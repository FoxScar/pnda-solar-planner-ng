import type { BatteryChemistry } from "../../shared/domain";
import type { EngineSettings } from "../../shared/settings";

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
  /** null → engine settings default. */
  efficiency: number | null;
  /** Continuous real power (W). null → kVA × power factor. */
  continuousW: number | null;
  /** Surge real power (W). null → continuous × default surge multiplier. */
  surgeW: number | null;
  /** PV input limits; null = unknown (check reported as unverified). */
  maxPvInputW: number | null;
  maxPvVoc: number | null;
  maxPvIsc: number | null;
  mpptCount: number | null;
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
  /** null → chemistry default from engine settings. */
  depthOfDischarge: number | null;
  dischargeEfficiency: number | null;
  /** Max continuous discharge power per unit (W); null = not checked. */
  maxDischargeW: number | null;
}

export interface PanelSku {
  id: string;
  sku: string;
  model: string;
  wattsPeak: number;
  unitPriceNgn: number;
  /** Usable output relative to nameplate, losses included (schematics §4). */
  performanceFactor: number;
  voc: number | null;
  isc: number | null;
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
  settings: EngineSettings;
}

export type WarningCode =
  | "SUN_HOURS_FALLBACK"
  | "MINIMUM_BATTERY_APPLIED"
  | "ENGINEER_OVERRIDE_LEAD_ACID_AC"
  | "PV_INPUT_UNVERIFIED"
  | "INVERTER_SPECS_ASSUMED"
  | "CUSTOM_WATTAGE_HIGH";

export interface EngineWarning {
  code: WarningCode;
  message: string;
}

export interface LoadProfile {
  dayEnergyKwh: number;
  nightEnergyKwh: number;
  totalEnergyKwh: number;
  /** Sum of running watts for the period, all-overlap assumption (§1). */
  dayPeakW: number;
  nightPeakW: number;
  /** max(dayPeakW, nightPeakW): used for inverter VA and the panel combined rule. */
  peakW: number;
  /** Peak running watts plus the largest single-appliance start-up delta, worst period. */
  surgeRequirementW: number;
  hasAirConditioner: boolean;
}

export interface InverterSelection {
  inverter: InverterSku;
  systemVoltage: number;
  requiredVa: number;
  continuousW: number;
  surgeW: number;
  efficiency: number;
  /** True when continuous/surge came from defaults rather than the product record. */
  specsAssumed: boolean;
}

export interface BatterySizing {
  requiredKwh: number;
  depthOfDischarge: number;
  dischargeEfficiency: number;
  battery: BatterySku;
  /** Units in series per string (1 for lithium modules at system voltage). */
  seriesCount: number;
  parallelStrings: number;
  totalUnits: number;
  installedKwh: number;
  /** Bank discharge power (W) when the product rating is known. */
  bankDischargeW: number | null;
}

export type PvCheck = "passed" | "unverified";

export interface PanelSizing {
  panel: PanelSku;
  sunHours: number;
  effectivePanelW: number;
  chargingW: number;
  combinedW: number;
  /** Count from the combined rule (§4C). */
  combinedRuleCount: number;
  /** Count needed to pass the daily-energy check (§4D). */
  energyCheckCount: number;
  count: number;
  governedBy: "combined_rule" | "energy_check";
  arrayWattsPeak: number;
  estimatedPvEnergyKwh: number;
  requiredEnergyKwh: number;
  pvInput: PvCheck;
}

export interface ValidationCheck {
  id: "inverter" | "battery_voltage" | "battery_bank" | "panel_count" | "pv_input" | "energy_sufficiency" | "inventory";
  status: "passed" | "unverified";
  detail: string;
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
  sunHoursBasis: EngineSettings["sunHoursBasis"];
  load: LoadProfile;
  inverter: InverterSelection;
  battery: BatterySizing;
  panels: PanelSizing;
  validation: { checks: ValidationCheck[]; quoteEligible: boolean };
  bom: BomLine[];
  warnings: EngineWarning[];
}
