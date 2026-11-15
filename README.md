# NutriResQ — Smart Food Rescue & Redistribution Optimizer

## Project Summary
NutriResQ is a web-based decision-support system that finds efficient road paths, allocates food packages across a limited delivery fleet, analyzes nearby facilities, and optimizes multi-stop delivery routes. It implements four DAA (Design and Analysis of Algorithms) paradigms—Dynamic Programming, Divide & Conquer, Greedy Search, and Approximation Heuristics—to solve the food redistribution problem.

## Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Seed expansion (28 locations / 62 roads / 15 donors / 10 recipients / 24 donations / 5 vehicles), algorithm unit tests (A*, DP+exhaustive, closest-pair, ACO), API tests | ✅ Complete (87/87 tests passing) |
| **Phase 2** | Scenario simulator backend (clone, 6 edit types: roads/fleet/packages/recipients/supply shock/sensitivity, audit trail, compare & sensitivity views), AdminScenarioPage, nav item, live smoke 31/31 checks | ✅ Complete |
| **Phase 3** | ACO best/average/worst per trial (`trialStats[]`), DP vs exhaustive prefix check in the lab (8 of 19 packages, 65,536 assignments, match at 32,950), `npm run bench:scale` CSV benchmark, +7 tests → 87/87 passing | ✅ Complete |
| **Phase 4** | Leaflet map (`RouteMap.tsx`) + Map/Schematic toggle on AdminWorkspacePage, OSM tiles, markers by location type, coloured polylines per vehicle, closed roads dashed/grey, popups with cost/stops, graceful fallback to SVG schematic if tiles fail, works at 390px narrow viewport | ✅ Complete |

## Four Algorithms

| Algorithm | Paradigm | Role |
|-----------|----------|------|
| **A* Search** | Greedy / Search | Finds low-cost road paths between donors, hubs and recipients using travel cost plus a geographic heuristic |
| **Multiple Knapsack (DP)** | Dynamic Programming | Assigns food packages to vehicles of different capacities to maximize total humanitarian impact |
| **Closest Pair of Points** | Divide and Conquer | Finds the geographically closest pair of donors, recipients or hubs for proximity analysis |
| **Ant Colony Optimization** | Approximation / Heuristic | Searches for efficient multi-stop collection and delivery orders using road-network costs, assigned stops and road availability |

**How they connect:** ACO decides the order of stops, A* computes the road path between consecutive stops, DP decides which packages each vehicle carries, and Closest Pair supports proximity analysis.

## Test Suite

- **87 passing tests** across 8 files, no database required
- Coverage: algorithm correctness, cross-checks (A* vs Dijkstra, Closest Pair vs brute force, DP vs exhaustive), edge cases (disconnected network, oversized packages, unavailable vehicles, expired donations, unreachable destinations), performance benchmarks
- Run: `npm test` in the `backend` directory

## Technology Stack

- **Frontend:** React, TypeScript, custom token-based CSS (Tailwind not installed — deviation documented)
- **Backend:** Node.js, Express, PostgreSQL (Neon)
- **Algorithms:** Plain TypeScript modules (no third-party optimization library)
- **Maps:** Leaflet with OpenStreetMap (vanilla, not `react-leaflet`)
- **Deployment:** Vercel (frontend), Node-compatible host (backend)

## Project Constraints

- Test dataset: 28 locations, 62 roads (1 closed), 15 donors, 10 recipients, 5 vehicles (3 available), 24 donations
- Road cost + availability; closed roads never used
- Disconnected networks and unreachable destinations detected and reported by name
- Each vehicle stays within weight capacity; no package assigned to more than one vehicle
- Packages too large for every vehicle are excluded; best feasible partial allocation on oversupply
- Expired or ineligible packages filtered out before allocation and routing
- Routes respect pickup-before-delivery order
- Scenario simulator: road closures, reduced food supply, unavailable vehicles, changed recipient needs, sensitivity analysis, original scenario preserved

## Quick Start

```bash
# Backend
cd backend
npm install
npx tsc --noEmit      # TypeScript check
npm test               # 87 tests, no database

# Frontend
cd frontend
npm install
npm run lint           # ESLint check
npm run build          # Vite build

# Run the dev servers
cd backend  && npm run dev   # port 4000
cd frontend && npm run dev   # port 5173
```

## Key Decisions (Deviations from Proposal)

1. **No Tailwind CSS** — Custom token-based CSS is used instead; porting to Tailwind is ~2–3 days of pure churn with no functional benefit.
2. **Vanilla Leaflet** — `react-leaflet` has React 19 peer-dep friction; a 150-line `useEffect` wrapper is safer. `RouteSchematic.tsx` remains as the offline fallback.
3. **Recharts optional** — Tables are the source of truth; only 2–3 charts where they add evidence.
4. **Plain JavaScript modules** — All four algorithms are written in plain JavaScript/TypeScript for independence, testability and documentation.

## Directory Overview (root)

```
NutriResQ/
├── README.md              ← Project summary (this file)
├── remaining_plan.md      ← Phase status and roadmap (8 phases)
├── NutriResQ_CCP_Proposal (2).pdf  ← Original proposal document
├── CCP Fall 26.pdf        ← Course material
├── NutriResQ Food Rescue Logistics.png  ← Hero asset (2.76 MB)
├── NutriResQ Food Rescue Logistics(1).png  ← Stray file (Phase 8 cleanup)
├── errors.txt             ← Stray file (Phase 8 cleanup)
├── NutriResQ_Detailed_Documentation.pdf  ← Detailed docs (Phase 8 cleanup)
├── docs/                  ← To be restored in Phase 5 (currently deleted)
├── backend/               ← Node/Express/PostgreSQL backend
├── frontend/              ← React/TypeScript/Vite frontend
└── .git/                  ← Git repository
```

## Commit History (main..develop)

```
67e1c61  Phase 4 done and verified    (Leaflet map + Map/Schematic toggle)
4358899  Phase 3 done and verified    (ACO best/avg/worst + DP/exhaustive)
facc08f  Added phase 1 and phase 2  (sidebar, scenarios, admin pages)
24e6984  Smooth sidebar collapse    (pre-Phase 1, on main)
```

## Learn More

- `remaining_plan.md` — Single source of truth for phases 5–8
- `backend/tests/README.md` — Test coverage map (87 tests across 8 files)
- `backend/tests/` — 8 test files: seed-data, astar, knapsack, closest-pair, aco, optimization, scenario, api
- `frontend/src/components/app/RouteMap.tsx` — Leaflet map component (Phase 4)
- `frontend/src/pages/admin/AdminWorkspacePage.tsx` — Admin workspace with Map/Schematic toggle (Phase 4)

---

Generated from the implementation state as of 2026-11-15. All four algorithms are implemented, all constraints are satisfied, and the application is functionally complete against the CCP proposal.