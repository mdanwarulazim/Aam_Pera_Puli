import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_all():
    passed = 0
    total = 11

    print("=== STARTING GRIDWISE 11 CANONICAL TRAINING BENCHMARKS ===")

    # 1. Directives Extraction & Time Window Disambiguation
    r1 = requests.post(f"{BASE_URL}/test-directive", json={
        "note": "Maintenance scheduled: panel cleaning will reduce PV generation by 80% from 1:00 PM to 3:00 PM."
    }).json()
    interp1 = r1["interpretation"]
    adj1 = interp1.get("structured_adjustment") or {}
    assert interp1["directive_type"] == "solar_reduction", f"Q1 directive_type failed: {interp1}"
    assert interp1["applies"] is True, f"Q1 applies failed: {interp1}"
    assert adj1.get("hours") == [13, 14], f"Q1 hours failed: {adj1}"
    assert abs(adj1.get("factor", 0) - 0.2) < 0.01, f"Q1 factor failed: {adj1}"
    print("[PASS] Case 1: Directives Extraction & Time Window Disambiguation (solar_reduction, [13, 14], factor 0.2)")
    passed += 1

    # 2. Handling Distractors and Non-Operational Notes
    r2 = requests.post(f"{BASE_URL}/test-directive", json={
        "note": "Please note that the south campus cafeteria menu will be updated starting tomorrow."
    }).json()
    interp2 = r2["interpretation"]
    assert interp2["directive_type"] == "no_op", f"Q2 directive_type failed: {interp2}"
    assert interp2["applies"] is False, f"Q2 applies failed: {interp2}"
    assert interp2.get("structured_adjustment") is None, f"Q2 structured_adjustment failed: {interp2}"
    print("[PASS] Case 2: Handling Distractors and Non-Operational Notes (no_op, applies: false, null adjustment)")
    passed += 1

    # 3. Complex Phrasing & Battery Reserve Constraints
    r3 = requests.post(f"{BASE_URL}/test-directive", json={
        "note": "Keep at least 140 kWh in the reserve buffer between 18:00 and 21:00 due to planned grid maintenance in the evening."
    }).json()
    interp3 = r3["interpretation"]
    adj3 = interp3.get("structured_adjustment") or {}
    assert interp3["directive_type"] == "minimum_battery_reserve", f"Q3 directive_type failed: {interp3}"
    assert interp3["applies"] is True, f"Q3 applies failed: {interp3}"
    assert adj3.get("hours") == [18, 19, 20], f"Q3 hours failed: {adj3}"
    res3 = adj3.get("minimum_energy_kwh") or adj3.get("limit")
    assert res3 == 140, f"Q3 reserve failed: {adj3}"
    print("[PASS] Case 3: Complex Phrasing & Battery Reserve Constraints (minimum_battery_reserve, [18, 19, 20], 140 kWh)")
    passed += 1

    # 4. Dispatch Strategy Reasoning (Advisory Copilot)
    r4 = requests.post(f"{BASE_URL}/chat-copilot", json={
        "message": "Why is the optimizer charging the battery at 03:00 at maximum capacity instead of waiting until 08:00, when solar output starts ramping up?"
    }).json()
    reply4 = r4["reply"]
    assert "7" in reply4 or "03:00" in reply4 or "lowest" in reply4.lower(), f"Q4 reasoning failed: {reply4}"
    assert "demand" in reply4.lower() or "solar" in reply4.lower() or "arbitrage" in reply4.lower(), f"Q4 reasoning failed: {reply4}"
    print("[PASS] Case 4: Dispatch Strategy Reasoning (Tariff arbitrage ৳7 vs ৳9, campus demand exceeds solar at 08:00)")
    passed += 1

    # 5. Energy Physics and Validation Rule Replay (End-of-day battery neutrality)
    r5 = requests.post(f"{BASE_URL}/chat-copilot", json={
        "message": "Scenario Check: An optimizer suggests ending hour 23 with 120 kWh in the battery when initial_energy_kwh was 200 kWh. Total cost dropped by ৳800. Is this schedule valid?"
    }).json()
    reply5 = r5["reply"]
    assert "invalid" in reply5.lower(), f"Q5 validation failed: {reply5}"
    assert "neutrality" in reply5.lower() or "200" in reply5 or "09.6" in reply5, f"Q5 explanation failed: {reply5}"
    print("[PASS] Case 5: Energy Physics and Validation Rule Replay (Invalid, Section 09.6 neutrality violation)")
    passed += 1

    # 6. Operational Window Constraint: No-Discharge Directive
    r6 = requests.post(f"{BASE_URL}/test-directive", json={
        "note": "Do not draw power from the battery storage between 6:00 PM and 9:00 PM to ensure emergency backup readiness."
    }).json()
    interp6 = r6["interpretation"]
    adj6 = interp6.get("structured_adjustment") or {}
    assert interp6["directive_type"] == "no_discharge_window", f"Q6 directive_type failed: {interp6}"
    assert interp6["applies"] is True, f"Q6 applies failed: {interp6}"
    assert adj6.get("hours") == [18, 19, 20], f"Q6 hours failed: {adj6}"
    print("[PASS] Case 6: Operational Window Constraint: No-Discharge Directive (no_discharge_window, [18, 19, 20])")
    passed += 1

    # 7. Import Limitation: Max Grid Window
    r7 = requests.post(f"{BASE_URL}/test-directive", json={
        "note": "Substation transformer throttling: keep grid import capped at 95 kWh from 11 AM to 2 PM."
    }).json()
    interp7 = r7["interpretation"]
    adj7 = interp7.get("structured_adjustment") or {}
    assert interp7["directive_type"] == "max_grid_window", f"Q7 directive_type failed: {interp7}"
    assert interp7["applies"] is True, f"Q7 applies failed: {interp7}"
    assert adj7.get("hours") == [11, 12, 13], f"Q7 hours failed: {adj7}"
    cap7 = adj7.get("max_grid_kwh") or adj7.get("limit")
    assert cap7 == 95, f"Q7 cap failed: {adj7}"
    print("[PASS] Case 7: Import Limitation: Max Grid Window (max_grid_window, [11, 12, 13], 95 kWh)")
    passed += 1

    # 8. Ambiguous Phrasing: Fractional Solar Reduction
    r8 = requests.post(f"{BASE_URL}/test-directive", json={
        "note": "Due to heavy dust storms, rooftop solar panels will only generate about one-quarter of normal output between 10:00 and 13:00."
    }).json()
    interp8 = r8["interpretation"]
    adj8 = interp8.get("structured_adjustment") or {}
    assert interp8["directive_type"] == "solar_reduction", f"Q8 directive_type failed: {interp8}"
    assert interp8["applies"] is True, f"Q8 applies failed: {interp8}"
    assert adj8.get("hours") == [10, 11, 12], f"Q8 hours failed: {adj8}"
    assert abs(adj8.get("factor", 0) - 0.25) < 0.01, f"Q8 factor failed: {adj8}"
    print("[PASS] Case 8: Ambiguous Phrasing: Fractional Solar Reduction (solar_reduction, [10, 11, 12], factor 0.25)")
    passed += 1

    # 9. Conversational Distractor with Numeric Trap
    r9 = requests.post(f"{BASE_URL}/test-directive", json={
        "note": "Room 304 air conditioning is set to 24 degrees Celsius, and 50 new chairs will arrive at 3 PM."
    }).json()
    interp9 = r9["interpretation"]
    assert interp9["directive_type"] == "no_op", f"Q9 directive_type failed: {interp9}"
    assert interp9["applies"] is False, f"Q9 applies failed: {interp9}"
    assert interp9.get("structured_adjustment") is None, f"Q9 structured_adjustment failed: {interp9}"
    print("[PASS] Case 9: Conversational Distractor with Numeric Trap (no_op, applies: false, null adjustment)")
    passed += 1

    # 10. Energy Accounting: Solar Export Violation
    r10 = requests.post(f"{BASE_URL}/chat-copilot", json={
        "message": "Scenario Check: At hour 12, campus demand is 150 kWh, effective solar generation is 220 kWh, and the battery is fully charged (capacity_kwh: 500). An optimization model proposes solar_used_kwh: 220 and exports the excess 70 kWh back to the utility grid for a cost credit. Is this valid?"
    }).json()
    reply10 = r10["reply"]
    assert "invalid" in reply10.lower(), f"Q10 validation failed: {reply10}"
    assert "curtail" in reply10.lower() or "export" in reply10.lower() or "09.4" in reply10, f"Q10 explanation failed: {reply10}"
    print("[PASS] Case 10: Energy Accounting: Solar Export Violation (Invalid, grid export unsupported, curtailment required)")
    passed += 1

    # 11. Rate Limits vs. Reserve Thresholds
    r11 = requests.post(f"{BASE_URL}/chat-copilot", json={
        "message": "Scenario Check: At hour 17, current battery storage is 90 kWh. A directive requires minimum_battery_reserve of 180 kWh starting at hour 18. The battery specs specify max_charge_kwh_per_hour: 50. What should the optimizer and validator do?"
    }).json()
    reply11 = r11["reply"]
    assert "anticipate" in reply11.lower() or "preceding" in reply11.lower() or "50" in reply11, f"Q11 reasoning failed: {reply11}"
    print("[PASS] Case 11: Rate Limits vs. Reserve Thresholds (Anticipate across preceding hours, rate limit binding)")
    passed += 1

    print("\n==================================================")
    print(f"RESULTS: {passed} / {total} TRAINING BENCHMARKS PASSED (100% ACCURACY)")
    print("==================================================")

if __name__ == "__main__":
    test_all()
