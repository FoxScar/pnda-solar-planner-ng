import { VAT_RATE } from "./constants";
import type { BomLine } from "./types";

export interface PricingOptions {
  /** Installer margin as a percentage of equipment cost (e.g. 15 for 15%). */
  marginPct?: number;
  labourFlatFeeNgn?: number;
}

export interface PricedLine {
  sku: string;
  type: BomLine["type"];
  model: string;
  quantity: number;
  /** Client-facing unit price, margin included. */
  unitPriceNgn: number;
  lineTotalNgn: number;
}

export interface Pricing {
  lines: PricedLine[];
  /** Sum of client-facing line totals (margin included). */
  equipmentSubtotalNgn: number;
  /** Portion of the subtotal that is installer margin (never shown to the client). */
  marginNgn: number;
  marginPct: number;
  labourNgn: number;
  vatNgn: number;
  totalNgn: number;
  vatRate: number;
}

/**
 * PRD §28.1: equipment × (1 + margin) + labour, then 7.5% VAT. The margin is
 * folded into each unit price so client documents show Equipment / Labour /
 * VAT / Total only (§29.1). Whole naira throughout.
 */
export function priceBom(bom: BomLine[], { marginPct = 0, labourFlatFeeNgn = 0 }: PricingOptions = {}): Pricing {
  const lines = bom.map((l) => {
    const unitPriceNgn = Math.round(l.unitPriceNgn * (1 + marginPct / 100));
    return { sku: l.sku, type: l.type, model: l.model, quantity: l.quantity, unitPriceNgn, lineTotalNgn: unitPriceNgn * l.quantity };
  });
  const baseSubtotal = bom.reduce((sum, l) => sum + l.quantity * l.unitPriceNgn, 0);
  const equipmentSubtotalNgn = lines.reduce((sum, l) => sum + l.lineTotalNgn, 0);
  const labourNgn = Math.round(labourFlatFeeNgn);
  const vatNgn = Math.round((equipmentSubtotalNgn + labourNgn) * VAT_RATE);
  return {
    lines,
    equipmentSubtotalNgn,
    marginNgn: equipmentSubtotalNgn - baseSubtotal,
    marginPct,
    labourNgn,
    vatNgn,
    totalNgn: equipmentSubtotalNgn + labourNgn + vatNgn,
    vatRate: VAT_RATE,
  };
}
