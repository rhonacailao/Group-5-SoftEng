# HOPE ERP: Team Working Agreement

## Team Roles & Members

| Role | Username | Full Name | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Scrum Master** | `@rhonacailao` | Rhona Angelica Cailao | Manages sprints, breaks down tasks, and guides the team through GitHub issues and Git workflows. |
| **UI/UX Designer** | `@bearbau` | Beatriz Marie Bautista | Designs responsive user interfaces, layouts, and interactive components using modern design tools. |
| **Backend Developer** | `@RebEmnacin` | Reb Emnacin | Implements API logic, client authentication, and database record management using Supabase. |
| **DB Admin** | `@karlamaemori` | Karla Mae Ibuig | Configures database schemas, migrations, PostgreSQL scripts, and Row Level Security policies. |
| **Tester** | `@IanCarloArimas` | Ian Carlo Balajadia | Writes test plans, executes automated test scripts, and performs bug and security reporting. |

---

## 1. Overview & Purpose
This document establishes our core team collaboration rules, communication channels, meeting schedules, review expectations, and quality standards for the 8-week sprint project. 

---

## 2. Communication & Collaboration Channels
- **Primary Messaging:** The Messenger Group Chat will be used for daily async updates, blockers, and quick technical syncs.
- **Documentation:** All project artifacts, guides, roadmaps, and architecture notes must live inside the repository (`docs/` or `.github/`) so everyone can reference them.
- **Transparency:** All code changes must go through GitHub Issues and Pull Requests. No direct commits to `main`.

---

## 3. Meeting Schedules & Ceremonies
- **Daily Standups:** Brief asynchronous updates or quick syncs to report what was done yesterday, what is planned today, and any active blockers.
- **Sprint Planning (Bi-weekly):** Held at the start of each 2-week sprint to assign issues from the sprint backlog to team members.
- **Sprint Review & Retrospective:** Held at the end of each sprint to review completed deliverables against the acceptance criteria and discuss workflow improvements.

---

## 4. Pull Request & Review Expectations
- **Task Association:** Every pull request must be linked to a GitHub Issue/Task ID (`Closes #n`) and follow the project's PR template.
- **Peer Review Rule:** Every PR requires at least **one approval from a teammate** (never self-approved) before it can be merged into `main`.
- **Review Turnaround:** Team members should review assigned pull requests within 24 hours to keep sprint tasks moving.
- **Quality Gates:** Code must build cleanly, pass linting and unit tests (`npm test`, `npm run build`), and be free of hardcoded secrets or leftover debug logs.

---

## 5. Conflict Resolution & Accountability
- **Blockers:** Raise blockers immediately in the team chat or tag the Scrum Master during standups.
- **Disagreements:** Technical or design disagreements should be resolved via a quick team call or discussion thread; if consensus isn't reached, the Scrum Master helps arbitrate based on the Student Guide.
- **Accountability:** Team members are responsible for updating their task status on the GitHub Project board (To Do $\rightarrow$ In Progress $\rightarrow$ Review $\rightarrow$ Done).