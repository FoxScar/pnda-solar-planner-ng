import type { PricingSettings } from "../../shared/settings";
import type { BomLine } from "./types";

export interface PricingOptions extends PricingSettings {
  /** Installer margin as a percentage of equipment cost (e.g. 15 for 15%). */
  marginPct?: number;
  /** Other fees, e.g. an installer's flat labour fee. */
  labourFlatFeeNgn?: number;
  discountNgn?: number;
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
  installationRate: number;
  installationFeeNgn: number;
  labourNgn: number;
  discountNgn: number;
  vatRate: number;
  vatNgn: number;
  totalNgn: number;
}

/**
 * Schematics §6, whole naira:
 *   item total       = quantity × current authorised unit price (installer margin folded in)
 *   installation fee = subtotal × configured installation rate
 *   total            = subtotal + installation fee + other fees − discounts (+ VAT at the configured rate)
 */
export function priceBom(bom: BomLine[], opts: PricingOptions): Pricing {
  const { marginPct = 0, labourFlatFeeNgn = 0, discountNgn = 0, installationRate, vatRate } = opts;
  const lines = bom.map((l) => {
    const unitPriceNgn = Math.round(l.unitPriceNgn * (1 + marginPct / 100));
    return { sku: l.sku, type: l.type, model: l.model, quantity: l.quantity, unitPriceNgn, lineTotalNgn: unitPriceNgn * l.quantity };
  });
  const baseSubtotal = bom.reduce((sum, l) => sum + l.quantity * l.unitPriceNgn, 0);
  const equipmentSubtotalNgn = lines.reduce((sum, l) => sum + l.lineTotalNgn, 0);
  const installationFeeNgn = Math.round(equipmentSubtotalNgn * installationRate);
  const labourNgn = Math.round(labourFlatFeeNgn);
  const discount = Math.round(discountNgn);
  const beforeVat = equipmentSubtotalNgn + installationFeeNgn + labourNgn - discount;
  const vatNgn = Math.round(beforeVat * vatRate);
  return {
    lines,
    equipmentSubtotalNgn,
    marginNgn: equipmentSubtotalNgn - baseSubtotal,
    marginPct,
    installationRate,
    installationFeeNgn,
    labourNgn,
    discountNgn: discount,
    vatRate,
    vatNgn,
    totalNgn: beforeVat + vatNgn,
  };
}
