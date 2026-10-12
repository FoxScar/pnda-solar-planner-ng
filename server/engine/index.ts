import { requiredBatteryKwh, selectBattery } from "./battery";
import { CHEMISTRY_PARAMS, ENGINE_VERSION } from "./constants";
import { EngineError } from "./errors";
import { assertCompatible } from "./guard";
import { selectInverter } from "./inverter";
import { computeLoadProfile } from "./load";
import { sizePanels } from "./panels";
import type { BomLine, EngineInput, EngineResult, EngineWarning } from "./types";

export { ENGINE_VERSION } from "./constants";
export { EngineError } from "./errors";
export { assertCompatible } from "./guard";
export { priceBom, type Pricing, type PricedLine } from "./pricing";
export type * from "./types";

/**
 * The solar decision engine (PRD §14). Pure and deterministic: all data comes
 * in through `input`, nothing is fetched or written here.
 *
 * Order: load → chemistry rule → panels → inverter (needs the array size for
 * its PV-input limit) → battery (needs the system voltage) → compatibility guard.
 */
export function calculateSystem(input: EngineInput): EngineResult {
  const { loads, sunHours, batteryChemistry, engineerOverride, catalogue } = input;
  const warnings: EngineWarning[] = [];

  if (loads.length === 0) {
    throw new EngineError("INVALID_PAYLOAD", "Add at least one appliance.", "appliances");
  }

  const load = computeLoadProfile(loads);

  if (load.hasAirConditioner && batteryChemistry !== "lithium") {
    if (!engineerOverride) {
      throw new EngineError(
        "CHEMISTRY_RESTRICTED",
        "Air conditioners draw heavy current that wears out gel and tubular batteries quickly. " +
          "Systems with an air conditioner need lithium batteries.",
        "batteryChemistry",
      );
    }
    warnings.push({
      code: "ENGINEER_OVERRIDE_LEAD_ACID_AC",
      message: "Engineer override: lead-acid batteries specified for a system with air conditioning.",
    });
  }

  if (sunHours.isFallback) {
    warnings.push({
      code: "SUN_HOURS_FALLBACK",
      message: `No sun-hour data for this state; the national default of ${sunHours.wetSeason} hours was used.`,
    });
  }

  const params = CHEMISTRY_PARAMS[batteryChemistry];
  const panels = sizePanels(load, params, sunHours, catalogue.panels);
  const { pvInputUnverified, ...inverter } = selectInverter(
    load.designPeakKw,
    panels.arrayKwp * 1000,
    catalogue.inverters,
  );
  if (pvInputUnverified) {
    warnings.push({
      code: "PV_INPUT_UNVERIFIED",
      message: `${inverter.inverter.model} has no PV input limit on record; confirm it accepts a ${panels.arrayKwp}kWp array.`,
    });
  }

  const battery = selectBattery(
    requiredBatteryKwh(load.nightEnergyKwh, params),
    batteryChemistry,
    inverter.systemVoltage,
    catalogue.batteries,
  );
  if (load.nightEnergyKwh === 0) {
    warnings.push({
      code: "MINIMUM_BATTERY_APPLIED",
      message: "No night-time use was entered, so the smallest battery bank is included as a safety buffer.",
    });
  }

  assertCompatible(inverter.inverter, [{ battery: battery.battery, seriesCount: battery.seriesCount }]);

  const bom: BomLine[] = [
    { componentId: inverter.inverter.id, sku: inverter.inverter.sku, type: "inverter", model: inverter.inverter.model, quantity: 1, unitPriceNgn: inverter.inverter.unitPriceNgn },
    { componentId: battery.battery.id, sku: battery.battery.sku, type: "battery", model: battery.battery.model, quantity: battery.totalUnits, unitPriceNgn: battery.battery.unitPriceNgn },
    { componentId: panels.panel.id, sku: panels.panel.sku, type: "panel", model: panels.panel.model, quantity: panels.count, unitPriceNgn: panels.panel.unitPriceNgn },
  ];

  return {
    engineVersion: ENGINE_VERSION,
    systemVoltage: inverter.systemVoltage,
    batteryChemistry,
    load,
    panels,
    inverter,
    battery,
    bom,
    warnings,
  };
}
