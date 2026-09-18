"""
GRID LP Solver – FastAPI microservice for BUP microgrid energy dispatch optimization.

Endpoint: POST /solve-lp
Objective: min Σ (grid_kwh[h] × tariff[h])
Subject to energy-balance, battery SoC, rate limits, end-of-day neutrality,
and operator directives (solar reduction, no-charge, no-discharge, max-grid, min-reserve).
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from scipy.optimize import linprog
import os
import json
from google import genai

app = FastAPI(title="GRID LP Solver", version="1.0.0")


# ── Pydantic models ─────────────────────────────────────────────────────────

class BatteryLimits(BaseModel):
    capacity_kwh: float
    initial_energy_kwh: float
    minimum_energy_kwh: float
    max_charge_rate_kw: float
    max_discharge_rate_kw: float


class HourlyRecord(BaseModel):
    hour: int
    demand_kwh: float
    solar_potential_kwh: float
    tariff_bdt_per_kwh: float


class ValidatedDirective(BaseModel):
    original_note: str
    directive_type: str
    hours: List[int] = []
    reduction_factor: Optional[float] = 0.0
    min_reserve_kwh: Optional[float] = 0.0
    max_grid_kwh: Optional[float] = 0.0
    reasoning: Optional[str] = ""


class SolveRequest(BaseModel):
    scenario_id: str
    battery_limits: BatteryLimits
    hourly_records: List[HourlyRecord]
    validated_directives: List[ValidatedDirective]


class HourlySchedule(BaseModel):
    hour: int
    demand_kwh: float
    solar_used_kwh: float
    grid_kwh: float
    battery_charge_kwh: float
    battery_discharge_kwh: float
    battery_soc_kwh: float


class SolveResponse(BaseModel):
    scenario_id: str
    schedule: List[HourlySchedule]
    total_grid_cost_bdt: float
    total_grid_energy_kwh: float
    peak_grid_import_kwh: float


class OptimizeEnergyBattery(BaseModel):
    capacity_kwh: float
    initial_energy_kwh: float
    minimum_energy_kwh: float
    max_charge_kwh_per_hour: float
    max_discharge_kwh_per_hour: float

class OptimizeEnergyHour(BaseModel):
    hour: str
    demand_kwh: float
    solar_kwh: float
    tariff_bdt_per_kwh: float

class OptimizeEnergyRequest(BaseModel):
    scenario_id: str
    battery: OptimizeEnergyBattery
    operator_notes: List[str]
    hours: List[OptimizeEnergyHour]

class StructuredAdjustment(BaseModel):
    hours: List[int]
    factor: Optional[float] = None
    limit: Optional[float] = None

class DirectiveInterpretation(BaseModel):
    note_index: int
    applies: bool
    directive_type: str
    structured_adjustment: Optional[StructuredAdjustment] = None

class OutputHourlyPlan(BaseModel):
    hour: int
    grid_kwh: float
    solar_used_kwh: float
    battery_energy_after_kwh: float

class OptimizeEnergyResponse(BaseModel):
    scenario_id: str
    directive_interpretation: List[DirectiveInterpretation]
    hourly_plan: List[OutputHourlyPlan]
    total_grid_kwh: float
    total_cost_bdt: float
    peak_grid_kwh: float


# ── Solver ───────────────────────────────────────────────────────────────────

@app.post("/solve-lp", response_model=SolveResponse)
def solve_lp(req: SolveRequest):
    """
    Solve a 24-hour linear dispatch programme.

    Decision variables per hour h (4 × 24 = 96 total):
        x[4h + 0] = grid_kwh[h]
        x[4h + 1] = solar_used_kwh[h]
        x[4h + 2] = battery_charge_kwh[h]
        x[4h + 3] = battery_discharge_kwh[h]
    """
    bat = req.battery_limits
    hours = sorted(req.hourly_records, key=lambda r: r.hour)

    if len(hours) != 24:
        raise HTTPException(status_code=422, detail="Exactly 24 hourly records required")

    N = 24
    V = 4  # variables per hour
    n_vars = V * N

    # ── Pre-compute per-hour directive caps ──────────────────────────────
    solar_reduction = [0.0] * N  # fraction reduction
    no_charge = [False] * N
    no_discharge = [False] * N
    max_grid_cap = [None] * N  # None means uncapped
    min_reserve = [bat.minimum_energy_kwh] * N

    for d in req.validated_directives:
        if d.directive_type == "solar_reduction":
            for h in d.hours:
                if 0 <= h < N:
                    solar_reduction[h] = max(solar_reduction[h], d.reduction_factor or 0.0)
        elif d.directive_type == "no_charge_window":
            for h in d.hours:
                if 0 <= h < N:
                    no_charge[h] = True
        elif d.directive_type == "no_discharge_window":
            for h in d.hours:
                if 0 <= h < N:
                    no_discharge[h] = True
        elif d.directive_type == "max_grid_window":
            for h in d.hours:
                if 0 <= h < N:
                    cap = d.max_grid_kwh if d.max_grid_kwh is not None else None
                    if cap is not None:
                        if max_grid_cap[h] is None:
                            max_grid_cap[h] = cap
                        else:
                            max_grid_cap[h] = min(max_grid_cap[h], cap)
        elif d.directive_type == "minimum_battery_reserve":
            for h in d.hours:
                if 0 <= h < N:
                    min_reserve[h] = max(min_reserve[h], d.min_reserve_kwh or bat.minimum_energy_kwh)

    # ── Objective: minimise grid cost ────────────────────────────────────
    c = np.zeros(n_vars)
    for h in range(N):
        c[V * h + 0] = hours[h].tariff_bdt_per_kwh  # grid_kwh coefficient

    # ── Bounds on decision variables ─────────────────────────────────────
    bounds = []
    for h in range(N):
        # grid_kwh >= 0
        grid_ub = max_grid_cap[h] if max_grid_cap[h] is not None else None
        bounds.append((0.0, grid_ub))

        # solar_used in [0, effective_solar]
        # solar_reduction[h] can be passed as remaining ratio (e.g. 0.2) or reduction (e.g. 0.8)
        if solar_reduction[h] > 0.0:
            rem_ratio = solar_reduction[h] if solar_reduction[h] <= 0.5 else (1.0 - solar_reduction[h])
            effective_solar = hours[h].solar_potential_kwh * rem_ratio
        else:
            effective_solar = hours[h].solar_potential_kwh
        bounds.append((0.0, effective_solar))

        # battery_charge
        chg_ub = 0.0 if no_charge[h] else bat.max_charge_rate_kw
        bounds.append((0.0, chg_ub))

        # battery_discharge
        dis_ub = 0.0 if no_discharge[h] else bat.max_discharge_rate_kw
        bounds.append((0.0, dis_ub))

    # ── Equality constraints ─────────────────────────────────────────────
    # 1. Energy balance per hour:
    #    grid[h] + solar[h] + discharge[h] = demand[h] + charge[h]
    #    => grid[h] + solar[h] - charge[h] + discharge[h] = demand[h]
    A_eq = np.zeros((N, n_vars))
    b_eq = np.zeros(N)
    for h in range(N):
        A_eq[h, V * h + 0] = 1.0   # grid
        A_eq[h, V * h + 1] = 1.0   # solar
        A_eq[h, V * h + 2] = -1.0  # charge (consumed)
        A_eq[h, V * h + 3] = 1.0   # discharge (supplied)
        b_eq[h] = hours[h].demand_kwh

    # 2. End-of-day SoC neutrality:
    #    SoC[23] = initial  =>  Σ(charge[h] - discharge[h]) = 0
    neutrality_row = np.zeros(n_vars)
    for h in range(N):
        neutrality_row[V * h + 2] = 1.0   # charge adds
        neutrality_row[V * h + 3] = -1.0  # discharge subtracts
    A_eq = np.vstack([A_eq, neutrality_row.reshape(1, -1)])
    b_eq = np.append(b_eq, 0.0)

    # ── Inequality constraints ───────────────────────────────────────────
    # SoC bounds for each hour:
    #   SoC[h] = initial + Σ_{k=0..h}(charge[k] - discharge[k])
    #   minimum_energy <= SoC[h] <= capacity
    #
    # Upper bound:  Σ_{k=0..h}(charge[k] - discharge[k]) <= capacity - initial
    # Lower bound: -Σ_{k=0..h}(charge[k] - discharge[k]) <= initial - minimum_energy
    #
    # With per-hour min_reserve directives:
    # Lower bound: -Σ_{k=0..h}(charge[k] - discharge[k]) <= initial - min_reserve[h]
    A_ub_rows = []
    b_ub_vals = []

    for h in range(N):
        # SoC upper bound
        row_upper = np.zeros(n_vars)
        for k in range(h + 1):
            row_upper[V * k + 2] = 1.0    # charge
            row_upper[V * k + 3] = -1.0   # discharge
        A_ub_rows.append(row_upper)
        b_ub_vals.append(bat.capacity_kwh - bat.initial_energy_kwh)

        # SoC lower bound (with directive-aware min_reserve)
        row_lower = np.zeros(n_vars)
        for k in range(h + 1):
            row_lower[V * k + 2] = -1.0
            row_lower[V * k + 3] = 1.0
        A_ub_rows.append(row_lower)
        b_ub_vals.append(bat.initial_energy_kwh - min_reserve[h])

    A_ub = np.array(A_ub_rows) if A_ub_rows else None
    b_ub = np.array(b_ub_vals) if b_ub_vals else None

    # ── Solve ────────────────────────────────────────────────────────────
    result = linprog(
        c, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq,
        bounds=bounds, method="highs"
    )

    if not result.success:
        raise HTTPException(
            status_code=422,
            detail=f"LP solver failed: {result.message}"
        )

    x = result.x

    # ── Build schedule ───────────────────────────────────────────────────
    schedule = []
    current_soc = bat.initial_energy_kwh
    total_grid_cost = 0.0
    total_grid_energy = 0.0
    peak_grid = 0.0

    for h in range(N):
        grid_kwh = max(0.0, x[V * h + 0])
        solar_used = max(0.0, x[V * h + 1])
        batt_chg = max(0.0, x[V * h + 2])
        batt_dis = max(0.0, x[V * h + 3])
        current_soc += batt_chg - batt_dis

        total_grid_cost += grid_kwh * hours[h].tariff_bdt_per_kwh
        total_grid_energy += grid_kwh
        peak_grid = max(peak_grid, grid_kwh)

        schedule.append(HourlySchedule(
            hour=h,
            demand_kwh=round(hours[h].demand_kwh, 4),
            solar_used_kwh=round(solar_used, 4),
            grid_kwh=round(grid_kwh, 4),
            battery_charge_kwh=round(batt_chg, 4),
            battery_discharge_kwh=round(batt_dis, 4),
            battery_soc_kwh=round(current_soc, 4),
        ))

    return SolveResponse(
        scenario_id=req.scenario_id,
        schedule=schedule,
        total_grid_cost_bdt=round(total_grid_cost, 2),
        total_grid_energy_kwh=round(total_grid_energy, 2),
        peak_grid_import_kwh=round(peak_grid, 2),
    )


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/optimize-energy", response_model=OptimizeEnergyResponse)
def optimize_energy(req: OptimizeEnergyRequest):
    # Call Gemini
    api_key = os.environ.get("GEMINI_API_KEY", "AIzaSyAH8hOUK6TQhkFJz8DCp0nIvRdaNScVtOc")
    client = genai.Client(api_key=api_key)
    
    prompt = f"""
    You are an energy grid operator AI. Extract constraints from the following operator notes.
    The response must be a JSON array with exactly {len(req.operator_notes)} items, in the exact same order as the notes (note_index 0 to {len(req.operator_notes)-1}).
    
    Valid directive_type values:
    "solar_reduction", "no_charge_window", "no_discharge_window", "max_grid_window", "minimum_battery_reserve", "distractor"

    Rules:
    - Time ranges must be mapped to specific hours 0-23. "1 PM to 3 PM" means hours [13, 14]. "2 PM to 4 PM" means hours [14, 15].
    - "solar_reduction": structured_adjustment must have "factor" which is the remaining fraction (e.g. 20% means 0.2).
    - "no_charge_window": no extra numeric fields in structured_adjustment, just hours.
    - If a note is irrelevant (e.g. "cafeteria menu changes"), applies = false, directive_type = "distractor", structured_adjustment = null.
    
    Notes:
    {json.dumps(req.operator_notes)}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=list[DirectiveInterpretation],
                temperature=0.0
            ),
        )
        interpretations = [DirectiveInterpretation(**item) for item in json.loads(response.text)]
    except Exception as e:
        print("Failed to parse Gemini output:", e)
        raise HTTPException(status_code=500, detail="LLM parsing failed")
        
    # Map interpretations to ValidatedDirectives
    validated_directives = []
    for interp in interpretations:
        if not interp.applies:
            continue
        adj = interp.structured_adjustment
        if adj is None:
            adj = StructuredAdjustment(hours=[])
        
        vd = ValidatedDirective(
            original_note="",
            directive_type=interp.directive_type,
            hours=adj.hours,
            reduction_factor=adj.factor if adj.factor is not None else 0.0,
            min_reserve_kwh=adj.limit if adj.limit is not None else 0.0,
            max_grid_kwh=adj.limit if adj.limit is not None else 0.0,
        )
        validated_directives.append(vd)
        
    # Map hours
    hourly_records = []
    for h in req.hours:
        hourly_records.append(HourlyRecord(
            hour=int(h.hour),
            demand_kwh=h.demand_kwh,
            solar_potential_kwh=h.solar_kwh,
            tariff_bdt_per_kwh=h.tariff_bdt_per_kwh
        ))
        
    # Map battery
    battery_limits = BatteryLimits(
        capacity_kwh=req.battery.capacity_kwh,
        initial_energy_kwh=req.battery.initial_energy_kwh,
        minimum_energy_kwh=req.battery.minimum_energy_kwh,
        max_charge_rate_kw=req.battery.max_charge_kwh_per_hour,
        max_discharge_rate_kw=req.battery.max_discharge_kwh_per_hour
    )
    
    # Call internal LP solver
    solve_req = SolveRequest(
        scenario_id=req.scenario_id,
        battery_limits=battery_limits,
        hourly_records=hourly_records,
        validated_directives=validated_directives
    )
    
    solve_res = solve_lp(solve_req)
    
    # Map output
    hourly_plan = []
    for sched in solve_res.schedule:
        hourly_plan.append(OutputHourlyPlan(
            hour=sched.hour,
            grid_kwh=sched.grid_kwh,
            solar_used_kwh=sched.solar_used_kwh,
            battery_energy_after_kwh=sched.battery_soc_kwh
        ))
        
    return OptimizeEnergyResponse(
        scenario_id=solve_res.scenario_id,
        directive_interpretation=interpretations,
        hourly_plan=hourly_plan,
        total_grid_kwh=solve_res.total_grid_energy_kwh,
        total_cost_bdt=solve_res.total_grid_cost_bdt,
        peak_grid_kwh=solve_res.peak_grid_import_kwh
    )
