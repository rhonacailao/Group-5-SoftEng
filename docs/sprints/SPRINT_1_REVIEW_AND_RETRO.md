# Sprint 1 Review and Retrospective

**Project:** HOPE, Inc. ERP
**Sprint:** 1 of 4 (Weeks 1-2)
**Date of session:** November 9, 2026
**Facilitator:** @rhonacailao (Scrum Master)
**Attendees:** @bearbau (UI/UX Developer), @IanCarloArimas (Tester), @karlamaemori (DB Admin), @RebEmnacin (Backend Developer)
**Related task:** S1-SM-05

---

## 1. Sprint Goal

Deliver the foundation of the Hope, Inc. ERP: project setup, database migrations and seed data, and the complete access layer (registration, login, password reset, User Management, per-action rights, and a role-aware main page), as described in the Student Guide (sections 3.1, 3.2 and 3.8), and have it deployed and running on Vercel.

**Result:** Goal met. All planned Sprint 1 work was completed within the sprint.

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
- S1-DEV-01: Project scaffold (app skeleton, env config, DB connection)
- S1-DEV-02: Register user form and API (new users start as pending)
- S1-DEV-03: Login and logout with session handling, password hashing, set-password on first login, blocked users cannot sign in
- S1-DEV-04: Reset password (request, emailed token, reset form)
- S1-DEV-05: User Management screen (list, Add, Edit, Block/Unblock; Admin manages Users only, Superadmin accounts hidden)
- S1-DEV-06: Superadmin approves pending users and designates admins; last-superadmin guard
- S1-DEV-07: Rights dialog (per-action rights by module, module checkbox, All/None)
- S1-DEV-08: Main page with sidebar and module tiles by role and rights, plus server-side permission check

**DB Admin (6/6)**
- S1-DBA-01: Team database setup, migration runner script, setup README
- S1-DBA-02: Migration of HOPE base tables and sample data
- S1-DBA-03: Migration of app_user, role, module, rights catalogue, user_permission (with soft delete)
- S1-DBA-04: Password reset token table (hashed, expiry, used flag)
- S1-DBA-05: Seed data (superadmin accounts, five rights modules, 36-right catalogue)
- S1-DBA-06: audit_user() records the logged-in user in audit_log, with tests

**Tester (6/6)**
- S1-TST-01: Sprint 1 test plan and acceptance criteria
- S1-TST-02: Test cases for register, login/logout, set and reset password
- S1-TST-03: Test cases for User Management
- S1-TST-04: Permission matrix tests (superadmin/admin/user x each right)
- S1-TST-05: Automated smoke test (login and main page)
- S1-TST-06: Bug reports and fix verification

**UI/UX Designer (5/5)**
- S1-UIX-01: Design system (colors, typography, core components)
- S1-UIX-02: Wireframes for login, register, set/reset password
- S1-UIX-03: Wireframes for main page, User Management list and Rights dialog
- S1-UIX-04: Hi-fi mockups and developer handoff notes
- S1-UIX-05: Usability review of built screens and fix list

**Scrum Master (5/5)**
- S1-SM-01: Repo setup (branch protection, PR and issue templates)
- S1-SM-02: Sprint 1 board with acceptance criteria and module-to-sprint mapping
- S1-SM-03: Team working agreement, Definition of Done, role guide
- S1-SM-04: Mid-sprint check notes and impediment log
- S1-SM-05: Sprint 1 review and retrospective report (this document)

### 2.3 Demo results

| Deliverable | Status | Notes |
|-------------|:------:|-------|
| Register (new accounts start as pending) | Done | Working on the deployed Vercel site |
| Login / logout, blocked users cannot sign in | Done | Frontend-backend connection issue fixed (see section 3) |
| Set and reset password | Done | Emailed token flow with expiry |
| User Management (list, add, edit, block/unblock) | Done | Admin cannot see Superadmin accounts |
| Superadmin approval and admin designation | Done | Last-superadmin guard in place |
| Rights dialog (per-action rights by module) | Done | Backed by the 36-right catalogue |
| Main page (sidebar and tiles by role and rights) | Done | Server-side permission check included |
| Audit logging (audit_user) | Done | Logged-in user recorded in audit_log |
| Deployment on Vercel | Done | Project is hosted and accessible |

### 2.4 Carryover to Sprint 2

None. All 30 planned Sprint 1 PRs were merged. The only open item is an action item from the retrospective (see section 4), not unfinished work.

---

## 3. Retrospective

### What went well
- **Hosted on Vercel.** The project is deployed and accessible, so everyone can test the real running system instead of only local setups.
- **Sprint 1 finished on time.** All 30 planned PRs were completed within the sprint, with 100% of the planned work merged.

### What didn't go well
- **Late PRs.** Some PRs were opened or merged close to their due days, which compressed review and testing time near the end of the sprint.
- **Lack of communication.** Updates on progress, blockers and who was reviewing what were not shared often enough.
- **Frontend did not connect well to the backend (main issue).** Screens built by the UI/Developer side and the backend/database work did not integrate smoothly at first, causing delays and rework. **This has since been fixed** and the connected system now works end to end.

### Key takeaways
- Integration problems are cheapest to catch early. Connecting frontend and backend should be checked in the first week, not at the end.
- Small, frequent updates matter more than long reports. A short daily check-in would have surfaced the integration issue sooner.
- Finishing on time with a working Vercel deployment shows the team can deliver when blockers are resolved quickly.

---

## 4. Action Items for Sprint 2

| # | Action | Owner | Due |
|---|--------|-------|-----|
| 1 | **Open PRs earlier.** Open a PR (draft is fine) at least 2 days before the task due day, and get a teammate review within 24 hours. | All members | Sprint 2, day 2 onward |
| 2 | **Improve communication.** Post a short daily update (done / doing / blocked) in the team chat, and log blockers in the impediment log. | All members, tracked by Scrum Master | Starting Sprint 2, day 1 |
| 3 | **Check frontend-backend integration early.** Do an integration check of each new screen against the real API and database in week 3 (before week 4 work), and test on the Vercel deployment. | Developer and Tester | Sprint 2, week 3 (day 5) |

---

## 5. Summary

Sprint 1 delivered the full access foundation of the HOPE ERP (registration, authentication, password reset, User Management, per-action rights and the role-based main page), hosted on Vercel, with 30 of 30 planned PRs merged on time. The main challenges were late PRs, limited communication and an early frontend-backend integration problem, which is now resolved. The team enters Sprint 2 (Customers and Products modules) with three concrete action items to improve how we work.