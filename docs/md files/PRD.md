# Product Requirements Document — NutriResQ

## 1. Document purpose

This document defines what NutriResQ must do, who it serves, what the first release includes, and how acceptance will be judged. It does not prescribe every implementation detail; see `ARCHITECTURE.md`, `TECH_STACK.md`, and `BACKEND_SCHEMA.md` for those.

## 2. Product vision

Build a usable, explainable food-rescue optimization tool that combines algorithmic analysis with an interactive full-stack application. A coordinator should be able to model a small food-rescue network, optimize the use of limited fleet capacity, inspect routes, compare algorithms, and reproduce results after scenario changes.

**Product promise:** turn a scenario's road, donation, recipient, and fleet data into feasible, inspectable optimization results.

The system is a decision-support prototype for academic evaluation and portfolio demonstration. It does not autonomously dispatch real drivers or certify food safety.

## 3. Problem statement

Food rescue involves several linked constraints:

- donor and recipient locations are spread across a road network;
- road links can be unavailable;
- donations have quantities, values/priorities, and eligibility or expiry constraints;
- vehicles have limited capacity and availability;
- recipient demand and urgency can differ;
- the order of multiple stops affects travel cost; and
- operational conditions can change after a plan is produced.

A simple listing website does not solve these optimization problems. NutriResQ separates them into algorithmic subproblems and integrates the outputs into one workflow.

## 4. Goals and non-goals

### Goals

1. Implement four required algorithms as independent, testable modules.
2. Integrate their results into a coherent optimization workflow.
3. enforce capacity, eligibility, and road-availability constraints.
4. report infeasible, unreachable, or partial results instead of concealing them.
5. compare selected algorithms with transparent baselines.
6. allow controlled scenario changes and reruns.
7. persist scenario snapshots and results in PostgreSQL.
8. provide a clear dashboard, map, allocation table, route view, and benchmark comparison.
9. support an academic demonstration with measured results and documented complexity.

### Non-goals for the MVP

- production logistics management for real organizations;
- live maps-based traffic, real-time ETAs, or guaranteed road routing;
- real-time GPS/driver dispatch;
- donor self-service and recipient self-service portals;
- mobile applications;
- AI/ML demand prediction;
- payments, invoicing, or a donation marketplace;
- comprehensive food-safety compliance workflows; and
- multi-tenant enterprise access control.

## 5. Users and usage context

### Primary persona: Operations Coordinator

**Needs**
- understand the current scenario;
- edit roads, packages, recipient priorities, and vehicle capacities;
- run optimization and understand its output;
- identify unreachable locations and infeasible packages;
- compare algorithms and baselines;
- simulate a disruption; and
- revisit an earlier run.

**Success looks like:** the coordinator can produce and explain a valid plan without manually calculating every route or capacity assignment.

### Represented participants

| Participant | Initial representation |
|---|---|
| Donor | A record with a location and one or more donation/package records |
| Recipient organization | A record with a location, demand/priority information, and eligibility |
| Vehicle | A record with capacity and availability |
| Operations Coordinator | The only required interactive user role for the MVP |

Separate donor/recipient portals are future work.

## 6. Core user journeys

### Journey A — Inspect a scenario
1. Open the application.
2. Select a saved scenario or create a new one.
3. Inspect locations, road links, donations, recipients, and vehicles.
4. See validation errors and warnings before running.

### Journey B — Run integrated optimization
1. Select a valid scenario.
2. Start an optimization run.
3. View network reachability and A\* paths.
4. View closest-pair analysis.
5. View package allocation by vehicle, including unallocated reasons.
6. View each vehicle's stop order, road paths, and travel cost.
7. Review metrics and warnings.
8. Save and revisit the run.

### Journey C — Compare algorithms
1. Open the algorithm comparison area.
2. Select a supported algorithm and its baseline.
3. Run both with the same input and conditions.
4. View measured result quality and runtime.
5. See the metric definitions, limitations, and test settings.

### Journey D — Simulate a disruption
1. Select a scenario or prior run as the starting point.
2. Apply a change, such as closing a road, reducing vehicle capacity, reducing available donations, expiring a donation, or making a recipient unavailable.
3. Keep the original scenario unchanged.
4. rerun optimization on the modified scenario.
5. compare the original and modified outcomes.

### Journey E — Review history
1. Open prior runs.
2. inspect the scenario snapshot, algorithm configuration, status, metrics, allocations, and routes.
3. rerun from a copied scenario if desired; do not mutate the historical result.

## 7. Functional requirements

Priority definitions: **P0** = required for a credible MVP; **P1** = important after the core workflow works; **P2** = future extension.

### Scenario and data management

- **FR-01 (P0):** Load a seeded synthetic scenario on first setup.
- **FR-02 (P0):** List and select available scenarios.
- **FR-03 (P0):** Create a scenario by copying a known valid dataset or starting from the documented template.
- **FR-04 (P0):** Edit scenario-specific road availability, vehicle capacity/availability, donation eligibility/quantity, and recipient availability/priority where supported.
- **FR-05 (P0):** Validate required fields, references, non-negative quantities, and supported value ranges before optimization.
- **FR-06 (P0):** Show validation errors that identify the offending record and field.
- **FR-07 (P0):** Preserve a prior run's input snapshot even if the scenario is later edited.

### A\* road pathfinding

- **FR-08 (P0):** Represent roads as a weighted graph with location nodes and directed or explicitly modeled undirected edges.
- **FR-09 (P0):** Exclude closed/unavailable roads from path calculations.
- **FR-10 (P0):** Return a path and total cost when a route exists; return an explicit unreachable result otherwise.
- **FR-11 (P0):** Use an admissible heuristic for the selected edge-cost model, or use a zero heuristic if no safe heuristic is available.
- **FR-12 (P1):** Compare path cost and runtime against Dijkstra using identical graph inputs.
- **FR-13 (P1):** Support a road-failure experiment that closes three connections and compares full recomputation with a clearly defined affected-path repair strategy. Do not label this as an incremental minimum-spanning-tree algorithm.

### Multiple-knapsack dynamic programming

- **FR-14 (P0):** Allocate each eligible package to at most one vehicle.
- **FR-15 (P0):** Never exceed any vehicle's capacity.
- **FR-16 (P0):** Maximize the sum of the defined package values/priorities within the chosen model.
- **FR-17 (P0):** Reconstruct and display the selected packages for each vehicle.
- **FR-18 (P0):** Report expired/ineligible packages and packages that individually exceed every available vehicle's capacity.
- **FR-19 (P0):** Return the best feasible partial allocation if not all packages can be assigned; do not fabricate full fulfillment.
- **FR-20 (P1):** Compare against a documented greedy baseline using the same input and objective.
- **FR-21 (P0):** Validate the DP model's state size and input limits before running, and return a clear error for unsupported sizes rather than freezing the server.

### Closest pair of points

- **FR-22 (P0):** Find the closest pair among the configured eligible locations using divide and conquer.
- **FR-23 (P0):** State the coordinate/distance model and units in the result.
- **FR-24 (P0):** Handle duplicate coordinates and fewer than two eligible points.
- **FR-25 (P1):** Compare with a brute-force baseline on identical points.
- **FR-26 (P0):** Do not present straight-line geographic proximity as a road travel distance.

### ACO route optimization

- **FR-27 (P0):** Build a travel-cost matrix for required stops using A\* path costs over available roads.
- **FR-28 (P0):** Use ACO to search for a low-cost ordering of the stops included in a vehicle's feasible route.
- **FR-29 (P0):** Validate every route leg against the road graph and calculate the displayed route cost from the same cost source.
- **FR-30 (P0):** Handle disconnected stops explicitly; do not silently assign an infinite-cost leg to a displayed route.
- **FR-31 (P0):** Label ACO output as a heuristic result, not a guaranteed global optimum.
- **FR-32 (P1):** Compare with a nearest-neighbor baseline.
- **FR-33 (P1):** Support fixed seeds and repeated trials where practical; display the trial settings.

### Integrated optimization and results

- **FR-34 (P0):** Provide one orchestration workflow that runs validation, network analysis, allocation, routing, metric calculation, and persistence in a documented order.
- **FR-35 (P0):** Show run status such as queued/running/succeeded/partial/failed as applicable to the actual implementation.
- **FR-36 (P0):** Display allocation, unallocated packages and reasons, unreachable locations, route stops, road paths, cost, and warnings.
- **FR-37 (P0):** Calculate metrics from real result objects. Never hard-code result metrics for appearance.
- **FR-38 (P0):** Save scenario input snapshot, algorithm configuration, output summary, and detailed results.
- **FR-39 (P1):** Show run history and allow a run's details to be inspected.
- **FR-40 (P1):** Provide charts that compare actual measured values and clearly label units.

### Scenario simulation

- **FR-41 (P0):** Apply changes to a scenario copy, not directly to a historical run.
- **FR-42 (P0):** Support at least road closure, vehicle capacity reduction/unavailability, donation quantity/eligibility change, and recipient unavailability.
- **FR-43 (P0):** Rerun optimization after a simulation and show a before/after comparison.
- **FR-44 (P0):** Record which changes were applied and to which scenario/run they relate.

## 8. Non-functional requirements

- **NFR-01 Correctness:** Every saved result passes the documented integrity checks.
- **NFR-02 Reproducibility:** The run records its input snapshot, algorithm options, and random seed when relevant.
- **NFR-03 Explainability:** Users can inspect why a package was excluded and why a location is unreachable.
- **NFR-04 Maintainability:** Each algorithm is isolated from HTTP, React, and database code.
- **NFR-05 Responsiveness:** Typical seeded scenarios should finish interactively; actual timings must be measured rather than promised in advance.
- **NFR-06 Robustness:** Invalid input and disconnected graphs produce structured errors or partial results, not server crashes.
- **NFR-07 Security:** Secrets remain server-side; all input is validated; SQL uses parameterized queries.
- **NFR-08 Accessibility:** Controls have labels, keyboard focus is visible, status is not conveyed by color alone, and tables have clear headings.
- **NFR-09 Deployment:** The deployed frontend communicates with the deployed API over HTTPS, and the API connects securely to PostgreSQL.
- **NFR-10 Data honesty:** Synthetic data, approximations, heuristic outputs, and limitations are labeled clearly.

## 9. Algorithm definitions and boundaries

| Algorithm | Input | Output | Must not be confused with |
|---|---|---|---|
| A\* | Road graph, start, goal, edge costs, heuristic | One lowest-cost path when heuristic conditions are satisfied, or unreachable | Multi-stop ordering |
| Multiple-knapsack DP | Eligible packages with integerized weights/values, vehicle capacities | Feasible package-to-vehicle assignment maximizing the modeled value | Route minimization |
| Divide-and-conquer closest pair | Eligible points in a documented coordinate system | Closest pair and distance under that coordinate metric | Road-network travel distance |
| ACO | Stops and pairwise feasible road costs | Heuristic low-cost stop ordering | Proof of global optimality |

A package's objective value must be explicitly defined. If urgency or recipient priority affects value, document the formula and ensure it is consistent across tests and UI labels. Integer DP capacities/weights may require a documented unit scale; do not silently round values.

## 10. Product metrics

Use these metrics to assess the implementation; do not set arbitrary success percentages before measuring.

- total eligible package value allocated;
- total package weight allocated;
- number and reasons of unallocated packages;
- vehicle capacity utilization;
- count of reachable/unreachable required stops;
- total road-network cost per route and overall;
- route cost compared with the selected baseline;
- runtime per algorithm and total workflow;
- count of validation or constraint violations (must be zero for a valid saved result);
- effect of each scenario change on allocation and route cost.

## 11. Acceptance criteria

The MVP is acceptable when all of the following are demonstrated:

1. A seeded scenario loads and can be inspected.
2. Invalid input is rejected with useful feedback.
3. A\* never traverses a closed road and identifies disconnected endpoints.
4. Multiple-knapsack DP never duplicates a package and never exceeds a vehicle's capacity.
5. Ineligible and oversized packages are reported rather than silently lost.
6. Closest-pair output agrees with brute force on a test suite, within the same distance model.
7. ACO routes contain only feasible legs and displayed costs match those legs.
8. Algorithm comparisons use the same inputs and report measured values.
9. Scenario simulation does not mutate the original historical run.
10. A saved run can be reopened with its inputs and outputs intact.
11. UI values come from actual API results.
12. The project can be run locally using documented steps and deployed using documented environment variables.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| DP state explosion | Integer units, input bounds, validation, tests, and a clear refusal for oversized inputs |
| ACO results vary | Record parameters/seeds, repeat trials where practical, label heuristic nature |
| Closest-pair coordinates are misleading | Document coordinate projection and units; distinguish geometric distance from road cost |
| Algorithms become tangled with UI | Keep pure algorithm modules and independent tests |
| Demo values are fabricated | Seeded data and result-driven UI; no mock metrics after integration |
| Scope becomes too large | Enforce the explicit MVP/non-goal list |
| Deployment database credentials leak | Backend-only environment variables and secret checks |

## 13. Scope-change rule

A new feature is not automatically part of the MVP because it sounds useful. Before implementing it, describe its user value, impact on algorithms/data model, extra dependencies, and effect on the CCP timeline. Update this PRD and the relevant architecture/schema documents when the change is approved.
