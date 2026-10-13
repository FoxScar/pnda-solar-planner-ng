# Reference designs (engine 2.0.0 — Developer Calculation Schematics)

Enforced by `server/engine/__tests__/reference-designs.test.ts`. Wattages and surge factors come from
the seeded appliance catalogue; sun hours are the wet-season values in `server/db/seed/data.ts`.

**Default settings** (admin → Settings): power factor 0.80 · safety margin 30% · inverter efficiency
0.90 · lithium DoD 0.80 / discharge efficiency 0.95 · gel & tubular DoD 0.50 / 0.85 · panel
performance factor 0.80 · surge = 2 × continuous when not on the datasheet · night 17:00–06:00.

**Formulas**

| Step | Formula |
|---|---|
| Energy | Σ watts × qty × hours ÷ 1000, per period |
| Peak | Σ watts × qty of appliances used in the period (all-overlap); peak = max(day, night) |
| Start-up | period peak + largest single-unit (surge − 1) × watts, worst period |
| Inverter | VA = peak ÷ 0.8; smallest SKU with kVA ≥ VA, continuous ≥ peak, surge ≥ start-up, and a valid battery bank and PV array |
| Battery | night × 1.30 ÷ (DoD × inverter eff × discharge eff); fewest identical units |
| Panels | effective W = rated × factor; combined rule ceil((peak + bank kWh × 1000 ÷ sun) ÷ effective W); raised if needed so count × effective W × sun ÷ 1000 ≥ day kWh + bank kWh |

## Schematics §8 worked example

Night 14.675 kWh, day 11.41 kWh, peak 4,260 W (all-overlap), 5 sun-hours, 650 W panel × 0.80.

- VA = 4,260 ÷ 0.8 = **5,325** → 5kVA (5,000) too small → **6kVA, 48V**
- Battery = 14.675 × 1.30 ÷ (0.80 × 0.90 × 0.95) = **27.89 kWh** → fewest units: 2 (15, 17 or 25 kWh) → least capacity → **2 × 15 kWh** (30 kWh)
- Effective panel = **520 W**; charging = 30,000 ÷ 5 = 6,000 W; combined = 10,260 W → **20 panels**
- Energy check: 20 × 520 × 5 ÷ 1000 = 52 kWh ≥ 11.41 + 30 = 41.41 kWh ✓

## REF-001 Basic home — Lagos (wet 4.0 h), lithium

| Appliance | W | Qty | Day h | Night h |
|---|---|---|---|---|
| Ceiling fan | 75 | 3 | 8 | 8 |
| TV 43" | 80 | 1 | 4 | 4 |
| LED bulb 9W | 9 | 5 | 0 | 6 |
| Fridge single door (surge ×2) | 150 | 1 | 11 | 13 |

- Day 3.77 kWh, night 4.34 kWh; day peak 455 W, night peak **500 W**; start-up 500 + 150 = 650 W
- VA 625 → **1.8kVA 24V** (1,440 W continuous, 2,880 W surge)
- Battery 4.34 × 1.3 ÷ 0.684 = 8.25 kWh → **2 × 5 kWh 24V**
- Panels: 320 W effective; (500 + 10,000 ÷ 4) ÷ 320 = 9.4 → 10; energy check needs (3.77 + 10) × 1000 ÷ 1,280 = 10.8 → **11 × 400 W**

## REF-002 AC home — Abuja/FCT (wet 5.0 h), lithium

| Appliance | W | Qty | Day h | Night h |
|---|---|---|---|---|
| AC 1.5HP (surge ×3) | 1350 | 2 | 0 | 8 |
| TV 55" | 120 | 1 | 4 | 4 |
| LED bulb 9W | 9 | 8 | 0 | 6 |
| Fridge double door (surge ×2) | 250 | 1 | 11 | 13 |
| Ceiling fan | 75 | 2 | 8 | 0 |

- Day 4.43 kWh, night 25.762 kWh; night peak **3,142 W**; start-up 3,142 + 2,700 = 5,842 W
- VA 3,927.5 → **4kVA 24V** (3,200 W continuous ≥ 3,142; 6,400 W surge ≥ 5,842)
- Battery 25.762 × 1.3 ÷ 0.684 = 48.96 kWh → **10 × 5 kWh 24V** (50 kWh)
- Panels: (3,142 + 50,000 ÷ 5) ÷ 320 = 41.1 → **42 × 400 W**; energy 67.2 ≥ 54.43 kWh ✓
- ⚠ 16.8 kWp on a 4kVA inverter will exceed most 4kVA units' PV input. Once the inverter's PV limit is
  entered, the engine moves to a larger inverter automatically.

## REF-003 Commercial shop — Kano (wet 5.5 h)

| Appliance | W | Qty | Day h | Night h |
|---|---|---|---|---|
| Photocopier (surge ×1.5) | 1000 | 1 | 4 | 0 |
| Industrial fan (surge ×2) | 200 | 2 | 10 | 0 |
| Commercial deep freezer (surge ×2) | 500 | 1 | 11 | 13 |
| LED tube 20W | 20 | 6 | 10 | 2 |

- Day 14.7 kWh, night 6.74 kWh; day peak **2,020 W**; start-up 2,520 W → VA 2,525 → **3kVA 24V**
- **Lithium:** 6.74 × 1.3 ÷ 0.684 = 12.81 kWh → **3 × 5 kWh**; combined rule 15, energy check (14.7 + 15) ÷ 1.76 = 16.9 → **17 panels**
- **Tubular:** 6.74 × 1.3 ÷ (0.5 × 0.9 × 0.85) = 22.91 kWh = 954 Ah @24V → **5 strings × 2 = 10 × 220 Ah**;
  combined rule 22, energy check (14.7 + 26.4) ÷ 1.76 = 23.4 → **24 panels**
