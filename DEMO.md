# NutriResQ — Six-Minute Defence Walkthrough

A fixed path through the deployed system, with the exact click sequence and the number to point at
in each step. Total: **6 minutes**. Every step has a fallback.

**Live:** <https://nutri-res-q.vercel.app>

---

## Before you start (60 seconds before your slot)

1. Open <https://nutriresq-api.onrender.com/api/health> in a tab.
2. Reload until it returns `"api":"up"` and `"database":"up"`.
   - Render's free tier sleeps after ~15 minutes; the first request can take 30–50 s and may return
     `502`/`503`. This is expected, not a failure.
3. Keep that tab open. If the app ever stalls mid-demo, the health tab tells you whether it is a cold
   start or a real problem.
4. Log in as admin, then log out, so the login you perform on stage is a warm one.

**Accounts**

| Role | Email | Password | Entry |
|---|---|---|---|
| Admin | `admin@nutriresq.local` | `ChangeMe-Admin-2026` | `/admin/login` |
| Donor | `donor@nutriresq.local` | `Demo-Pass-2026` | `/auth` |
| Recipient | `recipient@nutriresq.local` | `Demo-Pass-2026` | `/auth` |
| Delivery | `delivery@nutriresq.local` | `Demo-Pass-2026` | `/auth` |

---

## 0:00–0:45 — Landing page

Open <https://nutri-res-q.vercel.app>.

**Point at:** the hero section renders a square banner at full width with no side cropping; scroll one
screen to show the problem/impact sections.

**Say:** "The banner is a 257 KB WebP converted from a 2.76 MB PNG — a 10× reduction with no visible
loss, because the deployed page has to load on a phone."

**Fallback:** if images look stale, `Ctrl+Shift+R`.

---

## 0:45–1:15 — Admin sign-in

Go to `/admin/login`. Enter `admin@nutriresq.local` / `ChangeMe-Admin-2026` → **Sign in**.

**Point at:** you land on **Overview** (`/admin`) with live counts — 28 locations, 62 roads,
15 donors, 10 recipients, 5 vehicles (3 available), 24 donations.

**Say:** "The session is an opaque token in an `HttpOnly` cookie, `SameSite=Lax`. The frontend
proxies `/api/*` to Render, so the browser only ever sees one origin — no third-party cookie, which
is why this also works in Safari and private windows."

**Fallback:** if sign-in fails, check the health tab first. Wrong password shows an inline error;
a 502 means the service is still waking.

---

## 1:15–2:15 — Run the optimizer

Click **Workspace** in the sidebar (`/admin/workspace`) → leave the defaults → **Run optimization**.

**Point at** (results, in order):

| Card | What to say |
|---|---|
| Status pill | `partial` — the fleet cannot carry everything in one pass |
| Allocated weight | all 3 available vehicles used; ~154 / 155 kg, ≈99 % utilisation |
| Allocated packages per vehicle | DP result: each row is one vehicle's package set with weight / capacity and objective value |
| Packages not assigned | the one package the knapsack could not fit, with its reason |
| ACO spread per vehicle | best ≤ average ≤ worst — the heuristic's own variance, not a claim of optimality |

**Say:** "Multiple-knapsack DP assigns packages to vehicles; the run also stores the ACO trial spread,
so the evaluation shows the heuristic's variance rather than a single lucky tour."

**Fallback:** if you are short on time, click a row in **Previous runs** — stored runs replay from
`result_json` and never recompute.

---

## 2:15–2:45 — Map

Still on Workspace, scroll to **Route map**.

**Point at:** OSM basemap, colour-coded markers (hub / donor / recipient), one coloured polyline per
vehicle, a **dashed red closed road**, and popups showing leg cost and stop sequence.

Click **Schematic** → same routes, no network. Click **Map** to return.

**Say:** "The polyline follows the A\* node sequence on the road graph, not street geometry — the
graph is what the algorithm actually optimises. If OSM tiles fail, the schematic is the offline
fallback, so the demo never depends on the network."

---

## 2:45–3:30 — Algorithms lab

Click **Algorithms** (`/admin/algorithms`).

Four tabs: **A\* search**, **Multiple-knapsack DP**, **Closest pair**, **ACO routing**.

1. **Multiple-knapsack DP** → run it. Point at the **optimality check**: DP vs exhaustive enumeration
   on a prefix of the instance (8 of 19 packages, 65,536 assignments, matching objective 32,950).
   **Say:** "It is evidence, not a proof for the whole scenario — the UI says so."
2. **A\* search** → point at nodes expanded and the cost agreement between A\* and Dijkstra.
3. **Closest pair** → D&C result next to the brute-force answer, with agreement flagged.

**Fallback:** the lab is a pure computation endpoint — it works even if the scenario list is slow to
load.

---

## 3:30–4:15 — Benchmarks and scale

Click **Benchmarks** (`/admin/benchmarks`) → point at the per-vehicle **best / average / worst** ACO
costs and the recorded measurements table.

**Say:** "`npm run bench:scale` runs outside the app and prints CSV: A\* vs Dijkstra on 10×10…40×40
grids with node-expansion counts, D&C vs brute force for 100…4,000 points, DP runtime for 10…30
packages on the 143,106-state fleet, and ACO for 4…10 jobs. That is the complexity evidence behind
the four paradigms."

---

## 4:15–5:00 — Scenario simulator

Click **Scenarios** (`/admin/scenarios`).

1. Select **Riverside District — Monday Rescue**.
2. Copy it as a variant (**Variant name** → e.g. `Demo variant`) → **Clone**.
3. On the variant, close one road (or use **supply shock**) → the guard blocks an invalid state and
   explains why.
4. Run the variant → open **Compare** → point at the **Base vs Variant** table with the delta and
   better/worse verdict, then the **audit trail** (one row per edit).

**Say:** "The original scenario is never mutated; every edit is audited, and the comparison is
computed from two stored runs, not from live state."

**Fallback:** if time is short, skip the clone and show only the compare table of an existing
variant.

---

## 5:00–5:45 — One portal

Log out → `/auth` → sign in as `donor@nutriresq.local` / `Demo-Pass-2026`.

**Point at:** `/donor/donations` — only that donor's donations, with status and weight. Then
**Profile**.

**Say:** "Four roles, one session model. Donors only see their own donations; recipients see available
food; delivery partners see vehicles and assignments."

**Fallback:** if you have 10 more seconds, show `/recipient/available` or `/delivery/assignments` in a
second tab using the matching account.

---

## 5:45–6:00 — Close

**Say:** "Four algorithms — DP, divide & conquer, greedy search, approximation — each cross-checked
against an independent baseline, all served by one Node/Express API over PostgreSQL, deployed on
Vercel, Render and Neon. The README documents every deviation from the original proposal."

---

## If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| Login form shows a generic failure | Render/Neon cold start (502/503 behind the proxy) | Open `/api/health` until `database:"up"`, retry |
| Map is blank, grey tiles | OSM tile server unreachable | Click **Schematic** — same routes, no network |
| Optimizer "validation" error | Scenario has no feasible vehicle (all disabled) | Switch back to the base scenario |
| Numbers differ from this script | Different form seed/trials, or a different stored run | Quote the shape (partial, ~99 % utilisation), not the exact figure |
| Page shows cached old assets | Vercel/browser cache | `Ctrl+Shift+R` |
