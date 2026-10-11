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

## Still open

- **Reference designs (§37.4)** need exact inputs — appliance models, wattages, day/night hours —
  before they can serve as regression tests. As written, REF-001 and REF-002 do not follow from the
  PRD's own formulas (REF-001 computes to the 1.8kVA inverter, REF-002 to 8kVA).
- **Inverter and panel prices** are not in the PRD. Seed data uses placeholders; set real prices in
  the admin panel.
- **Guest sizing vs. §20.3** ("no unauthenticated calculation calls"): decide whether guests can see a
  recommendation before signing in.
- **Ad gate**: AdSense display ads cannot be used as a forced 30-second gate; needs Google Ad Manager
  rewarded ads (or house ads until approved).
