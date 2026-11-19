# Backend test suite

Run from `backend/`:

```bash
npm test          # vitest run, one shot
npm run test:watch
```

The suite is **database-free by design**. Algorithm, seed and pipeline tests import
the pure TypeScript modules directly; `api.test.ts` talks to the Express app with
`supertest` and never opens a connection (it sets a placeholder `DATABASE_URL`
before importing `src/app.ts`). This keeps `npm test` reliable on a laptop, in CI,
and on the free Neon plan.

## Proposal §6 coverage map

| §6 requirement | Test file | Key assertions |
|---|---|---|
| Correctness: closed roads are never used | `astar.test.ts`, `optimization.test.ts` | no A* path or route leg uses the closed road |
| Correctness: capacity never exceeded, no package duplicated | `knapsack.test.ts`, `optimization.test.ts` | per-vehicle weight ≤ capacity; global `Set` of assigned ids |
| Correctness: route cost equals sum of graph edges | `astar.test.ts`, `aco.test.ts` | path legs exist in the graph; leg costs sum to `totalCost` |
| A* versus Dijkstra | `astar.test.ts` | identical cost on all 702 reachable ordered pairs; A* expands ≤ Dijkstra |
| Heuristic admissibility | `seed-data.test.ts`, `astar.test.ts` | every road cost ≥ straight-line distance; `h(n) ≤ d(n, goal)` for all pairs |
| Closest pair versus brute force | `closest-pair.test.ts`, `optimization.test.ts` | 200 random sets agree to 1e-9; benchmark `distancesAgree` |
| DP versus **exhaustive enumeration** | `knapsack.test.ts` | 50 random small instances match an independent exhaustive solver |
| Lab cross-check (`verifyOptimalitySmall`) | `knapsack.test.ts` | production verifier agrees with the independent solver on 25 instances; trims 40 items to a 65,536-assignment prefix; declines with a reason when impossible |
| Greedy baseline never beats DP | `knapsack.test.ts`, `optimization.test.ts` | greedy total value ≤ DP total value |
| ACO trials: best / average / worst available | `aco.test.ts` | per-trial best ≤ average ≤ worst; complete-tour counts; summary matches the trial series; deterministic for a fixed seed |
| ACO versus nearest neighbour | `aco.test.ts` | same job coverage, finite measured costs, comparison logged |
| Pickup before delivery on every route | `aco.test.ts`, `optimization.test.ts` | legs are emitted in pickup→delivery pairs; delivery stops follow their pickup |
| Disconnected / unreachable reported by name | `seed-data.test.ts`, `optimization.test.ts` | Isolation Point unreachable; 54 ordered unreachable pairs named |
| Expired / ineligible filtered before allocation | `optimization.test.ts` | reason is `expired` / `ineligible` per seeded case |
| Unavailable recipient excluded from allocation | `scenario.test.ts`, `optimization.test.ts` | package of a disabled recipient gets reason `not_available` and is never allocated |
| Simulator state-space guard | `scenario.test.ts` | `prod(capacity + 1)`; seeded fleet 143,106 states; +70 kg truck > 250,000 |
| Oversized package excluded | `knapsack.test.ts`, `optimization.test.ts` | reason `oversized`; never allocated |
| Partial allocation on oversupply | `optimization.test.ts` | status `partial`, capacity utilisation ≈ 99% |
| No vehicles / invalid weights / state limit | `knapsack.test.ts`, `optimization.test.ts` | explicit reasons and honest `failed` status |
| Deterministic ties and seeded RNG | `astar.test.ts`, `closest-pair.test.ts`, `aco.test.ts`, `optimization.test.ts` | repeated runs produce identical output |
| Scenario comparison deltas | `scenario.test.ts` | absolute + relative delta, lower-is-better flags, no divide-by-zero, failed run → zeros |
| Sensitivity ranking | `scenario.test.ts` | priority desc, then demand desc, then name; count clamped; input not reordered |
| HTTP guards and validation envelope | `api.test.ts` | 401 matrix, 403 untrusted origin, 422 validation, 404 JSON, CORS |

### Simulator coverage boundaries

`scenario.test.ts` is deliberately pure: it covers the state-space projection, metric
deltas, urgency ranking and the recipient-availability eligibility rule. The SQL side
of the simulator (clone copies, `FOR UPDATE` mutations, `scenario_changes` inserts,
cross-scenario `404`s, the `422` state guard, compare family rule) needs a live
database, so it is verified by the throwaway smoke script used during development
(`sim-smoke.mjs`: 31/31 checks, base run left untouched) rather than by `npm test`.
Keep it that way unless a dedicated test database is provisioned.

## Seed dataset contract

`seed-data.test.ts` locks the expanded scenario so later phases (simulator,
Leaflet, docs) can rely on it:

- 28 locations / 62 roads (1 closed) / 15 donors / 10 recipients / 24 donations / 5 vehicles
- exactly 3 available vehicles at 60 / 45 / 50 kg
  → `61 × 46 × 51 = 143,106` DP states, under the 250,000 default
- every road cost ≥ its projected straight-line distance (admissibility precondition)
- one unreachable node (`Isolation Point`), everything else connected to `Central Depot`
- designed edge cases: expired, ineligible, oversized, no-recipient, `unavailable`,
  and future-dated donations

## Scale benchmark (not part of `npm test`)

`npm run bench:scale` prints CSV to stdout and touches neither the database nor the
server. It measures A* vs Dijkstra on grid graphs (runtime + node expansions + a
cost-equality flag), divide-and-conquer vs brute-force closest pair on 100–4,000
points (with an equality flag), DP runtime on the seeded 143,106-state fleet, and
ACO runtime on synthetic planes. Use it for the performance section; it asserts
nothing, so keep the agreement flags in the output when quoting numbers.

## Adding a test

- Prefer `buildSeedSnapshot()` from `tests/helpers/seed-snapshot.ts` over hand-built
  fixtures; it mirrors `scenario.repository.ts` ordering and joins exactly.
- Keep new tests database-free unless they are explicitly integration tests.
  `DATABASE_URL_TEST` / `TEST_SCHEMA` exist in `.env.example` but are not used yet.
