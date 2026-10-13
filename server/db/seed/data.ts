import type { BatteryChemistry } from "../../../shared/domain";

// ---------------------------------------------------------------------------
// Sun hours (PRD §33.1). Values are the PRD's regional figures applied to every
// state in the region; admins can refine individual states from the dashboard.
// ---------------------------------------------------------------------------

interface Region {
  annualAvg: number;
  drySeason: number;
  wetSeason: number;
  states: string[];
}

export const SUN_HOUR_REGIONS: Record<string, Region> = {
  "Far North": {
    annualAvg: 6.3,
    drySeason: 6.5,
    wetSeason: 5.5,
    states: ["Bauchi", "Borno", "Gombe", "Jigawa", "Kano", "Katsina", "Kebbi", "Sokoto", "Yobe", "Zamfara"],
  },
  "Middle Belt": {
    annualAvg: 5.6,
    drySeason: 5.8,
    wetSeason: 5.0,
    states: ["Adamawa", "Benue", "FCT", "Kaduna", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau", "Taraba"],
  },
  "South-West": {
    annualAvg: 4.7,
    drySeason: 5.0,
    wetSeason: 4.0,
    states: ["Ekiti", "Lagos", "Ogun", "Ondo", "Osun", "Oyo"],
  },
  "South-East": {
    annualAvg: 4.5,
    drySeason: 4.8,
    wetSeason: 3.8,
    states: ["Abia", "Anambra", "Ebonyi", "Enugu", "Imo"],
  },
  "South-South": {
    annualAvg: 4.2,
    drySeason: 4.5,
    wetSeason: 3.5,
    states: ["Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Rivers"],
  },
};

export const SUN_HOURS = Object.entries(SUN_HOUR_REGIONS).flatMap(([region, r]) =>
  r.states.map((state) => ({
    state,
    region,
    annualAvg: r.annualAvg,
    wetSeason: r.wetSeason,
    drySeason: r.drySeason,
  })),
);

// ---------------------------------------------------------------------------
// Felicity component catalogue (PRD §16.2, §17.3, §32.2).
// Battery prices are from the PRD. Inverter and panel prices are NOT in the PRD:
// the values below are placeholders and must be set from the admin dashboard.
// ---------------------------------------------------------------------------

export const INVERTERS = [
  { sku: "INV-FEL-1K8-24", model: "Felicity 1.8kVA", kva: 1.8, dcVoltage: 24, unitPriceNgn: 450_000 },
  { sku: "INV-FEL-3K-24", model: "Felicity 3kVA", kva: 3.0, dcVoltage: 24, unitPriceNgn: 650_000 },
  { sku: "INV-FEL-4K-24", model: "Felicity 4kVA", kva: 4.0, dcVoltage: 24, unitPriceNgn: 850_000 },
  { sku: "INV-FEL-5K-48", model: "Felicity 5kVA", kva: 5.0, dcVoltage: 48, unitPriceNgn: 1_100_000 },
  { sku: "INV-FEL-6K-48", model: "Felicity 6kVA", kva: 6.0, dcVoltage: 48, unitPriceNgn: 1_300_000 },
  { sku: "INV-FEL-8K-48", model: "Felicity 8kVA", kva: 8.0, dcVoltage: 48, unitPriceNgn: 1_800_000 },
  { sku: "INV-FEL-12K-48", model: "Felicity 12kVA", kva: 12.0, dcVoltage: 48, unitPriceNgn: 2_600_000 },
].map((i) => ({ ...i, type: "inverter" as const, brand: "Felicity" }));

interface BatterySeed {
  sku: string;
  model: string;
  chemistry: BatteryChemistry;
  dcVoltage: number;
  capacityKwh: number;
  capacityAh?: number;
  unitPriceNgn: number;
}

export const BATTERIES = (
  [
    { sku: "BAT-LI-24-5K", model: "Felicity LiFePO4 24V 5kWh", chemistry: "lithium", dcVoltage: 24, capacityKwh: 5.0, unitPriceNgn: 850_000 },
    { sku: "BAT-LI-48-512", model: "Felicity LiFePO4 48V 5.12kWh", chemistry: "lithium", dcVoltage: 48, capacityKwh: 5.12, unitPriceNgn: 900_000 },
    { sku: "BAT-LI-48-72", model: "Felicity LiFePO4 48V 7.2kWh", chemistry: "lithium", dcVoltage: 48, capacityKwh: 7.2, unitPriceNgn: 1_200_000 },
    { sku: "BAT-LI-48-10K", model: "Felicity LiFePO4 48V 10kWh", chemistry: "lithium", dcVoltage: 48, capacityKwh: 10.0, unitPriceNgn: 1_600_000 },
    { sku: "BAT-LI-48-125", model: "Felicity LiFePO4 48V 12.5kWh", chemistry: "lithium", dcVoltage: 48, capacityKwh: 12.5, unitPriceNgn: 1_950_000 },
    { sku: "BAT-LI-48-15K", model: "Felicity LiFePO4 48V 15kWh", chemistry: "lithium", dcVoltage: 48, capacityKwh: 15.0, unitPriceNgn: 2_300_000 },
    { sku: "BAT-LI-48-17K", model: "Felicity LiFePO4 48V 17kWh", chemistry: "lithium", dcVoltage: 48, capacityKwh: 17.0, unitPriceNgn: 2_600_000 },
    { sku: "BAT-LI-48-25K", model: "Felicity LiFePO4 48V 25kWh", chemistry: "lithium", dcVoltage: 48, capacityKwh: 25.0, unitPriceNgn: 3_800_000 },
    { sku: "BAT-GEL-12-200", model: "Felicity Gel 12V 200Ah", chemistry: "gel", dcVoltage: 12, capacityKwh: 2.4, capacityAh: 200, unitPriceNgn: 180_000 },
    { sku: "BAT-TUB-12-220", model: "Felicity Tubular 12V 220Ah", chemistry: "tubular", dcVoltage: 12, capacityKwh: 2.64, capacityAh: 220, unitPriceNgn: 195_000 },
  ] satisfies BatterySeed[]
).map((b) => ({ ...b, type: "battery" as const, brand: "Felicity", capacityAh: b.capacityAh ?? null }));

export const PANELS = [
  { sku: "PNL-MONO-400", model: "400Wp Monocrystalline PERC", wattsPeak: 400, unitPriceNgn: 110_000 },
].map((p) => ({ ...p, type: "panel" as const, brand: "Generic", performanceFactor: 0.8 }));

// ---------------------------------------------------------------------------
// Appliance catalogue (FR-001: 60+ Nigerian household and commercial items).
// Surge factors follow PRD §14.2: AC 3.0, pump 2.5, refrigeration 2.0.
// Other motor loads get 2.0; resistive/electronic loads 1.0.
// ---------------------------------------------------------------------------

type ApplianceSeed = [name: string, category: string, watts: number, surgeFactor?: number, isAirConditioner?: boolean];

const APPLIANCE_ROWS: ApplianceSeed[] = [
  // Lighting
  ["LED Bulb (9W)", "Lighting", 9],
  ["LED Bulb (15W)", "Lighting", 15],
  ["LED Tube Light", "Lighting", 20],
  ["Energy Saving Bulb (CFL)", "Lighting", 23],
  ["Incandescent Bulb", "Lighting", 60],
  ["Security Floodlight (LED)", "Lighting", 50],
  ["Rechargeable Lamp (charging)", "Lighting", 10],
  // Cooling
  ["Ceiling Fan", "Cooling", 75],
  ["Standing Fan", "Cooling", 65],
  ["Table Fan", "Cooling", 45],
  ["Wall Fan", "Cooling", 55],
  ["Rechargeable Fan (charging)", "Cooling", 30],
  ["Industrial Fan", "Cooling", 200, 2.0],
  ["Air Cooler", "Cooling", 150, 2.0],
  ["Air Conditioner (1HP)", "Air Conditioning", 900, 3.0, true],
  ["Air Conditioner (1.5HP)", "Air Conditioning", 1350, 3.0, true],
  ["Air Conditioner (2HP)", "Air Conditioning", 1800, 3.0, true],
  ["Inverter Air Conditioner (1HP)", "Air Conditioning", 750, 1.5, true],
  ["Inverter Air Conditioner (1.5HP)", "Air Conditioning", 1100, 1.5, true],
  // Refrigeration
  ["Mini Fridge", "Refrigeration", 80, 2.0],
  ["Refrigerator (Single Door)", "Refrigeration", 150, 2.0],
  ["Refrigerator (Double Door)", "Refrigeration", 250, 2.0],
  ["Inverter Refrigerator", "Refrigeration", 120, 1.2],
  ["Chest Freezer (Small)", "Refrigeration", 200, 2.0],
  ["Chest Freezer (Large)", "Refrigeration", 350, 2.0],
  ["Deep Freezer (Commercial)", "Refrigeration", 500, 2.0],
  ["Water Dispenser", "Refrigeration", 500, 2.0],
  ["Display Chiller (Commercial)", "Refrigeration", 400, 2.0],
  // Entertainment
  ['TV (32" LED)', "Entertainment", 50],
  ['TV (43" LED)', "Entertainment", 80],
  ['TV (55" LED)', "Entertainment", 120],
  ['TV (65" LED)', "Entertainment", 160],
  ["Decoder (DSTV/GOtv)", "Entertainment", 20],
  ["Home Theatre System", "Entertainment", 150],
  ["Sound Bar", "Entertainment", 40],
  ["Gaming Console", "Entertainment", 150],
  ["Radio", "Entertainment", 15],
  // Office & electronics
  ["Laptop", "Office & Electronics", 65],
  ["Desktop Computer", "Office & Electronics", 200],
  ["Computer Monitor", "Office & Electronics", 30],
  ["Inkjet Printer", "Office & Electronics", 50],
  ["Laser Printer", "Office & Electronics", 500],
  ["Photocopier", "Office & Electronics", 1000, 1.5],
  ["Wi-Fi Router / Modem", "Office & Electronics", 15],
  ["Phone Charger", "Office & Electronics", 10],
  ["CCTV Camera", "Office & Electronics", 10],
  ["CCTV DVR/NVR", "Office & Electronics", 30],
  ["POS Terminal (charging)", "Office & Electronics", 10],
  // Kitchen
  ["Microwave Oven", "Kitchen", 1000],
  ["Electric Kettle", "Kitchen", 1500],
  ["Blender", "Kitchen", 400, 2.0],
  ["Toaster", "Kitchen", 800],
  ["Rice Cooker", "Kitchen", 700],
  ["Electric Cooker (single plate)", "Kitchen", 1500],
  ["Air Fryer", "Kitchen", 1500],
  ["Food Processor", "Kitchen", 500, 2.0],
  ["Coffee Maker", "Kitchen", 800],
  // Laundry & household
  ["Washing Machine", "Laundry & Household", 500, 2.0],
  ["Clothes Iron", "Laundry & Household", 1200],
  ["Vacuum Cleaner", "Laundry & Household", 1000, 1.5],
  ["Hair Dryer", "Laundry & Household", 1200],
  ["Electric Water Heater", "Laundry & Household", 2000],
  // Pumps & tools
  ["Water Pump (0.5HP)", "Pumps & Tools", 375, 2.5],
  ["Water Pump (1HP)", "Pumps & Tools", 750, 2.5],
  ["Borehole Submersible Pump (1.5HP)", "Pumps & Tools", 1100, 2.5],
  ["Electric Gate Motor", "Pumps & Tools", 300, 2.5],
  // Commercial
  ["Hair Clipper", "Commercial", 15],
  ["Barbing Salon Dryer (hood)", "Commercial", 1000],
  ["Sewing Machine (electric)", "Commercial", 100, 2.0],
  ["Industrial Sewing Machine", "Commercial", 400, 2.0],
  ["Cash Register", "Commercial", 30],
];

export const APPLIANCES = APPLIANCE_ROWS.map(([name, category, watts, surgeFactor = 1, isAirConditioner = false]) => ({
  name,
  category,
  watts,
  surgeFactor,
  isAirConditioner,
}));
