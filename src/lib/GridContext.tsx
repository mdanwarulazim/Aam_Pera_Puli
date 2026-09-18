import React, { createContext, useContext, useEffect, useState } from "react";
import { seedScenarioGrid101, getScenario, getLatestRunSummary, Scenario, RunSummary } from "./db";

// Hardcoded fallbacks in case DB fails or while loading initially to match previous mock behavior
export const fallbackEnergy = Array.from({ length: 24 }, (_, hour) => {
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

export const fallbackNotes = [
  {
    text: "Solar output will drop to about 20% from 1 PM to 3 PM.",
    type: "Solar reduction",
    detail: "Hours 13:00–15:00 · Factor 0.2 (48 & 42 kWh → 9.6 & 8.4 kWh)",
    applied: true,
    hours: [13, 14],
    factor: 0.2,
  },
  {
    text: "Do not charge the battery between 2 PM and 4 PM.",
    type: "No charge window",
    detail: "Hours 14:00–16:00 · Charge limit 0 kWh enforced",
    applied: true,
    hours: [14, 15],
    factor: null,
  },
  {
    text: "The cafeteria menu changes tomorrow.",
    type: "No operation",
    detail: "Distractor note · Ignored by optimizer (applies: false)",
    applied: false,
    hours: [],
    factor: null,
  },
];

interface GridData {
  scenario: Scenario | null;
  summary: RunSummary | null;
  loading: boolean;
  energy: any[];
  notes: any[];
  refresh: () => Promise<void>;
}

const GridContext = createContext<GridData>({
  scenario: null,
  summary: null,
  loading: true,
  energy: fallbackEnergy,
  notes: fallbackNotes,
  refresh: async () => {},
});

export const useGridData = () => useContext(GridContext);

export function GridDataProvider({ children }: { children: React.ReactNode }) {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      await seedScenarioGrid101();
      const s = await getScenario("GRID-101");
      const sum = await getLatestRunSummary();
      setScenario(s);
      if (sum) setSummary(sum);
    } catch (err) {
      console.error("Error loading grid data from Firebase:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map Firebase data to the UI format, falling back to mock data if not loaded
  const energy = scenario
    ? scenario.hours.map((h, i) => ({
        hour: String(h.hour).padStart(2, "0"),
        demand: h.demand_kwh,
        solar: h.solar_kwh,
        grid: fallbackEnergy[i].grid, // In a full app, this comes from the 'schedules' collection
        battery: fallbackEnergy[i].battery,
        tariff: h.tariff_bdt_per_kwh,
      }))
    : fallbackEnergy;

  const notes = scenario
    ? scenario.operator_notes.map((text, i) => {
        // Map text back to our mock structured notes for UI purposes
        const mockNote =
          fallbackNotes.find((n) => text.includes(n.text.substring(0, 15))) || fallbackNotes[i];
        return { ...mockNote, text };
      })
    : fallbackNotes;

  return (
    <GridContext.Provider value={{ scenario, summary, loading, energy, notes, refresh: loadData }}>
      {children}
    </GridContext.Provider>
  );
}
