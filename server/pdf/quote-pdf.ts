import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { QuoteView } from "../quotes/service";
import type { PdfAssets } from "./assets";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 40;
const FOOTER_SPACE = 36;
const ORANGE = rgb(0.93, 0.45, 0.1);
const DARK = rgb(0.12, 0.12, 0.14);
const MUTED = rgb(0.42, 0.42, 0.46);
const RULE = rgb(0.86, 0.86, 0.88);
const SHADE = rgb(0.97, 0.96, 0.94);
const WARN_BG = rgb(1, 0.95, 0.88);

const naira = (n: number) => `₦${new Intl.NumberFormat("en-US").format(n)}`;
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const num = (n: number) => Number(n.toFixed(2)).toString();

const FLAG_TEXT: Record<string, string> = {
  PRICE_CHANGED: "Component prices have changed by 5% or more since this quote was generated.",
  COMPONENT_UNAVAILABLE: "One or more components in this quote are no longer available.",
};

interface Column {
  header: string;
  width: number;
  align?: "left" | "right";
}

/** Minimal flowing layout: a cursor that starts a new page when content won't fit. */
class Layout {
  page!: PDFPage;
  y = 0;
  readonly width = A4[0] - MARGIN * 2;

  constructor(
    private readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN + FOOTER_SPACE) this.newPage();
  }

  fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
  }

  text(text: string, x: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; maxWidth?: number; align?: "left" | "right" } = {}) {
    const size = opts.size ?? 10;
    const font = opts.font ?? this.regular;
    const t = opts.maxWidth ? this.fit(text, font, size, opts.maxWidth) : text;
    const drawX = opts.align === "right" && opts.maxWidth ? x + opts.maxWidth - font.widthOfTextAtSize(t, size) : x;
    this.page.drawText(t, { x: drawX, y: this.y, size, font, color: opts.color ?? DARK });
  }

  /** Wraps a paragraph to the content width. */
  paragraph(text: string, size = 9, color = MUTED) {
    const words = text.split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (this.regular.widthOfTextAtSize(candidate, size) > this.width) {
        lines.push(line);
        line = w;
      } else line = candidate;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      this.ensure(size + 4);
      this.text(l, MARGIN, { size, color });
      this.y -= size + 4;
    }
  }

  heading(text: string) {
    this.ensure(40);
    this.y -= 10;
    this.text(text, MARGIN, { size: 12, font: this.bold });
    this.y -= 6;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + this.width, y: this.y }, thickness: 1, color: ORANGE });
    this.y -= 16;
  }

  table(columns: Column[], rows: string[][]) {
    const rowH = 18;
    const drawHeader = () => {
      this.page.drawRectangle({ x: MARGIN, y: this.y - 5, width: this.width, height: rowH, color: SHADE });
      let x = MARGIN + 6;
      for (const col of columns) {
        this.text(col.header, x, { size: 9, font: this.bold, maxWidth: col.width - 12, align: col.align });
        x += col.width;
      }
      this.y -= rowH;
    };
    this.ensure(rowH * 2);
    drawHeader();
    for (const row of rows) {
      if (this.y - rowH < MARGIN + FOOTER_SPACE) {
        this.newPage();
        drawHeader(); // repeat header on continuation pages
      }
      let x = MARGIN + 6;
      row.forEach((cell, i) => {
        const col = columns[i]!;
        this.text(cell, x, { size: 9, maxWidth: col.width - 12, align: col.align });
        x += col.width;
      });
      this.page.drawLine({ start: { x: MARGIN, y: this.y - 6 }, end: { x: MARGIN + this.width, y: this.y - 6 }, thickness: 0.5, color: RULE });
      this.y -= rowH;
    }
  }
}

/** Renders the client quotation PDF (PRD §29.1) from a stored quote snapshot. */
export async function renderQuotePdf(quote: QuoteView, assets: PdfAssets, opts: { publicUrl: string; generatedAt?: Date }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Solar quotation ${quote.reference}`);
  doc.setAuthor(quote.preparedBy ?? "PandaSolution");
  doc.setCreator("PandaSolution");
  const regular = await doc.embedFont(assets.regular, { subset: true });
  const bold = await doc.embedFont(assets.bold, { subset: true });
  const logo = await doc.embedJpg(assets.logoJpg);
  const L = new Layout(doc, regular, bold);
  const { system, pricing } = quote;

  // Header
  const logoSize = 54;
  L.page.drawImage(logo, { x: MARGIN, y: L.y - logoSize + 10, width: logoSize, height: logoSize });
  L.text("PandaSolution", MARGIN + logoSize + 12, { size: 18, font: bold });
  L.y -= 18;
  L.text(quote.preparedBy ? `Prepared by ${quote.preparedBy}` : "Solar System Quotation", MARGIN + logoSize + 12, { size: 10, color: MUTED });
  const rightX = MARGIN + L.width - 190;
  L.y += 18;
  L.text(`Quote ${quote.reference}`, rightX, { size: 10, font: bold, maxWidth: 190, align: "right" });
  L.y -= 14;
  L.text(`Date: ${date(quote.createdAt)}`, rightX, { size: 9, color: MUTED, maxWidth: 190, align: "right" });
  L.y -= 12;
  L.text(`Valid until: ${date(quote.expiresAt)}`, rightX, { size: 9, color: MUTED, maxWidth: 190, align: "right" });
  L.y -= 30;

  const flagMessages = quote.flags.map((f) => FLAG_TEXT[f]).filter((m): m is string => !!m);
  if (quote.status === "expired") flagMessages.unshift("This quote has expired. Please request an updated quote before purchasing.");
  for (const message of flagMessages) {
    L.page.drawRectangle({ x: MARGIN, y: L.y - 6, width: L.width, height: 20, color: WARN_BG });
    L.text(message, MARGIN + 8, { size: 9, font: bold, maxWidth: L.width - 16 });
    L.y -= 26;
  }

  // Client summary
  L.heading("Client");
  const summary: [string, string][] = [
    ["Client", quote.clientName ?? "—"],
    ["Location", quote.state === "FCT" ? "Abuja (FCT)" : `${quote.state} State`],
    ["Prepared by", quote.preparedBy ?? "PandaSolution"],
  ];
  for (const [k, v] of summary) {
    L.text(k, MARGIN, { size: 10, color: MUTED });
    L.text(v, MARGIN + 110, { size: 10, maxWidth: L.width - 110 });
    L.y -= 15;
  }

  // System overview
  L.heading("Recommended system");
  const leadAcid = system.batteryChemistry !== "lithium";
  const overview: [string, string][] = [
    ["Inverter", system.inverter.model.includes(`${system.inverter.kva}kVA`) ? system.inverter.model : `${system.inverter.model} (${system.inverter.kva}kVA)`],
    [
      "Battery bank",
      `${system.battery.units} × ${system.battery.model} — ${num(system.battery.installedKwh)}kWh total` +
        (leadAcid ? ` (${system.battery.parallelStrings} × ${system.battery.seriesCount} in series)` : ""),
    ],
    ["Solar array", `${system.panels.count} × ${system.panels.model} — ${num(system.panels.arrayKwp)}kWp total`],
    ["System voltage", `${system.systemVoltage}V DC`],
  ];
  for (const [k, v] of overview) {
    L.ensure(15);
    L.text(k, MARGIN, { size: 10, color: MUTED });
    L.text(v, MARGIN + 110, { size: 10, maxWidth: L.width - 110 });
    L.y -= 15;
  }

  // Appliances (no wattage — FR-003)
  L.heading("Your appliances");
  L.table(
    [
      { header: "Appliance", width: L.width - 240 },
      { header: "Qty", width: 60, align: "right" },
      { header: "Daytime hrs", width: 90, align: "right" },
      { header: "Night hrs", width: 90, align: "right" },
    ],
    quote.appliances.map((a) => [a.name, String(a.quantity), num(a.dayHours), num(a.nightHours)]),
  );

  // Bill of materials
  L.heading("Bill of materials");
  const typeLabel: Record<string, string> = { inverter: "Inverter", battery: "Battery", panel: "Solar panel" };
  L.table(
    [
      { header: "Component", width: 85 },
      { header: "Model", width: L.width - 85 - 45 - 95 - 105 },
      { header: "Qty", width: 45, align: "right" },
      { header: "Unit price", width: 95, align: "right" },
      { header: "Line total", width: 105, align: "right" },
    ],
    pricing.lines.map((l) => [typeLabel[l.type] ?? l.type, l.model, String(l.quantity), naira(l.unitPriceNgn), naira(l.lineTotalNgn)]),
  );

  // Cost summary
  L.y -= 6;
  const totals: [string, string, boolean][] = [
    ["Equipment subtotal", naira(pricing.equipmentSubtotalNgn), false],
    ...(pricing.installationFeeNgn > 0
      ? [[`Installation (${num(pricing.installationRate * 100)}%)`, naira(pricing.installationFeeNgn), false] as [string, string, boolean]]
      : []),
    ...(pricing.labourNgn > 0 ? [["Other fees", naira(pricing.labourNgn), false] as [string, string, boolean]] : []),
    ...(pricing.discountNgn > 0 ? [["Discount", `−${naira(pricing.discountNgn)}`, false] as [string, string, boolean]] : []),
    ...(pricing.vatRate > 0 ? [[`VAT (${num(pricing.vatRate * 100)}%)`, naira(pricing.vatNgn), false] as [string, string, boolean]] : []),
    ["Grand total", naira(pricing.totalNgn), true],
  ];
  const labelX = MARGIN + L.width - 330;
  for (const [label, value, strong] of totals) {
    L.ensure(20);
    if (strong) L.page.drawRectangle({ x: labelX - 8, y: L.y - 6, width: 338, height: 20, color: SHADE });
    L.text(label, labelX, { size: strong ? 11 : 10, font: strong ? bold : regular });
    L.text(value, labelX + 130, { size: strong ? 11 : 10, font: strong ? bold : regular, maxWidth: 190, align: "right" });
    L.y -= strong ? 24 : 16;
  }

  // Notices
  L.heading("Validity and disclaimer");
  L.paragraph(`This quote is valid for 30 days, until ${date(quote.expiresAt)}. Prices are subject to change after that date or if supplier prices move.`);
  L.y -= 4;
  L.paragraph(
    "This system is sized for the load profile listed above: the appliances, quantities and daily hours you provided, using rainy-season sunshine for your state. " +
      "Its accuracy depends on that information being correct. A site survey by a qualified installer is recommended before purchase.",
  );

  // Footer on every page
  const generated = (opts.generatedAt ?? new Date()).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: MARGIN + 14 }, end: { x: A4[0] - MARGIN, y: MARGIN + 14 }, thickness: 0.5, color: RULE });
    p.drawText(`PandaSolution · ${opts.publicUrl.replace(/^https?:\/\//, "")} · Generated ${generated}`, { x: MARGIN, y: MARGIN, size: 8, font: regular, color: MUTED });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: A4[0] - MARGIN - regular.widthOfTextAtSize(label, 8), y: MARGIN, size: 8, font: regular, color: MUTED });
  });

  return doc.save();
}
