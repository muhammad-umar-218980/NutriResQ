# Technology Stack — NutriResQ

## 1. Purpose

This document is the authoritative technology allowlist for NutriResQ. It prevents an AI coding agent from silently replacing the database, changing the algorithm language, adding unnecessary frameworks, or moving secret-bearing logic into the browser.

If a required technology becomes unsuitable, explain the reason and propose a change before implementing it. Update this file only after the change is approved.

## 2. Approved stack

| Layer | Approved choice | Responsibility |
|---|---|---|
| UI framework | React | Component-based interactive interface |
| Frontend language | TypeScript | Typed UI, API models, and component props |
| CSS/styling | Tailwind CSS | Utility-based styling and responsive layouts |
| Interactive maps | Leaflet | Render locations, roads, paths, and route stops |
| Map data/tiles | OpenStreetMap-compatible tiles | Geographic basemap display |
| Charts | Recharts | Visualize measured metrics and comparisons |
| Server runtime | Node.js | Run the API and algorithm modules |
| API framework | Express | HTTP routes and middleware |
| Algorithm language | Plain JavaScript modules | A\*, multiple-knapsack DP, closest pair, ACO, baselines |
| Database | PostgreSQL on Neon | Persistent application data |
| PostgreSQL driver | `pg` | Server-side database connections and parameterized queries |
| Frontend hosting | Vercel | Deploy the frontend |
| API hosting | Render or another compatible Node.js host | Deploy Express API |
| Version control | Git + GitHub | Source history, review, and collaboration |

Use a supported Node.js LTS release compatible with the chosen libraries. Select concrete versions at project initialization, verify compatibility, and commit the lockfile. This document deliberately does not pin versions that have not yet been verified.

## 3. Non-negotiable constraints

1. **PostgreSQL stays PostgreSQL.** Do not replace Neon/PostgreSQL with Supabase, Firebase, MongoDB, SQLite, or another database without explicit approval.
2. **Algorithms use JavaScript.** The four required algorithms and their baselines must be implemented in plain JavaScript modules running in Node.js.
3. **No database access from the browser.** Only the backend may use `pg` and the Neon connection string.
4. **No fake optimization output.** UI metrics and route paths must come from actual algorithm/API results.
5. **Map display is not route computation.** Leaflet and OpenStreetMap tiles show geographic context; A\* and ACO are implemented by NutriResQ.
6. **Do not add microservices for the MVP.** Use a modular monolith unless a measured requirement justifies another architecture.
7. **No unapproved dependency sprawl.** Before adding a package, explain the use case, whether the existing stack can do it, maintenance/security implications, and bundle/runtime impact.
8. **No frontend secrets.** Do not expose database credentials, private API keys, or server-only environment variables in client bundles.
9. **Use the same algorithm implementation everywhere.** Standalone evaluation endpoints and integrated optimization must call the same tested modules.
10. **Do not silently change the product scope.** Follow `PRD.md`.

## 4. Algorithm requirements

### A\* Search
- Input: explicit road graph, start node, goal node, edge costs, and heuristic.
- Closed roads are excluded from the graph used for a run.
- Heuristic must be admissible for the cost model if optimal-path claims are made; otherwise use a zero heuristic or qualify the claim.
- Return path, total cost, visited/expanded-node diagnostics where useful, and an explicit unreachable result.

### Multiple Knapsack using Dynamic Programming
- Use integer capacities and weights for the DP state model.
- Document the scale used to convert real package weights and vehicle capacities to integer units; avoid silent rounding.
- Package value/priority must be explicit and consistent.
- Every package can be assigned at most once; vehicle capacities must be respected.
- Validate state-space limits before allocation to prevent excessive memory/time use.
- Reconstruct assignments from DP state and test reconstruction separately.
- Do not silently replace the required DP approach with a greedy approximation. A greedy baseline may be included separately.

### Closest Pair using Divide and Conquer
- Implement the divide-and-conquer algorithm as a distinct module.
- Define the point set, coordinate system, and units before implementation.
- If geographic coordinates are used, do not apply a planar Euclidean formula directly to latitude/longitude degrees and then label the result as kilometers. Use a documented local projection for a bounded region or a justified geographic-distance model.
- Distinguish straight-line proximity from road-network travel cost.
- Include duplicate-point and small-input tests.

### Ant Colony Optimization
- ACO searches for a low-cost ordering of a defined stop set; it is heuristic and does not guarantee the global optimum.
- Pairwise costs must represent feasible road travel, ideally obtained through A\*.
- Define how unreachable stop pairs affect route construction.
- Make parameters configurable in a controlled way; record the parameters and random seed for each run when practical.
- Include a nearest-neighbor baseline.
- Report measured outcomes; do not promise a fixed percentage improvement.

## 5. Database rules

- Use PostgreSQL hosted on Neon for deployed persistence.
- Use `pg` on the backend.
- Use parameterized SQL for all user-influenced values.
- Use versioned SQL migrations; do not rely on undocumented manual changes in a hosted database.
- Keep schema names, foreign keys, unique constraints, and check constraints aligned with `BACKEND_SCHEMA.md`.
- Use a transaction when saving a run and its related allocations/routes so results are not half-persisted.
- Use the provider-recommended secure connection settings.
- Never commit `.env` files or real credentials.

## 6. Frontend rules

- Use TypeScript types for API responses and key domain entities.
- Keep API calls in a small shared client/service layer rather than scattering raw `fetch` calls across components.
- Treat backend validation and results as authoritative.
- Keep algorithm logic out of React components.
- Use Leaflet for display and interaction; do not imply that map tiles provide a route result.
- Use Recharts only for data that exists in API responses.
- Make loading, empty, error, partial, and success states explicit.
- Avoid gradients in the visual design unless the product owner explicitly approves them. Follow `DESIGN_SYSTEM.md` for final visual decisions.
- Keep map components isolated enough that map rendering problems do not break allocation or history views.

## 7. Backend rules

- Use Express routes/controllers for HTTP concerns, services for use-case orchestration, algorithm modules for computation, and repositories for database access.
- Validate every external request on the server.
- Centralize error handling and use consistent response shapes.
- Never accept client-supplied totals or route costs as trusted computed values.
- Do not return stack traces or database error details to clients.
- Put secrets and environment parsing in a server-only configuration module.
- Keep algorithm modules deterministic where the algorithm allows it; where randomness is intrinsic, expose and record a seed when practical.

## 8. Environment variables

The exact names should be finalized when initializing the application. Recommended names:

### Backend
- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `FRONTEND_ORIGIN` or an equivalent CORS allowlist setting

### Frontend
- `VITE_API_BASE_URL` if using Vite, or the equivalent public configuration mechanism for the chosen frontend build setup.

Rules:
- `DATABASE_URL` is backend-only.
- Only values intentionally safe to expose may use public/client prefixes.
- `.env.example` contains placeholder values, never working credentials.
- Validate required environment variables at startup and fail with a clear, secret-free message.
- Keep local `.env` files ignored by Git.
- Do not assume the exact frontend build tool until it is chosen and documented.

## 9. Deployment

### Frontend
- Deploy the frontend to Vercel.
- Configure its public API base URL to point to the deployed backend.
- Ensure the production build does not contain database credentials.

### Backend
- Deploy Express to Render or another compatible Node.js host.
- Configure server-only environment variables through the host's secret/configuration interface.
- Configure CORS for the expected frontend origin rather than allowing every origin by default.
- Provide a health endpoint that does not expose sensitive details.
- Confirm the host's port binding, start command, Node version, and persistent runtime expectations.

### Database
- Use Neon PostgreSQL.
- Apply migrations in a controlled order.
- Use secure connection settings and least-privilege credentials where supported.
- Confirm connection limits and pooling requirements for the selected host and deployment model.

Deployment provider details and free-tier limits can change; verify them at implementation time rather than hard-coding assumptions into the application.

## 10. Testing stack

Choose and document a JavaScript test runner before Phase 2. Use it to test:
- each algorithm independently;
- baselines against small known cases;
- post-optimization invariants;
- API validation and error responses;
- database persistence and migrations; and
- at least one end-to-end scenario.

Do not install multiple overlapping test frameworks without a clear reason. The exact framework is a pending implementation decision.

## 11. Package addition/change process

Before adding or replacing a dependency, the coding agent must state:
1. the requirement it addresses;
2. why current approved dependencies are insufficient;
3. whether it adds runtime, bundle, hosting, licensing, or security costs;
4. what alternatives were considered; and
5. which documentation and tests need updates.

Wait for approval for any change to a non-negotiable constraint. Routine compatible dependencies can be proposed in the implementation plan, but should not be added silently.

## 12. Explicitly not approved by default

These are not part of the planned MVP unless separately approved:
- Supabase or Firebase;
- MongoDB;
- Python-based algorithm services;
- a separate microservice for each algorithm;
- a third-party routing API as a substitute for implementing A\* and ACO;
- a UI component framework added solely for convenience without checking the design requirements;
- authentication providers or role-management systems before the MVP authentication decision;
- queues, Redis, or background-worker infrastructure before measured need; and
- AI/ML features unrelated to the four required algorithms.

## 13. Decision log

| Decision | Status |
|---|---|
| React + TypeScript frontend | Approved |
| Tailwind CSS | Approved |
| Leaflet + OpenStreetMap tiles | Approved |
| Recharts | Approved |
| Node.js + Express API | Approved |
| JavaScript algorithm modules | Approved |
| Neon PostgreSQL + `pg` | Approved |
| Vercel frontend | Approved target |
| Render or compatible Node host | Approved target, provider to confirm |
| Concrete package versions | Pending repository initialization |
| Frontend build tool | Confirm before setup |
| Test framework | Confirm before algorithm implementation |
| Authentication for MVP | Not required by current scope; decide before implementation if access control is needed |
