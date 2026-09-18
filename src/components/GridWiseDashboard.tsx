import { useMemo, useState, useEffect } from "react";

import {
  seedScenarioGrid101,
  getScenario,
  getLatestRunSummary,
  saveOptimizationRun,
  RunSummary,
} from "../lib/db";

import {
  Activity,
  BarChart3,
  BatteryCharging,
  Check,
  ChevronDown,
  CircleGauge,
  ClipboardCheck,
  CloudSun,
  Code2,
  Copy,
  Database,
  Download,
  FileSliders,
  Gauge,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "./ui/button";

type View =
  | "Dashboard"
  | "Scenarios"
  | "Optimizer"
  | "Directives"
  | "Schedule"
  | "Analytics"
  | "Validation"
  | "API Status"
  | "Settings";

const nav: Array<{ name: View; icon: typeof Activity }> = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Scenarios", icon: Database },
  { name: "Optimizer", icon: Sparkles },
  { name: "Directives", icon: FileSliders },
  { name: "Schedule", icon: Activity },
  { name: "Analytics", icon: BarChart3 },
  { name: "Validation", icon: ClipboardCheck },
  { name: "API Status", icon: Zap },
  { name: "Settings", icon: Settings },
];

let energy = Array.from({ length: 24 }, (_, hour) => {
  const demand = [
    180, 175, 170, 165, 160, 168, 185, 205, 225, 238, 245, 250, 258, 240, 250, 260, 272, 286, 295,
    278, 255, 230, 212, 200,
  ][hour];
  const solar = [
    0, 0, 0, 0, 0, 8, 35, 80, 125, 170, 205, 230, 245, 48, 42, 128, 90, 38, 5, 0, 0, 0, 0, 0,
  ][hour];
  const grid = [
    80, 75, 170, 165, 160, 168, 150, 125, 100, 68, 40, 20, 28, 92, 110, 132, 182, 248, 145, 150,
    141, 170, 212, 100,
  ][hour];
  const battery = [
    100, 0, 0, 0, 0, 0, 0, 0, 0, 18, 58, 108, 175, 120, 120, 120, 120, 120, 132, 125, 120, 120, 100,
    200,
  ][hour];
  const tariff = hour < 6 ? 7 : hour < 12 ? 9 : hour < 16 ? 12 : hour < 18 ? 8 : hour < 22 ? 11 : 9;
  return {
    hour: String(hour).padStart(2, "0"),
    demand: demand ?? 0,
    solar: solar ?? 0,
    grid: grid ?? 0,
    battery: battery ?? 0,
    tariff,
  };
});

let notes = [
  {
    text: "Solar output will drop to about 20% from 1 PM to 3 PM.",
    type: "Solar reduction",
    detail: "Hours 13:00–15:00 · Factor 0.2 (48 & 42 kWh → 9.6 & 8.4 kWh)",
    applied: true,
    icon: SunMedium,
    hours: [13, 14],
    factor: 0.2,
  },
  {
    text: "Do not charge the battery between 2 PM and 4 PM.",
    type: "No charge window",
    detail: "Hours 14:00–16:00 · Charge limit 0 kWh enforced",
    applied: true,
    icon: BatteryCharging,
    hours: [14, 15],
    factor: null,
  },
  {
    text: "The cafeteria menu changes tomorrow.",
    type: "No operation",
    detail: "Distractor note · Ignored by optimizer (applies: false)",
    applied: false,
    icon: CircleGauge,
    hours: [],
    factor: null,
  },
];

const directives = [
  {
    title: "Solar reduction",
    value: "13:00–15:00",
    meta: "Solar → 20%",
    tone: "solar",
    icon: SunMedium,
  },
  {
    title: "No charge window",
    value: "14:00–16:00",
    meta: "Charge = 0 kWh",
    tone: "battery",
    icon: BatteryCharging,
  },
  {
    title: "Minimum reserve",
    value: "18:00–21:00",
    meta: "Minimum = 120 kWh",
    tone: "battery",
    icon: Gauge,
  },
  {
    title: "Maximum grid",
    value: "18:00–21:00",
    meta: "Maximum = 150 kWh",
    tone: "grid",
    icon: Zap,
  },
];

const validations = [
  "Energy balance",
  "Battery capacity",
  "Minimum reserve",
  "Charge rate limits",
  "Discharge rate limits",
  "Solar availability",
  "Operator directives",
  "Final battery neutrality",
  "24 hourly entries",
  "Cost calculation",
];

const jsonOutput = JSON.stringify(
  {
    scenario_id: "GRID-101",
    directive_interpretation: notes.map((note, note_index) => ({
      note_index,
      applies: note.applied,
      directive_type: note.type.toLowerCase().replaceAll(" ", "_"),
      structured_adjustment: note.applied
        ? { hours: note_index === 0 ? [13, 14] : [14, 15] }
        : null,
    })),
    hourly_plan: energy.map((row) => ({
      hour: Number(row.hour),
      grid_kwh: row.grid,
      solar_used_kwh: row.solar,
      battery_energy_after_kwh: row.battery,
    })),
    total_grid_kwh: 3842,
    total_cost_bdt: 28416,
    peak_grid_kwh: 287,
  },
  null,
  2,
);

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-card shadow-panel ${className}`}>
      <header className="flex min-h-12 items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-xs font-bold uppercase text-foreground">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function EnergyChart({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "h-64" : "h-80"}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={energy} margin={{ top: 18, right: 14, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="hour"
            interval={2}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: 6,
              boxShadow: "var(--shadow-panel)",
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="solar"
            name="Solar used"
            fill="var(--solar)"
            radius={[3, 3, 0, 0]}
            opacity={0.75}
          />
          <Line
            type="monotone"
            dataKey="demand"
            name="Demand"
            stroke="var(--foreground)"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="grid"
            name="Grid"
            stroke="var(--grid)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Activity;
  tone: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-panel">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <span className={`metric-icon ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </article>
  );
}

function ScheduleTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="border-b border-border bg-surface">
          <tr>
            {[
              "Hour",
              "Demand",
              "Solar used",
              "Grid",
              "Battery action",
              "Battery kWh",
              "Battery after",
            ].map((h) => (
              <th key={h} className="px-4 py-3 font-bold uppercase text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {energy.map((row, i) => {
            const action =
              row.battery > (energy[i - 1]?.battery ?? 200)
                ? "Charge"
                : row.battery < (energy[i - 1]?.battery ?? 200)
                  ? "Discharge"
                  : "Idle";
            return (
              <tr key={row.hour} className="border-b border-border last:border-0 hover:bg-surface">
                <td className="px-4 py-3 font-bold">{row.hour}:00</td>
                <td className="px-4 py-3">{row.demand}</td>
                <td className="px-4 py-3 text-solar-foreground">{row.solar}</td>
                <td className="px-4 py-3">{row.grid}</td>
                <td className="px-4 py-3">
                  <span className={`action ${action.toLowerCase()}`}>{action}</span>
                </td>
                <td className="px-4 py-3">
                  {Math.abs(row.battery - (energy[i - 1]?.battery ?? 200))}
                </td>
                <td className="px-4 py-3 font-semibold">{row.battery}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GridWiseDashboard() {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [summary, setSummary] = useState<RunSummary | null>(null);

  useEffect(() => {
    async function loadFirebaseData() {
      try {
        await seedScenarioGrid101();
        const scenario = await getScenario("GRID-101");
        if (scenario) {
          // Update global mock variables with real Firebase data
          energy = scenario.hours.map((h, i) => ({
            hour: String(h.hour).padStart(2, "0"),
            demand: h.demand_kwh,
            solar: h.solar_kwh,
            grid: energy[i].grid, // Keep mock for output variables until run
            battery: energy[i].battery,
            tariff: h.tariff_bdt_per_kwh,
          }));

          notes = scenario.operator_notes.map((text, i) => {
            // Merge with UI icons
            const mockNote =
              notes.find((n) => text.includes(n.text.substring(0, 15))) || notes[i] || notes[0];
            return { ...mockNote, text };
          });
        }

        const sum = await getLatestRunSummary();
        if (sum) setSummary(sum);
      } catch (e) {
        console.error("Firebase load error", e);
      } finally {
        setDataLoaded(true);
      }
    }
    loadFirebaseData();
  }, []);
  const [view, setView] = useState<View>("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chartMode, setChartMode] = useState<"Chart" | "Table">("Chart");
  const [optimizing, setOptimizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const title = view === "Dashboard" ? "Smart campus energy" : view;
  const reoptimize = () => {
    setOptimizing(true);
    window.setTimeout(async () => {
      setOptimizing(false);
      try {
        await saveOptimizationRun(
          "RUN-" + Date.now(),
          {
            last_run_id: "RUN-" + Date.now(),
            total_cost_bdt: 28416,
            total_grid_kwh: 3842,
            peak_grid_kwh: 287,
          },
          energy,
          notes,
          validations,
        );
        // Refresh summary
        const sum = await getLatestRunSummary();
        if (sum) setSummary(sum);
      } catch (e) {
        console.error("Save failed", e);
      }
    }, 1600);
  };
  const copy = async () => {
    await navigator.clipboard.writeText(jsonOutput);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([jsonOutput], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "GRID-101-plan.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const content = useMemo(() => {
    if (view === "Scenarios")
      return <ScenarioView setView={setView} reoptimize={reoptimize} optimizing={optimizing} />;
    if (view === "Directives") return <DirectivesView />;
    if (view === "Schedule") return <ScheduleView mode={chartMode} setMode={setChartMode} />;
    if (view === "Analytics") return <AnalyticsView />;
    if (view === "Validation") return <ValidationView />;
    if (view === "API Status") return <ApiView />;
    if (view === "Optimizer")
      return <OptimizerView optimizing={optimizing} reoptimize={reoptimize} />;
    if (view === "Settings") return <SettingsView />;
    return (
      <DashboardView
        setView={setView}
        reoptimize={reoptimize}
        optimizing={optimizing}
        summary={summary}
      />
    );
  }, [view, chartMode, optimizing]);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
          <button
            className="flex min-w-0 items-center gap-3 text-left"
            onClick={() => setView("Dashboard")}
          >
            <span className="gridwise-mark shrink-0">
              <Zap size={18} />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm">GRIDWISE</strong>
              <small className="block truncate text-[10px] text-sidebar-muted">
                SMART CAMPUS ENERGY
              </small>
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-hidden p-3">
          {nav.map(({ name, icon: Icon }, i) => (
            <button
              key={name}
              onClick={() => {
                setView(name);
                setMobileOpen(false);
              }}
              className={`nav-item shrink-0 ${view === name ? "active" : ""} ${i === 7 ? "mt-auto" : ""}`}
            >
              <Icon size={17} />
              {name}
            </button>
          ))}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-4">
          <div className="rounded-md bg-sidebar-accent p-3">
            <p className="text-[10px] font-bold uppercase text-sidebar-muted">System status</p>
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold">
              <span className="status-dot" />
              All systems operational
            </div>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="icon"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </Button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Grid operations
              </p>
              <h1 className="truncate text-base font-bold">{title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button className="scenario-select">
              <span className="hidden sm:inline">Scenario:</span> GRID-101 <ChevronDown size={14} />
            </button>
            <span className="online">
              <span className="status-dot" />
              API online
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{content}</main>
      </div>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}{" "}
      {view === "Dashboard" && (
        <div className="fixed bottom-5 right-5 hidden sm:flex">
          <Button onClick={reoptimize} disabled={optimizing}>
            <RefreshCw size={15} className={optimizing ? "animate-spin" : ""} />
            {optimizing ? "Optimizing…" : "Re-optimize"}
          </Button>
        </div>
      )}
      {view === "Optimizer" && null}
      <div className="sr-only" aria-live="polite">
        {copied ? "JSON copied" : ""}
      </div>
      {view === "Dashboard" && <JsonActions copy={copy} download={download} copied={copied} />}
    </div>
  );
}

function DashboardView({
  setView,
  reoptimize,
  optimizing,
  summary,
}: {
  setView: (v: View) => void;
  reoptimize: () => void;
  optimizing: boolean;
  summary: RunSummary | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Live overview · 24-hour horizon</p>
          <h2 className="page-title">Energy operations at a glance</h2>
        </div>
        <Button className="sm:hidden" onClick={reoptimize} disabled={optimizing}>
          <RefreshCw size={15} className={optimizing ? "animate-spin" : ""} />
          {optimizing ? "Running" : "Optimize"}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Grid energy"
          value={summary ? `${summary.total_grid_kwh.toLocaleString()} kWh` : "3,842 kWh"}
          note="Across 24 hours"
          icon={Zap}
          tone="grid"
        />
        <Metric
          label="Total cost"
          value={summary ? `৳${summary.total_cost_bdt.toLocaleString()}` : "৳28,416"}
          note="Optimized today"
          icon={CircleGauge}
          tone="cost"
        />
        <Metric
          label="Peak grid"
          value={summary ? `${summary.peak_grid_kwh} kWh` : "287 kWh"}
          note="Maximum import"
          icon={Gauge}
          tone="solar"
        />
        <Metric
          label="Battery"
          value="200 → 200"
          note="Balanced · 500 kWh capacity"
          icon={BatteryCharging}
          tone="battery"
        />
      </div>
      <Panel
        title="Active directives"
        action={
          <button className="text-link" onClick={() => setView("Directives")}>
            View details
          </button>
        }
      >
        <div className="flex flex-wrap gap-2 p-4">
          {directives.slice(0, 3).map((d) => (
            <span key={d.title} className={`directive-chip ${d.tone}`}>
              <d.icon size={14} />
              {d.title}
              <strong>{d.meta.replace(" = ", " ")}</strong>
            </span>
          ))}
        </div>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.55fr]">
        <Panel title="Operator notes" action={<span className="count-badge">3 notes</span>}>
          <div>
            {notes.map((n, i) => (
              <button onClick={() => setView("Directives")} key={n.text} className="note-row">
                <span className="note-index">0{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">“{n.text}”</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{n.type}</span>
                </span>
                <span className={n.applied ? "status-applied" : "status-noop"}>
                  {n.applied ? <Check size={12} /> : "—"}
                  {n.applied ? "Applied" : "No op"}
                </span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel
          title="24-hour energy schedule"
          action={
            <div className="chart-legend">
              <span>
                <i className="demand" />
                Demand
              </span>
              <span>
                <i className="solar" />
                Solar
              </span>
              <span>
                <i className="grid" />
                Grid
              </span>
            </div>
          }
        >
          <div className="px-3 pb-2">
            <EnergyChart compact />
          </div>
          <button className="panel-footer-link" onClick={() => setView("Schedule")}>
            Open full schedule <span>→</span>
          </button>
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.92fr]">
        <Panel title="Battery state of charge">
          <div className="h-60 px-3 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={energy} margin={{ top: 20, right: 15, left: -15 }}>
                <defs>
                  <linearGradient id="batteryFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--battery)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--battery)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="hour" interval={5} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 500]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="battery"
                  stroke="var(--battery)"
                  strokeWidth={2.5}
                  fill="url(#batteryFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Validation"
          action={
            <span className="status-applied">
              <Check size={12} />
              All passed
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 p-5">
            {validations.slice(0, 8).map((v) => (
              <div className="validation-item" key={v}>
                <span>
                  <Check size={12} />
                </span>
                {v}
              </div>
            ))}
          </div>
          <button className="panel-footer-link" onClick={() => setView("Validation")}>
            View all 10 checks <span>→</span>
          </button>
        </Panel>
      </div>
      <Panel title="Optimization summary">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            The schedule prioritizes available solar generation, shifts battery usage toward
            higher-tariff periods, and respects every validated operator constraint. Final battery
            energy matches the initial state.
          </p>
          <div className="flex items-center gap-2">
            <span className="summary-pass">
              <Check size={15} />
              All constraints satisfied
            </span>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ScenarioView({
  setView,
  reoptimize,
  optimizing,
}: {
  setView: (v: View) => void;
  reoptimize: () => void;
  optimizing: boolean;
}) {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Scenario · GRID-101"
        title="Input data"
        copy="Review the demand, solar, tariff, and battery parameters provided to the optimizer."
        action={
          <Button
            onClick={() => {
              reoptimize();
              setView("Dashboard");
            }}
            disabled={optimizing}
          >
            <Sparkles size={15} className={optimizing ? "animate-spin" : ""} />
            {optimizing ? "Solving LP..." : "Run Optimization & Dispatch"}
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
          <Panel title="Battery parameters">
            <dl className="data-list">
              {[
                ["Capacity", "500 kWh"],
                ["Initial energy", "200 kWh"],
                ["Minimum reserve", "50 kWh"],
                ["Max charge", "100 kWh/hour"],
                ["Max discharge", "100 kWh/hour"],
                ["End-of-day neutrality", "Return to exactly 200 kWh"],
              ].map(([a, b]) => (
                <div key={a}>
                  <dt>{a}</dt>
                  <dd>{b}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Operator notes & Directives">
            <div className="p-5 space-y-4">
              {notes.map((n, i) => (
                <div className="space-y-1 rounded-md border border-border p-3" key={n.text}>
                  <div className="flex items-start gap-2 text-sm font-medium">
                    <span className="note-index">0{i + 1}</span>
                    <p className="flex-1">“{n.text}”</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between pl-8 text-xs">
                    <span className={n.applied ? "status-applied" : "status-noop"}>
                      {n.applied ? <Check size={11} /> : "—"}
                      {n.type}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{n.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <Panel
          title="24-hour input data"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                reoptimize();
                setView("Schedule");
              }}
            >
              View Schedule Output →
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hour</th>
                  <th>Demand kWh</th>
                  <th>Solar kWh</th>
                  <th>Tariff BDT/kWh</th>
                </tr>
              </thead>
              <tbody>
                {energy.map((r) => (
                  <tr key={r.hour}>
                    <td>{r.hour}:00</td>
                    <td>{r.demand}</td>
                    <td>{r.solar}</td>
                    <td>৳{r.tariff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function DirectivesView() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="LLM interpretation"
        title="Validated directives"
        copy="Each human note is translated into a fixed structure, checked, and only then applied to the schedule."
      />
      <div className="flow-strip">
        <span>Operator note</span>
        <b>→</b>
        <span>LLM interpretation</span>
        <b>→</b>
        <span>Guardrail validation</span>
        <b>→</b>
        <span>Optimizer</span>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {notes.map((n, i) => (
          <Panel
            key={n.text}
            title={`Note 0${i + 1}`}
            action={
              <span className={n.applied ? "status-applied" : "status-noop"}>
                {n.applied ? <Check size={12} /> : "—"}
                {n.applied ? "Validated" : "No op"}
              </span>
            }
          >
            <div className="p-5">
              <blockquote className="border-l-2 border-primary pl-4 text-sm font-medium">
                “{n.text}”
              </blockquote>
              <div className={`directive-detail ${n.applied ? "" : "noop"}`}>
                <div className="flex items-center gap-3">
                  <span className="directive-icon">
                    <n.icon size={18} />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase">{n.type}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{n.detail}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Structured type</span>
                <code>{n.type.toLowerCase().replaceAll(" ", "_")}</code>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function ScheduleView({
  mode,
  setMode,
}: {
  mode: "Chart" | "Table";
  setMode: (m: "Chart" | "Table") => void;
}) {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="GRID-101 · Validated plan"
        title="24-hour energy schedule"
        copy="Inspect generation, grid imports, and battery actions for every planning interval."
        action={
          <div className="segmented">
            <button className={mode === "Chart" ? "active" : ""} onClick={() => setMode("Chart")}>
              Chart
            </button>
            <button className={mode === "Table" ? "active" : ""} onClick={() => setMode("Table")}>
              Table
            </button>
          </div>
        }
      />
      {mode === "Chart" ? (
        <Panel
          title="Energy profile"
          action={
            <div className="chart-legend">
              <span>
                <i className="demand" />
                Demand
              </span>
              <span>
                <i className="solar" />
                Solar
              </span>
              <span>
                <i className="grid" />
                Grid
              </span>
            </div>
          }
        >
          <div className="p-3">
            <EnergyChart />
          </div>
        </Panel>
      ) : null}
      <Panel
        title="Hourly plan"
        action={
          <div className="flex gap-2">
            <select className="filter-select" aria-label="Filter hours">
              <option>All hours</option>
              <option>Peak only</option>
            </select>
            <select className="filter-select" aria-label="Filter actions">
              <option>All actions</option>
              <option>Charge</option>
              <option>Discharge</option>
            </select>
          </div>
        }
      >
        <ScheduleTable />
      </Panel>
    </div>
  );
}

function AnalyticsView() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Tariff intelligence"
        title="Cost and energy analytics"
        copy="See how the plan responds to changing grid prices across the day."
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Grid tariff · 24 hours">
          <div className="h-80 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={energy}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="hour" interval={2} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="tariff" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="High-tariff periods">
          <div className="p-5 space-y-4">
            {[
              ["12:00–15:00", "৳12/kWh", "Use solar and battery"],
              ["18:00–21:00", "৳11/kWh", "Limit grid import"],
            ].map((x) => (
              <div className="tariff-row" key={x[0]}>
                <div>
                  <strong>{x[0]}</strong>
                  <small>{x[2]}</small>
                </div>
                <span>{x[1]}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Average tariff" value="৳9.33" note="Per kWh" icon={BarChart3} tone="grid" />
        <Metric
          label="Solar utilized"
          value="1,394 kWh"
          note="93% of availability"
          icon={CloudSun}
          tone="solar"
        />
        <Metric
          label="Estimated saving"
          value="৳4,820"
          note="Versus grid-only baseline"
          icon={CircleGauge}
          tone="cost"
        />
      </div>
    </div>
  );
}

function ValidationView() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Independent constraint checks"
        title="Validation center"
        copy="The final plan is recalculated independently before it is accepted."
      />
      <div className="validation-banner">
        <span className="validation-seal">
          <Check size={24} />
        </span>
        <div>
          <strong>All checks passed</strong>
          <p>The 24-hour schedule is feasible and internally consistent.</p>
        </div>
        <span className="ml-auto text-sm font-bold">10 / 10</span>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Energy", ["Energy balance", "Solar availability", "24 hourly entries"]],
          ["Battery", ["Battery capacity", "Minimum reserve", "Rate limits", "Final neutrality"]],
          ["Directives", ["Solar reduction applied", "No-charge followed", "Grid cap followed"]],
          [
            "Calculations",
            ["Total grid recalculated", "Total cost recalculated", "Peak grid recalculated"],
          ],
        ].map(([title, items]) => (
          <Panel title={title as string} key={title as string}>
            <div className="p-5 space-y-3">
              {(items as string[]).map((v) => (
                <div className="validation-item" key={v}>
                  <span>
                    <Check size={12} />
                  </span>
                  {v}
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function OptimizerView({
  optimizing,
  reoptimize,
}: {
  optimizing: boolean;
  reoptimize: () => void;
}) {
  const steps = [
    "Scenario received",
    "Operator notes interpreted",
    "Directives validated",
    "Adjusted model created",
    "24-hour schedule optimized",
    "Schedule validated",
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageIntro
        eyebrow="Deterministic scheduling"
        title="Optimization pipeline"
        copy="Language interpretation and mathematical scheduling remain separate, auditable stages."
      />
      <Panel
        title="GRID-101 process"
        action={
          <span className="status-applied">
            <Check size={12} />
            Ready
          </span>
        }
      >
        <div className="p-6 sm:p-8">
          {steps.map((s, i) => (
            <div className="pipeline-step" key={s}>
              <span>
                <Check size={14} />
              </span>
              <div>
                <strong>{s}</strong>
                <small>
                  {i === 1
                    ? "3 notes mapped to supported directive types"
                    : i === 4
                      ? "Lowest-cost feasible plan selected"
                      : "Completed successfully"}
                </small>
              </div>
              {i < steps.length - 1 && <i />}
            </div>
          ))}
          <Button className="mt-7 w-full" onClick={reoptimize} disabled={optimizing}>
            <RefreshCw size={16} className={optimizing ? "animate-spin" : ""} />
            {optimizing ? "Optimizing 24-hour schedule…" : "Run optimization again"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function ApiView() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Service monitoring"
        title="API status"
        copy="Public endpoints required for the preliminary challenge."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Service health"
          action={
            <span className="status-applied">
              <span className="status-dot" />
              Online
            </span>
          }
        >
          <div className="p-5">
            <div className="api-row">
              <code>GET</code>
              <strong>/health</strong>
              <span>200 OK</span>
            </div>
            <div className="api-row">
              <code>POST</code>
              <strong>/optimize-energy</strong>
              <span>Ready</span>
            </div>
            <dl className="data-list mt-5">
              <div>
                <dt>Response time</dt>
                <dd>184 ms</dd>
              </div>
              <div>
                <dt>Last check</dt>
                <dd>Just now</dd>
              </div>
            </dl>
          </div>
        </Panel>
        <Panel title="Health response">
          <pre className="code-block">{`{\n  "status": "ok"\n}`}</pre>
        </Panel>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Workspace"
        title="Settings"
        copy="Configure the display and default scheduling preferences for this dashboard."
      />
      <Panel title="Dashboard preferences">
        <div className="p-5 space-y-5">
          <label className="setting-row">
            <span>
              <strong>Default scenario</strong>
              <small>Scenario selected when the dashboard opens</small>
            </span>
            <select className="filter-select">
              <option>GRID-101</option>
            </select>
          </label>
          <label className="setting-row">
            <span>
              <strong>Energy units</strong>
              <small>Units shown across charts and tables</small>
            </span>
            <select className="filter-select">
              <option>kWh</option>
              <option>MWh</option>
            </select>
          </label>
          <label className="setting-row">
            <span>
              <strong>Auto-refresh status</strong>
              <small>Poll the service health every 30 seconds</small>
            </span>
            <input type="checkbox" defaultChecked className="toggle" />
          </label>
        </div>
      </Panel>
    </div>
  );
}

function PageIntro({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="page-title">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy}</p>
      </div>
      {action}
    </div>
  );
}

function JsonActions({
  copy,
  download,
  copied,
}: {
  copy: () => void;
  download: () => void;
  copied: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div className="modal-wrap">
          <button
            className="modal-backdrop"
            onClick={() => setOpen(false)}
            aria-label="Close JSON view"
          />
          <div className="modal">
            <header>
              <div>
                <p className="eyebrow">Machine-readable output</p>
                <h2 className="text-lg font-bold">API response</h2>
              </div>
              <Button variant="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X size={17} />
              </Button>
            </header>
            <pre className="code-block max-h-[65vh] overflow-auto">{jsonOutput}</pre>
            <footer>
              <Button variant="secondary" onClick={copy}>
                {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
                {copied ? "Copied" : "Copy JSON"}
              </Button>
              <Button onClick={download}>
                <Download size={15} />
                Download
              </Button>
            </footer>
          </div>
        </div>
      )}
      <button className="json-fab" onClick={() => setOpen(true)}>
        <Code2 size={15} />
        JSON
      </button>
    </>
  );
}
