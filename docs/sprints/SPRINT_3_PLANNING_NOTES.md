# Sprint 3 Planning Notes
**Sprint:** Sprint 3 (Weeks 5 - 6)
**Module:** Module 4 (Department & Job Management) and Module 5 (Employee Management & Job History)

## 1. Sprint Goals
- Implement Department and Job management workflows, including CRUD operations, validation rules, and child-record delete protection.
- Build Employee management, employee profiles with job timelines, and effective-dated job history tracking without duplicate effective dates.
- Enforce role-based permissions—including salary and job history visibility controls—and support database views, indexing, backup/restore, and thorough testing across HR modules.

## 2. Role Priorities & Focus Areas
| **Role** | **Priorities for Sprint 3** |
| --- | ----- |
| Scrum Master | Configure Sprint 3 planning notes and project board with user stories and acceptance criteria, and re-prioritize any Sprint 2 carryover items. Conduct mid-sprint checks, maintain the impediment log, update velocity and the Sprint 4 risk register, and facilitate the Sprint 3 review and retrospective report. |
| Backend Developer | Build Department, Job, and Employee CRUD and workflow endpoints, including linking `app_user.empno` to employees and building employee profiles with job timelines. Enforce job history validation (preventing duplicate effective dates), child-record delete checks, and permission restrictions such as salary and job history visibility. |
| DB Admin | Create database views/queries for employee current job and department, and populate HR demo/seed data. Configure strategic database indexes, implement backup and restore scripts, and ensure migrations, constraints, and delete checks remain clean and reversible. |
| UI/UX Designer | Design wireframes for Department, Job, Employee, and profile screens, and design the job timeline component. Produce high-fidelity mockups with developer handoff notes covering required UI states, and conduct a usability review of built screens with a fix list. |
| Tester | Write and execute test cases for Department/Job, Employee, and Job History (effective dates and salary), plus salary visibility and HR per-right permission tests. Run regression tests for Sprints 1–2, log bug reports, and verify fixes. |
```[cite: 3, 5, 6]