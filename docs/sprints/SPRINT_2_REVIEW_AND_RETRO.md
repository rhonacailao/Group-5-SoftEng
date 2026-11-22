# Sprint 1 Review and Retrospective

**Project:** HOPE, Inc. ERP
**Sprint:** 2 of 4 (Weeks 3-4)
**Date of session:** November 23, 2026
**Facilitator:** @rhonacailao (Scrum Master)
**Attendees:** @bearbau (UI/UX Developer), @IanCarloArimas (Tester), @karlamaemori (DB Admin), @RebEmnacin (Backend Developer)
**Related task:** S2-SM-05

---

## 1. Sprint Goal

Deliver the core business modules for Sprint 2—Customer Management and Product Management & Price History—including CRUD workflows, soft delete/restore, effective-date price history tracking, current-price display, per-action permission checks, and supporting test/UI/DB deliverables, deployed and running on Vercel.

**Result:** Goal met. All planned Sprint 2 tasks were completed on time within the sprint.

---

## 2. Sprint Review

### 2.1 Progress: planned vs. merged PRs

| Role | Planned PRs | Merged PRs | % Done |
|------|:-----------:|:----------:|:------:|
| Developer | 8 | 8 | 100% |
| DB Admin | 6 | 6 | 100% |
| Tester | 6 | 6 | 100% |
| UI/UX Designer | 5 | 5 | 100% |
| Scrum Master | 5 | 5 | 100% |
| **Team total** | **30** | **30** | **100%** |

### 2.2 Deliverables by role

**Developer (8/8)**
- S2-DEV-01: Customer list with search and filter (permission-checked)
- S2-DEV-02: Customer create and edit form
- S2-DEV-03: Customer soft delete and restore
- S2-DEV-04: Product list with search and filter
- S2-DEV-05: Product create and edit form
- S2-DEV-06: Product soft delete and restore
- S2-DEV-07: Price history: add, edit and delete price with effective date
- S2-DEV-08: Current-price display on product page; per-action rights checks (Add/Edit/Delete) across both modules

**DB Admin (6/6)**
- S2-DBA-01: Customer and product active views, indexes
- S2-DBA-02: Query: current price as of a given date
- S2-DBA-03: Validation constraints (payTerms, unit)
- S2-DBA-04: Verify child-record delete checks for customer and product
- S2-DBA-05: Demo data for customer, product, price history
- S2-DBA-06: Search performance check and index tuning

**Tester (6/6)**
- S2-TST-01: Test cases: customer module
- S2-TST-02: Test cases: product and price history
- S2-TST-03: Soft delete/restore tests, incl. delete blocked by active children
- S2-TST-04: Per-right permission tests for customer and product (Add/Edit/Delete, price rights)
- S2-TST-05: Regression test of Sprint 1
- S2-TST-06: Bug reports and fix verification

**UI/UX Designer (5/5)**
- S2-UIX-01: Wireframes: customer screens
- S2-UIX-02: Wireframes: product and price history screens
- S2-UIX-03: Hi-fi mockups and handoff notes
- S2-UIX-04: Empty, error and confirm-delete states
- S2-UIX-05: Usability review of built screens

**Scrum Master (5/5)**
- S2-SM-01: Sprint 2 planning notes and board
- S2-SM-02: Follow up Sprint 1 retro actions
- S2-SM-03: Mid-sprint check and impediment log
- S2-SM-04: Update velocity and burndown
- S2-SM-05: Sprint 2 review and retrospective report

### 2.3 Demo results

| Deliverable | Status | Notes |
|-------------|:------:|-------|
| Customer list (search & filter) | Done | Permission-checked; merged early in Week 3 |
| Customer create & edit form | Done | Integrated with backend and database |
| Customer soft delete & restore | Done | Preserves historical records; active views updated |
| Product list (search & filter) | Done | Integrated with catalog and permissions |
| Product create & edit form | Done | Includes child-record delete checks |
| Product soft delete & restore | Done | Verified with demo data and delete tests |
| Price history & current-price display | Done | Effective-date price handling and active price lookup verified |
| Permission checks across modules | Done | Role and per-action rights enforced |
| Deployment on Vercel | Done | Latest Sprint 2 build live and tested on Vercel |

### 2.4 Carryover to Sprint 2

None. All 30 planned Sprint 2 PRs were merged. The only open item is an action item from the retrospective (see section 4), not unfinished work.

---

## 3. Retrospective

### What went well
- **Strong first-half execution and mid-sprint milestone.** All 15 Week 3 tasks were merged on schedule by Day 5 (mid-sprint check), keeping the team right on the ideal burndown track.
- **Earlier integration and testing.** Checking screens against the backend/database and testing on Vercel earlier in the sprint prevented late integration surprises.
- **All 30 tasks finished on time.** Every planned PR was completed within Sprint 2 with zero carryover into Sprint 3.

### What didn't go well
- **Late-sprint clustering on final verification.** A few end-of-sprint tasks (such as final bug fix verification and closing out sprint reporting) clustered near Days 8–10, leaving less buffer at the very end.
- **Occasional single-day slip during heavy days.** On Days 8–9, a couple of items slipped by a day before catching up, showing where review/verification queues can still bottleneck.

### Key takeaways
- Keeping Week 3 momentum strong gives the team breathing room in Week 4 for bug verification and polish.
- Verifying bug fixes continuously as features land—rather than bundling verification at the end—smooths out the final days of the sprint.
- Consistent daily check-ins and early PRs continue to pay off when paired with timely reviews.

---

## 4. Action Items for Sprint 2

| # | Action | Owner | Due |
|---|--------|-------|-----|
| 1 | **Verify bug fixes continuously.** Run bug-fix verification as soon as individual fixes are merged instead of saving bulk verification for the end of the sprint. | Tester and Developer | Sprint 3, ongoing from Day 2 |
| 2 | **Keep PRs and reviews moving early.** Open PRs (drafts included) at least 2 days before due dates and complete reviews within 24 hours so late-sprint days stay clear. | All members | Sprint 3, Day 2 onward |
| 3 | **Maintain daily updates and impediment tracking.** Post brief daily `done` / `doing` / `blocked` updates in team chat and log blockers immediately in the impediment log. | All members, tracked by Scrum Master | Starting Sprint 3, Day 1 |

---

## 5. Summary

Sprint 2 delivered the Customer Management and Product Management & Price History modules on schedule, with all 30 of 30 planned PRs merged and verified on the Vercel deployment. Building on Sprint 1's foundation, the team maintained strong mid-sprint velocity and finished with zero carryover, while identifying continuous bug verification and smoother end-of-sprint pacing as key focus areas heading into Sprint 3.