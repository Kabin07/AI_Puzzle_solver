# Demonstration video script (3–5 minutes)

The assignment asks for a 3–5 minute video covering the implemented algorithms, the puzzle-solving process, the algorithm comparison, the heuristic functions, and the overall features. Suggested flow (≈ 4 min):

## 1. Introduction (0:00–0:30) · Home page
- Show the course name, assignment title, your name and registration number (24BCT0117), and that the assigned algorithm is **No. 6: Greedy Best-First Search**.
- Briefly explain the 8-puzzle: 3×3 board, 8 tiles and a blank; actions move the blank; each move costs 1; 181,440 reachable states; solvability by inversion parity.
- Point at the live GBFS demo board.

## 2. Puzzle input (0:30–1:00) · Solver
- Method 1: type the example `2 8 3 / 1 6 4 / 7 _ 5` and goal `1 2 3 / 8 _ 4 / 7 6 5` (or click **Example**).
- Show validation: type a duplicate tile, then make an unsolvable puzzle (swap two tiles) and read the error.
- Method 2: **Generate Random Puzzle** at Medium difficulty.

## 3. GBFS solving process (1:00–2:15) · Solver
- Select **Greedy Best-First Search** with **Manhattan Distance** and press **Run**.
- **Pause**, then use **Next / Previous Step** to walk through 3–4 expansions. For each one point out:
  - the current node and its parent, depth, g(n), **h(n)** and **f(n) = h(n)**,
  - the generated successors and their status (added, already explored, already in frontier),
  - the **Open List** sorted by h(n): the "next" row is what GBFS pops next,
  - the **Closed List**, nodes generated and expanded, and the h(n) chart heading towards 0.
- **Resume**, change the **Speed**, then show the **Solution Summary** and play the **Final Solution Path** (the blank slides step by step).

## 4. Why GBFS is not optimal (2:15–2:45)
- Open the Algorithms page → GBFS section → the "Why GBFS is not optimal" box → **Open this case in the solver**. Or use:
  `solver.html?algo=gbfs&h=manhattan&start=702645381&goal=123804765&autorun=1&jump=solution`
- The summary shows GBFS's 63-move solution against the 23-move optimum.

## 5. Heuristics (2:45–3:15) · Algorithms page
- Misplaced Tiles h₁ = 4 and Manhattan h₂ = 5 on the example; both are admissible and consistent, and h₂ dominates h₁.
- Switch the heuristic in the solver and rerun to show that Misplaced Tiles needs more expansions.

## 6. Comparison (3:15–4:00) · Comparison page
- Click **Run Comparison** on the same puzzle (`compare.html?start=702645381&goal=123804765&autorun=1`).
- Read the table: BFS / IDDLS / UCS / A* are optimal (23 moves). DFS gives a huge path. DLS with ℓ = 10 fails. GBFS expands the fewest nodes but its path is longer.
- Show the charts and the generated observations, and mention the CSV export.

## 7. Wrap-up (4:00–4:15)
- Algorithms page: each algorithm's description, principle, pros/cons, complexity, completeness and optimality.
- Mention responsive design, dark mode, keyboard shortcuts, the test suite, and GitHub Pages deployment.
