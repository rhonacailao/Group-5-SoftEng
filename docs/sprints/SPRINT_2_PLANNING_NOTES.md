# Sprint 2 Planning Notes 
**Sprint:** Sprint 2 (Weeks 3 - 4)
**Module:** Module 2 (Customer Management) and Module 3 (Product Management & Price History)

## 1. Sprint Goals
- Implement customer search, list views, full CRUD operations, and soft delete/restore workflows.
- Build product catalogue creation, list views, and management forms.
- Implement effective-date price history tracking (add/edit/delete prices) with current-price display and per-action permission checks across both modules.

## 2. Role Priorities & Focus Areas
| **Role** | **Priorities for Sprint 2** |
| --- | ----- |
| Scrum Master | - Configure Sprint 2 planning notes and project board with user stories and acceptance criteria.<br>- Follow up on Sprint 1 retrospective action items.<br>- Conduct mid-sprint checks, maintain the impediment log, update velocity/burndown metrics, and facilitate the Sprint 2 review and retrospective. |
| Backend Developer | - Build Customer CRUD, search/filter, and soft delete/restore APIs and views.<br>- Build Product catalogue CRUD, search/filter, and soft delete/restore workflows.<br>- Implement effective-date price history tracking (add/edit/delete), current-price display logic, and per-action permission checks across both modules. |
| DB Admin | - Create database views for active customers and products (filtering soft-deleted records).<br>- Configure strategic database indexes and optimize search query performance.<br>- Populate demo/seed data for customers, products, and price history tiers, and enforce delete blocks when active child records exist. |
| UI/UX Designer | - Design wireframes for Customer screens (list, search/filter, create/edit) and Product & Price History screens.<br>- Produce high-fidelity mockups and developer handoff notes.<br>- Design empty, error, and confirm-delete UI states, and conduct a usability review of built screens. |
| Tester | - Write and execute test cases for Customer Management, Product Catalogue, and Effective-Date Price History.<br> - Execute soft delete/restore tests (including delete protection when active child records exist) and per-right permission checks.<br>- Run Sprint 2 regression tests, log bug reports, and verify fixes. |