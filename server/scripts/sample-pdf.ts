// Renders a sample quotation PDF without a database, for visual review.
// Usage: npx tsx server/scripts/sample-pdf.ts <out.pdf>
import { writeFile } from "node:fs/promises";
import { DEFAULT_ENGINE_SETTINGS, DEFAULT_PRICING_SETTINGS } from "../../shared/settings";
import { calculateSystem, priceBom } from "../engine";
import { load, regionSunHours, seedCatalogue } from "../engine/__tests__/fixtures";
import { loadPdfAssets } from "../pdf/assets";
import { renderQuotePdf } from "../pdf/quote-pdf";
import { quoteView, type QuoteRow } from "../quotes/service";

const loads = [
  load("Air Conditioner (1.5HP)", 2, 0, 8),
  load('TV (55" LED)', 1, 4, 4),
  load("LED Bulb (9W)", 8, 0, 6),
  load("Refrigerator (Double Door)", 1, 11, 13),
  load("Ceiling Fan", 2, 8, 0),
];
const result = calculateSystem({ loads, sunHours: regionSunHours("Middle Belt"), batteryChemistry: "lithium", engineerOverride: false, catalogue: seedCatalogue(), settings: DEFAULT_ENGINE_SETTINGS });
const pricing = priceBom(result.bom, { ...DEFAULT_PRICING_SETTINGS, marginPct: 10, labourFlatFeeNgn: 250_000 });
const now = new Date();
const row = {
  id: "sample", reference: "PS-202610-SAMPLE", userId: null, installerId: "i", clientName: "Mrs Adaeze Okafor", state: "FCT",
  status: "generated", flags: [], shareToken: "x", inputs: { request: { state: "FCT" }, loads }, result, bom: result.bom, pricing,
  totalCostNgn: pricing.totalNgn, engineVersion: result.engineVersion, calcAuditId: "c", createdAt: now,
  expiresAt: new Date(now.getTime() + 30 * 86_400_000),
} as QuoteRow;
const bytes = await renderQuotePdf(quoteView(row, { preparedBy: "Emeka Solar Ltd" }), await loadPdfAssets(), { publicUrl: "https://pandasolution.ng" });
await writeFile(process.argv[2] ?? "sample-quote.pdf", bytes);
console.log(`Wrote ${bytes.length} bytes`);
