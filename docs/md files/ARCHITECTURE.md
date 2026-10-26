# System Architecture — NutriResQ

## 1. Architectural goals

The architecture should keep algorithmic correctness independent of the interface, allow results to be tested without a browser or database, persist reproducible runs, and make it possible to replace a UI component without rewriting the optimization engine.

Use a **modular monolith** for the MVP: one frontend application, one Express API, one PostgreSQL database, and a set of independent algorithm modules within the backend codebase. Do not introduce microservices without a demonstrated need.

## 2. High-level component view

```text
┌──────────────────────────── User Browser ───────────────────────────┐
│ React + TypeScript                                                  │
│  ├─ Scenario editor and validation feedback                         │
│  ├─ Optimization dashboard / allocation / route panels              │
│  ├─ Leaflet map (renders road/location data returned by API)        │
│  └─ Recharts (renders measured result and benchmark data)           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS + JSON
                               ▼
┌──────────────────────────── Express API ─────────────────────────────┐
│ Route handlers → request validation → application services           │
│                                   │                                  │
│                                   ▼                                  │
│                         Optimization Orchestrator                    │
│                         ├─ Scenario validator                        │
│                         ├─ A* road pathfinding                       │
│                         ├─ Multiple-knapsack DP                      │
│                         ├─ Divide-and-conquer closest pair           │
│                         ├─ ACO multi-stop route ordering             │
│                         ├─ Baseline implementations                  │
│                         └─ Result / constraint validator             │
│                                   │                                  │
│                         Repository / data-access layer               │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │ TLS PostgreSQL connection
                                    ▼
                         ┌────────────────────────┐
                         │ PostgreSQL on Neon     │
                         │ scenarios and inputs   │
                         │ runs and configurations│
                         │ allocations and routes │
                         │ benchmark measurements │
                         └────────────────────────┘

External map tile provider: OpenStreetMap tile service
- Used by Leaflet to display map tiles.
- It is not NutriResQ's pathfinding algorithm or a guaranteed routing API.
```

## 3. Deployment topology

- **Frontend:** React application deployed to Vercel.
- **Backend:** Express API deployed to Render or another compatible Node.js host.
- **Database:** PostgreSQL hosted on Neon.
- **Map tiles:** Leaflet requests tiles from the configured OpenStreetMap-compatible tile provider in the browser, subject to that provider's usage policy.
- **Communication:** frontend calls the API over HTTPS using a configured API base URL; backend connects to PostgreSQL using a server-only connection string.

Do not put the Neon connection string in frontend environment variables. A variable exposed to browser code is not secret merely because its name begins with `VITE_` or another frontend prefix.

## 4. Backend module boundaries

Suggested structure; refine it only when the repository is initialized:

```text
backend/
  src/
    app.js
    server.js
    config/
      env.js
    routes/
      scenarios.routes.js
      locations.routes.js
      optimization.routes.js
      algorithms.routes.js
      benchmarks.routes.js
      runs.routes.js
    controllers/
    middleware/
      error-handler.js
      validate-request.js
    services/
      scenario.service.js
      optimization.service.js
      simulation.service.js
      benchmark.service.js
    algorithms/
      astar.js
      multiple-knapsack-dp.js
      closest-pair.js
      aco.js
      baselines/
        dijkstra.js
        greedy-knapsack.js
        brute-force-closest-pair.js
        nearest-neighbor.js
    repositories/
    validators/
    utils/
  migrations/
  tests/
```

Suggested frontend structure:

```text
frontend/
  src/
    app-or-pages/
    components/
      layout/
      map/
      scenarios/
      allocation/
      routes/
      benchmarks/
      simulation/
      ui/
    features/
      scenarios/
      optimization/
      runs/
    lib/
      api-client.ts
      formatters.ts
    types/
    styles/
```

These are responsibility boundaries, not permission to create dozens of empty files immediately. Implement only the files needed for the current phase.

## 5. Responsibilities

### Frontend
- collects and edits scenario inputs;
- calls API endpoints;
- renders map, allocations, routes, metrics, warnings, and history;
- performs client-side convenience validation but never replaces backend validation;
- does not run authoritative optimization or connect directly to PostgreSQL.

### Express API
- validates and normalizes requests;
- applies scenario and run business rules;
- calls services and algorithm modules;
- returns stable JSON response shapes and suitable HTTP status codes;
- handles errors centrally;
- never trusts client-submitted result metrics as authoritative.

### Optimization service
Coordinates the sequence of steps and combines outputs. It must not contain UI logic or SQL statements. Its inputs and outputs should be ordinary data objects that can be unit tested.

### Algorithm modules
- operate on explicit inputs and return explicit outputs;
- do not read environment variables, query the database, or send HTTP responses;
- do not mutate shared scenario data unexpectedly;
- expose enough diagnostics for correctness checks and benchmarks;
- are tested independently.

### Repository/data-access layer
- performs parameterized SQL queries;
- maps database rows to application data structures;
- persists scenario snapshots, run metadata, allocations, routes, and benchmark records;
- handles transaction boundaries for multi-table writes.

### PostgreSQL
Stores scenarios, source records, scenario changes, optimization runs, detailed outputs, and benchmark measurements. Database migrations are versioned and committed.

## 6. Integrated optimization sequence

The orchestrator should use a defined order:

1. **Load immutable input snapshot.** Resolve scenario data and record its version/snapshot.
2. **Validate.** Check references, values, coordinate fields, edge weights, capacities, dates, and algorithm limits. Stop on fatal errors; retain non-fatal warnings.
3. **Build road graph.** Exclude closed roads and apply the documented directionality/cost model.
4. **Network analysis.** Run A\* for required origin/destination pairs. Record unreachable pairs explicitly. Run closest-pair analysis on the selected eligible location set.
5. **Donation eligibility.** Exclude expired or ineligible packages according to documented rules. Identify packages too large for every available vehicle.
6. **Allocation.** Run multiple-knapsack DP and reconstruct package assignments. Validate unique assignment and capacity constraints.
7. **Stop construction.** Derive route stops from the allocation and the documented pickup/delivery semantics. Do not route unassigned or ineligible work.
8. **Travel-cost matrix.** Use A\* road-network costs for every required pair of stops. An unreachable pair is not a normal numeric cost; route feasibility must handle it explicitly.
9. **Route ordering.** Run ACO on feasible route costs. If a required stop cannot be connected under the chosen model, mark the route partial/infeasible and explain why.
10. **Post-validation.** Recalculate costs from road paths and verify constraints.
11. **Metrics and persistence.** Calculate actual metrics, save run metadata and detailed results transactionally, then return the saved run identifier.
12. **Presentation.** Frontend renders returned results, warnings, and metrics.

Allocation and routing are related but distinct. The allocation objective does not automatically minimize travel cost. The UI and documentation must make that trade-off visible.

## 7. API design

Prefix all endpoints with `/api`. JSON is the default request/response format.

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Lightweight API health check; do not expose secrets |
| `GET /api/scenarios` | List scenarios |
| `POST /api/scenarios` | Create scenario |
| `GET /api/scenarios/:id` | Retrieve scenario and relevant input data |
| `PATCH /api/scenarios/:id` | Update supported scenario data |
| `GET /api/locations?scenarioId=...` | Retrieve scenario locations |
| `GET /api/roads?scenarioId=...` | Retrieve scenario road edges |
| `POST /api/optimize` | Start/run integrated optimization for a scenario or explicit snapshot |
| `GET /api/runs/:id` | Retrieve run metadata and results |
| `GET /api/scenarios/:id/runs` | List runs for a scenario |
| `POST /api/algorithms/astar` | Execute A\* in isolation for development/evaluation |
| `POST /api/algorithms/knapsack` | Execute multiple-knapsack DP in isolation |
| `POST /api/algorithms/closest-pair` | Execute closest-pair analysis in isolation |
| `POST /api/algorithms/aco` | Execute ACO in isolation |
| `POST /api/benchmarks` | Compare supported algorithm and baseline on the same inputs |
| `POST /api/scenarios/:id/simulate` | Create a changed scenario copy and rerun or prepare a simulation |

Do not expose debug-only endpoints in production without a deliberate reason. Standalone algorithm endpoints should share the same validators and algorithm modules as the integrated workflow.

### API response principles
- use consistent error responses with a stable error code, readable message, and field details where relevant;
- distinguish invalid input from unreachable/infeasible outcomes;
- return units with numeric metrics;
- avoid returning stack traces, credentials, or raw SQL errors;
- paginate history if it grows beyond the small demo dataset;
- use request IDs or run IDs to help diagnose failures.

Illustrative response shape (not a fixed implementation contract):

```json
{
  "runId": "example-run-id",
  "status": "succeeded",
  "metrics": {
    "allocatedPackageValue": 120,
    "totalRoadCost": 42.5,
    "unreachableStopCount": 0
  },
  "warnings": [],
  "resultsUrl": "/api/runs/example-run-id"
}
```

All values above are examples only. Real API responses must use computed values.

## 8. Data and persistence flow

1. API receives a validated scenario edit or optimization request.
2. The service loads current scenario records.
3. A run snapshot is created so later edits do not rewrite history.
4. Algorithms run in memory against normalized input objects.
5. Result validators check constraints.
6. A database transaction stores run status, configuration, metrics, allocations, routes, stops, and warnings.
7. API returns the persisted run result.
8. Frontend displays the response and can fetch it again using the run ID.

For a failed run, persist a failure status and safe diagnostic information if possible. Avoid partially writing allocations/routes as though they were a complete successful run.

## 9. Scenario and run immutability

- Editing a scenario affects future runs, not prior snapshots.
- Simulation starts from a copy and records each change.
- A run must refer to the exact inputs used, not only a mutable scenario ID.
- Algorithm version/configuration and random seed should be recorded when relevant.
- Reopening a run must not silently recompute it with newer algorithm code.

## 10. Error and feasibility model

Distinguish at least:

- **Validation failure:** the request or dataset is malformed.
- **Unreachable:** no path exists through available roads for a required pair.
- **Ineligible:** a donation cannot be considered under the configured rules.
- **Oversized:** a package cannot fit any available vehicle under the modeled capacity.
- **Partial:** a feasible result exists, but not all desired work can be completed.
- **Algorithm failure:** an implementation error or configured limit prevented a valid result.
- **Success:** outputs pass the documented post-validation checks.

Do not encode all these conditions as an empty array or a generic HTTP 500.

## 11. Performance strategy

Start with a synchronous workflow for small seeded scenarios if measured execution time is acceptable. Set input limits for DP and ACO so a request cannot monopolize the server. If later measurements show that optimization runs are too long for a request/response cycle, move run execution to a background job pattern without changing the pure algorithm interfaces or run-result contract.

Do not add a queue or distributed infrastructure before it is needed.

## 12. Observability

Record safe structured logs for:
- request/run identifier;
- scenario identifier and snapshot/version;
- algorithm name and configuration;
- run duration and status;
- validation or feasibility warnings;
- benchmark trial/seed where relevant.

Never log database passwords, connection strings, session tokens, or unnecessary personal information.

## 13. Architecture decisions to record

Before implementation, record decisions for:
- frontend build tool and package versions;
- API route conventions and validation library;
- test framework;
- coordinate projection and distance units for closest pair;
- road edge directionality and edge-cost units;
- route semantics for pickup and delivery stops;
- integer scaling and limits for multiple-knapsack DP;
- ACO parameter defaults and random seed policy;
- authentication scope for the first release; and
- how a run snapshot is represented and versioned.

If a decision changes later, update this document and any affected schema/tests.
