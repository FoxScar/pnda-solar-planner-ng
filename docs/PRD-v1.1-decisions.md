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

## Engineering rules (supersedes parts of §13, §14.2, §17, §33.2)

1. **Battery recharge energy for panel sizing** is the energy actually drawn overnight, not the
   battery bank's nameplate capacity:
   `rechargeEnergy = nightEnergy ÷ inverter_eff ÷ battery_rte`.
   Using nameplate capacity (already divided by DoD) oversized lead-acid arrays ~2× and lithium ~1.25×.
2. **Sun hours: always size on the wet-season value** for the user's state, so the system works all
   year. The dry-season figure is shown for information only. (Replaces month-based season detection.)
3. **AC loads require lithium** whenever any air conditioner is selected, regardless of inverter size
   (FR-019 wins over the >4kVA wording in §13.2/§15.1). Engineers may override with justification.

4. **Inverter sizing uses the larger of the day and night surge-adjusted peaks** (supersedes FR-012's
   "daytime peak only"). The inverter powers night loads too; with ACs used only at night the
   day-only rule selects an inverter that cannot start them.
5. **Reference designs** are redefined with pinned inputs in [`reference-designs.md`](reference-designs.md)
   (supersedes §37.4, whose inputs were incomplete and whose outputs did not follow from §14).

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

## Still open

- **Fridge/freezer duty cycle**: compressors are sized as running for every hour entered. A user
  entering "24 hours" for a fridge gets ~2–3× its real daily energy. Options: catalogue duty-cycle
  factor, or ask users for typical hours. Needs an engineering decision.
- **Inverter and panel prices** are not in the PRD. Seed data uses placeholders; set real prices in
  the admin panel.
- **Guest sizing vs. §20.3** ("no unauthenticated calculation calls"): decide whether guests can see a
  recommendation before signing in.
- **Ad gate**: AdSense display ads cannot be used as a forced 30-second gate; needs Google Ad Manager
  rewarded ads (or house ads until approved).
