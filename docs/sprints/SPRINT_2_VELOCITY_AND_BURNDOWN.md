# [S2-SM-04] Sprint 2 Velocity & Burndown Analysis (Day 10)

**Project:** HOPE, Inc. ERP  
**Sprint:** 2 of 4 (Weeks 3–4: Customer Management & Product/Price History)  
**Reporting Point:** Day 10 (Final Day of Sprint 2)  
**Facilitator:** Scrum Master  

---

## 1. Sprint 2 Snapshot (Day 10)

| Metric | Value |
| :--- | :--- |
| **Merged PRs** | 27 of 30 (90%) |
| **Sprint Time Elapsed** | 10 of 10 days (100%) |
| **Tasks In Progress** | 1 (`S2-SM-04` — this document) |
| **Tasks Not Started / At Risk** | 2 (`S2-TST-06`, `S2-SM-05`) |
| **Overall Sprint Status** | **Near Completion (27/30 Merged; 3 PRs pending final merge)** |

---

## 2. Team Velocity Analysis

### Overall Team Velocity
| Measure | Value |
| :--- | :--- |
| **Planned pace** | 3.0 PRs/day (30 PRs over 10 days) |
| **Actual pace, Week 3 (Days 1–5)** | 2.0 PRs/day (10 PRs merged) |
| **Actual pace, Week 4 (Days 6–10)** | 3.4 PRs/day (17 PRs merged) |
| **Overall Sprint 2 actual pace** | 2.7 PRs/day (27 PRs merged over 10 days) |
| **Sprint 2 completion vs. plan** | 90% (27 of 30 PRs merged) |
| **PRs remaining on Day 10** | 3 (`S2-SM-04`, `S2-TST-06`, `S2-SM-05`) |
| **Remaining effort needed today** | 3 PRs before sprint close to achieve 100% (30/30) |

### Velocity by Role (Day 10 Final Standing)
| Role | Planned | Merged | Remaining | Completion % | Role Minimum | Target | Status vs. Minimum |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Developer** | 8 | 8 | 0 | 100% | 5 | 8 | **Target Met (8/8)** |
| **DB Admin** | 6 | 6 | 0 | 100% | 4 | 6 | **Target Met (6/6)** |
| **Tester** | 6 | 5 | 1 | 83% | 4 | 6 | **Above Minimum (5/4)** |
| **UI/UX Designer** | 5 | 5 | 0 | 100% | 3 | 5 | **Target Met (5/5)** |
| **Scrum Master** | 5 | 3 | 2 | 60% | 3 | 5 | **At Minimum (3/3)** |
| **Team Total** | **30** | **27** | **3** | **90%** | — | **30** | **All roles at or above minimum** |

### Velocity Observations
* **Strong Week 4 Recovery:** After starting Week 3 behind pace (2.0 PRs/day due to early weekday breaks and branch/deployment blockers), the team accelerated to **3.4 PRs/day** in Week 4, clearing 17 PRs.
* **Core Feature & Design Completion:** Developer (8/8), DB Admin (6/6), and UI/UX Designer (5/5) have merged 100% of their planned Sprint 2 PRs.
* **Role Minimums Secured:** Every role has already met or exceeded its per-sprint grading minimum (`Developer: 8/5`, `DB Admin: 6/4`, `Tester: 5/4`, `UI/UX: 5/3`, `Scrum Master: 3/3`).
* **Final Day Bottleneck:** Only 3 tasks remain open on Day 10: `S2-SM-04` (In progress), `S2-TST-06` (Bug reports and fix verification — Not started), and `S2-SM-05` (Sprint 2 review and retrospective report — Not started).

---

## 3. Sprint 2 Burndown Chart & Tracking

### Burndown Progression Table (PRs Remaining)
*Note: Ideal burndown burns 3.0 PRs/day from 30 down to 0. Actual daily figures reflect the Week 3 midpoint (10 merged by Day 5) and rapid Week 4 task completion through Day 10.*

| Sprint Day | Week | Ideal Remaining PRs | Actual Remaining PRs | Cumulative Merged | Key Milestones & Notes |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **Day 0** | — | 30.0 | 30 | 0 | Sprint 2 kickoff; 0 carryover from Sprint 1 |
| **Day 1** | Wk 3 | 27.0 | 29 | 1 | `S2-SM-01` merged; slow start due to Nov 16–18 breaks |
| **Day 2** | Wk 3 | 24.0 | 28 | 2 | Early customer list/DB views started |
| **Day 3** | Wk 3 | 21.0 | 26 | 4 | Customer CRUD & wireframes underway |
| **Day 4** | Wk 3 | 18.0 | 23 | 7 | Soft delete & price query PRs merging |
| **Day 5** | Wk 3 | **15.0** | **20** | **10** | Mid-sprint checkpoint (`S2-SM-03`); 5 PRs behind ideal pace |
| **Day 6** | Wk 4 | 12.0 | 17 | 13 | Week 3 carryover cleared; Week 4 tasks underway |
| **Day 7** | Wk 4 | 9.0 | 12 | 18 | Product CRUD, demo data, and soft-delete tests merged |
| **Day 8** | Wk 4 | 6.0 | 8 | 22 | Price history (`S2-DEV-07`) & permission tests (`S2-TST-04`) merged |
| **Day 9** | Wk 4 | 3.0 | 3 | 27 | Current-price display, index tuning, regression test & UI review merged |
| **Day 10** | Wk 4 | **0.0** | **3** *(Target: 0)* | **27** *(Target: 30)* | **Current Day:** `S2-SM-04` in progress; `S2-TST-06` & `S2-SM-05` remaining |

### Visual Burndown Chart (Remaining PRs vs. Sprint Day)

```text
PRs Remaining
30 | * (Ideal)
   |   \
27 |     *--# (Actual)
   |       \   \
24 |         *   #
   |           \   \
21 |             *   #---#
   |               \       \
18 |                 *       # (Day 6)
   |                   \       \
15 |                     *       \
   |                       \       # (Day 7)
12 |                         *       \
   |                           \       # (Day 8)
 9 |                             *       \
   |                               \       \
 6 |                                 *       \
   |                                   \       #---# (Day 9-10: 3 PRs left)
 3 |                                     *   /
   |                                       \
 0 +-----------------------------------------*----------------
     D0  D1  D2  D3  D4  D5  D6  D7  D8  D9  D10

Legend:  * = Ideal Burndown (3.0 PRs/day)   |   # = Actual Remaining PRs
```

---

## 4. Final Day Action Plan (Closing Sprint 2)

To bring the remaining burndown from **3 PRs to 0 PRs** before the Sprint 2 deadline:
1. **Merge `S2-SM-04` (Velocity & Burndown):** Commit this report, open the PR, and get immediate teammate approval.
2. **Complete `S2-TST-06` (Bug Reports & Fix Verification):** Tester to finalize any bug verification logs from the Day 9 regression/usability pass and merge the PR (brings Tester to 6/6).
3. **Complete `S2-SM-05` (Sprint 2 Review & Retrospective Report):** Scrum Master to document the Sprint 2 demo outcomes, final velocity (27–30 PRs), and Sprint 3 action items, then merge before end of Day 10.