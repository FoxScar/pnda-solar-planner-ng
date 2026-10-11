import type { BatteryChemistry } from "../../shared/domain";

/** One appliance line with its catalogue data already resolved. */
export interface LoadItem {
  name: string;
  watts: number;
  surgeFactor: number;
  isAirConditioner: boolean;
  quantity: number;
  dayHours: number;
  nightHours: number;
}

export interface SunHoursInput {
  wetSeason: number;
  drySeason: number;
  annualAvg: number;
  /** True when the state had no record and the national default was used. */
  isFallback: boolean;
}

export interface InverterSku {
  id: string;
  sku: string;
  model: string;
  kva: number;
  dcVoltage: number;
  unitPriceNgn: number;
  /** Max PV array the built-in charge controller accepts. Unknown → not checked. */
  maxPvInputW: number | null;
}

export interface BatterySku {
  id: string;
  sku: string;
  model: string;
  chemistry: BatteryChemistry;
  dcVoltage: number;
  capacityKwh: number;
  capacityAh: number | null;
  unitPriceNgn: number;
}

export interface PanelSku {
  id: string;
  sku: string;
  model: string;
  wattsPeak: number;
  unitPriceNgn: number;
}

/** Active inventory the engine may choose from. */
export interface Catalogue {
  inverters: InverterSku[];
  batteries: BatterySku[];
  panels: PanelSku[];
}

export interface EngineInput {
  loads: LoadItem[];
  sunHours: SunHoursInput;
  batteryChemistry: BatteryChemistry;
  /** Engineer may allow lead-acid on an AC system (FR-019). Caller must check the role. */
  engineerOverride: boolean;
  catalogue: Catalogue;
}

export type WarningCode =
  | "SUN_HOURS_FALLBACK"
  | "MINIMUM_BATTERY_APPLIED"
  | "ENGINEER_OVERRIDE_LEAD_ACID_AC"
  | "PV_INPUT_UNVERIFIED"
  | "CUSTOM_WATTAGE_HIGH";

export interface EngineWarning {
  code: WarningCode;
  message: string;
}

export interface LoadProfile {
  dayEnergyKwh: number;
  nightEnergyKwh: number;
  dayRunningPeakKw: number;
  nightRunningPeakKw: number;
  daySurgePeakKw: number;
  nightSurgePeakKw: number;
  /** The larger of the day and night surge-adjusted peaks: the inverter must handle both. */
  designPeakKw: number;
  hasAirConditioner: boolean;
}

export interface PanelSizing {
  rechargeEnergyKwh: number;
  totalPanelEnergyKwh: number;
  designSunHours: number;
  requiredKwp: number;
  panel: PanelSku;
  count: number;
  arrayKwp: number;
  /** Expected daily yield on the design (wet-season) and dry-season sun hours. */
  wetSeasonYieldKwh: number;
  drySeasonYieldKwh: number;
}

export interface InverterSelection {
  requiredKvaForLoad: number;
  inverter: InverterSku;
  systemVoltage: number;
}

export interface BatterySizing {
  requiredKwh: number;
  battery: BatterySku;
  /** Units in series per string (1 for lithium modules at system voltage). */
  seriesCount: number;
  parallelStrings: number;
  totalUnits: number;
  installedKwh: number;
}

export interface BomLine {
  componentId: string;
  sku: string;
  type: "inverter" | "battery" | "panel";
  model: string;
  quantity: number;
  unitPriceNgn: number;
}

export interface EngineResult {
  engineVersion: string;
  systemVoltage: number;
  batteryChemistry: BatteryChemistry;
  load: LoadProfile;
  panels: PanelSizing;
  inverter: InverterSelection;
  battery: BatterySizing;
  bom: BomLine[];
  warnings: EngineWarning[];
}
