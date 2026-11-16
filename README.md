# NutriResQ — Smart Food Rescue & Redistribution Optimizer

NutriResQ is a web-based decision-support system for a food-rescue operation. It finds low-cost road
paths between donors, hubs and recipients, allocates a limited delivery fleet across donated food
packages, analyses nearby facilities, and orders multi-stop collection and delivery routes.

Four DAA paradigms are implemented from scratch in plain TypeScript — **Dynamic Programming**,
**Divide & Conquer**, **Greedy Search** and an **Approximation Heuristic** — with no third-party
optimization library.

---

## Live Deployment

| Service | URL |
|---|---|
| Frontend (Vercel) | <https://nutri-res-q.vercel.app> |
| API health (Render) | <https://nutriresq-api.onrender.com/api/health> |
| Database | Neon PostgreSQL (pooled connection) |
| Backend service | Render Web Service, root `backend`, branch `develop` |

The browser only ever talks to **one origin**. `frontend/vercel.json` rewrites `/api/:path*` to the
Render service, so the session cookie stays first-party (`SameSite=Lax`, `Secure` in production).
This avoids third-party cookie blocking in Safari and private windows and requires no CORS relaxation.

> **Cold start.** Render's free tier and Neon both suspend when idle. The first request after
> ~15 minutes can take 30–50 s and may return `502`/`503`. Open `/api/health` until it reports
> `"database":"up"` before logging in or demonstrating.

---

## Demo Accounts

Seeded by `npm run db:seed`. Passwords come from `ADMIN_PASSWORD` and `DEMO_PASSWORD` in
`backend/.env`.

| Role | Email | Password | Entry point |
|---|---|---|---|
| Admin | `admin@nutriresq.local` | `ChangeMe-Admin-2026` | `/admin/login` |
| Donor | `donor@nutriresq.local` | `Demo-Pass-2026` | `/auth` |
| Recipient | `recipient@nutriresq.local` | `Demo-Pass-2026` | `/auth` |
| Delivery partner | `delivery@nutriresq.local` | `Demo-Pass-2026` | `/auth` |

The three portal accounts are kept deliberately so all four surfaces can be shown in the defence.
There is no admin registration page — the administrator is seeded from `.env`.

---

## Four Algorithms

| Algorithm | Paradigm | Role | Module |
|---|---|---|---|
| **A\* Search** | Greedy / best-first search | Low-cost road path between two locations, using travel cost plus a geographic heuristic | `backend/src/algorithms/astar.ts` |
| **Multiple Knapsack (DP)** | Dynamic Programming | Assigns packages to vehicles of different capacities, maximising humanitarian impact | `backend/src/algorithms/knapsack.ts` |
| **Closest Pair of Points** | Divide & Conquer | Nearest pair among donors / recipients / hubs for proximity analysis | `backend/src/algorithms/closest-pair.ts` |
| **Ant Colony Optimization** | Approximation heuristic | Multi-stop collection and delivery order over the road network | `backend/src/algorithms/aco.ts` |

**How they connect:** ACO decides the order of stops → A\* computes the road path between
consecutive stops → DP decides which packages each vehicle carries → Closest Pair supports
proximity analysis.

Correctness evidence: A\* is cross-checked against Dijkstra, Closest Pair against brute force, and
DP against exhaustive enumeration on the largest prefix that fits an assignment budget
(8 of 19 packages, 65,536 assignments, matching objective 32,950). `npm run bench:scale` prints
complexity comparisons for all four.

---

## Completed Phases

| Phase | Description | Status |
|---|---|---|
| **1** | Seed expansion (28 locations / 62 roads / 15 donors / 10 recipients / 5 vehicles / 24 donations), algorithm unit tests, API tests | ✅ 87/87 tests |
| **2** | Scenario simulator: clone + 6 edit types (roads, fleet, packages, recipients, supply shock, sensitivity), audit trail, compare view, `AdminScenarioPage` | ✅ Verified |
| **3** | ACO best/average/worst per trial (`trialStats[]`), DP-vs-exhaustive prefix check in the lab, `bench:scale` CSV benchmark | ✅ Verified |
| **4** | Leaflet map (`RouteMap.tsx`) with Map/Schematic toggle, OSM tiles, colour-coded markers, closed roads dashed, SVG fallback when tiles fail | ✅ Verified |
| **5** | `README.md` rewritten as the authoritative project document | ✅ Committed |
| **6** | SMTP email via `nodemailer` (`ENABLE_EMAIL` + `SMTP_*`), console-link fallback when unset | ✅ Committed |
| **7** | Deployment: Vercel frontend + Render backend + Neon; `/api/*` proxy; hero PNG → WebP (257 KB) | ✅ Live |
| **8** | Repo hygiene, documentation accuracy pass, static + live QA, demo script | ✅ Complete |

---

## Architecture

```
Browser ──► Vercel (React SPA)
              │  /api/*  rewritten by vercel.json
              ▼
           Render (Express API, Node 22)
              │  pg pool
              ▼
           Neon PostgreSQL
```

- **Auth:** opaque session tokens in an `HttpOnly` cookie; the token is stored hashed, never in
  `localStorage`, `sessionStorage` or the URL. CSRF is enforced by an `Origin` allowlist.
- **Session cookie:** `SameSite=Lax`, `Secure` when `NODE_ENV=production`, path `/`.
- **Single origin in production** thanks to the Vercel rewrite, so no third-party cookie and no
  `SameSite=None`.
- **Role separation:** `/api/admin/*` (admin only), `/api/auth/*` (all roles), `/api/portal/*`
  (scoped portal reads), `/api/scenarios/*`, `/api/optimize`, `/api/runs/:id`,
  `/api/algorithms/*` (evaluation lab, no database).

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, React Router, custom token-based CSS
  (Tailwind is **not** installed — deviation documented below)
- **Backend:** Node.js 22, Express, TypeScript, Zod validation, `pg` connection pool
- **Database:** PostgreSQL 16 on Neon, 14 SQL migrations (`backend/src/db/migrations`)
- **Algorithms:** plain TypeScript modules, no optimization library
- **Maps:** Leaflet with OpenStreetMap tiles (vanilla, not `react-leaflet`)
- **Email:** Nodemailer with SMTP; console fallback when unconfigured
- **Tests:** Vitest, 87 tests across 8 files, no database required
- **Hosting:** Vercel (frontend) + Render (backend) + Neon (database)

---

## Dataset

| Entity | Count |
|---|---|
| Locations (hub / donors / recipients) | 28 |
| Roads (1 closed) | 62 |
| Donors | 15 |
| Recipients | 10 |
| Donations | 24 |
| Vehicles (3 available) | 5 |

---

## Project Constraints

- Road cost and availability are stored; closed roads are never used by any algorithm.
- Disconnected networks and unreachable destinations are detected and reported by name.
- Each vehicle stays within its weight capacity; no package is assigned to more than one vehicle.
- Packages too large for every vehicle are excluded, and the best feasible partial allocation is
  returned on oversupply.
- Expired or ineligible packages are filtered before allocation and routing.
- Routes respect pickup-before-delivery order.
- Scenario simulator: road closures, reduced supply, unavailable vehicles, changed recipient needs,
  sensitivity analysis; the original scenario is never mutated.

---

## Quick Start

```bash
# 1. Backend environment
cd backend
cp .env.example .env          # fill DATABASE_URL, SESSION_TOKEN_PEPPER, ADMIN_PASSWORD
npm install
npm run db:migrate            # apply 14 migrations
npm run db:seed               # seed dataset + admin + demo accounts

# 2. Backend checks
npx tsc --noEmit              # type check
npm test                      # 87 tests, no database

# 3. Frontend
cd ../frontend
cp .env.example .env.local    # VITE_API_BASE_URL=http://localhost:4000
npm install
npm run lint
npm run build

# 4. Run
cd ../backend  && npm run dev    # http://localhost:4000
cd ../frontend && npm run dev    # http://localhost:5173
```

Local development talks to `http://localhost:4000` directly (different port, same site), so the
`SameSite=Lax` cookie still works. Production leaves `VITE_API_BASE_URL` **unset** so requests go
same-origin through the Vercel rewrite — setting it to the Render URL there would make the cookie
third-party and break login.

### Scripts

**backend**

| Script | Purpose |
|---|---|
| `npm run dev` | `tsx watch src/server.ts` |
| `npm run build` / `npm start` | TypeScript build → `node dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run bench:scale` | Scaling benchmark (A\* vs Dijkstra, D&C vs brute force, DP, ACO) |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed dataset, admin and demo accounts |
| `npm run db:reset` | Drop and rebuild (destructive) |
| `npm run db:status` | Migration status |

**frontend**

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | ESLint |
| `npm run preview` | Preview the production build |

There is **no frontend test runner** — verification is `tsc`, ESLint, the build, and the manual QA
matrix. The backend has no lint script; `tsc` and Vitest cover it.

---

## API Summary

Base path `/api`.

| Group | Routes |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` (with `portal`), `POST /auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/verify-email`, `POST /auth/resend-verification` |
| Admin | `POST /admin/auth/login`, `GET /admin/stats`, `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/status` |
| Scenarios | `GET /scenarios`, `GET /scenarios/:id`, `GET /scenarios/:id/snapshot`, `GET /scenarios/:id/runs`, `POST /scenarios/:id/clone`, `POST /scenarios/:id/runs`, `PATCH /scenarios/:id/roads/:roadId`, `PATCH /scenarios/:id/vehicles/:vehicleId`, `PATCH /scenarios/:id/donations/:donationId`, `PATCH /scenarios/:id/recipients/:recipientId`, `POST /scenarios/:id/supply/reduce`, `POST /scenarios/:id/sensitivity`, `GET /scenarios/:id/changes`, `GET /scenarios/:id/compare` |
| Optimization | `POST /optimize` |
| Runs | `GET /runs/:id` (replays stored result, including `acoTours`) |
| Algorithms lab | `POST /algorithms/astar`, `POST /algorithms/knapsack`, `POST /algorithms/closest-pair`, `POST /algorithms/aco` |
| Portals | `GET /portal/scenarios`, `GET /portal/scenarios/:id/locations`, `GET /portal/donations/:id`, `GET /portal/vehicles/:id` |
| Health | `GET /health` → `{ api, database, databaseLatencyMs, timestamp }` |

---

## Screens

**Admin** (`/admin`) — Overview, Workspace, Scenarios, Algorithms, Benchmarks, Donors, Recipients,
Delivery Partners.

**Portals** — Donor (`/donor/donations`), Recipient (`/recipient/available`), Delivery
(`/delivery/vehicles`, `/delivery/assignments`), each with a profile page.

Admin sign-in is at `/admin/login`; portal sign-in is the shared `/auth` page.

---

## Key Decisions (Deviations from the Proposal)

1. **No Tailwind CSS** — custom token-based CSS is used instead; porting would be pure churn with no
   functional benefit.
2. **Vanilla Leaflet** — `react-leaflet` has React 19 peer-dependency friction; a single `useEffect`
   wrapper is safer. `RouteSchematic.tsx` remains as the offline fallback.
3. **Recharts used sparingly** — tables are the source of truth; charts only where they add evidence.
4. **Plain TypeScript algorithms** — no third-party optimization library, so each paradigm is
   inspectable and independently testable.
5. **Vercel proxy instead of a second origin** — one origin keeps the session cookie first-party;
   no `SameSite=None`, no third-party cookie blocking.
6. **Demo portal accounts retained** — the three portal accounts are intentionally left in the
   database so all four surfaces can be demonstrated.
7. **`docs/` retained as supplementary material** — `docs/md files/` holds earlier design documents;
   this README is the authoritative description of the implemented system.

---

## Known Limitations

- **Render cold start** — 30–50 s first request after idle; reflected in the UI as a transient
  "unavailable" state, resolved by retrying.
- **Route geometry** — polylines follow the stored A\* node sequence (the road graph), not street
  geometry, which is never stored. The OSM basemap supplies the geography.
- **No frontend unit tests** — covered by TypeScript, ESLint, the production build and manual QA.
- **Email is opt-in** — with SMTP unset, verification and reset links are printed to the server log
  instead of being sent.

---

## Directory Overview

```
NutriResQ/
├── README.md                       ← authoritative project document (this file)
├── DEMO.md                         ← six-minute defence walkthrough
├── remaining_plan.md               ← phase plan, verification evidence and decisions
├── NutriResQ_CCP_Proposal (2).pdf  ← original assignment spec
├── CCP Fall 26.pdf                 ← course handout
├── NutriResQ_Detailed_Documentation.pdf
├── color theme.png                 ← palette reference
├── NutriResQ Food Rescue Logistics.png   ← hero source (WebP is used at runtime)
├── docs/
│   ├── NutriResQ_Detailed_Documentation.pdf
│   ├── md files/                   ← ARCHITECTURE, BACKEND_SCHEMA, PRD, README, TECH_STACK
│   └── txt diagrams/               ← activity, deployment, use-case diagrams
├── backend/
│   ├── src/
│   │   ├── algorithms/             ← astar, knapsack, closest-pair, aco, optimality, pipeline
│   │   ├── bench/                  ← scale benchmark
│   │   ├── config/                 ← env schema
│   │   ├── db/                     ← pool, migrate, seed, reset, status, migrations/001–014
│   │   ├── errors/                 ← typed application errors
│   │   ├── lib/                    ← session cookie, helpers
│   │   ├── middleware/             ← auth, csrf, validate, rate-limit, errors
│   │   ├── repositories/           ← SQL access (users, scenarios, runs, benchmarks)
│   │   ├── routes/                 ← auth, admin, scenarios, optimize, runs, algorithms, portal
│   │   ├── schemas/                ← Zod request schemas
│   │   ├── services/               ← auth, optimization, scenario, email
│   │   └── types/
│   └── tests/                      ← 8 files, 87 tests
└── frontend/
    ├── vercel.json                 ← /api/* rewrite to Render + SPA fallback
    └── src/
        ├── assets/                 ← hero WebP and section images
        ├── auth/                   ← AuthProvider, guards
        ├── components/app/         ← AppShell, RouteMap, RouteSchematic, BenchmarkTable, ui
        ├── config/
        ├── hooks/
        ├── lib/                    ← api client, auth-api, domain-api
        ├── pages/                  ← home, auth, admin/, workspace/
        └── types/                  ← mirrored domain types
```

---

## Test Suite

- **87 tests across 8 files**, no database required: `seed-data`, `astar`, `knapsack`,
  `closest-pair`, `aco`, `optimization`, `scenario`, `api`.
- Coverage: algorithm correctness, cross-checks (A\* vs Dijkstra, Closest Pair vs brute force,
  DP vs exhaustive), edge cases (disconnected network, oversized packages, unavailable vehicles,
  expired donations, unreachable destinations), and performance benches.
- Run `npm test` in `backend/`.

---

## Commit History (`main..develop`)

```
1f9ece2  Fix API base URL precedence in api.ts
16b9f25  Phase 7 - Vercel proxy + API base fallback
78b590b  Phase 6 fix - nodemailer dependency and ENABLE_EMAIL parsing
982de78  Phase 7 prep - hero WebP conversion
f9d81c7  Phase 6 done and verified - SMTP email delivery
bae3832  Phase 5 done and verified - README.md
67e1c61  Phase 4 done and verified
4358899  Phase 3 done and verified
facc08f  Added phase 1 and phase 2
24e6984  Smooth sidebar collapse        (pre-Phase 1, still on main)
```

The work is committed on `develop`; `main` remains at `24e6984` and is merged once, at the end.

---

## Learn More

- `DEMO.md` — six-minute defence walkthrough with exact click paths.
- `remaining_plan.md` — phase plan, verification evidence, decisions and the two-day schedule.
- `backend/tests/README.md` — test coverage map.
- `frontend/src/components/app/RouteMap.tsx` — Leaflet map component.
- `frontend/src/pages/admin/AdminWorkspacePage.tsx` — workspace with the Map / Schematic toggle.
