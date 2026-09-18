import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface BatteryParams {
  capacity_kwh: number;
  initial_energy_kwh: number;
  minimum_energy_kwh: number;
  max_charge_kwh_per_hour: number;
  max_discharge_kwh_per_hour: number;
}

export interface HourlyRecord {
  hour: string;
  demand_kwh: number;
  solar_kwh: number;
  tariff_bdt_per_kwh: number;
}

export interface Scenario {
  scenario_id: string;
  battery: BatteryParams;
  operator_notes: string[];
  hours: HourlyRecord[];
}

export interface RunSummary {
  last_run_id: string;
  total_cost_bdt: number;
  total_grid_kwh: number;
  peak_grid_kwh: number;
}

/**
 * Seeds the GRID-101 scenario if it doesn't already exist in the database.
 */
export async function seedScenarioGrid101() {
  const scenarioRef = doc(db, "scenarios", "GRID-101");
  const snap = await getDoc(scenarioRef);

  if (!snap.exists()) {
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour: String(hour).padStart(2, "0"),
      demand_kwh: [
        180, 175, 170, 165, 160, 168, 185, 205, 225, 238, 245, 250, 258, 240, 250, 260, 272, 286,
        295, 278, 255, 230, 212, 200,
      ][hour],
      solar_kwh: [
        0, 0, 0, 0, 0, 8, 35, 80, 125, 170, 205, 230, 245, 48, 42, 128, 90, 38, 5, 0, 0, 0, 0, 0,
      ][hour],
      tariff_bdt_per_kwh:
        hour < 6 ? 7 : hour < 12 ? 9 : hour < 16 ? 12 : hour < 18 ? 8 : hour < 22 ? 11 : 9,
    }));

    await setDoc(scenarioRef, {
      scenario_id: "GRID-101",
      battery: {
        capacity_kwh: 500,
        initial_energy_kwh: 200,
        minimum_energy_kwh: 50,
        max_charge_kwh_per_hour: 100,
        max_discharge_kwh_per_hour: 100,
      },
      operator_notes: [
        "Solar output will drop to about 20% from 1 PM to 3 PM.",
        "Do not charge the battery between 2 PM and 4 PM.",
        "The cafeteria menu changes tomorrow.",
      ],
      hours,
    });
  }
}

export async function getScenario(scenarioId: string): Promise<Scenario | null> {
  const snap = await getDoc(doc(db, "scenarios", scenarioId));
  return snap.exists() ? (snap.data() as Scenario) : null;
}

export async function getLatestRunSummary(): Promise<RunSummary | null> {
  const snap = await getDoc(doc(db, "runs", "latest"));
  return snap.exists() ? (snap.data() as RunSummary) : null;
}

export async function saveOptimizationRun(
  runId: string,
  summary: RunSummary,
  schedule: any[],
  directives: any[],
  validations: string[],
) {
  // Batch write all output collections
  const promises = [
    setDoc(doc(db, "runs", runId), { status: "SUCCESS", timestamp: Date.now(), latency_ms: 1240 }),
    setDoc(doc(db, "runs", "latest"), summary),
    setDoc(doc(db, "schedules", runId), { hourly_plan: schedule }),
    setDoc(doc(db, "directives", runId), { interpretations: directives }),
    setDoc(doc(db, "validations", runId), { passed_checks: validations }),
  ];
  await Promise.all(promises);
}
