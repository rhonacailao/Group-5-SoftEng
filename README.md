# HOPE, Inc. ERP
## Group 5 Software Engineering
A database-driven Enterprise Resource Planning (ERP) system for Hope, Inc. It centralizes customers, products, employees, and sales with strict role-based access control.

## 1. ABOUT THE PROJECT
**ERP** (Enterprise Resource Planning) replaces separate spreadsheets per department with one shared database. Every screen is a view of rows from that database, and what a person sees depends on their **role** and **rights**.

### Modules

| Module | What it manages | Main tables |
|---|---|---|
| Customers | Who we sell to (name, address, payment terms) | `customer` |
| Products | Catalogue and price history | `product`, `pricehist` |
| Human Resources | Employees, jobs, departments, job/salary history | `employee`, `job`, `department`, `jobhistory` |
| Sales | Sale header + detail lines, payments | `sales`, `salesdetail`, `payment` |
| Reports | 7 read-only reports (Print / Save as PDF) | reads all of the above |
| User Management | Accounts, blocking, per-action rights | `app_user`, `role`, `module`, `rights`, `user_permission`, `password_reset_token` |

### User roles

| Role | Can do |
|---|---|
| **Superadmin** | Everything, including approving users, designating admins and assigning any role |
| **Admin** | Manages Users and their rights; cannot see or change Superadmin accounts |
| **User** | Only the modules and actions an Admin has granted (36 per-action rights) |

New registrations always start as a **User** with status **Pending** until approved. During development, team members are seeded as Superadmin.

### Key design rules

- **Soft delete** — deleting sets `status = 'Inactive'`; rows can be restored. Users see only Active rows; Admins see all.
- **Stamp** — every row records the latest action, who did it and when.
- **Derived data is not stored** — totals and current prices are calculated from `salesdetail` and `pricehist`.
- **Security on the server** — hiding a button is not enough; the server must check rights on every request. Row Level Security (RLS) is enabled on all tables.

## 2. TECH STACK
| Layer | Technology|
| -------- | -------- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend  | Node.js |
| Database | PostgreSQL |
| Tests    |  |

### Project Structure
```
Group-5-SoftEng/
├── backend/            Express API (src/app.js, routes, controllers, config/db.js)
├── frontend/           React + Vite app (pages, components)
├── supabase/migrations SQL migrations (run in timestamp order)
├── scripts/            migrate.cmd (preview/apply) and rollback SQL
├── docs/database/      Database setup guide
├── SprintTest/         Sprint test records per task (e.g. Sprint1/S1-DEV-01)
├── CodeSCR/            Screenshot evidence for test cases
└── .github/            PR template, issue templates, agent instructions
```

## 3. GETTING STARTED


**Prerequisites:** Git, VS Code, Node.js + npm, a Supabase account with access to the team project.

### Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in DATABASE_URL (never commit .env)
npm run dev               # http://localhost:3000

### Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Other frontend scripts: `npm run build`, `npm run lint`, `npm run preview`.

### Database migrations (Windows)

```bat
npx.cmd supabase login
npx.cmd supabase link
scripts\migrate.cmd preview    :: dry run — review pending migrations
scripts\migrate.cmd apply      :: only after Scrum Master/team approval
```

## 4. TESTING

Testing is done per sprint task. Each task has a test record in `SprintTest/SprintN/<TASK-ID>` with test cases, steps, expected/actual results and a PASS/FAIL status, backed by screenshots in `CodeSCR/`. Tests are written and verified by the Tester (`@IanCarloArimas`).

### Test case format

```
Test Case ID:        TC-DEV-02
Test Component:      Backend App Skeleton & Server Startup
Test Steps:          1. cd backend  2. npm install  3. npm run dev
Expected Result:     Packages install cleanly; API listens on port 3000
Actual Result:       (what really happened)
Status:              PASS ✅ / FAIL ❌
Evidence:            CodeSCR/TC-DEV-02.png
```

### Bug reporting

Open a GitHub Issue using the **Bug Report** template (steps to reproduce, expected behavior, fix verification). A bug is closed only after the fix is verified by someone other than the author and a regression test is added.

## 5. Team and Roles

| Role | Member | Username | Responsibilities |
|---|---|---|---|
| **Scrum Master** | Rhona Angelica Cailao | `@rhonacailao` | Sprint planning and board, repo governance (branch protection, PR/issue templates), working agreement, impediment log, reviews/retros, approves DB migrations, peer evaluations |
| **UI/UX Designer** | Beatriz Marie Bautista | `@bearbau` | Design system, wireframes, hi-fi mockups and handoff notes, usability reviews |
| **Developer (Backend)** | Reb Emnacin | `@RebEmnacin` | App scaffold, auth (register, login, reset), User Management, module screens and APIs |
| **DB Admin / DevSecOps** | Karla Mae Ibuig | `@karlamaemori` | Supabase/PostgreSQL schema, migrations, seed data, RLS, audit log, queries and indexes |
| **Tester** | Ian Carlo Balajadia | `@IanCarloArimas` | Test plans and cases, permission-matrix and regression tests, bug reports, fix verification, sign-off |

### Planned PRs per sprint

| Role | Per sprint | Total (4 sprints) |
|---|---|---|
| Developer | 8 | 32 |
| DB Admin | 6 | 24 |
| Tester | 6 | 24 |
| UI/UX Designer | 5 | 20 |
| Scrum Master | 5 | 20 |
| **Team** | **30** | **120** |

### Sprint plan

| Sprint | Weeks | Focus |
|---|---|---|
| 1 | 1–2 | Scaffold, register/login/reset, User Management, rights, main page |
| 2 | 3–4 | Customers and Products (with price history) |
| 3 | 5–6 | Human Resources (employees, jobs, departments, job history) |
| 4 | 7–8 | Sales, payments, Reports, audit log viewer, final tests and release |

---

## 6. Team Workflow

1. Pick a task from the sprint plan and open an issue using the **Sprint Task** template.
2. Create a feature branch — **never commit directly to `main`**.
3. Open a PR using the template; link the issue and Task ID.
4. Get approval from at least **one teammate** and resolve all comments.
5. Merge. Only **valid PRs** count for grading: merged, linked to an issue, approved by a teammate and non-trivial.

**Definition of Done:** self-reviewed and tested locally · acceptance criteria met · follows coding guidelines · peer-approved · all threads resolved.

### Security reminders

- Never commit `.env`, passwords or access tokens.
- Store only password hashes, never passwords.
- Enable RLS on every new table.
- Enforce rights on the server, not just in the UI.
