import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "aamperapuli1",
  appId: "1:818077143340:web:9ed2935c2aa2b29b7c5c89",
  storageBucket: "aamperapuli1.firebasestorage.app",
  apiKey: "AIzaSyB_1mkcBATJ4L9NVAiG3EOpW-OvzMh_pOc",
  authDomain: "aamperapuli1.firebaseapp.com",
  messagingSenderId: "818077143340",
  measurementId: "G-V0JXY31HEP",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log("Seeding scenarios...");
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

  await setDoc(doc(db, "scenarios", "GRID-101"), {
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
  console.log("Seeded scenario GRID-101");

  console.log("Seeding latest run & outputs...");
  const runId = "RUN-GRID-101-INIT";
  await setDoc(doc(db, "runs", "latest"), {
    last_run_id: runId,
    total_cost_bdt: 28416,
    total_grid_kwh: 3842,
    peak_grid_kwh: 287,
  });

  await setDoc(doc(db, "runs", runId), {
    status: "SUCCESS",
    timestamp: Date.now(),
    latency_ms: 1240,
    scenario_id: "GRID-101",
    total_cost_bdt: 28416,
    total_grid_kwh: 3842,
    peak_grid_kwh: 287,
  });

  await setDoc(doc(db, "directives", runId), {
    interpretations: [
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
        type: "Distractor note",
        detail: "Non-operational · Disregarded by optimization model",
        applied: false,
        hours: [],
        factor: null,
      },
    ],
  });

  await setDoc(doc(db, "validations", runId), {
    passed_checks: [
      "No-charge constraint enforced: 14:00–16:00 charging = 0 kWh",
      "Solar reduction applied: 13:00 (9.6 kWh) and 14:00 (8.4 kWh)",
      "Battery energy limits strictly kept within 50 kWh - 500 kWh range",
      "Demand balance equations satisfied for all 24 hours",
    ],
  });

  console.log("All collections seeded successfully into Firestore!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Error seeding Firebase:", err);
  process.exit(1);
});
