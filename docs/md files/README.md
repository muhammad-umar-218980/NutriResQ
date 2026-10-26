# NutriResQ — Smart Food Rescue & Redistribution Optimizer

> **Project type:** CT-363 Design and Analysis of Algorithms (DAA) CCP + full-stack portfolio project  
> **Primary user:** Operations Coordinator  
> **Status:** Planning / pre-implementation  
> **Project principle:** Correct, explainable optimization first; polished interface second.

## 1. What is NutriResQ?

NutriResQ is an algorithm-driven decision-support system for planning surplus-food collection and redistribution. It helps an operations coordinator explore a controlled food-rescue network, allocate food packages to vehicles with limited capacity, identify geographically close locations, plan routes over an available-road network, compare algorithms with simpler baselines, and test what happens when conditions change.

NutriResQ is **not merely a food-listing website**. Its main value is the integration of four distinct algorithmic problems into a single reproducible workflow:

1. **A\* Search** — find a low-cost path through the available road graph between two locations.
2. **Multiple Knapsack using Dynamic Programming** — assign eligible food packages to multiple vehicles without exceeding their capacities, maximizing the defined package value.
3. **Closest Pair of Points using Divide and Conquer** — find the geographically closest pair among eligible locations.
4. **Ant Colony Optimization (ACO)** — search for a low-cost ordering of the required stops for a vehicle route, using road-network costs.

The algorithms solve different subproblems. A\* computes a road path between two endpoints; ACO proposes a multi-stop order. ACO must not be described as replacing A\*.

## 2. The problem

Food donors such as restaurants, bakeries, and supermarkets may have surplus food, while recipient organizations such as shelters, welfare organizations, community kitchens, and food banks have needs. Coordinating these resources is difficult when roads are unavailable, the fleet has limited capacity, donations expire, and routes contain multiple stops.

NutriResQ aims to help the coordinator:

- understand which locations are connected through available roads;
- identify unreachable locations and avoid routes that use closed roads;
- select and allocate food packages within vehicle capacity limits;
- inspect geographic proximity between locations;
- build and compare multi-stop routes;
- change a scenario and rerun optimization;
- compare algorithm outputs against simpler baselines; and
- inspect or reproduce prior optimization runs.

The initial version uses **synthetic, documented sample data**. It must not imply that real donors, charities, live traffic, or live inventories are connected unless those integrations are explicitly implemented later.

## 3. Intended users

### Primary interactive user: Operations Coordinator

The coordinator creates or selects a scenario, edits its data, runs optimization, reviews allocation and routing results, compares algorithms, and simulates disruptions.

### Entities represented as data

- **Food donors:** restaurants, bakeries, supermarkets, and similar businesses.
- **Recipient organizations:** shelters, welfare organizations, community kitchens, and food banks.
- **Vehicles:** vehicles with capacity and availability attributes.

For the initial CCP MVP, these are records managed by the coordinator. Separate donor and recipient accounts or portals are future extensions, not prerequisites.

## 4. MVP scope

The minimum credible system includes:

- a seeded synthetic network of locations and roads;
- editable scenario data, including road availability, donations, recipients, and vehicles;
- scenario validation with actionable errors;
- A\* pathfinding and reachability reporting;
- multiple-knapsack DP allocation with assignment reconstruction;
- divide-and-conquer closest-pair analysis;
- ACO multi-stop route ordering;
- baseline implementations for algorithm comparison;
- an integrated optimization run with saved inputs and outputs;
- an interactive map, result tables, metrics, and charts;
- scenario disruption/sensitivity simulation;
- run history and reproducible results;
- automated tests for algorithm correctness and edge cases; and
- deployment of the frontend, API, and PostgreSQL database.

### Explicitly outside the initial MVP

- live donor onboarding and public donor/recipient portals;
- live traffic or guaranteed real-world travel times;
- live driver tracking or native mobile apps;
- automated SMS/email notifications;
- machine-learning demand forecasts;
- complex cold-chain or regulatory food-safety certification;
- payments, billing, or donation marketplace functionality;
- multi-tenant enterprise permissions; and
- claims that the heuristic route is globally optimal.

## 5. Approved technology summary

See [`TECH_STACK.md`](./TECH_STACK.md) for the authoritative list and constraints.

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Map | Leaflet + OpenStreetMap tiles |
| Charts | Recharts |
| Backend | Node.js + Express |
| Algorithms | Plain JavaScript modules |
| Database | PostgreSQL hosted on Neon |
| Database driver | `pg` |
| Frontend hosting | Vercel |
| API hosting | Render or another compatible Node.js host |
| Version control | Git + GitHub |

Use a supported Node.js LTS release compatible with the selected dependencies. Do not guess package versions: verify compatibility when initializing the repository and commit the lockfile.

## 6. System workflow

1. Load or create a scenario.
2. Validate the input data and report any invalid or contradictory records.
3. Build the available-road graph and calculate required A\* paths.
4. Report disconnected or unreachable locations explicitly.
5. identify the geographically closest eligible pair using the agreed coordinate-distance model.
6. Filter expired or otherwise ineligible donations and identify packages that cannot fit any vehicle.
7. Run multiple-knapsack DP and reconstruct package-to-vehicle assignments.
8. Derive feasible stops from the allocation, build road-network travel costs using A\*, and run ACO for multi-stop ordering.
9. Validate the returned paths, assignments, capacities, and route costs.
10. Calculate metrics, persist the scenario snapshot and results, and display the dashboard.
11. Allow the coordinator to compare a baseline, modify conditions, and rerun the workflow.

The UI must display the actual algorithm outputs. It must not use hard-coded “optimized” numbers or fabricated chart values.

## 7. Repository documentation

The root of the repository should contain these documents:

| File | What it governs |
|---|---|
| `README.md` | Project overview and documentation index |
| `PRD.md` | Product requirements and MVP acceptance criteria |
| `ARCHITECTURE.md` | Component boundaries and data flow |
| `TECH_STACK.md` | Approved stack and dependency rules |
| `BACKEND_SCHEMA.md` | PostgreSQL data model and persistence |
| `DESIGN_SYSTEM.md` | Visual design standards |
| `CONTENT_SPEC.md` | UI language and terminology |
| `SECURITY.md` | Security requirements |
| `TEST_PLAN.md` | Verification strategy |
| `IMPLEMENTATION_PLAN.md` | Phased build sequence |
| `AGENTS.md` | Instructions for AI coding agents |

Read these files before implementing a feature. If two documents conflict, stop and identify the conflict rather than silently choosing an interpretation. Update the relevant source document before making a consequential change.

## 8. Development priorities

The preferred order is:

1. finalize assumptions, data model, and sample dataset;
2. implement and test each algorithm independently;
3. implement and test baseline comparisons;
4. integrate the algorithms into a deterministic optimization service;
5. implement PostgreSQL migrations and the API;
6. build the interface around real API responses;
7. test edge cases and end-to-end workflows;
8. deploy and prepare the CCP demonstration.

Do not spend most of the early development effort on visual polish while the algorithm engine is incorrect.

## 9. Quality principles

- **Correctness:** every displayed allocation and route must satisfy the documented constraints.
- **Transparency:** show inputs, assumptions, algorithm names, status, metrics, and infeasibility warnings.
- **Reproducibility:** store the input snapshot, configuration, algorithm settings, and results for each run.
- **Separation of concerns:** UI, API, database access, and algorithms must have clear boundaries.
- **No false claims:** ACO is a heuristic; OpenStreetMap tiles are not a routing engine; synthetic data is not live operational data.
- **Incremental development:** implement a small, testable vertical slice before expanding the feature set.

## 10. Current planning decisions and open decisions

### Decided

- Project name: **NutriResQ**.
- Full title: **NutriResQ — Smart Food Rescue & Redistribution Optimizer**.
- Primary user: Operations Coordinator.
- Initial data: controlled synthetic dataset.
- Required algorithms: A\*, multiple-knapsack DP, divide-and-conquer closest pair, ACO.
- Database: PostgreSQL on Neon, accessed only by the backend.
- Initial deployment target: Vercel frontend plus a Node-compatible API host.

### Decisions to finalize before implementation

- the exact synthetic dataset and coordinate system;
- the numeric scale used for food weights and package values in DP;
- the exact route semantics (which pickup and delivery stops are mandatory);
- the ACO parameters and reproducibility seed strategy;
- the chosen authentication approach, if authentication is required for the first release;
- the final package versions and test framework; and
- the final visual tokens in `DESIGN_SYSTEM.md`.

Do not invent answers to these open decisions inside code. Record a decision in the appropriate document before relying on it.

## 11. Definition of a credible demonstration

A successful demonstration should let a reviewer change a road or vehicle, rerun the optimizer, inspect valid allocations and routes, see an unreachable or infeasible case handled honestly, compare at least one algorithm with its baseline, and review a saved run. The system should show how results were produced, not just present a polished dashboard.

---
**Documentation status:** Initial planning baseline. Revise as decisions are confirmed.
