# Usability Review: Hope ERP Front End

Based on a code read of all 20 uploaded files (not a rendered test). The `lib/*` files, `useDismiss`, the Tailwind theme and the Customers, Sales, Dashboard and login pages were not available. Verify contrast and layout points in a browser.

## Strengths

- Every list state is handled: loading, load error, refresh error, three empty states, confirm-delete.
- `ConfirmDialog` focuses Cancel first, blocks Esc while busy, and shows server refusals inline.
- Forms keep typed data after a server error.
- Role-aware UI (role chip, intro line, demo role preview) explains what each person can do.
- Good a11y basics: descriptive row-action labels, table captions and `scope`, `aria-hidden` icons, debounced search with stale-response guards.

## High priority

| # | Issue | Fix |
|---|-------|-----|
| 1 | Product, Customer, Price and Rights dialogs can be closed (Esc/Cancel) mid-save; submit label doesn't change while busy; `RightsDialog` has no `busy`/`error` props. | Block Esc/Cancel while busy; show "Saving…"; add `busy`/`error` to `RightsDialog`. |
| 2 | Esc/Cancel silently discards typed data. | Add a "discard changes?" guard. |
| 3 | Navbar uses `<a href>` for Products/Industries/Pricing: full reload, and `/products` is protected. | Use `NavLink`; fix or remove the protected link. |
| 4 | Not responsive: fixed `w-64` Sidebar, no mobile Navbar, dialogs have no side gutters. | Collapsible sidebar, mobile menu, `w-[calc(100%-2rem)]` on dialogs. |
| 5 | Input pill `#e0d3ca` on white is about 1.4:1 (needs 3:1); placeholder contrast unverified; colour hard-coded in about six places. | Add a border or darker fill; make it a theme token. |
| 6 | Field errors not wired: `TextField` `error` unused by dialogs; `required` forced on every field; hints lack `aria-describedby`; no client check of product-code pattern. | Per-field errors, optional `required`, `hint` prop, pattern validation. |
| 7 | `StatusTabs` uses `role="tab"` without tabpanel, `aria-controls` or arrow keys. | Use buttons with `aria-pressed`, or build the full tab pattern. |
| 8 | Delete is offered for products the server will refuse (prices/sales exist). | API returns `hasPrices`/`hasSales`; disable with a reason. |
| 9 | Price form: no focus move on open, focus lost after save. | Focus first field; restore focus to the row's Edit button. |
| 10 | Dead or fake controls: `GoogleButton` does nothing; notifications are mock data and not clickable. | Disable or label "Coming soon" / "Sample data". |

## Medium priority

- After adding a product, the notice says "Search for it to find it". Auto-search the new code or highlight the row.
- Refetch (tab, page, search) shows no loading state; stale rows stay clickable.
- Terminology drifts: Inactive vs Deleted vs "Delete" (which soft-deletes). "Stamp" is jargon; use "Last changed".
- `RightsDialog` allows Edit without View; "None" has no confirmation.
- `ProtectedRoute` loses the intended destination; `RoleRoute` redirects silently.
- Success notices are hand-styled instead of `Alert`, not dismissible, and may sit off-screen.
- ARIA fixes:
  - `aria-label` on plain `<span>`s (role chip, "No actions" dash) is unreliable; use `sr-only` text.
  - Account button label hides the visible name (WCAG 2.5.3).
  - `AuthSplitLayout` image is decorative; use `alt=""`.
- ISO dates (`2026-11-22`) shown raw; `maxLength` stops typing silently (add a counter).

## Low priority

- Product vs Customer dialogs differ in select style; transitions and shadows are inconsistent (Add button, Cancel, filter panel).
- "Clear filters" resets unit only; the empty-state button resets search and unit.
- Cap notification badge (99+), scroll to table top on page change, replace `min-h-[calc(100vh-6rem)]`, consider text input with `inputMode="decimal"` for prices.
- **Root cause:** four dialogs duplicate the shell, `showModal` effect and button styles. A shared `Dialog` component fixes items 1, 2, 4 (dialog gutters) and 9 in one place.

## Suggested order

1. Shared `Dialog` plus `RightsDialog` busy/error (1, 2, 9).
2. `TextField` field errors and hints (6).
3. Navbar links, responsive layout (3, 4).
4. Contrast tokens, `StatusTabs`, predictable-delete check (5, 7, 8).
5. Medium and low items.
