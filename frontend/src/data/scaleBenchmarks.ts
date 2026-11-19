/**
 * GENERATED FILE - do not edit by hand.
 *
 * Scaling benchmark measured by `npm run bench:export`
 * (backend/src/bench/scale.ts). Each row is one deterministic synthetic
 * instance; timings are wall-clock and therefore machine-specific.
 *
 * Machine: win32 x64 / UMAR-DESKTOP
 * Generated: 2026-11-17T14:46:10.150Z
 */

export interface ScaleBenchmarkRow {
  algorithm: string;
  instance: string;
  size: number | null;
  metric: string;
  value: number | string;
  unit: string;
  note: string;
}

export const SCALE_BENCHMARK_ROWS: ScaleBenchmarkRow[] = [
  {"algorithm":"astar","instance":"10x10 grid, 3 corner pairs","size":100,"metric":"runtime","value":3.821,"unit":"ms","note":"admissible Euclidean heuristic; compared with Dijkstra on identical pairs"},
  {"algorithm":"dijkstra","instance":"10x10 grid, 3 corner pairs","size":100,"metric":"runtime","value":2.816,"unit":"ms","note":"baseline for A*; same graph and pairs"},
  {"algorithm":"astar","instance":"10x10 grid, 3 corner pairs","size":100,"metric":"nodes-expanded","value":207,"unit":"nodes","note":"Dijkstra expanded 246; costs agree: yes"},
  {"algorithm":"astar","instance":"20x20 grid, 3 corner pairs","size":400,"metric":"runtime","value":5.255,"unit":"ms","note":"admissible Euclidean heuristic; compared with Dijkstra on identical pairs"},
  {"algorithm":"dijkstra","instance":"20x20 grid, 3 corner pairs","size":400,"metric":"runtime","value":8.109,"unit":"ms","note":"baseline for A*; same graph and pairs"},
  {"algorithm":"astar","instance":"20x20 grid, 3 corner pairs","size":400,"metric":"nodes-expanded","value":817,"unit":"nodes","note":"Dijkstra expanded 991; costs agree: yes"},
  {"algorithm":"astar","instance":"30x30 grid, 3 corner pairs","size":900,"metric":"runtime","value":4.338,"unit":"ms","note":"admissible Euclidean heuristic; compared with Dijkstra on identical pairs"},
  {"algorithm":"dijkstra","instance":"30x30 grid, 3 corner pairs","size":900,"metric":"runtime","value":6.405,"unit":"ms","note":"baseline for A*; same graph and pairs"},
  {"algorithm":"astar","instance":"30x30 grid, 3 corner pairs","size":900,"metric":"nodes-expanded","value":1827,"unit":"nodes","note":"Dijkstra expanded 2236; costs agree: yes"},
  {"algorithm":"astar","instance":"40x40 grid, 3 corner pairs","size":1600,"metric":"runtime","value":11.318,"unit":"ms","note":"admissible Euclidean heuristic; compared with Dijkstra on identical pairs"},
  {"algorithm":"dijkstra","instance":"40x40 grid, 3 corner pairs","size":1600,"metric":"runtime","value":14.587,"unit":"ms","note":"baseline for A*; same graph and pairs"},
  {"algorithm":"astar","instance":"40x40 grid, 3 corner pairs","size":1600,"metric":"nodes-expanded","value":3237,"unit":"nodes","note":"Dijkstra expanded 3981; costs agree: yes"},
  {"algorithm":"closest-pair-dc","instance":"100 random projected points","size":100,"metric":"runtime","value":0.908,"unit":"ms","note":"distance agrees with brute force: yes"},
  {"algorithm":"closest-pair-brute","instance":"100 random projected points","size":100,"metric":"runtime","value":0.913,"unit":"ms","note":"O(n^2) baseline: 4950 pair comparisons"},
  {"algorithm":"closest-pair-dc","instance":"500 random projected points","size":500,"metric":"runtime","value":2.476,"unit":"ms","note":"distance agrees with brute force: yes"},
  {"algorithm":"closest-pair-brute","instance":"500 random projected points","size":500,"metric":"runtime","value":1.82,"unit":"ms","note":"O(n^2) baseline: 124750 pair comparisons"},
  {"algorithm":"closest-pair-dc","instance":"1000 random projected points","size":1000,"metric":"runtime","value":3.763,"unit":"ms","note":"distance agrees with brute force: yes"},
  {"algorithm":"closest-pair-brute","instance":"1000 random projected points","size":1000,"metric":"runtime","value":3.659,"unit":"ms","note":"O(n^2) baseline: 499500 pair comparisons"},
  {"algorithm":"closest-pair-dc","instance":"2000 random projected points","size":2000,"metric":"runtime","value":3.385,"unit":"ms","note":"distance agrees with brute force: yes"},
  {"algorithm":"closest-pair-brute","instance":"2000 random projected points","size":2000,"metric":"runtime","value":14.281,"unit":"ms","note":"O(n^2) baseline: 1999000 pair comparisons"},
  {"algorithm":"closest-pair-dc","instance":"4000 random projected points","size":4000,"metric":"runtime","value":11.519,"unit":"ms","note":"distance agrees with brute force: yes"},
  {"algorithm":"closest-pair-brute","instance":"4000 random projected points","size":4000,"metric":"runtime","value":259.014,"unit":"ms","note":"O(n^2) baseline: 7998000 pair comparisons"},
  {"algorithm":"multiple-knapsack-dp","instance":"10 packages, capacities 60/45/50","size":10,"metric":"runtime","value":84.254,"unit":"ms","note":"state count 143106, exact=true"},
  {"algorithm":"multiple-knapsack-dp","instance":"14 packages, capacities 60/45/50","size":14,"metric":"runtime","value":82.955,"unit":"ms","note":"state count 143106, exact=true"},
  {"algorithm":"multiple-knapsack-dp","instance":"18 packages, capacities 60/45/50","size":18,"metric":"runtime","value":98.703,"unit":"ms","note":"state count 143106, exact=true"},
  {"algorithm":"multiple-knapsack-dp","instance":"22 packages, capacities 60/45/50","size":22,"metric":"runtime","value":210.534,"unit":"ms","note":"state count 143106, exact=true"},
  {"algorithm":"multiple-knapsack-dp","instance":"26 packages, capacities 60/45/50","size":26,"metric":"runtime","value":239.375,"unit":"ms","note":"state count 143106, exact=true"},
  {"algorithm":"multiple-knapsack-dp","instance":"30 packages, capacities 60/45/50","size":30,"metric":"runtime","value":199.853,"unit":"ms","note":"state count 143106, exact=true"},
  {"algorithm":"aco","instance":"4 jobs, 20 trials, 2 ants","size":4,"metric":"runtime","value":6.063,"unit":"ms","note":"heuristic; best tour cost 357.887 on this synthetic plane"},
  {"algorithm":"aco","instance":"6 jobs, 20 trials, 3 ants","size":6,"metric":"runtime","value":3.247,"unit":"ms","note":"heuristic; best tour cost 487.923 on this synthetic plane"},
  {"algorithm":"aco","instance":"8 jobs, 20 trials, 3 ants","size":8,"metric":"runtime","value":2.962,"unit":"ms","note":"heuristic; best tour cost 573.924 on this synthetic plane"},
  {"algorithm":"aco","instance":"10 jobs, 20 trials, 4 ants","size":10,"metric":"runtime","value":10.122,"unit":"ms","note":"heuristic; best tour cost 984.848 on this synthetic plane"},
];
