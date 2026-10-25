# PRD v1.1 — agreed changes to PandaSolution PRD v1.0

These decisions supersede the corresponding sections of `PandaSolution_PRD_v1.0.docx`.

## Platform (supersedes §1, §20–25, §39)

| PRD v1.0 | v1.1 |
|---|---|
| Next.js 14 | Vite + React SPA. The app is an authenticated wizard and dashboards; the landing page will be pre-rendered for SEO. |
| Appwrite Auth | Better Auth, sessions stored in our own Postgres |
| Appwrite Database | PostgreSQL 16 via Drizzle ORM (local: Docker; production: Neon free tier) |
| Appwrite Functions | Hono API (`/api/v1/*`), deployable to Cloudflare Workers |
| Appwrite Storage | Cloudflare R2 (decided in Phase 4) |
| Vercel | Cloudflare (Vercel Hobby forbids commercial use; the product is ad-supported) |
| PostHog self-hosted | PostHog Cloud free tier |

No Supabase or Appwrite dependency remains.

## Engineering rules — Developer Calculation Schematics (October 2026)

The owner's *Developer Calculation Schematics* replace the sizing rules of PRD v1.0 §13–17 and the
v1.1 rules agreed earlier. Engine version **2.0.0**. Implemented as follows:

| Schematics | Implementation |
|---|---|
| §1 Night 17:00–06:00 (13 h); runtime ≤ window | Configurable night start/end; day ≤ 11 h and night ≤ 13 h enforced in UI and API |
| §1 Peak = simultaneous loads; conservative overlap | All-overlap per period; peak = max(day, night) |
| §2 VA = peak ÷ PF (0.8); reject insufficient continuous/surge; smallest valid model | Continuous and surge checked per product (defaults when not on datasheet, flagged); the smallest inverter that also yields a valid bank and PV array is chosen |
| §2 Parallel inverters only where defined | Not offered; loads above 12kVA return OVERSIZE_REQUIRED |
| §3 night × (1 + 30%) ÷ (DoD × inverter eff × discharge eff) | Exactly; DoD/efficiency from the product, else chemistry defaults |
| §3 Validate discharge power; no mixing | Units added if the bank's discharge rating is too low; one SKU per bank |
| §4 Effective W = rated × product performance factor | Per-panel `performance_factor` (existing panels backfilled to 0.80) |
| §4C Combined rule: peak + battery kWh × 1000 ÷ sun-hours | Exactly, using the installed bank's nominal kWh |
| §4D Daily-energy check | If the combined rule fails it, the count is raised to the smallest passing count ("next valid configuration") |
| §5 PV input (power, voltage, current) | Checked when the inverter and panel datasheet values are on record; otherwise reported as unverified |
| §5 Validation report; no quote for invalid systems | Seven checks returned with every calculation; saving a quote requires `quoteEligible` |
| §6 Subtotal + installation fee (rate) + other fees − discounts | Exactly; installation rate configurable (default 15%) |
| §7 No silent hard-coding | All parameters in admin → Settings, changes audited, recorded with each calculation |

**Superseded earlier rules:** recharge-from-energy-drawn (now full nominal bank ÷ sun-hours), 10%
safety margin (now 30%), inverter sizing on surge-adjusted peak ÷ 0.8 (now VA from running peak plus a
separate surge check), fixed 0.72 panel derating (now per-product factor).

**Kept from earlier decisions:** wet-season sun hours (now a setting), lithium required for any AC load,
12kVA single-inverter limit, fewest-units battery selection.

**Owner decisions needed**
- **VAT**: §6 has no VAT line; the PRD requires 7.5%. VAT stays on at 7.5% (admin can set 0).
- **Installation rate**: §6 says "configured"; 15% (the original app's figure) is the default.
- **Peak for the combined rule**: the pseudocode's `load.peakWatts` is taken as max(day, night),
  consistent with the inverter and with the §8 example. Daytime-only peak would give fewer panels.
- **PV limits**: §5/§7 say no quote until PV input is validated. Seed inverters have no PV specs yet,
  so `requireVerifiedPvLimits` is **off** until they are entered; switch it on in Settings afterwards.

## Phase 1 implementation choices

- **Guests can calculate** (soft auth, §25.2) with per-IP rate limiting; saving/sharing a quote
  will require an account. This relaxes §20.3 — revisit if abuse appears.
- **Battery selection** follows §15.3 literally: fewest units, then least installed capacity, then
  price. This can pick a pricier bank (e.g. 2 × 25kWh over 3 × 15kWh); switch to cheapest-first if
  preferred.
- **Inverter PV input limits**: components have an optional `max_pv_input_w`. When set, the engine
  steps up to an inverter whose charge controller accepts the array; when unknown, results carry a
  `PV_INPUT_UNVERIFIED` warning (shown to engineers). Felicity datasheet values should be entered.
- **Custom appliances** (FR-005) are treated as non-surge loads; entries above 5kW are flagged.

## Phase 4 implementation choices (quotes, PDF, sharing, ad gate)

- **PDFs are generated on demand** from the stored quote snapshot (prices and design frozen at save
  time), with pdf-lib and an embedded DejaVu Sans font (for the ₦ sign). Nothing is written to file
  storage, so no storage bucket is needed (supersedes the Appwrite/R2 storage plan in §22, §29).
- **Saving a quote requires an account.** A guest's calculation can be claimed for 24 hours after
  signing in. The quote is re-priced at current prices when saved.
- **Installer margin is folded into unit prices**; clients see Equipment / Labour / VAT / Total only.
- **Share links** (`/q/<token>`) are public for the 30-day validity period. Because the link itself
  gives an ungated PDF, it is only revealed to free users after the ad gate.
- **Ad gate**: server-verified duration using database time; unlock lasts 24 hours per user per
  quote. Until subscriptions exist, **installer and higher roles count as Pro** and skip the gate.
  With no ad campaign configured, a 15-second house ad (PandaSolution Pro promo) is shown.
- **Price validity** is checked whenever a quote is viewed: ≥5% move on any line → `PRICE_CHANGED`;
  deactivated part → `COMPONENT_UNAVAILABLE`; after 30 days → `expired` (PDF and link return 410).

## Still open

- **Ad provider**: the `ads` table accepts an embeddable URL per campaign, but a real rewarded-ad
  provider (e.g. Google Ad Manager rewarded web) still needs choosing and an admin screen.

- **Fridge/freezer duty cycle**: compressors are sized as running for every hour entered. A user
  entering "24 hours" for a fridge gets ~2–3× its real daily energy. Options: catalogue duty-cycle
  factor, or ask users for typical hours. Needs an engineering decision.
- **Inverter and panel prices** are not in the PRD. Seed data uses placeholders; set real prices in
  the admin panel.
- **Guest sizing vs. §20.3** ("no unauthenticated calculation calls"): decide whether guests can see a
  recommendation before signing in.
- **Ad gate**: AdSense display ads cannot be used as a forced 30-second gate; needs Google Ad Manager
  rewarded ads (or house ads until approved).
