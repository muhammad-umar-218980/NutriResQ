# NutriResQ — Remaining Work Plan

> Last updated: 2026-11-15
> Repo: `D:\NutriResQ` · Branch: working tree (uncommitted) · Owner commits manually
> Status legend: `[x]` done · `[~]` partial · `[ ]` remaining
> Purpose: single source of truth so work survives context loss. Copy of this file belongs at `D:\NutriResQ\remaining_plan.md`.

---

## 0. One-line status

The application is **functionally complete against the CCP proposal** with the **scenario simulator now built end-to-end**; only evaluation surfacing, the map, documentation and deployment remain. All four algorithms, their baselines, the integrated pipeline, persistence, auth, roles and all four portals are built and working. **Phase 1 is done** (expanded seed + §6 suite) and **Phase 2 is done** (simulator backend, UI, audit trail, comparison, 80 passing tests).

| Area | Coverage |
|---|---|
| 4 algorithms + 4 baselines | 100% |
| Shared pipeline + constraints | 100% |
| API / DB / auth / roles | 100% |
| Admin + 3 role portals | 100% |
| Landing page + shell polish | 100% |
| Seed dataset (28 locations / 62 roads) | 100% |
| Tests (§6) | 100% (80 passing) |
| Scenario simulator | 100% (clone, 6 edit types, audit, compare, sensitivity) |
| Docs / deployment / DB finalisation | 0% |
| Map (Leaflet) + charts (Recharts) | 0% (SVG schematic in place) |

---

## 1. Decisions locked (do not relitigate)

| # | Decision | Choice | Reason |
|---|---|---|---|
| D1 | **Tailwind CSS** | **DO NOT install** | The hand-written token system (`frontend/src/index.css` + page CSS) is consistent and finished. Porting is ~2–3 days of pure churn with zero functional or grading benefit. Document the deviation in README instead. |
| D2 | **Recharts** | **Optional, max 2–3 charts** | Only where it adds evidence: ACO best/avg/worst trial spread, A*/Dijkstra node expansions, allocation vs capacity. Tables stay the source of truth. Skip if time is short. |
| D3 | **Leaflet** | **Adopt, vanilla Leaflet (no `react-leaflet`)** | Proposal names Leaflet + OSM. `react-leaflet` has React 19 peer-dep friction; a 150-line `useEffect` wrapper is safer. Keep `RouteSchematic.tsx` as the offline fallback. |
| D4 | **Seed scale** | **Expand to planned size** | 15 donors / 10 recipients / 5 vehicles / 25+ roads makes the simulator and benchmarks legible. One file (`seed-data.ts`) + reseed. |
| D5 | **Email** | **nodemailer + SMTP env, console fallback in dev** | `/verify-email` and `/forgot-password` are dead ends for real users today (links only `console.log`). |
| D6 | **Distance model** | Keep backend equirectangular projection for schematic + A* heuristic; Leaflet draws road legs as straight lines because the DB stores cost, not geometry | Honest and already documented in code. |
| D7 | **Design system** | Keep custom CSS | Same as D1. |

---

## 2. Completed inventory (evidence, not claims)

### 2.1 Database & migrations — `[x]`
- **14 migrations → 20 tables** (`backend/migrations/001…014`):
  `users`, `donor_profiles`, `recipient_profiles`, `delivery_profiles`, `sessions`, `email_verifications`, `password_resets`, `scenarios`, `locations`, `scenario_locations`, `roads`, `donors`, `recipients`, `donations`, `vehicles`, `optimization_runs`, `scenario_changes`, `vehicle_allocations`, `routes`, `route_stops`, `algorithm_benchmarks`.
- Neon (free plan, pooled `DATABASE_URL`): **14/14 applied**.
- Scripts: `db:migrate`, `db:seed`, `db:reset`, `db:status`, plus `src/db/qa-cleanup.ts`.
- `scenario_changes` and `scenarios.parent_scenario_id` exist and are **wired up** by Phase 2 (audit trail + clone parent).

### 2.2 The four algorithms + baselines — `[x]`

| Proposal item | Paradigm | Complexity (documented in code) | Baseline | File |
|---|---|---|---|---|
| A* search | Greedy / search | O(E log V) typical | Dijkstra | `backend/src/algorithms/astar.ts` |
| Multiple knapsack | Dynamic programming | O(n·k·Π(Cj+1)) | Greedy value/weight | `multiple-knapsack-dp.ts` |
| Closest pair | Divide & conquer | O(n log n) | Brute force O(n²) | `closest-pair.ts` |
| Ant colony | Approximation | O(iterations·ants·n²) | Nearest neighbour | `aco.ts` |

Supporting modules: `dijkstra.ts`, `greedy-knapsack.ts`, `brute-force-closest-pair.ts`, `nearest-neighbor.ts`, `lib/graph.ts` (graph build + projection + admissible heuristic + path reconstruction), `lib/route.ts` (atomic pickup→delivery jobs), `lib/rng.ts` (seeded).

Correctness properties already implemented:
- `[x]` closed roads excluded at graph build (`buildRoadGraph` skips `isAvailable === false`)
- `[x]` A* heuristic is admissible **only** for km costs; falls back to `h=0` (Dijkstra) for any other unit — no fake admissibility
- `[x]` DP enumerates the joint capacity vector → exact for the given inputs; `maxStates` cap with a warning instead of a silent approximation; backtracking rebuilds real assignments
- `[x]` strict comparison keeps the lowest vehicle index on equal-value ties
- `[x]` closest-pair ties broken by original index (deterministic)
- `[x]` ACO jobs are atomic pickup→delivery → pickup-before-delivery is structural, not checked afterwards

### 2.3 Integrated pipeline — `[x]`
`backend/src/services/optimization.service.ts` (~1,040 lines), deterministic for a fixed snapshot + config + seed:

1. validate inputs (fatal → `status: 'failed'`)
2. build graph (closed roads dropped)
3. donation eligibility: `status === 'expired'` / `'unavailable'`, `expires_at <= run_started_at`, `is_eligible = false`, not yet available, intended recipient marked unavailable (`not_available`)
4. multiple-knapsack DP allocation → oversize / unallocated reporting with reasons
5. route stops derived **only** from allocations
6. A* travel-cost matrix + ACO ordering + nearest-neighbour benchmark
7. closest pair (projected straight-line) + brute-force benchmark
8. post-validation (recalculated, not trusted): capacity, duplicate packages, leg-cost consistency
9. metrics: allocated value/weight, utilisation %, total road cost, reachable/unreachable pair counts, route/partial counts, runtime
10. `status`: `succeeded` / `partial` / `failed` with warnings + errors arrays

### 2.4 API — `[x]`

| Method + path | Guard | Purpose |
|---|---|---|
| `POST /api/auth/register` | public + rate limit | creates donor/recipient/delivery account + verification token |
| `POST /api/auth/login`, `/logout`, `GET /me` | cookie | session |
| `POST /api/auth/verify-email`, `/forgot-password`, `/reset-password` | public + rate limit | token flows (link is `console.log` only — see D5) |
| `POST /api/admin/auth/login` | rate limit | hidden admin entry point |
| `GET /api/admin/stats`, `/users`, `/users/:id`, `PATCH /users/:id/status` | admin | account management; suspension revokes all sessions |
| `GET /api/scenarios`, `/scenarios/:id`, `/:id/snapshot`, `/:id/runs` | admin | read-only scenario access |
| `POST /api/scenarios/:id/clone`; `PATCH /:id/{roads,vehicles,donations,recipients}/:childId`; `POST /:id/supply/reduce`, `/:id/sensitivity`; `GET /:id/changes`, `/:id/compare` | admin | scenario simulator (Phase 2) — every accepted edit writes `scenario_changes` |
| `POST /api/optimize` | admin | run pipeline + persist |
| `GET /api/runs/:id` | admin | stored run |
| `POST /api/algorithms/{astar,knapsack,closest-pair,aco}` | admin | per-algorithm lab with baselines |
| `GET /api/portal/scenarios`, `/:id/locations` | auth | picker data |
| donor: `GET /api/portal/donor`, `POST/PUT/DELETE donations` | donor | donations write into the **scenario** table → feed the optimizer |
| recipient: `GET /api/portal/recipient`, `PATCH` | recipient | demand + priority profile |
| delivery: `GET /api/portal/delivery`, `POST/PUT/DELETE vehicles` | delivery | fleet writes into scenario vehicles |
| `GET /api/health`, `GET /` | public | liveness |

### 2.5 Security — `[x]`
- opaque HttpOnly session cookies, SHA-256 token hashes + pepper, no token in URL/localStorage
- CSRF trusted-origin middleware, CORS locked to `FRONTEND_URL`
- login rate limiting, `trust proxy`, request ids, 1 MB JSON cap
- role guards on every route, suspension revokes sessions immediately
- error envelope hides internals; Zod validates every body/query/param

### 2.6 Frontend — `[x]` (paths under `frontend/src/`)
- landing page (`pages/HomePage.tsx`, 1,100 lines) + CSS: nav 1000px breakpoint, square hero panel (`object-fit: contain`, no crop), platform section hidden < 840px, problem photo 4:3, caption removed
- auth: `AuthPage`, `AdminLoginPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`, portal selector, validation
- shared shell `components/app/AppShell.tsx|css`: collapsible rail 260→76 with smooth symmetric animation, icon x fixed at 38, stairs ↔ 3-bar toggle, brand fades, account fades, no jump on sign-out, mobile drawer
- admin: `AdminOverviewPage` (network + role stats), `AdminWorkspacePage` (scenario picker, run config, results, allocations, schematic, ordered stops, unallocated reasons, connectivity, closest pair, benchmarks, run history), `AdminScenarioPage` (what-if simulator: clone, roads, fleet, packages, recipients, supply shock, sensitivity, base-vs-variant deltas, audit trail), `AdminAlgorithmsPage` (4 labs), `AdminBenchmarksPage` (stored, per-run, "how to read"), `AdminUsersPage`
- donor `DonorDonationsPage` (CRUD), recipient `RecipientFoodPage`, delivery `DeliveryVehiclesPage` (fleet CRUD) + `DeliveryAssignmentsPage` (routes from runs)
- `RoleOverview`, `RoleProfilePage`, loading/empty/error states in `components/app/ui.tsx`
- `RouteSchematic.tsx`: dependency-free SVG map from projected coords (Leaflet replaces/complements it in Phase 5)

### 2.7 Seed dataset — `[x]` (expanded in Phase 1)
`backend/src/db/seed-data.ts`, scenario `00000000-0000-4000-8000-000000000001` ("Riverside District — Monday Rescue"):
- **28 locations** (2 hubs), **62 roads**, **1 closed road** (road `…0022`) leaving **"Isolation Point" unreachable** — real edge case for A*
- **15 donors**, **10 recipients** (priorities 50–95, demands 20–50), **5 vehicles** of which **3 are available** (60/45/50 kg), **24 donations**
- deliberate cases: expired (`Dairy pack (expired)`), ineligible (`Ineligible sample`), oversized 80 kg (`Oversized pallet`), no intended recipient (`Leafy greens`, priority fallback 1), `status: unavailable` (`Butter tubs`), future-dated (`Future harvest box`, `available_at` 2030)
- new roads are priced by `roadCostKm()` at 1.15× great-circle distance (ceil 0.1 km); road `…0007` re-priced 1.7 → 3.0 km so every cost stays ≥ straight-line distance
- demo accounts: `donor@` / `recipient@` / `delivery@nutriresq.local` — `Demo-Pass-2026`; admin `admin@nutriresq.local` — `ChangeMe-Admin-2026`

### 2.8 Proposal §4 constraint compliance — `[x]` except the simulator

| Constraint | Status |
|---|---|
| ≥10 locations, ≥20 roads | `[x]` 28 / 62 |
| road cost + availability; closed roads never used | `[x]` |
| disconnected/unreachable reported **by name**; deterministic ties | `[x]` |
| capacity respected, no duplicate package | `[x]` |
| oversized excluded; best partial allocation on oversupply | `[x]` |
| expired/ineligible filtered before allocation + routing | `[x]` |
| routes only assigned stops, pickup-before-delivery | `[x]` |
| **scenario simulator (5 change types + original preserved)** | `[x]` Phase 2 (six audited edit types, clone-never-mutate, sensitivity variant) |
| evaluation incl. exhaustive small-case cross-check | `[x]` DP == exhaustive in `knapsack.test.ts` |

### 2.9 Proposal §6 testing — `[x]` DONE
`backend/tests/` contains 8 files / 80 tests, all green in ~5 s with **no database**:
`seed-data`, `astar`, `knapsack` (incl. exhaustive cross-check), `closest-pair`, `aco`, `optimization` (end-to-end pipeline), `scenario` (state-space, deltas, urgency, recipient rule), `api` (401/403/422/404/CORS). Coverage map lives in `backend/tests/README.md`. `npx tsc --noEmit`, frontend `lint` and `build` are clean.

---

## 3. Remaining work (build order)

### Phase 1 — Seed expansion + test suite  ·  ~6–8 h · `[x]` DONE (2026-11-15)

**1A Seed (done).** `backend/src/db/seed-data.ts` now holds **28 locations / 62 roads / 15 donors / 10 recipients / 24 donations / 5 vehicles**. Closed-road, orphan-node, expired, ineligible, oversized, no-recipient, `unavailable` and future-dated cases all still present. Deviations from the draft:
- roads expanded to 62 (not 25–30) so the 28 locations form a realistic connected network;
- only **3 vehicles are available** (60 / 45 / 50 kg); the other two are seeded `isAvailable: false`. Reason: the exact DP state space is `61 × 46 × 51 = 143,106 < 250,000`, and 5 usable vehicles would exceed it;
- new roads leave `costKm` undefined and are priced by the exported `roadCostKm()` helper at **1.15× great-circle distance, ceil to 0.1 km**;
- road `…0007` (Riverside Restaurant ↔ Community Kitchen) was re-priced from 1.7 → 3.0 km because 1.7 was **below** the straight-line distance and would have broken A* heuristic admissibility.
`npm run db:reset -- --yes` applied 14 migrations + seed to Neon. Verified via `db:status` and a live `loadScenarioSnapshot` run: 28/62/15/10/24/5, `status: 'partial'`, 99.35% utilisation, 54 named unreachable pairs, 5 designed edge cases in `unallocated`, 0 errors.

**1B Algorithm unit tests (done at the end of Phase 1).** `backend/tests/` with **65 passing tests in 7 files** (~6 s, no database) — Phase 2 added `scenario.test.ts`, bringing the suite to **80 tests in 8 files**:
- `tests/seed-data.test.ts` — scale, ids/references, one closed road, Isolation Point unreachable, full connectivity, **every road cost ≥ straight-line distance**, DP state count, designed edge cases.
- `tests/astar.test.ts` — A* == Dijkstra on all 702 reachable ordered pairs; heuristic ≤ true cost everywhere; path legs exist and sum to `totalCost`; closed road never used; unreachable returns `[]`/`Infinity`; zero-heuristic equals Dijkstra; A* expands ≤ Dijkstra.
- `tests/knapsack.test.ts` — **DP == independent exhaustive enumeration on 50 random instances**; capacity/no-duplicate invariants; greedy ≤ DP; oversized/invalid/no-vehicle reasons; state count; `maxStates` guard.
- `tests/closest-pair.test.ts` — D&C == brute force on 200 random sets; duplicates → 0; <2 points; deterministic ties; comparisons = `n(n-1)/2`.
- `tests/aco.test.ts` — fixed seed determinism; pickup-before-delivery leg pairing; unreachable jobs surfaced; invalid config throws; ant scaling; ACO vs NN and exhaustive-optimality gap logged on real seed routes.
- `tests/optimization.test.ts` — end-to-end: input counts, `partial` status, eligibility reasons, capacity/no duplicates, metric arithmetic, Isolation Point named, route stops only from allocations, DP/closest-pair/ACO benchmarks, closest pair, determinism, state-limit failure, non-finite-coordinate failure.
- `tests/api.test.ts` — root banner, JSON 404, 14-route **401 matrix**, 403 untrusted origin, 422 validation, request-id echo, CORS preflight. No DB connection.
- `tests/helpers/seed-snapshot.ts` — DB-free `ScenarioSnapshot` builder mirroring `scenario.repository.ts` ordering/joins.
- `tests/README.md` — proposal §6 → test-file coverage map (used in place of the planned root `TESTING.md`; docs land in Phase 5).

Acceptance checks (Phase 1): `npm test` green (65/65), `npx tsc --noEmit` clean, frontend `npm run lint` clean, `npm run build` green.

---

### Phase 2 — Scenario simulator (the missing deliverable) · `[x]` DONE (2026-11-15)

**2A Backend (done).** Files: `services/scenario.service.ts`, `repositories/scenario-write.repository.ts`, `lib/scenario-math.ts`, `schemas/scenario.schema.ts`, extended `routes/scenario.routes.ts`, new domain types.

| Endpoint | Behaviour |
|---|---|
| `POST /api/scenarios/:id/clone` | deep copy of location links, roads, donors, recipients, donations, vehicles in one transaction; sets `parent_scenario_id`; clone drops `donors.user_id` / `vehicles.owner_user_id` so portal accounts still own only the original rows |
| `PATCH /:id/roads/:roadId` | `{ isAvailable }` — closure toggles |
| `PATCH /:id/vehicles/:vehicleId` | `{ isAvailable, capacityUnits, allowLargeStateSpace? }` |
| `PATCH /:id/donations/:donationId` | `{ weightUnits, valueScore, status }` |
| `POST /:id/supply/reduce` | `{ percent }` — reduces every package weight, clamps at ≥ 1 kg, one audit row with before/after totals |
| `PATCH /:id/recipients/:recipientId` | `{ demandUnits, priorityScore, isAvailable }` |
| `POST /:id/sensitivity` | clone + mark the N most urgent recipients unavailable; returns the variant, does not run it |
| `GET /:id/changes` | audit trail (`scenario_changes`) |
| `GET /:id/compare?baseRunId=&variantRunId=` | metric deltas from stored runs |

All admin-guarded, Zod-validated, row-locked (`FOR UPDATE`) writes, one audit row per **accepted** edit, no row for a no-op, cross-scenario ids → `404`.

Documented deviations from the draft:
- **Exact-DP state guard.** Editing the fleet is only allowed while `prod(capacity_j + 1) ≤ 250,000` over available vehicles. Enabling the seeded 70 kg truck would need 10,160,526 states, so the API returns `422` with `details.stateSpace`; the UI offers an explicit **"Apply anyway"** that resends `allowLargeStateSpace: true`. Disabling a van (143,106 → 2,346) is always allowed.
- **Recipient availability rule.** `recipient.isAvailable` was previously unused by the pipeline, which made "mark recipient unavailable" invisible. Donations naming an unavailable recipient are now excluded with reason `not_available`. Every seeded recipient is available, so the seed result is unchanged.
- **`recipient.demandUnits` stays informational.** The DP is supply-driven (maximise value under capacity); the UI labels the column as informational instead of implying demand is enforced.
- **Sensitivity = clone + disable**, not a separate solver run. Keeps the original scenario and its runs immutable and reuses the compare endpoint.
- **Compare is family-scoped**: a run may be compared against the scenario itself or its direct parent, nothing else.
- **Audit split**: SQL that copies rows and SQL that mutates rows live in `scenario-write.repository.ts`; policy/validation lives in `scenario.service.ts`.

**2B Frontend (done).** `pages/admin/AdminScenarioPage.tsx` + `AdminScenario.css`, nav item **Scenarios** (`/admin/scenarios`, `FlaskConical`), route in `App.tsx`, mirrored types in `src/types/domain.ts`, calls in `lib/domain-api.ts`. Tabs for roads / fleet / packages / recipients / supply shock / sensitivity, a guard-aware fleet editor, run controls, a base-vs-variant delta table with better/worse verdicts, and the audit trail.

**Verification (done).**
- `backend`: `npx tsc --noEmit` clean; `npm test` **80/80 in 8 files** (~5 s).
- `frontend`: `npx tsc --noEmit -p tsconfig.app.json` clean; `npm run lint` clean; `npm run build` green (451 KB JS / 57 KB CSS gzip 126/11).
- Live API smoke test against Neon (`sim-smoke.mjs`, 31/31 checks): login, clone counts + parent, road close, foreign-road `404`, guard `422` with 10,160,526, van disable → 2,346 states, recipient removal, package edit, 10 % supply shock (525 → 475 kg), variant run (`partial`, 94 kg), compare (154 → 94 kg, packages 9 → 6), base run untouched, all six change types audited, sensitivity variant with the top-2 recipients.
- Cleanup (`sim-cleanup.mjs`): only `Riverside District — Monday Rescue` remains with 1 run, 0 `scenario_changes`, 62 roads, 24 donations.

Acceptance checks met: base run untouched; closing a road / disabling a van / removing the top recipient changes the metrics and the diff is visible; `scenario_changes` has exactly one row per edit.

---

### Phase 3 — Evaluation gaps · ~2–3 h · `[ ]`
- Return + store **ACO best / average / worst** per trial (`aco.ts` already collects `tours[]`); surface on Benchmarks.
- `verifyOptimalitySmall()` for the Algorithms lab: "DP == exhaustive for this instance".
- Optional `npm run bench:scale` printing CSV for N = 10/20/50/100 locations (performance section evidence).

---

### Phase 4 — Leaflet map · ~3–4 h · `[ ]` (recommended)
- `npm i leaflet` + `@types/leaflet`; `components/app/RouteMap.tsx` (`useEffect`, OSM tiles, markers by location type, coloured polylines per vehicle, closed roads dashed/grey, popups with cost/stops).
- Toggle Map / Schematic on `AdminWorkspacePage`; graceful fallback to the schematic if tiles fail (offline demo).
Acceptance: every route leg visible, closed road visibly unavailable, no layout shift, works at 390px.

---

### Phase 5 — Documentation · ~5–6 h · `[ ]`
- Rewrite `README.md` (~180–250 lines): overview, screenshots, architecture, setup (`cp .env.example .env`, `db:migrate`, `db:seed`, two dev servers), scripts, credentials, API summary, **algorithm table with paradigms/complexities/baselines**, dataset spec, edge-case register, testing, deployment, known limitations, **stack deviations (no Tailwind, SVG/Leaflet, Recharts only where used)**.
- Restore `docs/`: `ARCHITECTURE.md`, `BACKEND_SCHEMA.md` (20 tables + ERD), `ALGORITHMS.md` (pseudocode + complexity + tie rules + failure modes), `TESTING.md`, `DEPLOYMENT.md`, `SCOPE.md` (proposal → implementation mapping).
- Regenerate the documentation PDF from markdown.

---

### Phase 6 — Email delivery · ~1.5–2 h · `[ ]`
- `nodemailer` behind `SMTP_HOST/PORT/USER/PASS/FROM`; send verification + reset links; keep console fallback when unset; update `.env.example`.

---

### Phase 7 — Deployment + DB finalisation · ~3–4 h · `[ ]`
- Frontend → Vercel: `VITE_API_BASE_URL`, SPA rewrite to `index.html`; convert 2.76 MB hero PNG → WebP (~300 KB) and switch the import.
- Backend → Render/Railway: `NODE_ENV=production`, pooled `DATABASE_URL`, `FRONTEND_URL`, `SESSION_TOKEN_PEPPER`; cookie `Secure` + `SameSite=None`; verify CORS.
- Neon: keep schema, delete demo rows, keep **1 admin + 1 real scenario**; add `db:create-admin`, `db:clear-demo`, `db:import-scenario`; verify with `db:status`.
- Smoke test prod: health, login, run, benchmark.

---

### Phase 8 — Repo hygiene + final QA · ~1–2 h · `[ ]`
- Delete from repo root: `errors.txt`, `NutriResQ Food Rescue Logistics(1).png`, `D&AA Chapter 05.pdf`, `D&AA Chapter 07.pdf` (or move to `course-material/`), commit restored `docs/`.
- Keep/add real `NutriResQ Food Rescue Logistics.png` hero.
- Final pass: `npm run lint`, `npm run build`, `npm test`, `tsc --noEmit` (backend), 390 / 1024 / 1440 / 1920 visual check, all four logins, one full run.
- Demo script for defence in `docs/DEMO.md`.

---

## 4. Definition of done

- [x] `npm test` green with all six §6 categories covered
- [x] Scenario simulator live: 5 change types + sensitivity + preserved original + comparison view
- [~] ACO best/avg/worst visible in the UI (data collected + optimality/exhaustive checks exist; UI surfacing is Phase 3)
- [ ] Leaflet map (or documented decision + schematic) with all routes and closed roads
- [ ] README + `docs/` restored and accurate; PDF regenerated
- [ ] Deployed: Vercel frontend + Node backend + Neon (schema + admin + 1 scenario, no demo rows)
- [ ] Repo clean, no stray files, hero image converted
- [ ] 6-minute demo path rehearsed

---

## 5. Two-day schedule (10–12 h/day, agent typing)

### Day 1 — correctness + simulator
| Slot | Work |
|---|---|
| 0:00–0:30 | seed expansion + reseed (1A) |
| 0:30–3:30 | algorithm unit tests (1B: A*, DP+exhaustive, closest pair) |
| 3:30–4:30 | ACO + pipeline + API tests |
| 4:30–5:00 | ACO best/avg/worst + `verifyOptimalitySmall` (Phase 3) |
| 5:00–9:00 | simulator backend: clone + 5 mutations + sensitivity + compare + audit (2A) |
| 9:00–11:00 | simulator UI + diff table + nav (2B) |
| 11:00–12:00 | buffer / fix discovered issues |

### Day 2 — surface, docs, ship
| Slot | Work |
|---|---|
| 0:00–3:00 | Leaflet map + Map/Schematic toggle (Phase 4) |
| 3:00–6:00 | README + docs restore + PDF (Phase 5) |
| 6:00–8:00 | Deployment + Smart DB cleanup + scripts (Phase 7) |
| 8:00–9:30 | Email (Phase 6) |
| 9:30–11:00 | Repo hygiene + full QA + demo script (Phase 8) |
| 11:00–12:00 | buffer |

**Verdict:** the *proposal-critical* scope (Phases 1, 2, 3, 5 + 7 + 8) fits in **two long days**. Leaflet (Phase 4) and email (Phase 6) are the two items that can slip to a third half-day. **One day is not realistic** — the simulator alone is 10–12 h including its UI and verification.

Bottleneck is review + decisions, not typing: every phase ends with a short acceptance check the user can eyeball.

---

## 6. Risks / gotchas

1. **Neon free plan** — pooler + `sslmode=require`; heavy test loops should run against a local/test schema, not the demo branch (`DATABASE_URL_TEST` is documented but unused).
2. **Tests that need HTTP + DB** — keep `api.test.ts` minimal (guards + health) so `npm test` never requires a live DB; algorithm/pipeline tests are pure.
3. **Leaflet + React 19** — avoid `react-leaflet`; vanilla `L.map` inside `useEffect`, destroy on unmount, invalidate size on sidebar collapse.
4. **Cross-site cookies in prod** — `Secure; SameSite=None` + `trust proxy` + exact `FRONTEND_URL` CORS, otherwise login silently fails on Vercel.
5. **Scenario cloning** — must copy `scenario_locations` links too, or the new scenario has no locations; enforce FK order and one transaction.
6. **Hero asset weight** — 2.76 MB PNG; convert before deployment.
7. **Global `body { min-width: 320px }`** — clips at >450% zoom; leave as-is, document.
8. **Uncommitted working tree** — landing/sidebar CSS changes are not committed; commit before large refactors to keep a rollback point.
