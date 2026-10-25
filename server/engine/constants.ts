/** Bump on any change that can alter a sizing result. Stored on every audit row and quote. */
export const ENGINE_VERSION = "2.0.0";

/** Largest single inverter the platform will specify; above this a phase-split design is needed. */
export const MAX_INVERTER_KVA = 12;

/** Nominal voltage of a lead-acid block; strings are built from these in series. */
export const LEAD_ACID_BLOCK_VOLTAGE = 12;

/**
 * Panel Voc rises as cells cool. Nigeria's coldest mornings are mild, so a 5%
 * allowance is used when checking string voltage against the inverter's PV limit.
 */
export const PV_VOC_COLD_FACTOR = 1.05;

/** Single custom appliances above this are flagged as a likely data-entry error (PRD §44). */
export const CUSTOM_APPLIANCE_OUTLIER_WATTS = 5000;
