# PandaSolution

Engineering-grade solar sizing and quotation platform for Nigeria. See `PandaSolution_PRD_v1.0.docx`
for the product requirements and [`docs/PRD-v1.1-decisions.md`](docs/PRD-v1.1-decisions.md) for the
changes agreed since.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React + TypeScript, Tailwind, shadcn/ui |
| API | Hono (TypeScript) — runs on Node locally, deployable to Cloudflare Workers |
| Database | PostgreSQL 16 via Drizzle ORM (Docker locally, Neon in production) |
| Auth | Better Auth (email + password, sessions in Postgres) with roles: consumer, installer, engineer, admin |
| Tests | Vitest — API integration tests run against a real Postgres test database |

```
src/        React frontend
server/     Hono API: routes, auth, Drizzle schema, migrations, seed data
shared/     Types and constants used by both sides
```

## Local setup

Requires Node 22+ and Docker.

```sh
npm install
cp .env.example .env                       # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:setup                           # start Postgres, run migrations, seed catalogue
npm run dev:api                            # API on http://localhost:8787
npm run dev                                # app on http://localhost:8080 (proxies /api to the API)
```

Create the first admin: sign up in the app, then

```sh
npm run admin:promote -- you@example.com
```

Further roles are assigned from the admin panel at `/admin`.

## Scripts

| Command | What it does |
|---|---|
| `npm run db:generate` | Generate a migration after editing `server/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Insert missing catalogue rows (never overwrites admin edits) |
| `npm test` | Run the test suite (rebuilds the `pandasolution_test` database) |
| `npm run typecheck` / `npm run lint` | Static checks (CI runs these plus tests and build) |

## API

Key endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/calculate` | Sizing engine (guests allowed, 10/min) |
| `POST /api/v1/quotes` | Save a calculation as a quote |
| `GET /api/v1/quotes/:id` · `/pdf` | Quote detail and PDF (PDF ad-gated for free users) |
| `POST /api/v1/quotes/:id/ad/start` · `/complete` | Server-verified ad gate |
| `GET /api/v1/public/quotes/:token` · `/pdf` | Public share link, valid 30 days |
| `POST /api/v1/validate-config` | Check an inverter/battery combination |
| `GET /api/v1/appliances`, `/sun-hours` | Public catalogue |
| `/api/v1/admin/*` | Components, appliances, sun hours, users, audit log |

`npx tsx server/scripts/sample-pdf.ts out.pdf` renders a sample quotation without a database.

The sizing engine is a pure module in `server/engine/` with 100% test coverage enforced
(`npm run test:coverage`); reference designs are documented in `docs/reference-designs.md`.

All endpoints live under `/api/v1` and return `{ success, data, meta }` or `{ success: false, error: { code, message, field? } }`.
Auth endpoints are served by Better Auth under `/api/auth`.

Prices, inventory, sun hours and role changes are written to an append-only `audit_log`; the database
rejects any UPDATE, DELETE or TRUNCATE on it.
