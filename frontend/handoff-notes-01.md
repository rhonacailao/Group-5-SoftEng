# Products & Price History: Hand-off Notes

Hope, Inc. ERP · Group-5-SoftEng · front end

## Summary

The Products screen and its Price History dialog work against the real back end (S2-DEV-04 to S2-DEV-08) and also on built-in demo data with no server. The page differs for User, Admin and Superadmin, and handles the three "other" states of every screen: empty, error and confirm-delete.

## Files

All under `frontend/src/`.

| File | Purpose |
|---|---|
| `pages/ProductsPage.tsx` | The product list: search, unit filter, tabs, add, edit, delete, restore, Prices button |
| `components/PriceHistoryDialog.tsx` | Price history of one product: add, edit, delete |
| `components/ConfirmDialog.tsx` | Confirm-delete state: modal question before a destructive action |
| `components/EmptyState.tsx` | Empty state: icon, title, one sentence, optional action button |
| `components/ErrorBanner.tsx` | Error state: headline, detail, optional "Try again" / "Dismiss". Built on the shared `Alert` |
| `components/StatusBadge.tsx`, `StatusTabs.tsx` | Active / Inactive pill and the Active / Inactive / All tabs (products only) |
| `lib/errorInfo.ts` | `describeError()`: turns a thrown `ApiError` into `{ title, message }` |
| `lib/products.ts` | Shared types, role labels, styles, `withStates()` helper |
| `lib/productApi.ts` | One switch between demo data and the real routes; adapts the server's price shape |
| `lib/demoProducts.ts` | Demo products and prices, and the demo rights for each previewed role |

## How to run and preview

1. `git pull`, then `npm run dev` in `frontend/`.
2. Log in with the demo account (`user@outlook.com` / `12345abcde`). A "Preview as User / Admin / Superadmin" switcher appears. Demo changes reset on refresh.
3. A real account uses the real routes (back end running, `VITE_API_URL` set if not `localhost:3000`).

## How the page differs by role

| | User | Admin | Superadmin |
|---|---|---|---|
| Product rows | Active only | Active and deleted (shaded) | Active and deleted (shaded) |
| Status and Stamp columns, Active / Inactive / All tabs | Hidden | Shown | Shown |
| Buttons | Only what their rights allow | Only what their rights allow | All of them |

- Superadmin holds every right implicitly (`middleware/permission.js`). Admin and User only hold what the Rights dialog granted, read from `GET /api/menu`.
- Rights: `PRODUCT_ADD`, `PRODUCT_EDIT`, `PRODUCT_DELETE`, `PRICE_ADD`, `PRICE_EDIT`, `PRICE_DELETE`. The Delete right covers delete and restore of products.
- The Price History dialog is the same table for everyone; rights decide who sees Edit and Delete. Prices have no status, so no tabs or Status column.
- A deleted product shows only Restore. Its prices cannot be changed until it is restored.

## The three states

- **Empty state** (`EmptyState`): different messages for "no search match" (with a clear button), "no deleted products" (Inactive tab), "no products yet" (with an Add button if allowed) and "no prices yet".
- **Error state** (`ErrorBanner`, `describeError`): a failed first load shows an error inside the table with "Try again". A failed refresh keeps the old rows and shows a banner. A refused restore shows a dismissible banner. Form errors stay inside the form so nothing typed is lost.
- **Confirm-delete state** (`ConfirmDialog`): replaces `window.confirm`. Focus starts on Cancel, Escape is ignored while the request runs, and a refusal from the server (for example "cannot be deleted: it still has 2 price records") appears inside the dialog. Restore asks nothing because it loses nothing.

## What the back end does (and what the screen relies on)

| Route | Right | Notes |
|---|---|---|
| `GET /api/products` | any product right | `currentPrice` arrives as `{ unitPrice, effectiveDate }`; `productApi.ts` flattens it. No `stamp` is sent yet |
| `POST /api/products`, `PATCH /api/products/:prodCode` | add / edit | |
| `DELETE /api/products/:prodCode` | `PRODUCT_DELETE` | Soft delete. 409 `HAS_ACTIVE_CHILDREN` while the product has prices or sale lines |
| `PATCH /api/products/:prodCode/restore` | `PRODUCT_DELETE` | |
| `GET /api/products/:prodCode/prices` | any | `{ product, currentPrice, prices, total }`; each price is `{ prodCode, effectiveDate, unitPrice, state }` with state Current, Upcoming or Past |
| `POST /api/products/:prodCode/prices` | `PRICE_ADD` | Body `{ effectiveDate, unitPrice }`. 409 `DATE_TAKEN` for a used date |
| `PATCH /api/products/:prodCode/prices/:effDate` | `PRICE_EDIT` | The screen sends only `{ unitPrice }` |
| `DELETE /api/products/:prodCode/prices/:effDate` | `PRICE_DELETE` | **Permanent.** There is no price soft delete and no price restore. 409 `PRICE_NEEDED_BY_SALES` if earlier sales would lose their price |

## Decisions to be aware of

- Price delete is permanent, so the confirmation says so and offers no restore. The Student Guide's price Status/Stamp/Restore was dropped because the price table has no such columns.
- The effective date of a price cannot be edited in the screen (the API would allow it). To change a date, delete the price and add a new one.
- Inactive and All tabs, Status and Stamp for products are decided by role, as in the PDF. The old page used the Delete right.
- Unit price must be greater than zero with at most two decimals. Prices show in USD, as in the PDF.
- The Stamp column shows a dash for real data until the product API sends a `stamp`.
- The demo mirrors the server: deleting a product that has prices is refused, so add a new product (no prices) to try a successful delete.

## Testing done

- TypeScript, ESLint on all of `src`, and the production build pass.
- A throwaway test covered both modes. Demo: empty states, clear button, confirm and refusal inside the dialog, cancel keeps the row, successful delete, permanent price delete, empty price list. Live (mocked server): unreachable server, retry, recovery, 409 shown inside the confirm dialog, price shape adapter, price DELETE request.
- That test is not committed, so there are no automated tests for this screen yet.

## Known gaps and next steps

1. Try the screen against the running back end with real rights for each role.
2. Have the product API send `stamp` so Admins see it.
3. Confirm a plain User cannot fetch deleted rows or call delete, restore or price routes without the right (the screen hides them, the server must enforce it).
4. Commit tests based on the cases above (for example Vitest and Testing Library).
5. `CustomersPage` still uses `window.confirm` and plain text for empty and error cases; it can adopt the three new components.
