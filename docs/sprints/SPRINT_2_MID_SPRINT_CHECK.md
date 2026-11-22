# [S2-SM-03] Sprint 2 Mid-Sprint Check Notes: Week 3

**Project:** HOPE, Inc. ERP
**Sprint:** 2 
**Coverage:** Week 3 (Days 1–5)
**Modules:** Customer Management & Product Management / Price History

---

## 1. Snapshot

| Metric | Value |
|---|---|
| Merged PRs | 10 of 30 (33%) *(9 Week 3 tasks + 1 Week 4 task merged early)* |
| Sprint time elapsed | 5 of 10 days (50%) |
| Week 3 tasks merged | 9 of 15 due (60%) |
| Open impediments | 3 (2 High, 1 Medium) |
| Overall status | **At risk** |

---

## 2. Week 3 Task Status (and Early Week 4 Progress)

| Task ID | Task | Role | Due | Status | Notes |
|---|---|---|---|---|---|
| S2-SM-01 | Sprint 2 planning notes and board | Scrum Master | 1 | Merged | |
| S2-DEV-01 | Customer list with search and filter (permission-checked) | Developer | 2 | Merged | |
| S2-DBA-01 | Customer and product active views, indexes | DB Admin | 2 | Merged | |
| S2-UIX-01 | Wireframes: customer screens | UI/UX Designer | 2 | Merged | |
| S2-DEV-02 | Customer create and edit form | Developer | 3 | Merged | |
| S2-TST-01 | Test cases: customer module | Tester | 3 | Not started | Overdue; Customer CRUD is already merged |
| S2-UIX-02 | Wireframes: product and price history screens | UI/UX Designer | 3 | Not started | Overdue; blocked by Git branch push issue |
| S2-SM-02 | Follow up Sprint 1 retro actions | Scrum Master | 3 | Merged | |
| S2-DEV-03 | Customer soft delete and restore | Developer | 4 | Merged | |
| S2-DBA-02 | Query: current price as of a given date | DB Admin | 4 | Merged | |
| S2-DEV-04 | Product list with search and filter | Developer | 5 | Merged | |
| S2-DBA-03 | Validation constraints (payTerms, unit) | DB Admin | 5 | Not started | Overdue |
| S2-TST-02 | Test cases: product and price history | Tester | 5 | Not started | Overdue |
| S2-UIX-03 | Hi-fi mockups and handoff notes | UI/UX Designer | 5 | Not started | Overdue; blocked by Git branch push issue |
| S2-SM-03 | Mid-sprint check and impediment log | Scrum Master | 5 | In progress | This document |
| S2-DEV-05 | Product create and edit form *(Week 4)* | Developer | 6 | Merged | Completed ahead of schedule |

---

## 3. Velocity Analysis

### Team velocity

| Measure | Value |
|---|---|
| Planned pace | 3.0 PRs/day (30 PRs over 10 days) |
| Actual pace, Week 3 | 2.0 PRs/day (10 PRs over 5 days) |
| Week 3 completion vs. plan | 60% (9 of 15 due in Week 3) |
| PRs remaining | 20 (6 carried over from Week 3 + 14 remaining in Week 4) |
| Pace needed to finish | 4.0 PRs/day |
| Projected total at current pace | 20 of 30 (67%) |

### Velocity by role

| Role | Planned | Merged | Remaining | Needed per day | Projected at current pace | Role minimum | Target |
|---|---|---|---|---|---|---|---|
| Developer | 8 | 5 | 3 | 0.6 | 10 *(capped at 8)* | 5 | 8 |
| DB Admin | 6 | 2 | 4 | 0.8 | 4 | 4 | 6 |
| Tester | 6 | 0 | 6 | 1.2 | 0 | 4 | 6 |
| UI/UX Designer | 5 | 1 | 4 | 0.8 | 2 | 3 | 5 |
| Scrum Master | 5 | 2 | 3 | 0.6 | 4 | 3 | 5 |
| **Team** | **30** | **10** | **20** | **4.0** | **20** | | **30** |

### Observations
- **Developer momentum is strong:** The Developer has already completed 5 of 8 PRs (63%), including all Week 3 tasks (`S2-DEV-01` through `S2-DEV-04`) plus `S2-DEV-05` ahead of its Day 6 deadline.
- **Testing has zero merged PRs:** All 6 Tester tasks (`S2-TST-01` through `S2-TST-06`) are currently `Not started`, requiring a pace of 1.2 PRs/day in Week 4 to hit the target.
- **Non-working days impact:** The implemented non-working days (November 16–18) caused a late start across several roles, resulting in 6 overdue tasks from Week 3.
- **UI/UX bottleneck:** UI/UX progress stalled after `S2-UIX-01` due to Git branch pushing issues, leaving `S2-UIX-02` and `S2-UIX-03` overdue.

---

## 4. Check Notes

**Went well**
- Customer module backend and frontend core features (`S2-DEV-01`, `S2-DEV-02`, `S2-DEV-03`) and foundational DB views/queries (`S2-DBA-01`, `S2-DBA-02`) are merged.
- Product list (`S2-DEV-04`) and Product create/edit form (`S2-DEV-05`) are already merged, putting development ahead of schedule on Product Management.
- Scrum Master planning and Sprint 1 retrospective follow-ups (`S2-SM-01`, `S2-SM-02`) were completed and merged on time.

**Needs attention**
- **Testing backlog:** `S2-TST-01` and `S2-TST-02` must start immediately so test execution (`S2-TST-03` to `S2-TST-06`) isn't compressed at the end of Week 4.
- **Vercel deployment instability:** Recent merged changes caused deployment issues on Vercel that need to be resolved before further frontend/backend integration testing.
- **UI/UX Git workflow:** Resolve the branch push error blocking the UI/UX Designer so wireframes (`S2-UIX-02`) and hi-fi mockups (`S2-UIX-03`) can be submitted.
- **DB Admin constraints:** `S2-DBA-03` (validation constraints for `payTerms` and `unit`) is overdue and needs to be merged to enforce database-level integrity.

### Actions

| # | Action | Owner (suggested) | Due |
|---|---|---|---|
| 1 | Troubleshoot and resolve branch push permissions/conflicts for UI/UX Designer | Scrum Master & UI/UX Designer | Day 6 |
| 2 | Diagnose build/environment logs and fix Vercel deployment errors from recent changes | Developer | Day 6 |
| 3 | Catch up on overdue Week 3 tasks (`S2-TST-01`, `S2-TST-02`, `S2-DBA-03`, `S2-UIX-02`, `S2-UIX-03`) | Tester, DB Admin, UI/UX Designer | Day 7 |
| 4 | Merge `S2-SM-03` (this mid-sprint check document) and update tracking sheet | Scrum Master | Day 6 |

---

## 5. Impediment Log

| ID | Impediment | Category | Affected tasks | Impact | Severity | Mitigation / next action |
|---|---|---|---|---|---|---|
| IMP-01 | **Late Sprint Kickoff due to Non-Working Days:** Several team members took a break during the implemented non-working days (Nov 16–18), delaying initial task execution. | Schedule / Availability | `S2-TST-01`, `S2-TST-02`, `S2-DBA-03`, `S2-UIX-02`, `S2-UIX-03` | Delayed Week 3 velocity; 6 tasks carried over into Week 4. | High | Re-align daily targets in Day 6 sync; prioritize overdue Week 3 PRs over Week 4 tasks for DB Admin, Tester, and UI/UX. |
| IMP-02 | **Git Branch Push Failure:** UI/UX Designer could not push local changes from their working branch to the remote repository. | Tooling / Git Workflow | `S2-UIX-02`, `S2-UIX-03` | Blocks submission and peer review of Product/Price History wireframes and hi-fi mockups. | Medium | Pair with Scrum Master or Developer to inspect git remote/branch protection errors, rebase/pull latest `main`, and push cleanly. |
| IMP-03 | **Vercel Deployment Issues:** Recent code changes caused build or runtime errors on the Vercel deployment environment. | Infrastructure / Deployment | `S2-DEV-04`, `S2-DEV-05`, Week 4 QA & Usability reviews | Blocks live environment verification and end-to-end testing on Vercel (Sprint 1 retro action item #3). | High | Developer to inspect Vercel build logs, verify environment variables/routing configs, and push a hotfix PR by Day 6. |

---

## 6. Next Check-in

- **Daily sync:** Every day starting Day 6 to monitor catch-up on Week 3 carry-over tasks.
- **Impediment review:** Day 7 (verify Vercel deployment fix and UI/UX PR submissions).
- **Velocity & burndown update:** Day 8 (`S2-SM-04`).
- **Sprint 2 review and retrospective:** Day 10 (`S2-SM-05`).