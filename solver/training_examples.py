"""Canonical GridWise training demonstrations supplied by the operator."""

CANONICAL_DIRECTIVE_TRAINING = r'''
Use these canonical directive examples and guardrails when extracting operator notes.
Return exactly one entry per note, preserving note_index order. Time windows are [start, end)
with the end hour excluded. Hours must be sorted, unique integers from 0 through 23.
For solar_reduction, factor is the usable fraction that remains, not the percentage removed.
Every no_op has applies=false and structured_adjustment=null. Do not infer energy parameters
from administrative, weather, facilities, IT, or other non-operational notes.

DIRECTIVE EXAMPLES
- "Maintenance scheduled: panel cleaning will reduce PV generation by 80% from 1:00 PM to 3:00 PM."
  => {"note_index":0,"applies":true,"directive_type":"solar_reduction","structured_adjustment":{"hours":[13,14],"factor":0.2}}
- "Please note that the south campus cafeteria menu will be updated starting tomorrow."
  => {"note_index":1,"applies":false,"directive_type":"no_op","structured_adjustment":null}
- "Keep at least 140 kWh in the reserve buffer between 18:00 and 21:00 due to planned grid maintenance in the evening."
  => {"note_index":2,"applies":true,"directive_type":"minimum_battery_reserve","structured_adjustment":{"hours":[18,19,20],"minimum_energy_kwh":140}}
- "Do not draw power from the battery storage between 6:00 PM and 9:00 PM to ensure emergency backup readiness."
  => {"note_index":0,"applies":true,"directive_type":"no_discharge_window","structured_adjustment":{"hours":[18,19,20]}}
- "Substation transformer throttling: keep grid import capped at 95 kWh from 11 AM to 2 PM."
  => {"note_index":1,"applies":true,"directive_type":"max_grid_window","structured_adjustment":{"hours":[11,12,13],"max_grid_kwh":95}}
- "Due to heavy dust storms, rooftop solar panels will only generate about one-quarter of normal output between 10:00 and 13:00."
  => {"note_index":2,"applies":true,"directive_type":"solar_reduction","structured_adjustment":{"hours":[10,11,12],"factor":0.25}}
- "Room 304 air conditioning is set to 24 degrees Celsius, and 50 new chairs will arrive at 3 PM."
  => {"note_index":1,"applies":false,"directive_type":"no_op","structured_adjustment":null}
- "Grid maintenance crew requests no energy storage intake between 9 AM and 11 AM."
  => {"note_index":0,"applies":true,"directive_type":"no_charge_window","structured_adjustment":{"hours":[9,10]}}
- "A light afternoon breeze will keep ambient campus temperatures around 28C."
  => {"note_index":1,"applies":false,"directive_type":"no_op","structured_adjustment":null}
- "Drone inspection over solar canopy will cut PV generation by 50% between 12:00 and 13:00."
  => {"note_index":0,"applies":true,"directive_type":"solar_reduction","structured_adjustment":{"hours":[12],"factor":0.5}}
- "Utility grid operator imposed a strict 110 kWh import ceiling from 5 PM to 8 PM."
  => {"note_index":2,"applies":true,"directive_type":"max_grid_window","structured_adjustment":{"hours":[17,18,19],"max_grid_kwh":110}}
- "Library study rooms will remain open until midnight for final exam week."
  => {"note_index":1,"applies":false,"directive_type":"no_op","structured_adjustment":null}
- "Heavy overcast expected from 2 PM to 5 PM, reducing solar output to approximately one-tenth of normal capacity."
  => {"note_index":0,"applies":true,"directive_type":"solar_reduction","structured_adjustment":{"hours":[14,15,16],"factor":0.1}}
- "Maintain at least 160 kWh in storage reserve between 21:00 and 24:00."
  => {"note_index":0,"applies":true,"directive_type":"minimum_battery_reserve","structured_adjustment":{"hours":[21,22,23],"minimum_energy_kwh":160}}
- An hours array [16,14,15] for no_discharge_window is sanitized to {"hours":[14,15,16]}.
- "Campus Wi-Fi routers will undergo a firmware restart at 04:00."
  => {"note_index":2,"applies":false,"directive_type":"no_op","structured_adjustment":null}
- A note "Expect a 30% reduction in solar output from 10 AM to 12 PM." has factor 0.7 and hours [10,11].
- "Full emergency shutdown of rooftop inverters between 11:00 and 12:00 for fire drill."
  => {"note_index":0,"applies":true,"directive_type":"solar_reduction","structured_adjustment":{"hours":[11],"factor":0.0}}

VALIDATION AND REASONING GUARDRAILS
- Missing note entries fail validation; every input note, including irrelevant notes, must produce one entry in index order.
- End-of-day neutrality: battery_energy_after_kwh[23] must equal initial_energy_kwh; a lower final level is invalid even when cost falls.
- No grid export: unused solar is curtailed. solar_used_kwh cannot exceed effective solar or local demand plus permitted battery charging.
- A battery cannot charge and discharge in the same hour; battery_action is exactly charge, discharge, or idle.
- Hourly charge/discharge rate limits cannot be breached to satisfy a reserve threshold. Reserve requirements must be anticipated in preceding hours.
- A no_discharge_window sets discharge to zero; a simultaneous reserve floor is satisfied by holding or charging the battery.
- Energy balance is grid_kwh + solar_used_kwh + battery_discharge = demand_kwh + battery_charge.
- At 03:00, charging at off-peak 7 BDT/kWh is preferred to 08:00 at 9 BDT/kWh because 08:00 demand (225 kWh) exceeds solar (125 kWh); stored low-cost energy displaces 12 BDT/kWh peak imports.
- At 04:00, buying 80 kWh for 40 kWh demand routes the remaining 40 kWh to the battery when within the hourly charge limit.
- Charging at 22:00 can be necessary to restore energy discharged during peak hours and meet end-of-day neutrality before hour 23 ends.
'''
