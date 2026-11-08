# HOPE ERP: Definition of Done (DoD)

A task is **Done** and ready to merge when all items below are true. If anything is missing, the card stays in review.

---

## 1. Universal Checklist (Every Task)
- [ ] **Traceability:** Linked to a GitHub issue (`Closes #n`) and a Sprint Task Plan row.
- [ ] **PR Standards:** Small, focused feature branch (no direct commits to `main`), with no debug code or leftover console logs.
- [ ] **Peer Review:** Approved by at least **one teammate** (not the author) and all review comments are resolved.
- [ ] **Quality Gates:** 
  - Backend tests pass (`npm test`).
  - Frontend builds and lints successfully (`npm run build` / `npm run lint`).
- [ ] **Security Basics:** No hardcoded secrets or `.env` files committed; server-side authentication (`requireAuth`) is used for protected routes.

---

## 2. Role-Specific Quick Checks
- **Developer:** Follows standard CRUD patterns, parameterized SQL, and handles loading/error states in the UI.
- **DB Admin:** Migrations are placed in `supabase/migrations/`, rollback scripts are included, and Row Level Security (RLS) is enabled.
- **UI/UX Designer:** Mockups cover default, empty, and error states, with handoff notes documented in the repo.
- **Tester:** Test cases cover happy paths, edge cases, and permission checks; failed tests have corresponding bug reports.
- **Scrum Master:** Sprint boards, retro notes, and roadmap documents are updated and committed to the repo.

---

## 3. What Does NOT Count as Done
- Code that only works on your local machine.
- A pull request with no linked issue or self-approval.
- A PR that breaks tests, linting, or builds.