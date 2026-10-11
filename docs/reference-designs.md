# Reference designs (engine v1.0.0)

These replace PRD v1.0 §37.4, whose inputs were incomplete. They are enforced by
`server/engine/__tests__/reference-designs.test.ts`. Wattages and surge factors come from the
seeded appliance catalogue; sun hours are the wet-season values from `server/db/seed/data.ts`.

**Formulas (v1.1):**
- Day/night energy = Σ watts × qty × hours
- Period peak = Σ running watts of appliances used in that period + the largest single-unit surge delta `(surge − 1) × watts`
- Inverter kVA ≥ max(day peak, night peak) ÷ 0.8 → smallest SKU
- Battery kWh = night ÷ inv_eff ÷ rte ÷ DoD × 1.1 (lithium 0.95/0.95/0.8; lead-acid 0.92/0.8/0.5)
- Recharge = night ÷ inv_eff ÷ rte
- Panel kWp = (day + recharge) ÷ (wet-season sun hours × 0.72) → ÷ 0.4, round up

## REF-001 Basic home — Lagos (wet 4.0h), lithium

| Appliance | W | Qty | Day h | Night h |
|---|---|---|---|---|
| Ceiling fan | 75 | 3 | 8 | 8 |
| TV 43" | 80 | 1 | 4 | 4 |
| LED bulb 9W | 9 | 5 | 0 | 6 |
| Fridge single door (surge ×2) | 150 | 1 | 11 | 13 |

- Day 3.77 kWh, night 4.34 kWh
- Day peak 455 W + 150 surge = 0.605 kW; night 500 + 150 = 0.65 kW → 0.8125 kVA → **1.8kVA, 24V**
- Battery 4.34 ÷ 0.722 × 1.1 = 6.612 kWh → **2 × 5kWh 24V lithium** (10 kWh)
- Recharge 4.809 kWh; (3.77 + 4.809) ÷ 2.88 = 2.979 kWp → **8 × 400Wp**

## REF-002 AC home — Abuja/FCT (wet 5.0h), lithium

| Appliance | W | Qty | Day h | Night h |
|---|---|---|---|---|
| AC 1.5HP (surge ×3) | 1350 | 2 | 0 | 8 |
| TV 55" | 120 | 1 | 4 | 4 |
| LED bulb 9W | 9 | 8 | 0 | 6 |
| Fridge double door (surge ×2) | 250 | 1 | 11 | 13 |
| Ceiling fan | 75 | 2 | 8 | 0 |

- Day 4.43 kWh, night 25.762 kWh
- Day peak 520 + 250 = 0.77 kW; night 3142 + 2700 = 5.842 kW → 7.3025 kVA → **8kVA, 48V**
  (PRD v1.0's day-only rule would have picked 1.8kVA, which cannot start the ACs)
- Battery 25.762 ÷ 0.722 × 1.1 = 39.25 kWh → fewest units: **2 × 25kWh 48V lithium** (50 kWh)
- Recharge 28.545 kWh; (4.43 + 28.545) ÷ 3.6 = 9.160 kWp → **23 × 400Wp**

## REF-003 Commercial shop — Kano (wet 5.5h)

| Appliance | W | Qty | Day h | Night h |
|---|---|---|---|---|
| Photocopier (surge ×1.5) | 1000 | 1 | 4 | 0 |
| Industrial fan (surge ×2) | 200 | 2 | 10 | 0 |
| Commercial deep freezer (surge ×2) | 500 | 1 | 11 | 13 |
| LED tube 20W | 20 | 6 | 10 | 2 |

- Day 14.7 kWh, night 6.74 kWh
- Day peak 2020 + 500 = 2.52 kW → 3.15 kVA → **4kVA, 24V**
- **Lithium:** 6.74 ÷ 0.722 × 1.1 = 10.269 kWh → **3 × 5kWh 24V**; (14.7 + 7.468) ÷ 3.96 = 5.598 kWp → **14 × 400Wp**
- **Tubular:** 6.74 ÷ 0.368 × 1.1 = 20.147 kWh = 839.4 Ah @24V → 4 strings × 2 = **8 × 220Ah (2S4P)**;
  recharge 9.158 kWh; (14.7 + 9.158) ÷ 3.96 = 6.025 kWp → **16 × 400Wp**
