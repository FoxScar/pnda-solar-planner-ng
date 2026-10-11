import { VAT_RATE } from "./constants";
import type { BomLine } from "./types";

export interface PricingOptions {
  /** Installer margin as a percentage of equipment cost (e.g. 15 for 15%). */
  marginPct?: number;
  labourFlatFeeNgn?: number;
}

export interface Pricing {
  equipmentSubtotalNgn: number;
  marginNgn: number;
  labourNgn: number;
  vatNgn: number;
  totalNgn: number;
  vatRate: number;
}

/** PRD §28.1: equipment × (1 + margin) + labour, then 7.5% VAT on top. Whole naira. */
export function priceBom(bom: BomLine[], { marginPct = 0, labourFlatFeeNgn = 0 }: PricingOptions = {}): Pricing {
  const equipmentSubtotalNgn = bom.reduce((sum, l) => sum + l.quantity * l.unitPriceNgn, 0);
  const marginNgn = Math.round(equipmentSubtotalNgn * (marginPct / 100));
  const labourNgn = Math.round(labourFlatFeeNgn);
  const vatNgn = Math.round((equipmentSubtotalNgn + marginNgn + labourNgn) * VAT_RATE);
  return {
    equipmentSubtotalNgn,
    marginNgn,
    labourNgn,
    vatNgn,
    totalNgn: equipmentSubtotalNgn + marginNgn + labourNgn + vatNgn,
    vatRate: VAT_RATE,
  };
}
