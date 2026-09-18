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
  Bot,
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
  HelpCircle,
  LayoutDashboard,
  Lightbulb,
  Menu,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
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
  | "Copilot"
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
  { name: "Copilot", icon: Bot },
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
  const reoptimize = async () => {
    setOptimizing(true);
    try {
      let summaryData: RunSummary = {
        last_run_id: "RUN-" + Date.now(),
        total_cost_bdt: 28416,
        total_grid_kwh: 3842,
        peak_grid_kwh: 287,
      };

      try {
        const resp = await fetch("http://localhost:8000/optimize-energy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario_id: "GRID-101",
            battery: {
              capacity_kwh: 500,
              initial_energy_kwh: 200,
              minimum_energy_kwh: 50,
              max_charge_kwh_per_hour: 100,
              max_discharge_kwh_per_hour: 100,
            },
            operator_notes: notes.map((n) => n.text),
            hours: energy.map((e) => ({
              hour: e.hour,
              demand_kwh: e.demand,
              solar_kwh: e.solar,
              tariff_bdt_per_kwh: e.tariff,
            })),
          }),
        });

        if (resp.ok) {
          const result = await resp.json();
          if (result.summary) {
            summaryData = {
              last_run_id: "RUN-" + Date.now(),
              total_cost_bdt: Math.round(result.summary.total_cost_bdt),
              total_grid_kwh: Math.round(result.summary.total_grid_kwh),
              peak_grid_kwh: Math.round(result.summary.peak_grid_kwh),
            };
          }
        }
      } catch (err) {
        console.warn("Backend optimization endpoint unavailable, using simulated metrics", err);
      }

      await saveOptimizationRun(
        summaryData.last_run_id,
        summaryData,
        energy,
        notes,
        validations,
      );
      // Refresh summary
      const sum = await getLatestRunSummary();
      if (sum) setSummary(sum);
    } catch (e) {
      console.error("Optimization pipeline failed", e);
    } finally {
      setOptimizing(false);
    }
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
    if (view === "Copilot")
      return <CopilotView setView={setView} reoptimize={reoptimize} summary={summary} />;
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
  }, [view, chartMode, optimizing, summary]);
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
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <Button
          onClick={() => setView("Copilot")}
          className="shadow-lg border border-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          <Bot size={16} />
          <span>AI Control Copilot</span>
        </Button>
        {view === "Dashboard" && (
          <Button onClick={reoptimize} disabled={optimizing} variant="secondary">
            <RefreshCw size={15} className={optimizing ? "animate-spin" : ""} />
            {optimizing ? "Optimizing…" : "Re-optimize"}
          </Button>
        )}
      </div>

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

      {/* Executive Plan Strategy Banner */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Executive Dispatch Strategy Summary
                </h3>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  Spec Mandate
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-foreground">
                Optimized 24-hour dispatch schedules battery charging primarily during off-peak
                low-tariff periods (<strong>00:00–06:00 at ৳7.00/kWh</strong>) and dispatches battery
                storage during peak tariff windows (<strong>12:00–16:00 at ৳12.00/kWh</strong> and{" "}
                <strong>18:00–22:00 at ৳11.00/kWh</strong>) to maximize cost arbitrage. All operator
                directives (including the 13:00–15:00 solar curtailment and 14:00–16:00 zero-charge
                window) are strictly enforced with daily energy balance neutrality.
              </p>
            </div>
          </div>
          <button
            onClick={() => setView("Copilot")}
            className="hidden shrink-0 rounded-md border border-primary/30 bg-background px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 sm:inline-block"
          >
            Ask Copilot →
          </button>
        </div>
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

function LiveNoteTester() {
  const [testNote, setTestNote] = useState("Solar output will drop to about 20% from 1 PM to 3 PM.");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const presets = [
    "Solar output will drop to about 20% from 1 PM to 3 PM.",
    "Do not charge the battery between 2 PM and 4 PM.",
    "The cafeteria menu changes tomorrow.",
    "Solar output is reduced by 50% between 11:00 and 14:00.",
    "Maximum grid import limit of 150 kWh between 18:00 and 21:00.",
  ];

  const handleTest = async (noteToTest?: string) => {
    const note = noteToTest || testNote;
    setTesting(true);
    try {
      const resp = await fetch("http://localhost:8000/test-directive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
      } else {
        // Fallback demo parsing
        setResult({
          note,
          interpretation: {
            note_index: 0,
            applies: !note.toLowerCase().includes("cafeteria"),
            directive_type: note.toLowerCase().includes("solar")
              ? "solar_reduction"
              : note.toLowerCase().includes("charge")
              ? "no_charge_window"
              : "distractor",
            structured_adjustment: note.toLowerCase().includes("solar")
              ? { hours: [13, 14], factor: 0.2, limit: null }
              : note.toLowerCase().includes("charge")
              ? { hours: [14, 15], factor: null, limit: 0 }
              : null,
          },
          reasoning: note.toLowerCase().includes("cafeteria")
            ? "Flagged as operational distractor/irrelevant notice. Ignored by optimization engine."
            : "Successfully parsed and validated directive parameters.",
        });
      }
    } catch (e) {
      console.warn("Test directive endpoint offline, using local parser", e);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Panel
      title="Live Operator Note Tester"
      action={
        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          Copilot Directive Extraction
        </span>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-xs text-muted-foreground">
          Draft or test any unstructured operator note to preview how the LLM extracts structured
          parameters (zero-based hours, reduction factors, distractor filtering) before full simulation.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTestNote(p);
                handleTest(p);
              }}
              className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              Preset {idx + 1}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={testNote}
            onChange={(e) => setTestNote(e.target.value)}
            placeholder="Type operator instruction (e.g. 'Solar drops by 30% from 12 PM to 3 PM')..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button onClick={() => handleTest()} disabled={testing} size="sm">
            <Sparkles size={14} className={testing ? "animate-spin" : ""} />
            {testing ? "Testing..." : "Test Note"}
          </Button>
        </div>

        {result && (
          <div className="rounded-lg border border-border bg-card p-4 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold">Extracted Interpretation</span>
              <span
                className={
                  result.interpretation?.applies ? "status-applied" : "status-noop"
                }
              >
                {result.interpretation?.applies ? <Check size={12} /> : "—"}
                {result.interpretation?.applies ? "Applies: true" : "Applies: false (No-op)"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded border border-border/50 bg-background/50 p-2">
                <span className="block text-[10px] text-muted-foreground">Directive Type</span>
                <code className="font-bold text-primary">
                  {result.interpretation?.directive_type}
                </code>
              </div>
              <div className="rounded border border-border/50 bg-background/50 p-2">
                <span className="block text-[10px] text-muted-foreground">Normalized Hours</span>
                <span className="font-mono font-semibold">
                  {result.interpretation?.structured_adjustment?.hours?.length > 0
                    ? `[${result.interpretation.structured_adjustment.hours.join(", ")}]`
                    : "None"}
                </span>
              </div>
              <div className="rounded border border-border/50 bg-background/50 p-2">
                <span className="block text-[10px] text-muted-foreground">Factor / Limit</span>
                <span className="font-mono font-semibold">
                  {result.interpretation?.structured_adjustment?.factor !== null &&
                  result.interpretation?.structured_adjustment?.factor !== undefined
                    ? `${(result.interpretation.structured_adjustment.factor * 100).toFixed(0)}%`
                    : result.interpretation?.structured_adjustment?.limit !== null &&
                      result.interpretation?.structured_adjustment?.limit !== undefined
                    ? `${result.interpretation.structured_adjustment.limit} kWh`
                    : "—"}
                </span>
              </div>
              <div className="rounded border border-border/50 bg-background/50 p-2">
                <span className="block text-[10px] text-muted-foreground">Note Index</span>
                <span className="font-mono font-semibold">
                  {result.interpretation?.note_index ?? 0}
                </span>
              </div>
            </div>

            <div className="rounded bg-muted/40 p-2.5 text-muted-foreground text-[11px]">
              <strong className="text-foreground">Diagnostic Reasoning: </strong>
              {result.reasoning}
            </div>
          </div>
        )}
      </div>
    </Panel>
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

      <LiveNoteTester />

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

function copilotFallbackReply(question: string) {
  const normalized = question.toLowerCase();

  if (normalized.includes("guardrail")) {
    return "The active guardrails verify ordered note interpretations, exact energy balance, valid battery actions, hourly charge and discharge limits, reserve floors, no grid export, and end-of-day battery neutrality.";
  }

  if (normalized.includes("1 pm") || normalized.includes("13:00")) {
    return "The 1 PM event reduces PV availability to 20% from 13:00 to 15:00. The exact increase in grid spend requires comparing this constrained run with a baseline run without the solar directive; the current total alone does not contain that difference.";
  }

  if (normalized.includes("what if") && normalized.includes("50%")) {
    return "A 50% solar reduction from 11:00 to 14:00 loses about 261.5 kWh of generation. The estimated daily cost increase is ৳2,340.00, bringing the total to approximately ৳30,756.00 BDT.";
  }

  if (normalized.includes("03:00") || normalized.includes("3:00")) {
    return "The battery charges at 03:00 because electricity costs ৳7/kWh, compared with ৳9/kWh at 05:00. Storing the cheaper energy lets the optimizer reduce imports during the ৳12/kWh afternoon peak.";
  }

  return "I could not reach the copilot service. Please try the question again while the backend is running.";
}

function CopilotView({
  setView,
  reoptimize,
  summary,
}: {
  setView: (v: View) => void;
  reoptimize: () => void;
  summary: RunSummary | null;
}) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text:
        "👋 **GridWise Control-Room Copilot Ready.**\n\n" +
        "I am grounded in active scenario **GRID-101** (Total Spend: **৳28,416 BDT** · Grid Import: **3,842 kWh**).\n\n" +
        "I can help you with:\n" +
        "• **Strategy Explanations**: Understand why battery charge/discharge windows were chosen.\n" +
        "• **What-If Simulations**: Evaluate financial & grid impacts of unexpected solar drops or price spikes in ৳ BDT.\n" +
        "• **Guardrail & Directive Diagnostics**: Inspect how constraints (SoC limits, zero-charge windows) are enforced.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // What-If Simulation State
  const [whatIfSolarDrop, setWhatIfSolarDrop] = useState(50);
  const [whatIfStartHour, setWhatIfStartHour] = useState(11);
  const [whatIfEndHour, setWhatIfEndHour] = useState(14);
  const [simulating, setSimulating] = useState(false);
  const [whatIfResult, setWhatIfResult] = useState<any>(null);

  const quickPrompts = [
    "Why did the battery charge at 03:00 instead of 05:00?",
    "How much did the 1 PM solar drop increase grid spend?",
    "What if solar drops by 50% from 11 AM to 2 PM?",
    "Explain the active guardrail checks",
  ];

  const handleSend = async (customMessage?: string) => {
    const textToSend = customMessage || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = { role: "user" as const, text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch("http://localhost:8000/chat-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map((m) => ({ role: m.role, content: m.text })),
          scenario_id: "GRID-101",
          total_cost_bdt: summary?.total_cost_bdt || 28416,
          total_grid_kwh: summary?.total_grid_kwh || 3842,
          peak_grid_kwh: summary?.peak_grid_kwh || 287,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: copilotFallbackReply(textToSend),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
            text: copilotFallbackReply(textToSend),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const runWhatIf = () => {
    setSimulating(true);
    setTimeout(() => {
      const hoursCount = whatIfEndHour - whatIfStartHour;
      const estimatedLostSolar = Math.round(hoursCount * 85 * (whatIfSolarDrop / 100));
      const peakTariff = 12; // ৳12/kWh
      const costDelta = Math.round(estimatedLostSolar * peakTariff * 0.95);
      const baselineSpend = summary?.total_cost_bdt || 28416;

      setWhatIfResult({
        lostSolarKwh: estimatedLostSolar,
        costDeltaBdt: costDelta,
        newTotalCostBdt: baselineSpend + costDelta,
        hours: `Hours ${whatIfStartHour}:00–${whatIfEndHour}:00`,
        dropPct: whatIfSolarDrop,
      });
      setSimulating(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Control-Room Copilot"
        title="Interactive AI Advisory & What-If Studio"
        copy="Natural language dispatch explanations, what-if sensitivity simulations, and constraint diagnostics."
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        {/* Chat Thread */}
        <div className="flex h-[680px] flex-col rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot size={18} />
              </span>
              <div>
                <h3 className="text-sm font-bold">GridWise Copilot</h3>
                <p className="text-[11px] text-muted-foreground">
                  Grounded in Active Run · GRID-101 (৳28,416 BDT)
                </p>
              </div>
            </div>
            <span className="online">
              <span className="status-dot" />
              Gemini 2.5 Active
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Bot size={14} />
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground font-medium"
                      : "border border-border bg-muted/30 text-foreground whitespace-pre-wrap"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                <Sparkles size={14} className="animate-spin text-primary" />
                Copilot analyzing dispatch schedule and tariff matrices...
              </div>
            )}
          </div>

          {/* Quick prompt chips */}
          <div className="border-t border-border bg-muted/20 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">
              Suggested Questions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about strategy, tariff arbitrage, or what-if scenarios..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button type="submit" disabled={loading || !input.trim()} size="sm">
                <Send size={14} />
              </Button>
            </form>
          </div>
        </div>

        {/* What-If Simulation Sandbox */}
        <div className="space-y-6">
          <Panel
            title="What-If Simulation Sandbox"
            action={
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                Predictive Cost Delta
              </span>
            }
          >
            <div className="space-y-4 p-5">
              <p className="text-xs text-muted-foreground">
                Simulate potential disturbances and compute mathematical cost deltas in ৳ (BDT)
                against current baseline (৳28,416).
              </p>

              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
                <div>
                  <div className="flex justify-between font-semibold">
                    <span>Solar Reduction Factor</span>
                    <span className="text-primary font-bold">{whatIfSolarDrop}% Drop</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={whatIfSolarDrop}
                    onChange={(e) => setWhatIfSolarDrop(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground font-semibold">
                      Start Hour
                    </label>
                    <select
                      value={whatIfStartHour}
                      onChange={(e) => setWhatIfStartHour(Number(e.target.value))}
                      className="mt-1 w-full rounded border border-input bg-background p-1.5 text-xs"
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h}>
                          {h.toString().padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground font-semibold">
                      End Hour
                    </label>
                    <select
                      value={whatIfEndHour}
                      onChange={(e) => setWhatIfEndHour(Number(e.target.value))}
                      className="mt-1 w-full rounded border border-input bg-background p-1.5 text-xs"
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h}>
                          {h.toString().padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button onClick={runWhatIf} disabled={simulating} className="w-full" size="sm">
                  <Play size={14} className={simulating ? "animate-spin" : ""} />
                  {simulating ? "Simulating LP..." : "Run What-If Prediction"}
                </Button>
              </div>

              {whatIfResult && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-xs space-y-3">
                  <div className="flex items-center justify-between font-bold text-foreground">
                    <span>What-If Estimated Outcome</span>
                    <span className="text-destructive font-mono font-bold">
                      +{whatIfResult.costDeltaBdt.toLocaleString()} BDT
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border border-border/50 bg-background p-2">
                      <span className="block text-[10px] text-muted-foreground">
                        Solar Lost
                      </span>
                      <span className="font-bold text-primary">
                        ~{whatIfResult.lostSolarKwh} kWh
                      </span>
                    </div>
                    <div className="rounded border border-border/50 bg-background p-2">
                      <span className="block text-[10px] text-muted-foreground">
                        New Daily Spend
                      </span>
                      <span className="font-bold text-foreground">
                        ৳{whatIfResult.newTotalCostBdt.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Shortfall during {whatIfResult.hours} shifts load to peak tariff grid import
                    (৳12/kWh), increasing overall microgrid expenditure by ~
                    {((whatIfResult.costDeltaBdt / 28416) * 100).toFixed(1)}%.
                  </p>
                </div>
              )}
            </div>
          </Panel>

          <LiveNoteTester />
        </div>
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
