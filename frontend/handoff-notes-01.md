# Products & Price History: Hand-off Notes

Hope, Inc. ERP · Group-5-SoftEng · front end only

## Summary

The Products screen and its Price History dialog are built and work end to end on demo data, with no backend needed. The page looks and behaves differently for User, Admin and Superadmin, following the Student Guide (sections 1.2 and 3.4) and this repo's rights model. The calls to the real server are written but untested, because the backend does not have the price, delete or restore routes yet.

## What was delivered

One existing file was replaced and six new files were added, all under `frontend/src/`.

| File | Status | Purpose |
|---|---|---|
| `pages/ProductsPage.tsx` | Replaced | The product list: search, unit filter, tabs, add, edit, delete, restore, Prices button |
| `components/PriceHistoryDialog.tsx` | New | Price history per product, with add, edit, delete and restore |
| `components/StatusBadge.tsx` | New | The green Active / red Inactive pill |
| `components/StatusTabs.tsx` | New | Active / Inactive / All tabs with counts |
| `lib/products.ts` | New | Shared types, role labels, styles and helpers (currency, today, current-price rule) |
| `lib/demoProducts.ts` | New | Sample products and prices from the PDF, plus demo rights per previewed role |
| `lib/productApi.ts` | New | One switch between the demo data and the real server calls |

These existing files are imported by the new code and were not changed: `components/ProductDialog.tsx`, `components/TextField.tsx`, `lib/units.ts`, `lib/roles.ts`, `lib/api.ts`, `lib/useDismiss.ts` and `store/authStore.ts`. They are included in `products-feature.zip` (except `useDismiss.ts`, which is already in the repo) so the feature compiles on its own.

## How to run and preview

1. Make sure your checkout is current: `git pull origin main`.
2. Confirm `frontend/src/App.tsx` routes `/products` to the real page: `import ProductsPage from "./pages/ProductsPage"` and `<Route path="/products" element={<ProductsPage />} />`.
3. Run `npm run dev` inside `frontend/`.
4. Log in with the demo account (`user@outlook.com` / `12345abcde`). A "Preview as User / Admin / Superadmin" switcher appears at the top of the page.

If you see "This page is coming soon.", the route still points to the placeholder page. Fix the route as in step 2.

Demo changes stay in the browser tab and reset on refresh.

## How the page differs by role

| | User | Admin | Superadmin |
|---|---|---|---|
| Rows | Active only | Active and deleted (shaded) | Active and deleted (shaded) |
| Status and Stamp columns | Hidden | Shown | Shown |
| Active / Inactive / All tabs | Hidden | Shown | Shown |
| Buttons | Only what their rights allow | Only what their rights allow | All of them |

- Superadmin holds every right implicitly, matching `middleware/permission.js`. Admin and User only hold what the Rights dialog granted, read from `GET /api/menu` (tile code `PRODUCT`).
- Rights used: `PRODUCT_ADD`, `PRODUCT_EDIT`, `PRODUCT_DELETE`, `PRICE_ADD`, `PRICE_EDIT`, `PRICE_DELETE`. The Delete right covers both delete and restore, the same convention as Customers.
- Everyone who can open the page can see the Current Price column and open a product's price history. There is no "view price" right.
- A deleted product shows only Restore. Its prices and details cannot be touched until it is restored.
- Admin and Superadmin look the same on this screen, as in the PDF. They differ in the badge and in where rights come from.

## What the backend still needs

The page expects these routes. The first four exist today; the rest are the next stories and follow the shape of the Customers routes. The full list is also in a comment above `productApi` in `lib/productApi.ts`.

| Route | Right | Notes |
|---|---|---|
| `GET /api/products?status=&search=&unit=&page=&pageSize=` | any | Add `currentPrice` and `stamp` to each product |
| `POST /api/products` and `PATCH /api/products/:prodCode` | add / edit | Already exist |
| `DELETE /api/products/:prodCode` | `PRODUCT_DELETE` | Soft delete. Refuse with 409 and a clear message if the product is on an active sale |
| `PATCH /api/products/:prodCode/restore` | `PRODUCT_DELETE` | |
| `GET /api/products/:prodCode/prices?status=` | any | Returns `{ ok, prices: [{ effDate, unitPrice, status, stamp }], counts }` |
| `POST /api/products/:prodCode/prices` | `PRICE_ADD` | Body `{ effDate, unitPrice }`. Duplicate date returns 409 |
| `PATCH /api/products/:prodCode/prices/:effDate` | `PRICE_EDIT` | Body `{ unitPrice }` |
| `DELETE /api/products/:prodCode/prices/:effDate` | `PRICE_DELETE` | Soft delete |
| `PATCH /api/products/:prodCode/prices/:effDate/restore` | `PRICE_DELETE` | |

Server rules that matter:

- The server must filter out deleted rows for a plain User. The page also hides them, but that is only a convenience.
- Check the role and the right on every request. Hiding a button is not security.
- Add `status` and `stamp` columns to `PRICEHIST`. The product list also needs a stamp.
- Errors should come back as `{ message }`, with an optional `errors` map per field. The page shows the first field error, otherwise the message.
- Postgres can return numeric values as strings. The page converts them, so either form is fine.

## Decisions to be aware of

- Inactive and All tabs, Status and Stamp are now decided by role, as in the PDF. The old page showed them to anyone with the Delete right. This is a one-line change if the team prefers the old rule.
- The effective date of a price cannot be edited, because it is part of the key and old sales depend on it. To change a date, delete the price and add a new one.
- Unit price must be greater than zero with at most two decimals. The server should check again.
- Prices are shown in USD, as in the PDF.
- The current price is derived, not stored: the active price with the latest effective date that is not in the future. A future-dated active price shows a "Scheduled" badge.
- The stamp is one text string from the server, such as `CREATED system 2026-10-01 9:00 AM`. The page shows it as is.
- In demo mode, restoring writes a `RESTORED` stamp. The real server decides its own wording.
- The search box and the unit filter follow the Customers design: a solid-color pill with no border or shadow, and a round filter icon that opens a panel of unit pills.

## Testing done

- TypeScript check, ESLint on all of `src`, and the production build all pass.
- A throwaway test checked the User, Admin and Superadmin views on demo data: columns, tabs, hidden Delete buttons for a User, Restore, price add with validation, duplicate-date refusal, delete and restore of a price, and the unit filter.
- That test was not committed, so the repo has no automated tests for this feature yet.

## Known gaps

- Nothing has been tried against the real backend.
- Demo data resets on every refresh.
- The Payments screen is out of scope. It is in the ERD but has no screen.
- No automated tests are committed.

## Suggested next steps

1. Build the missing backend routes above and add `currentPrice` and `stamp` to the product list.
2. Turn the demo off for a real account by logging in normally, then test each role with real rights.
3. Check that a User cannot fetch deleted rows or call delete, restore or price routes without the matching right.
4. Add committed tests (for example Vitest and Testing Library) based on the cases listed under Testing done.
5. Decide whether Superadmin should get anything extra on this screen, and whether prices should show in a different currency.
