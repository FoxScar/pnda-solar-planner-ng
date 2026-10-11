import { LEAD_ACID_BLOCK_VOLTAGE } from "./constants";
import { EngineError } from "./errors";
import type { BatterySku, InverterSku } from "./types";

export interface BankLine {
  battery: BatterySku;
  seriesCount: number;
}

/**
 * Compatibility guard (PRD §13, §18, §23.1). Throws a typed error on the first
 * violation. Runs on every engine result and backs the validate-config endpoint.
 */
export function assertCompatible(inverter: InverterSku, bank: BankLine[]): void {
  if (inverter.kva >= 5 && inverter.dcVoltage !== 48) {
    throw new EngineError(
      "VOLTAGE_MISMATCH",
      `${inverter.model} is rated ${inverter.kva}kVA; inverters of 5kVA and above must run on a 48V battery bank.`,
      "inverter",
    );
  }

  const chemistries = new Set(bank.map((l) => l.battery.chemistry));
  if (chemistries.size > 1) {
    throw new EngineError(
      "CHEMISTRY_MIXED",
      "Different battery types cannot be mixed in one system. Choose lithium, gel or tubular — not a combination.",
      "batteries",
      { chemistries: [...chemistries] },
    );
  }

  const skus = new Set(bank.map((l) => l.battery.sku));
  if (skus.size > 1) {
    throw new EngineError(
      "CAPACITY_MIXED",
      "Every battery in a bank must be the same model and capacity.",
      "batteries",
      { skus: [...skus] },
    );
  }

  for (const { battery, seriesCount } of bank) {
    const stringVoltage = battery.dcVoltage * seriesCount;
    const isLithium = battery.chemistry === "lithium";
    const valid = isLithium
      ? seriesCount === 1 && battery.dcVoltage === inverter.dcVoltage
      : battery.dcVoltage === LEAD_ACID_BLOCK_VOLTAGE && stringVoltage === inverter.dcVoltage;
    if (!valid) {
      throw new EngineError(
        "VOLTAGE_MISMATCH",
        `${battery.model} ${isLithium ? "is" : `in strings of ${seriesCount} gives`} ${stringVoltage}V, ` +
          `but ${inverter.model} needs a ${inverter.dcVoltage}V battery bank.`,
        "batteries",
        { batteryVoltage: stringVoltage, inverterVoltage: inverter.dcVoltage },
      );
    }
  }
}
