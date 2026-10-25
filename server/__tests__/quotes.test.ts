import { eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { afterAll, describe, expect, it } from "vitest";
import { adEvents, appliances, components, installerMargins, quoteCalcAudit, quotes, userProfiles } from "../db/schema";
import { createHarness } from "./harness";

const h = createHarness();
afterAll(() => h.sql.end());

const ip = () => ({ "x-forwarded-for": `10.9.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` });

async function idOf(name: string) {
  const [row] = await h.db.select({ id: appliances.id }).from(appliances).where(eq(appliances.name, name));
  return row!.id;
}

const REF_BODIES = {
  "REF-001": async () => ({
    state: "Lagos",
    appliances: [
      { applianceId: await idOf("Ceiling Fan"), quantity: 3, dayHours: 8, nightHours: 8 },
      { applianceId: await idOf('TV (43" LED)'), quantity: 1, dayHours: 4, nightHours: 4 },
      { applianceId: await idOf("LED Bulb (9W)"), quantity: 5, dayHours: 0, nightHours: 6 },
      { applianceId: await idOf("Refrigerator (Single Door)"), quantity: 1, dayHours: 11, nightHours: 13 },
    ],
  }),
  "REF-002": async () => ({
    state: "FCT",
    appliances: [
      { applianceId: await idOf("Air Conditioner (1.5HP)"), quantity: 2, dayHours: 0, nightHours: 8 },
      { applianceId: await idOf('TV (55" LED)'), quantity: 1, dayHours: 4, nightHours: 4 },
      { applianceId: await idOf("LED Bulb (9W)"), quantity: 8, dayHours: 0, nightHours: 6 },
      { applianceId: await idOf("Refrigerator (Double Door)"), quantity: 1, dayHours: 11, nightHours: 13 },
      { applianceId: await idOf("Ceiling Fan"), quantity: 2, dayHours: 8, nightHours: 0 },
    ],
  }),
  "REF-003": async () => ({
    state: "Kano",
    appliances: [
      { applianceId: await idOf("Photocopier"), quantity: 1, dayHours: 4, nightHours: 0 },
      { applianceId: await idOf("Industrial Fan"), quantity: 2, dayHours: 10, nightHours: 0 },
      { applianceId: await idOf("Deep Freezer (Commercial)"), quantity: 1, dayHours: 11, nightHours: 13 },
      { applianceId: await idOf("LED Tube Light"), quantity: 6, dayHours: 10, nightHours: 2 },
    ],
  }),
};

async function calculate(cookie?: string, ref: keyof typeof REF_BODIES = "REF-001") {
  const res = await h.request("/api/v1/calculate", { method: "POST", cookie, headers: ip(), json: await REF_BODIES[ref]() });
  expect(res.status).toBe(200);
  return res.body!.data as { calculationId: string; bom: { sku: string; unitPriceNgn: number }[] };
}

async function saveQuote(cookie: string, calculationId: string, clientName?: string) {
  const res = await h.request("/api/v1/quotes", { method: "POST", cookie, json: { calculationId, clientName } });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body!.data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function pdfOf(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, doc: await PDFDocument.load(bytes) };
}

async function rawRequest(path: string, cookie?: string) {
  const headers = new Headers({ origin: "http://localhost:8080" });
  if (cookie) headers.set("cookie", cookie);
  return h.app.request(`http://localhost${path}`, { headers });
}

async function completeAd(cookie: string, quoteId: string) {
  const start = await h.request(`/api/v1/quotes/${quoteId}/ad/start`, { method: "POST", cookie });
  const adEventId = start.body!.data.adEventId as string;
  await h.db.update(adEvents).set({ startedAt: sql`now() - interval '16 seconds'` }).where(eq(adEvents.id, adEventId));
  const done = await h.request(`/api/v1/quotes/${quoteId}/ad/complete`, { method: "POST", cookie, json: { adEventId } });
  expect(done.status).toBe(200);
  return done.body!.data;
}

describe("saving quotes", () => {
  it("requires an account", async () => {
    const { calculationId } = await calculate();
    const res = await h.request("/api/v1/quotes", { method: "POST", json: { calculationId } });
    expect(res.status).toBe(401);
  });

  it("lets a guest save their calculation after signing in, with a reference and 30-day expiry", async () => {
    const { calculationId } = await calculate();
    const { cookie } = await h.signUp();
    const quote = await saveQuote(cookie, calculationId, "Mrs Adaeze Okafor");
    expect(quote.reference).toMatch(/^PS-\d{6}-[A-Z2-9]{6}$/);
    expect(quote).toMatchObject({ status: "generated", flags: [], clientName: "Mrs Adaeze Okafor", state: "Lagos", unlocked: false });
    const days = (Date.parse(quote.expiresAt) - Date.parse(quote.createdAt)) / 86_400_000;
    expect(days).toBeCloseTo(30, 3);
    expect(quote.appliances[0]).toEqual({ name: "Ceiling Fan", quantity: 3, dayHours: 8, nightHours: 8 });
    expect(JSON.stringify(quote)).not.toMatch(/"watts"|EnergyKwh|PeakKw/);
  });

  it("refuses calculations made under an older engine version", async () => {
    const { cookie } = await h.signUp();
    const { calculationId } = await calculate(cookie);
    const [row] = await h.db.select().from(quoteCalcAudit).where(eq(quoteCalcAudit.id, calculationId));
    const [old] = await h.db.insert(quoteCalcAudit).values({ userId: row!.userId, inputs: row!.inputs, stepResults: row!.stepResults, engineVersion: "1.0.0" }).returning();
    const res = await h.request("/api/v1/quotes", { method: "POST", cookie, json: { calculationId: old!.id } });
    expect(res.status).toBe(409);
    expect(res.body?.error.message).toMatch(/calculate your system again/);
  });

  it("will not save another user's calculation", async () => {
    const alice = await h.signUp();
    const { calculationId } = await calculate(alice.cookie);
    const bob = await h.signUp();
    const res = await h.request("/api/v1/quotes", { method: "POST", cookie: bob.cookie, json: { calculationId } });
    expect(res.status).toBe(404);
  });

  it("prices the quote at today's prices, and refuses out-of-stock parts", async () => {
    const { cookie } = await h.signUp();
    const { calculationId } = await calculate(cookie);
    await h.db.update(components).set({ unitPriceNgn: 115_000 }).where(eq(components.sku, "PNL-MONO-400"));
    const quote = await saveQuote(cookie, calculationId);
    expect(quote.pricing.lines.find((l: { sku: string }) => l.sku === "PNL-MONO-400").unitPriceNgn).toBe(115_000);
    await h.db.update(components).set({ unitPriceNgn: 110_000 }).where(eq(components.sku, "PNL-MONO-400"));

    const second = await calculate(cookie);
    await h.db.update(components).set({ isActive: false }).where(eq(components.sku, "PNL-MONO-400"));
    const res = await h.request("/api/v1/quotes", { method: "POST", cookie, json: { calculationId: second.calculationId } });
    expect(res.status).toBe(409);
    expect(res.body?.error.code).toBe("NO_SKU_AVAILABLE");
    await h.db.update(components).set({ isActive: true }).where(eq(components.sku, "PNL-MONO-400"));
  });

  it("applies an installer's margin and labour, and shows their company", async () => {
    const installer = await h.signUp("installer");
    await h.db.update(userProfiles).set({ companyName: "Emeka Solar Ltd" }).where(eq(userProfiles.userId, installer.userId));
    await h.db.insert(installerMargins).values({ installerId: installer.userId, marginPct: 10, labourFlatFeeNgn: 150_000 });
    const calc = await calculate(installer.cookie);
    const quote = await saveQuote(installer.cookie, calc.calculationId, "Client A");
    const inverterBase = calc.bom[0]!.unitPriceNgn;
    expect(quote.pricing.lines[0].unitPriceNgn).toBe(Math.round(inverterBase * 1.1));
    expect(quote.pricing.labourNgn).toBe(150_000);
    expect(quote.pricing.installationFeeNgn).toBe(Math.round(quote.pricing.equipmentSubtotalNgn * 0.15));
    expect(quote.pricing.totalNgn).toBe(quote.pricing.equipmentSubtotalNgn + quote.pricing.installationFeeNgn + 150_000 + quote.pricing.vatNgn);
    expect(quote.preparedBy).toBe("Emeka Solar Ltd");
    expect(quote.pricing.marginNgn).toBeUndefined(); // margin is never exposed to clients
  });
});

describe("visibility", () => {
  it("shows users only their own quotes; admins see all", async () => {
    const alice = await h.signUp();
    const bob = await h.signUp();
    const admin = await h.signUp("admin");
    const q = await saveQuote(alice.cookie, (await calculate(alice.cookie)).calculationId);

    const list = await h.request("/api/v1/quotes", { cookie: alice.cookie });
    expect(list.body?.data.items.map((i: { id: string }) => i.id)).toEqual([q.id]);
    expect((await h.request(`/api/v1/quotes/${q.id}`, { cookie: bob.cookie })).status).toBe(404);
    expect((await h.request(`/api/v1/quotes/${q.id}/pdf`, { cookie: bob.cookie })).status).toBe(404);
    expect((await h.request(`/api/v1/quotes/${q.id}`, { cookie: admin.cookie })).status).toBe(200);
  });
});

describe("ad gate (PRD §31)", () => {
  it("blocks the PDF and hides the share link until an ad is completed", async () => {
    const { cookie } = await h.signUp();
    const q = await saveQuote(cookie, (await calculate(cookie)).calculationId);

    const pdf = await h.request(`/api/v1/quotes/${q.id}/pdf`, { cookie });
    expect(pdf.status).toBe(403);
    expect(pdf.body?.error.code).toBe("AD_REQUIRED");
    const detail = await h.request(`/api/v1/quotes/${q.id}`, { cookie });
    expect(detail.body?.data).toMatchObject({ unlocked: false, shareUrl: null });
  });

  it("rejects completion before the ad duration has elapsed", async () => {
    const { cookie } = await h.signUp();
    const q = await saveQuote(cookie, (await calculate(cookie)).calculationId);
    const start = await h.request(`/api/v1/quotes/${q.id}/ad/start`, { method: "POST", cookie });
    expect(start.body?.data).toMatchObject({ unlocked: false, ad: { providerUrl: null, durationSeconds: 15 } });
    const tooFast = await h.request(`/api/v1/quotes/${q.id}/ad/complete`, { method: "POST", cookie, json: { adEventId: start.body?.data.adEventId } });
    expect(tooFast.status).toBe(400);
    expect(tooFast.body?.error.code).toBe("AD_INCOMPLETE");
  });

  it("unlocks PDF and share link for 24 hours after a full view", async () => {
    const { cookie, userId } = await h.signUp();
    const q = await saveQuote(cookie, (await calculate(cookie)).calculationId);
    const done = await completeAd(cookie, q.id);
    expect(done.shareUrl).toMatch(/^https:\/\/pandasolution\.test\/q\/[\w-]{32}$/);

    const detail = await h.request(`/api/v1/quotes/${q.id}`, { cookie });
    expect(detail.body?.data).toMatchObject({ unlocked: true, shareUrl: done.shareUrl });
    const pdf = await rawRequest(`/api/v1/quotes/${q.id}/pdf`, cookie);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toContain(`${q.reference}.pdf`);

    // Already unlocked: no second ad within 24 hours.
    const again = await h.request(`/api/v1/quotes/${q.id}/ad/start`, { method: "POST", cookie });
    expect(again.body?.data).toEqual({ unlocked: true });

    // After 24 hours the gate returns.
    await h.db.update(adEvents).set({ completedAt: sql`now() - interval '25 hours'` }).where(eq(adEvents.userId, userId));
    expect((await h.request(`/api/v1/quotes/${q.id}/pdf`, { cookie })).status).toBe(403);
  });

  it("cannot reuse an ad session or complete someone else's", async () => {
    const alice = await h.signUp();
    const q = await saveQuote(alice.cookie, (await calculate(alice.cookie)).calculationId);
    const start = await h.request(`/api/v1/quotes/${q.id}/ad/start`, { method: "POST", cookie: alice.cookie });
    const adEventId = start.body?.data.adEventId;
    await h.db.update(adEvents).set({ startedAt: sql`now() - interval '16 seconds'` }).where(eq(adEvents.id, adEventId));

    const admin = await h.signUp("admin"); // can see the quote, but the ad session is Alice's
    expect((await h.request(`/api/v1/quotes/${q.id}/ad/complete`, { method: "POST", cookie: admin.cookie, json: { adEventId } })).status).toBe(404);
    expect((await h.request(`/api/v1/quotes/${q.id}/ad/complete`, { method: "POST", cookie: alice.cookie, json: { adEventId } })).status).toBe(200);
    expect((await h.request(`/api/v1/quotes/${q.id}/ad/complete`, { method: "POST", cookie: alice.cookie, json: { adEventId } })).status).toBe(404);
  });

  it("lets installers (Pro) skip the gate", async () => {
    const { cookie } = await h.signUp("installer");
    const q = await saveQuote(cookie, (await calculate(cookie)).calculationId);
    expect(q.unlocked).toBe(true);
    expect((await rawRequest(`/api/v1/quotes/${q.id}/pdf`, cookie)).status).toBe(200);
  });
});

describe("public share links", () => {
  async function sharedQuote() {
    const owner = await h.signUp();
    const q = await saveQuote(owner.cookie, (await calculate(owner.cookie)).calculationId);
    const { shareUrl } = await completeAd(owner.cookie, q.id);
    return { owner, q, token: (shareUrl as string).split("/q/")[1]! };
  }

  it("serves the quote and PDF without login, and marks it viewed", async () => {
    const { owner, q, token } = await sharedQuote();
    // The owner opening their own link does not count as a view.
    await h.request(`/api/v1/public/quotes/${token}`, { cookie: owner.cookie });
    expect((await h.db.select().from(quotes).where(eq(quotes.id, q.id)))[0]?.status).toBe("generated");

    const res = await h.request(`/api/v1/public/quotes/${token}`);
    expect(res.status).toBe(200);
    expect(res.body?.data).toMatchObject({ reference: q.reference, status: "viewed" });
    expect(res.body?.data.shareUrl).toBeUndefined();
    expect((await rawRequest(`/api/v1/public/quotes/${token}/pdf`)).status).toBe(200);
  });

  it("returns 410 after 30 days and 404 for unknown tokens", async () => {
    const { q, token } = await sharedQuote();
    await h.db.update(quotes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(quotes.id, q.id));
    const res = await h.request(`/api/v1/public/quotes/${token}`);
    expect(res.status).toBe(410);
    expect(res.body?.error.code).toBe("QUOTE_EXPIRED");
    expect((await h.db.select().from(quotes).where(eq(quotes.id, q.id)))[0]?.status).toBe("expired");
    expect((await h.request(`/api/v1/public/quotes/${"x".repeat(32)}`)).status).toBe(404);
  });
});

describe("price validity (PRD §28.2)", () => {
  it("flags PRICE_CHANGED at ≥5%, not below, and COMPONENT_UNAVAILABLE on deactivation", async () => {
    const { cookie } = await h.signUp();
    const q = await saveQuote(cookie, (await calculate(cookie)).calculationId);
    const [inv] = await h.db.select().from(components).where(eq(components.sku, "INV-FEL-1K8-24"));
    const original = inv!.unitPriceNgn;
    try {
      await h.db.update(components).set({ unitPriceNgn: Math.round(original * 1.04) }).where(eq(components.id, inv!.id));
      expect((await h.request(`/api/v1/quotes/${q.id}`, { cookie })).body?.data.flags).toEqual([]);

      await h.db.update(components).set({ unitPriceNgn: Math.round(original * 1.05) }).where(eq(components.id, inv!.id));
      expect((await h.request(`/api/v1/quotes/${q.id}`, { cookie })).body?.data.flags).toEqual(["PRICE_CHANGED"]);

      await h.db.update(components).set({ isActive: false }).where(eq(components.id, inv!.id));
      expect((await h.request(`/api/v1/quotes/${q.id}`, { cookie })).body?.data.flags).toEqual(["PRICE_CHANGED", "COMPONENT_UNAVAILABLE"]);
    } finally {
      await h.db.update(components).set({ unitPriceNgn: original, isActive: true }).where(eq(components.id, inv!.id));
    }
  });

  it("reports expired quotes in the list and blocks their PDF", async () => {
    const { cookie } = await h.signUp("installer");
    const q = await saveQuote(cookie, (await calculate(cookie)).calculationId);
    await h.db.update(quotes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(quotes.id, q.id));
    const list = await h.request("/api/v1/quotes", { cookie });
    expect(list.body?.data.items[0].status).toBe("expired");
    const pdf = await h.request(`/api/v1/quotes/${q.id}/pdf`, { cookie });
    expect(pdf.status).toBe(410);
  });
});

describe("PDF generation (PRD §37.2)", () => {
  it.each(["REF-001", "REF-002", "REF-003"] as const)("renders %s as a valid, compact PDF", async (ref) => {
    const { cookie } = await h.signUp("installer");
    const q = await saveQuote(cookie, (await calculate(cookie, ref)).calculationId, `${ref} client`);
    const started = Date.now();
    const res = await rawRequest(`/api/v1/quotes/${q.id}/pdf`, cookie);
    const elapsed = Date.now() - started;
    const { bytes, doc } = await pdfOf(res);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getPageCount()).toBeLessThanOrEqual(2);
    expect(doc.getTitle()).toBe(`Solar quotation ${q.reference}`);
    expect(bytes.length).toBeLessThan(250_000); // fonts are subset
    expect(elapsed).toBeLessThan(5000); // NFR: < 5 seconds
  });

  it("flows long appliance lists onto extra pages", async () => {
    const { cookie } = await h.signUp("installer");
    // 40 low-wattage lines, split between day and night, so the load stays well under 12kVA.
    const small = (await h.db.select({ id: appliances.id, watts: appliances.watts }).from(appliances)).filter((a) => a.watts <= 80);
    const lines = Array.from({ length: 40 }, (_, i) => small[i % small.length]!);
    const body = {
      state: "Lagos",
      appliances: lines.map((a, i) => ({ applianceId: a.id, quantity: 1, dayHours: i % 2 ? 0 : 2, nightHours: i % 2 ? 2 : 0 })),
    };
    const calc = await h.request("/api/v1/calculate", { method: "POST", cookie, json: body });
    expect(calc.status, JSON.stringify(calc.body)).toBe(200);
    const q = await saveQuote(cookie, calc.body!.data.calculationId);
    const { doc } = await pdfOf(await rawRequest(`/api/v1/quotes/${q.id}/pdf`, cookie));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
