import type { BatteryChemistry } from "../../shared/domain";

/** Bump on any change that can alter a sizing result. Stored on every audit row and quote. */
export const ENGINE_VERSION = "1.0.0";

/** Inverter kVA = surge-adjusted peak kW ÷ 0.80 (PRD §13.3). */
export const INVERTER_DERATING = 0.8;
/** Largest single inverter the platform will specify (PRD §13.3, FR-015). */
export const MAX_INVERTER_KVA = 12;

/** Panel field derating × system losses = 0.72 effective (PRD §13.5, §17.2). */
export const PANEL_DERATING = 0.8;
export const SYSTEM_LOSS_FACTOR = 0.9;

/** Extra capacity on top of the calculated battery requirement (PRD §13.4). */
export const BATTERY_SAFETY_MARGIN = 1.1;

/** Nominal voltage of a lead-acid block; strings are built from these in series. */
export const LEAD_ACID_BLOCK_VOLTAGE = 12;

export interface ChemistryParams {
  depthOfDischarge: number;
  roundTripEfficiency: number;
  inverterEfficiency: number;
}

/** PRD §15.1. */
export const CHEMISTRY_PARAMS: Record<BatteryChemistry, ChemistryParams> = {
  lithium: { depthOfDischarge: 0.8, roundTripEfficiency: 0.95, inverterEfficiency: 0.95 },
  gel: { depthOfDischarge: 0.5, roundTripEfficiency: 0.8, inverterEfficiency: 0.92 },
  tubular: { depthOfDischarge: 0.5, roundTripEfficiency: 0.8, inverterEfficiency: 0.92 },
};

export const VAT_RATE = 0.075;

/** Single custom appliances above this are flagged as a likely data-entry error (PRD §44). */
export const CUSTOM_APPLIANCE_OUTLIER_WATTS = 5000;
