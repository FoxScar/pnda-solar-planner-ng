import { selectBattery } from "./battery";
import { ENGINE_VERSION } from "./constants";
import { EngineError } from "./errors";
import { assertCompatible } from "./guard";
import { qualifyingInverters } from "./inverter";
import { computeLoadProfile } from "./load";
import { sizePanels } from "./panels";
import type { BomLine, EngineInput, EngineResult, EngineWarning, SunHoursInput, ValidationCheck } from "./types";

export { ENGINE_VERSION } from "./constants";
export { EngineError } from "./errors";
export { assertCompatible } from "./guard";
export { priceBom, type Pricing, type PricedLine } from "./pricing";
export type * from "./types";

function designSunHours(sun: SunHoursInput, basis: EngineInput["settings"]["sunHoursBasis"]): number {
  return basis === "wet" ? sun.wetSeason : basis === "dry" ? sun.drySeason : sun.annualAvg;
}

/**
 * The solar decision engine (Developer Calculation Schematics §1–§5, §7).
 * Pure and deterministic: all data and parameters come in through `input`.
 *
 * Order: load → chemistry rule → for each qualifying inverter, smallest first:
 * battery bank at its voltage → panels (combined rule + energy check + PV input)
 * → the first inverter with a complete valid system wins → validation report.
 */
export function calculateSystem(input: EngineInput): EngineResult {
  const { loads, sunHours, batteryChemistry, engineerOverride, catalogue, settings } = input;
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
    warnings.push({ code: "ENGINEER_OVERRIDE_LEAD_ACID_AC", message: "Engineer override: lead-acid batteries specified for a system with air conditioning." });
  }

  const sun = designSunHours(sunHours, settings.sunHoursBasis);
  if (!(sun > 0)) throw new EngineError("STATE_NOT_FOUND", "Valid sun-hour data is required for this state.", "state");
  if (sunHours.isFallback) {
    warnings.push({ code: "SUN_HOURS_FALLBACK", message: `No sun-hour data for this state; the national default of ${sun} hours was used.` });
  }

  const reasons: string[] = [];
  let lastError: EngineError | null = null;
  for (const inverter of qualifyingInverters(load, catalogue.inverters, settings)) {
    let battery;
    try {
      battery = selectBattery(
        {
          nightEnergyKwh: load.nightEnergyKwh,
          chemistry: batteryChemistry,
          systemVoltage: inverter.systemVoltage,
          inverterEfficiency: inverter.efficiency,
          dischargeDemandW: load.peakW / inverter.efficiency,
        },
        catalogue.batteries,
        settings,
      );
    } catch (err) {
      // Defensive: only typed engine errors mean "try the next inverter"; anything else is a bug.
      /* v8 ignore next */
      if (!(err instanceof EngineError)) throw err;
      lastError = err;
      reasons.push(`${inverter.inverter.model}: ${err.message}`);
      continue;
    }

    const panels = sizePanels(load, battery.installedKwh, sun, catalogue.panels, inverter.inverter);
    if (!panels) {
      reasons.push(`${inverter.inverter.model}: the required solar array exceeds its PV input limits.`);
      continue;
    }
    if (panels.pvInput === "unverified" && settings.requireVerifiedPvLimits) {
      reasons.push(`${inverter.inverter.model}: PV input limits are not on record.`);
      continue;
    }

    assertCompatible(inverter.inverter, [{ battery: battery.battery, seriesCount: battery.seriesCount }]);

    if (load.nightEnergyKwh === 0) {
      warnings.push({ code: "MINIMUM_BATTERY_APPLIED", message: "No night-time use was entered, so the smallest battery bank is included as a safety buffer." });
    }
    if (inverter.specsAssumed) {
      warnings.push({
        code: "INVERTER_SPECS_ASSUMED",
        message: `${inverter.inverter.model} has no continuous/surge rating on record; ${Math.round(inverter.continuousW)}W continuous and ${Math.round(inverter.surgeW)}W surge were assumed.`,
      });
    }
    if (panels.pvInput === "unverified") {
      warnings.push({
        code: "PV_INPUT_UNVERIFIED",
        message: `${inverter.inverter.model} has incomplete PV input limits on record; confirm it accepts ${panels.count} × ${panels.panel.wattsPeak}W panels.`,
      });
    }

    const checks: ValidationCheck[] = [
      {
        id: "inverter",
        status: inverter.specsAssumed ? "unverified" : "passed",
        detail: `${inverter.inverter.kva}kVA ≥ ${Math.round(inverter.requiredVa)}VA; ${Math.round(inverter.continuousW)}W continuous ≥ ${Math.round(load.peakW)}W peak; ${Math.round(inverter.surgeW)}W surge ≥ ${Math.round(load.surgeRequirementW)}W start-up.`,
      },
      { id: "battery_voltage", status: "passed", detail: `${inverter.systemVoltage}V bank matches the inverter's DC input.` },
      {
        id: "battery_bank",
        status: battery.bankDischargeW === null ? "unverified" : "passed",
        detail:
          `${battery.installedKwh}kWh installed ≥ ${battery.requiredKwh.toFixed(2)}kWh required; identical ${battery.battery.sku} units` +
          (battery.bankDischargeW === null ? "; discharge rating not on record." : `; ${battery.bankDischargeW}W discharge ≥ ${Math.round(load.peakW / inverter.efficiency)}W demand.`),
      },
      {
        id: "panel_count",
        status: "passed",
        detail: `Combined rule needs ${panels.combinedRuleCount}; daily-energy check needs ${panels.energyCheckCount}; ${panels.count} specified.`,
      },
      { id: "pv_input", status: panels.pvInput, detail: panels.pvInput === "passed" ? "Array within the inverter's PV power, voltage and current limits." : "Inverter PV limits incomplete; check against the datasheet." },
      {
        id: "energy_sufficiency",
        status: "passed",
        detail: `${panels.estimatedPvEnergyKwh.toFixed(2)}kWh/day estimated ≥ ${panels.requiredEnergyKwh.toFixed(2)}kWh (day use + full battery recovery).`,
      },
      { id: "inventory", status: "passed", detail: "All selected products are enabled and in stock." },
    ];

    const bom: BomLine[] = [
      { componentId: inverter.inverter.id, sku: inverter.inverter.sku, type: "inverter", model: inverter.inverter.model, quantity: 1, unitPriceNgn: inverter.inverter.unitPriceNgn },
      { componentId: battery.battery.id, sku: battery.battery.sku, type: "battery", model: battery.battery.model, quantity: battery.totalUnits, unitPriceNgn: battery.battery.unitPriceNgn },
      { componentId: panels.panel.id, sku: panels.panel.sku, type: "panel", model: panels.panel.model, quantity: panels.count, unitPriceNgn: panels.panel.unitPriceNgn },
    ];

    return {
      engineVersion: ENGINE_VERSION,
      systemVoltage: inverter.systemVoltage,
      batteryChemistry,
      sunHoursBasis: settings.sunHoursBasis,
      load,
      inverter,
      battery,
      panels,
      // Every check either passed or is pending datasheet data; invalid systems never get here.
      validation: { checks, quoteEligible: true },
      bom,
      warnings,
    };
  }

  // No inverter produced a valid complete system: report the limitation, never an undersized design.
  if (lastError && reasons.length === 1) throw lastError;
  throw new EngineError(
    "NO_SKU_AVAILABLE",
    "No in-stock combination of inverter, batteries and panels gives a valid system for this load.",
    "inverter",
    { reasons },
  );
}
