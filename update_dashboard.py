import re

with open("src/components/GridWiseDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
import_str = """
import { seedScenarioGrid101, getScenario, getLatestRunSummary, saveOptimizationRun, RunSummary } from '../lib/db';
"""
content = re.sub(r'import { useMemo, useState } from "react";', 'import { useMemo, useState, useEffect } from "react";\n' + import_str, content)

# 2. Convert const energy, notes, etc. to let
content = content.replace("const energy = Array.from", "let energy = Array.from")
content = content.replace("const notes = [", "let notes = [")

# 3. Inject data fetching inside GridWiseDashboard
hook_code = """
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
            tariff: h.tariff_bdt_per_kwh
          }));
          
          notes = scenario.operator_notes.map((text, i) => {
            // Merge with UI icons
            const mockNote = notes.find(n => text.includes(n.text.substring(0, 15))) || notes[i] || notes[0];
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
"""
content = content.replace('export function GridWiseDashboard() {\n  const [view, setView] = useState<View>("Dashboard");', 'export function GridWiseDashboard() {\n' + hook_code + '  const [view, setView] = useState<View>("Dashboard");')

# 4. Modify reoptimize to save to Firestore
save_code = """
  const reoptimize = () => {
    setOptimizing(true);
    window.setTimeout(async () => {
      setOptimizing(false);
      try {
        await saveOptimizationRun(
          "RUN-" + Date.now(),
          { last_run_id: "RUN-" + Date.now(), total_cost_bdt: 28416, total_grid_kwh: 3842, peak_grid_kwh: 287 },
          energy,
          notes,
          validations
        );
        // Refresh summary
        const sum = await getLatestRunSummary();
        if (sum) setSummary(sum);
      } catch (e) {
        console.error("Save failed", e);
      }
    }, 1600);
  };
"""
content = re.sub(
    r'const reoptimize = \(\) => \{\s*setOptimizing\(true\);\s*window\.setTimeout\(\(\) => setOptimizing\(false\), 1600\);\s*\};',
    save_code.strip(),
    content
)

# 5. Update UI to use `summary` if available
content = content.replace('value="3,842 kWh"', 'value={summary ? `${summary.total_grid_kwh.toLocaleString()} kWh` : "3,842 kWh"}')
content = content.replace('value="৳28,416"', 'value={summary ? `৳${summary.total_cost_bdt.toLocaleString()}` : "৳28,416"}')
content = content.replace('value="287 kWh"', 'value={summary ? `${summary.peak_grid_kwh} kWh` : "287 kWh"}')

# Pass summary to DashboardView
content = content.replace('return <DashboardView setView={setView} reoptimize={reoptimize} optimizing={optimizing} />;', 'return <DashboardView setView={setView} reoptimize={reoptimize} optimizing={optimizing} summary={summary} />;')
content = content.replace('function DashboardView({\n  setView,\n  reoptimize,\n  optimizing,\n}: {\n  setView: (v: View) => void;\n  reoptimize: () => void;\n  optimizing: boolean;\n}) {', 'function DashboardView({\n  setView,\n  reoptimize,\n  optimizing,\n  summary,\n}: {\n  setView: (v: View) => void;\n  reoptimize: () => void;\n  optimizing: boolean;\n  summary: RunSummary | null;\n}) {')


with open("src/components/GridWiseDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated GridWiseDashboard.tsx successfully")
