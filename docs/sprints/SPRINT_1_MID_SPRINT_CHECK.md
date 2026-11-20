# [S1-SM-04] Sprint 1 Mid-Sprint Check Notes: Week 1

**Project:** HOPE, Inc. ERP | **Sprint:** 1 | **Coverage:** Week 1 (Days 1-5) | 

---

## 1. Snapshot

| Metric | Value |
|---|---|
| Merged PRs | 8 of 30 (27%) |
| Sprint time elapsed | 5 of 10 days (50%) |
| Week 1 tasks merged | 8 of 15 due |
| Open impediments | 2 (both High) |
| Overall status | **At risk** |

---

## 2. Week 1 Task Status

| Task ID | Task | Role | Due | PR | Status | Notes |
|---|---|---|---|---|---|---|
| S1-SM-01 | Repo setup: branch protection, PR and issue templates | Scrum Master | 1 | #26 | Merged | |
| S1-SM-02 | Sprint 1 board and acceptance criteria | Scrum Master | 1 | - | Not Merged | |
| S1-SM-03 | Working agreement, Definition of Done, role guide | Scrum Master | 2 | - | Not Merged | |
| S1-DEV-01 | Project scaffold: app skeleton, env config, DB connection | Developer | 2 | #27 | Merged | |
| S1-DBA-01 | Team database setup, migration runner, setup README | DB Admin | 2 | #24 | Merged | |
| S1-UIX-01 | Design system | UI/UX Designer | 2 | #33 | Merged | |
| S1-DBA-02 | Migration: HOPE base tables and sample data | DB Admin | 3 | #35 | Merged | |
| S1-TST-01 | Sprint 1 test plan and acceptance criteria | Tester | 3 | #37 | Merged | Merged before SM-02; confirm criteria match |
| S1-UIX-02 | Wireframes: login, register, set/reset password | UI/UX Designer | 3 | #38 | Merged | |
| S1-DEV-02 | Register user form and API | Developer | 4 | #36 | Merged | |
| S1-DBA-03 | Migration: app_user, roles, rights catalogue, user_permission | DB Admin | 4 | - | Not merged | Overdue; blocks login and rights |
| S1-UIX-03 | Wireframes: main page, User Management, Rights dialog | UI/UX Designer | 4 | - | Not merged | Overdue |
| S1-DBA-04 | Migration: password reset token table | DB Admin | 5 | - | Not merged | Blocks reset password |
| S1-DBA-05 | Seed data: superadmins, modules, 36-right catalogue | DB Admin | 5 | - | Not merged | Blocks login testing |
| S1-SM-04 | Mid-sprint check notes and impediment log | Scrum Master | 5 | - | In progress | This document |

---

## 3. Velocity Analysis

### Team velocity

| Measure | Value |
|---|---|
| Planned pace | 3.0 PRs/day (30 PRs over 10 days) |
| Actual pace, Week 1 | 1.6 PRs/day (8 PRs over 5 days) |
| Week 1 completion vs. plan | 53% (8 of 15 due) |
| PRs remaining | 22 (7 carried over from Week 1 + 15 due in Week 2) |
| Pace needed to finish | 4.4 PRs/day |
| Projected total at current pace | 16 of 30 (53%) |

### Velocity by role

| Role | Planned | Merged | Remaining | Needed per day | Projected at current pace | Role minimum | Target |
|---|---|---|---|---|---|---|---|
| Developer | 8 | 2 | 6 | 1.2 | 4 | 5 | 8 |
| DB Admin | 6 | 2 | 4 | 0.8 | 4 | 4 | 6 |
| Tester | 6 | 1 | 5 | 1.0 | 2 | 4 | 6 |
| UI/UX Designer | 5 | 2 | 3 | 0.6 | 4 | 3 | 5 |
| Scrum Master | 5 | 1 | 4 | 0.8 | 2 | 3 | 5 |
| **Team** | **30** | **8** | **22** | **4.4** | **16** | | **30** |


### Observations
- **Back-loaded plan:** Week 2 has 15 tasks due, with 10 of them on Days 8-9 (4 on Day 8, 6 on Day 9). Any slip on Day 6-7 pushes work past the sprint end.
- **Dependency chain:** DBA-03/04/05 to DEV-03 to DEV-05/06/07/08 to TST-04/05. Developer, Tester and DB Admin velocity all depend on the same blockers.
- **Below minimum at current pace:** Developer (4 vs. 5), Tester (2 vs. 4) and Scrum Master (2 vs. 3). DB Admin is exactly at the minimum.
- **Strongest pace:** UI/UX and DB Admin, but their remaining work depends on UIX-03 and DBA-03/04/05.

---

## 4. Check Notes

**Went well**
- Foundations are in place: repo and templates, project scaffold, team DB setup with migration runner, HOPE base tables and sample data, and the design system are all merged.
- User registration form and API (DEV-02) is merged and approved.
- The Sprint 1 test plan (TST-01) and the login, register and reset-password wireframes (UIX-02) are merged and approved, so Testing and Design both have a first PR in.
- Team is using the `[S1-ROLE-NN]` PR naming convention consistently.
- Every merged PR carries teammate approval, as required for a valid PR.

**Needs attention**
- Login does not work end to end between frontend and backend (I-01).
- Most merged PRs have unfinished task checklists (#26, #27, #33, #36, #38: 6 of 9; #37: 5 of 9; #24: 6 of 7).
- SM-02 and SM-03 are still open, so acceptance criteria and Definition of Done are not yet formalised.

### Actions

| # | Action | Owner (suggested) | Due |
|---|---|---|---|
| A-1 | Joint frontend-backend session to agree on the API contract (base URL, endpoints, payloads, CORS, auth) | Scrum Master, Developers | Day 6 |
| A-2 | Merge DBA-03, DBA-04 and DBA-05 | DB Admin | Day 6 |
| A-3 | Get PR #26 reviewed and approved | Scrum Master | Day 6 |
| A-4 | Merge SM-02 and SM-03; reconcile with TST-01 | Scrum Master, Tester | Day 6 |
| A-5 | Merge UIX-03, then start UIX-04 mockups | UI/UX Designer | Day 6 |
| A-6 | Start a 10-15 minute daily sync | Scrum Master | Day 6 |
| A-7 | Finish PR checklists or split leftovers into follow-up issues | PR authors | Day 8 |
| A-8 | Day 7 re-check: decide what carries over to Sprint 2 | Team | Day 7 |

---

## 5. Impediment Log

| ID | Impediment | Category | Affected tasks | Impact | Severity | Mitigation / next action |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| I-01 | The frontend could not successfully communicate with the backend APIs for user, admin, and superadmin logins. | Technical / integration | S1-DEV-03, DEV-04, DEV-05, DEV-06, DEV-07, DEV-08, TST-02, TST-04, TST-05, UIX-05 | No role can log in end to end. Blocks the authentication chain, main page, rights, permission tests and the smoke test. | High | Run a joint debugging session. Verify the base URL and env config, endpoint paths, request/response payloads and CORS. Test each role (user, admin, superadmin) with a seeded account. Document the working setup in the README. |
| I-02 | **Communication gap:** backend developers worked in silos, leading to misaligned API base URLs, unmatching request/response payloads, and missing CORS or routing configurations. (Root cause of I-01.) | Process / communication | All login, auth and API-dependent tasks | Rework, duplicated effort, and late discovery of integration errors. | High | Agree on a written API contract before coding. Share one `.env.example` with the API base URL. Add a daily sync. Require early integration checks (a quick login call) before opening a PR. Add API-contract review to the Definition of Done. |

## 6. Next Check-in

- **Daily sync:** every day from Day 6.
- **Impediment review:** Day 7 (re-check I-01 and I-02; decide on carryover).
- **Sprint 1 review and retrospective:** Day 10 (S1-SM-05).