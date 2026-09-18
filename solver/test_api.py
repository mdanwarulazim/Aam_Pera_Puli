import requests
import json

payload = {
  "scenario_id": "GRID-101",
  "battery": {
    "capacity_kwh": 500,
    "initial_energy_kwh": 200,
    "minimum_energy_kwh": 50,
    "max_charge_kwh_per_hour": 100,
    "max_discharge_kwh_per_hour": 100
  },
  "operator_notes": [
    "Solar output will drop to about 20% from 1 PM to 3 PM.",
    "Do not charge the battery between 2 PM and 4 PM.",
    "The cafeteria menu changes tomorrow."
  ],
  "hours": [
    {"hour": "00", "demand_kwh": 180, "solar_kwh": 0, "tariff_bdt_per_kwh": 7},
    {"hour": "01", "demand_kwh": 175, "solar_kwh": 0, "tariff_bdt_per_kwh": 7},
    {"hour": "02", "demand_kwh": 170, "solar_kwh": 0, "tariff_bdt_per_kwh": 7},
    {"hour": "03", "demand_kwh": 165, "solar_kwh": 0, "tariff_bdt_per_kwh": 7},
    {"hour": "04", "demand_kwh": 160, "solar_kwh": 0, "tariff_bdt_per_kwh": 7},
    {"hour": "05", "demand_kwh": 168, "solar_kwh": 8, "tariff_bdt_per_kwh": 7},
    {"hour": "06", "demand_kwh": 185, "solar_kwh": 35, "tariff_bdt_per_kwh": 9},
    {"hour": "07", "demand_kwh": 205, "solar_kwh": 80, "tariff_bdt_per_kwh": 9},
    {"hour": "08", "demand_kwh": 225, "solar_kwh": 125, "tariff_bdt_per_kwh": 9},
    {"hour": "09", "demand_kwh": 238, "solar_kwh": 170, "tariff_bdt_per_kwh": 9},
    {"hour": "10", "demand_kwh": 245, "solar_kwh": 205, "tariff_bdt_per_kwh": 9},
    {"hour": "11", "demand_kwh": 250, "solar_kwh": 230, "tariff_bdt_per_kwh": 9},
    {"hour": "12", "demand_kwh": 258, "solar_kwh": 245, "tariff_bdt_per_kwh": 12},
    {"hour": "13", "demand_kwh": 240, "solar_kwh": 48, "tariff_bdt_per_kwh": 12},
    {"hour": "14", "demand_kwh": 250, "solar_kwh": 42, "tariff_bdt_per_kwh": 12},
    {"hour": "15", "demand_kwh": 260, "solar_kwh": 128, "tariff_bdt_per_kwh": 12},
    {"hour": "16", "demand_kwh": 272, "solar_kwh": 90, "tariff_bdt_per_kwh": 8},
    {"hour": "17", "demand_kwh": 286, "solar_kwh": 38, "tariff_bdt_per_kwh": 8},
    {"hour": "18", "demand_kwh": 295, "solar_kwh": 5, "tariff_bdt_per_kwh": 11},
    {"hour": "19", "demand_kwh": 278, "solar_kwh": 0, "tariff_bdt_per_kwh": 11},
    {"hour": "20", "demand_kwh": 255, "solar_kwh": 0, "tariff_bdt_per_kwh": 11},
    {"hour": "21", "demand_kwh": 230, "solar_kwh": 0, "tariff_bdt_per_kwh": 11},
    {"hour": "22", "demand_kwh": 212, "solar_kwh": 0, "tariff_bdt_per_kwh": 9},
    {"hour": "23", "demand_kwh": 200, "solar_kwh": 0, "tariff_bdt_per_kwh": 9}
  ]
}

res = requests.post("http://localhost:8000/optimize-energy", json=payload)
print(res.status_code)
try:
    print(json.dumps(res.json(), indent=2))
except:
    print(res.text)
