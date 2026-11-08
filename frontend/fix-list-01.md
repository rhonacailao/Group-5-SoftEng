# Usability Review: Hope ERP Frontend

|                 |                                                                                |
| --------------- | ------------------------------------------------------------------------------ |
| **Project**     | Group-5-SoftEng, `frontend/`                                                   |
| **Stack**       | React 19, React Router 7, Tailwind CSS 4, Zustand, Font Awesome (CDN)          |
| **Review type** | Heuristic review of the source code (static; the app was not run in a browser) |
| **Review date** | November 9, 2026                                                               |
| **Scope**       | All 10 pages, 2 layouts and 12 shared components under `src/`                  |

---

## 1. Summary

The frontend has a solid base: a small design token set (`fire`, `dark`, `paper`, `cream`), shared `TextField`, `Alert` and dialog patterns, semantic HTML (`<section>`, `<dl>`, `<caption>`, `aria-*`), and role-aware navigation. The inconsistencies below mostly come from the project growing page by page. Several pages re-declare patterns instead of reusing them.

**Findings by severity**

| Severity | Count | Meaning                                                          |
| -------- | ----- | ---------------------------------------------------------------- |
| High     | 8     | Blocks a task, misleads the user, or breaks a design-system rule |
| Medium   | 14    | Visible inconsistency or friction users will notice              |
| Low      | 8     | Polish, naming and minor accessibility issues                    |

**Top priorities**

1. Remove the duplicate Tailwind and font setup (`index.css` vs `App.css`). The brand font is never applied. (F-01, F-02)
2. Fix the marketing navbar: three dead links, and "Change password" drops logged-in users into the public layout. (F-14, F-15)
3. Make Customers actions match the stated roles. Regular users are told they can "search, add and edit" but also get Delete. (F-22)
4. Show the "Pending" registration state in User Management, and wire up the dead "Add user" and "Edit" buttons. (F-23, F-24)
5. Fix the contrast of the primary orange button and the orange links. (F-06)
6. Add a responsive sidebar and navbar. (F-16)

---

## 2. Findings

### 2.1 Design system and styling

#### F-01: Two competing Tailwind and theme entry points · **High**

- **Where:** `src/index.css`, `src/App.css`, `src/main.tsx`, `src/App.tsx`
- **What:** Both CSS files contain `@import "tailwindcss"`, an `@font-face` block and an `@theme` block. `index.css` is loaded from `main.tsx` and `App.css` from `App.tsx`.
- **Inconsistency:**
  - `index.css` defines only `--font-avenir: AvenirNext` (a family that does not exist) and no colors.
  - `App.css` defines `--font-avenir: Avenir` and all brand colors, and also sets `html { font-size: 90% }`.
  - Tailwind is processed twice, so the output is larger and the cascade depends on import order.
- **Impact:** Unpredictable styling, extra CSS payload, and a theme that is hard to maintain.
- **Recommendation:** Keep one stylesheet (`index.css`) with a single `@import`, `@font-face` and `@theme`. Delete the other.

#### F-02: Brand font (Avenir Next) is never applied · **High**

- **Where:** `src/index.css`, `src/App.css`, `src/assets/fonts/`
- **What:** `--font-avenir` is defined but the `font-avenir` class is not used anywhere, and `body` sets no `font-family`. The UI renders in the browser default.
- **Also:** Five font files ship (Light, Regular, Medium, Bold, Italic) but only Regular is declared. Every `font-bold` and `font-semibold` is therefore synthesized (faux bold) rather than using the real Bold file.
- **Impact:** The visual identity differs from the intended design, and synthetic bold looks heavier and less legible.
- **Recommendation:** Declare each weight with `font-weight` descriptors, add `font-display: swap`, and set the font on `body` or the Tailwind `font-sans` token.

#### F-03: `text-md` is not a Tailwind class · **Medium**

- **Where:** 8 uses, including `TextField` labels, `AuthSplitLayout` description and footer, and `LoginPage`/`RegisterPage` paragraphs.
- **What:** Tailwind has no `text-md`, and no `--text-md` token is defined in either `@theme`. The class does nothing.
- **Inconsistency:** Text meant to be a distinct "medium" size renders at the inherited size, so it looks identical to surrounding text.
- **Recommendation:** Replace it with `text-base`, or define `--text-md` in the theme.

#### F-04: Heading scale differs between pages · **Medium**

- **Where:** `DashboardPage`, `CustomersPage`, `AccountPage`, `PlaceholderPage` use `text-5xl font-bold leading-none`. `UserManagementPage` and `SystemSettingsPage` use `text-3xl font-bold`. `RegisterPage` uses `text-2xl` while other auth pages use `text-5xl`.
- **Impact:** Page titles jump in size as users navigate, which weakens the sense of one product.
- **Recommendation:** Create a shared `PageHeader` component (title, description, optional action) and use it on every dashboard page.

#### F-05: Page padding is doubled on two pages · **Medium**

- **Where:** `DashboardLayout` wraps content in `<main class="p-10">`. `UserManagementPage` and `SystemSettingsPage` add `className="p-8"` on their own root `<section>`.
- **Impact:** Those two pages sit about 2rem further in than Dashboard, Customers and Account, so the content edge shifts when switching pages.
- **Recommendation:** Remove `p-8` from the page roots. Spacing belongs to the layout.

#### F-06: Orange brand colors fail contrast requirements · **High**

- **Where:** Primary buttons (`bg-fire text-white`), hover state (`hover:bg-fire-light`), orange text links (`text-fire`), focus ring (`ring-fire-light`).
- **Calculated contrast** (using the theme values, where `white` is redefined as `#f5f5f5`):

  | Pair                                                       | Approx. ratio | WCAG AA target        |
  | ---------------------------------------------------------- | ------------- | --------------------- |
  | `#f5f5f5` on `fire #ea5c1f` (button text)                  | ≈ 3.2 : 1     | 4.5 : 1 (normal text) |
  | `#f5f5f5` on `fire-light #ed9555` (button hover)           | ≈ 2.1 : 1     | 4.5 : 1               |
  | `fire #ea5c1f` on white (links such as "Forgot password?") | ≈ 3.5 : 1     | 4.5 : 1               |
  | `fire-light` focus ring on white                           | ≈ 2.1 : 1     | 3 : 1 (non-text)      |

- **Impact:** Hover turns button text hard to read, and small orange links are weak for low-vision users.
- **Recommendation:** Use a darker orange for text and button backgrounds (about `#c2410c`), keep the lighter orange for decoration only, and darken hover rather than lighten it.

#### F-07: `--color-white` is overridden to `#f5f5f5` · **Low**

- **Where:** `App.css` `@theme`.
- **What:** Every `bg-white` and `text-white` is off-white. Inputs and dialogs (`bg-white`) sit on a similar tint to the page, and "white" cards on `bg-white` pages have almost no separation.
- **Recommendation:** Keep `white` as `#fff` and add a named token (for example `--color-surface`) for the off-white.

#### F-08: Card elevation is inconsistent · **Low**

- **Where:** Dashboard, Customers, User Management and System Settings cards use `shadow-lg`. The two `bg-paper` cards on `AccountPage` have no shadow.
- **Recommendation:** Standardize on a shared `Card` component.

#### F-09: Status badges use three different styles · **Medium**

- **Where:** `DashboardPage` (`StatusTag`), `CustomersPage` (inline), `UserManagementPage` (inline, plus a role badge).

  | Location               | Border | Padding  | Weight   | Colors             |
  | ---------------------- | ------ | -------- | -------- | ------------------ |
  | Dashboard `StatusTag`  | Yes    | `px-2.5` | semibold | blue / green / red |
  | Customers status       | Yes    | `px-2.5` | semibold | green / red        |
  | User Management status | **No** | `px-3`   | **bold** | green / red        |

- **Recommendation:** Extract one `Badge` component with variants.

#### F-10: Table styling is not shared · **Medium**

- **Where:** Dashboard deliverables, Customers and User Management tables.
  - **Dashboard:** `px-2`, `divide-y` rows, no card padding, `text-sm` header with a bottom border.
  - **Customers and User Management:** `px-4`, `border-t` rows, `p-2` card wrapper.
  - **Customers:** has `<caption>`; **User Management:** no `<caption>`.
  - **User Management:** names are `<th scope="row">`; **Customers:** the Cust no/name cells are plain `<td>`.
  - **Minimum widths:** `48rem` vs `40rem` vs none.
- **Recommendation:** One `DataTable` pattern with consistent caption, row headers and spacing.

#### F-11: Button styles are repeated inline and drift slightly · **Low**

- **Where:** Primary, secondary and "action" buttons are copy-pasted as long class strings across ~15 places. `actionButton` is defined twice (`CustomersPage`, `UserManagementPage`) and a third time inline in `RightsDialog`. Some primary buttons use `flex items-center gap-2` and others don't.
- **Recommendation:** Create `Button` (primary, secondary, danger, small) and `LinkButton`.

---

### 2.2 Navigation and information architecture

#### F-12: Two different navigation shells with duplicated brand and no shared logic · **Low**

- **Where:** `Navbar` (public) vs `Sidebar` (app). The logo link goes to `/` in the navbar and `/dashboard` in the sidebar. `/` itself just redirects to `/login`.
- **Impact:** Clicking the logo on the public pages always lands on Log in, not on any home page.

#### F-13: Product naming is inconsistent · **Low**

- **Where:** UI wordmark "Hope ERP", browser tab title "Hope INC. ERP" (`index.html`), package name `hope-inc-erd` ("erd" looks like a typo of "erp"), code comments "Hope, Inc.".
- **Also:** The tab title never changes per route, so history, bookmarks and screen-reader page announcements all read "Hope INC. ERP". The favicon link is commented out (and the comment syntax `<!---` ... `--->` is malformed).
- **Recommendation:** Pick one product name, and set `document.title` per page (for example "Customers · Hope ERP").

#### F-14: Marketing navbar contains dead and misleading links · **High**

- **Where:** `Navbar.tsx`
- **What:**
  - `/industries` and `/pricing` have no route. The `*` catch-all silently redirects visitors to `/login`.
  - `/products` is a protected route, so a guest clicking "Products" is bounced to Log in with no explanation.
  - These three use plain `<a href>` instead of `<Link>`, so each click is a full page reload.
- **Impact:** Visitors click a menu item and land on the login form instead.
- **Recommendation:** Remove the links until the pages exist, or build them. Use `<Link>` for internal navigation.

#### F-15: "Change password" and "Back to log in" leave the app shell · **Medium**

- **Where:** `AccountPage` links to `/forgot-password`, which renders inside `AuthLayout`.
- **What:** A logged-in user is moved from the sidebar layout into the public layout, which shows "Try for free" and "Log in" buttons although they are signed in. The reset email flow also asks them to type their own email address again.
- **Also:** None of the auth pages redirect an already-signed-in user, so `/login` shows the login form to someone who is logged in _(verify)_.
- **Recommendation:** Offer an in-app "Change password" form, or at least prefill the email and keep the sidebar shell.

#### F-16: No responsive behavior for the main navigation · **High**

- **Where:** `Sidebar` is a fixed `w-64 shrink-0` column with no collapse or menu button. `Navbar` shows five items in a single row with no mobile menu. The Dashboard grids _are_ responsive (`sm:`, `xl:`), so the content adapts but the navigation does not.
- **Impact:** On a phone the sidebar takes roughly 70% of the screen width, and the navbar items wrap or overflow.
- **Recommendation:** Collapse the sidebar into a drawer with a hamburger button below `lg`, and add a small-screen menu to the navbar.

#### F-17: Active state is missing on public navbar buttons · **Low**

- **Where:** `Navbar` uses `NavLink` for "Try for free" and "Log in" but never uses `isActive`, so the current page is not indicated. On `/login` the "Log in" button is redundant with the page.

#### F-18: Duplicate and inconsistent entry points for the same actions · **Medium**

- **Where:**
  - **Log out:** sidebar footer, account dropdown, and the Account page (three places, three different styles).
  - **Settings:** sidebar footer and account dropdown.
  - **Settings vs System Settings:** "Settings" sits in the sidebar footer, "System Settings" in the main list, and the two names are easy to confuse. The code comment even states they are different things.
- **Recommendation:** Pick one place per action. Rename "Settings" to something like "Preferences", or merge them with tabs.

#### F-19: Placeholder pages are presented as finished features · **Medium**

- **Where:** `/products`, `/sales`, `/settings`, `/human-resources` render only "This page is coming soon." They are all in the sidebar. The Dashboard quick actions "Manage products" ("Update the catalogue and prices") and "Sales pipeline" ("Track orders and payments") promise functionality that does not exist.
- **Recommendation:** Mark unfinished modules (for example a "Soon" badge, disabled state) and make the quick action descriptions truthful. Improve the placeholder with a back link and the expected release or status.

#### F-20: Icon meaning differs for the same module · **Low**

- **Where:** Sales is `fa-cart-shopping` in the sidebar but `fa-chart-line` in the Dashboard quick action. Settings uses `fa-gear` and System Settings uses `fa-sliders`.
- **Recommendation:** Keep one icon per module and reuse the same constant.

#### F-21: Top-right account controls appear on some pages but not others · **Medium**

- **Where:** `DashboardLayout` hides `TopbarActions` on `/user-management` (`hideTopbarOn`).
- **Impact:** The notification bell and account menu vanish on one page, so users lose access to them there. On User Management the "Add user" button sits where the controls would be.
- **Also:** `TopbarActions` is absolutely positioned over the page. Large titles (`text-5xl`) and the header action rows have no reserved space, so they can collide with the controls on narrow widths _(verify)_.
- **Recommendation:** Put the topbar in normal flow (a header row in the layout), show it on every page, and place page actions below it.

---

### 2.3 Roles, rights and workflow logic

#### F-22: Customers UI does not match its role description · **High**

- **Where:** `CustomersPage.tsx`
- **What:**
  - The non-admin description says "Search, add and edit customers."
  - The Delete button is rendered for everyone. It is not gated by `isAdmin`.
  - After a regular user deletes a customer, it disappears with no way to restore it (only admins see the Inactive tab and Restore).
  - User Management defines per-module rights (view, create, and so on) but the Customers page ignores them.
- **Impact:** Users can take an action the page says they can't, and can't undo it.
- **Recommendation:** Gate Delete by permission, add a confirmation dialog, and read from the rights model.

#### F-23: Registration approval is promised but not visible · **High**

- **Where:** `RegisterPage` says an administrator will approve the request. A notification says "New registration waiting for approval" and points to User Management. But `UserManagementPage` has only Active and Blocked states, and no Approve or Reject action or Pending filter.
- **Impact:** An admin following the notification can't complete the task the app tells them to do.
- **Recommendation:** Add a Pending status with Approve and Reject actions, and a pending count on the sidebar item.

#### F-24: Visible buttons that do nothing · **High**

- **Where:** `UserManagementPage`: "Add user" and the row "Edit" button have no `onClick`. `GoogleButton` is a mockup. Notification rows look clickable (unread highlight) but are not links.
- **Impact:** Users will click, get no response and assume the app is broken.
- **Recommendation:** Disable or hide unfinished controls, or label them "Coming soon". Make notifications link to the related record.

#### F-25: Destructive actions have no confirmation or feedback · **Medium**

- **Where:** Customers "Delete", User Management "Block".
- **What:** Both apply immediately. Saving, adding or restoring a customer also gives no toast or "saved" message. The only feedback is the row moving or changing.
- **Recommendation:** Confirm destructive actions, style them as danger, and show a short success toast with Undo where possible.

#### F-26: Demo credentials are shown on the login page · **Medium**

- **Where:** `LoginPage` prints the demo email and password when `DEMO_ENABLED` (on unless `VITE_DEMO_LOGIN=off`). The demo user is given the `admin` role.
- **Impact:** Fine for a class demo, but easy to ship by accident, and it grants admin access to anyone who reads the page.
- **Recommendation:** Default it to off in production builds and give the demo account the lowest role.

---

### 2.4 Forms and feedback

#### F-27: Register page uses a different layout from the other auth pages · **Medium**

- **Where:** `RegisterPage` builds its own full-bleed photo background with a floating card. Login, Forgot and Set password share `AuthSplitLayout`.
- **Inconsistencies:** Different image (`group.jpg` vs `techstore.jpg`), heading `text-2xl` vs `text-5xl`, footer left-aligned vs centered, and card chrome (border, rounded-lg) vs flat split panel.
- **Impact:** Moving between Log in and Register feels like two products.
- **Recommendation:** Support a variant of `AuthSplitLayout`, or move Register onto the same layout.

#### F-28: Wording for creating an account varies · **Low**

- **Where:** Navbar "Try for free", Login footer "Register", Register heading "Create your account", submit button "Register", code comments "sign up".
- **Recommendation:** Choose one verb (for example "Create account") and use it everywhere.

#### F-29: Two different validation styles, and field errors are used only once · **Medium**

- **Where:**
  - The `TextField` `error` prop (inline, red border, `aria-describedby`) is used only on Register.
  - Login and Set password put every error in a generic `Alert` at the bottom.
  - Native browser validation bubbles also appear (`required` is forced by `TextField`, `minLength` is set, and the form has no `noValidate`), alongside the custom messages.
- **Impact:** Users see browser pop-ups on some errors and styled messages on others. Alerts titled just "Error!" don't say which field to fix.
- **Recommendation:** Pick one approach (custom inline errors with `noValidate`), and attach errors to the relevant field. Use a descriptive Alert title.

#### F-30: Alert titles use inconsistent punctuation and tone · **Low**

- **Where:** "Error!", "Request sent!", "Password saved!", "Check your inbox." (the last ends with a period).
- **Recommendation:** Use specific, consistent titles, for example "Could not log in".

#### F-31: Password rules are hidden once the user starts typing · **Medium**

- **Where:** `SetPasswordPage` communicates "At least 8 characters" only through the placeholder, which disappears on input.
- **Also:** No show/hide password toggle on any password field, and the confirm field must be retyped blind.
- **Recommendation:** Show requirements as persistent helper text, and add a visibility toggle.

#### F-32: Hidden input limits in the customer dialog · **Medium**

- **Where:** `CustomerDialog`: `maxLength={20}` on Customer name and `50` on Address.
- **What:** Typing is silently cut off with no counter or hint. A 20-character limit is tight for company names (existing records such as "Globus Medical, Inc" are already 19 characters).
- **Recommendation:** Show a character counter and helper text, or raise the limit if the database allows.

#### F-33: `TextField` forces `required` and `name` from `id` · **Low**

- **Where:** `TextField.tsx`
- **What:** Every field is always required, and optional fields can't be expressed (the `{...props}` spread comes after `required`, so callers can override it only with `required={false}`, which is not obvious). There's also no visual required indicator and no hint or help text slot.
- **Recommendation:** Make `required` a prop that defaults to true, add a visible marker, and add a `hint` prop.

---

### 2.5 Content and data presentation

#### F-34: Status vocabulary differs per module · **Medium**

- **Where:** Dashboard: Pending / Done / Overdue. Customers: Active / Inactive (the action is called "Delete"). Users: Active / Blocked.
- **Impact:** "Delete" followed by "Inactive" and "Restore" is confusing, and "Active" has different meanings per module. Red for "Inactive" implies an error when it only means archived.
- **Recommendation:** Rename the action "Deactivate"/"Archive" (or the status "Deleted"), and use a neutral color for inactive.

#### F-35: Three date and time formats · **Low**

- **Where:** Dashboard "Nov 3, 2026", Customers stamp `EDIT user1 2026-10-12 11:18 AM`, notifications "2h ago" / "Yesterday".
- **Also:** The Stamp column shows raw audit text (`ADD admin 2026-10-12 11:18 AM`), which is meant for the database and is cryptic in the UI. `<time>` elements have no `dateTime` attribute.
- **Recommendation:** Format dates with one helper, show "Added by admin on Oct 12, 2026" and keep the raw stamp in a tooltip.

#### F-36: Mock deliverables contradict their own status _(verify)_ · **Low**

- **Where:** `DashboardPage` mock data. With today's date (Nov 9, 2026), "Deliver 12 items" is due Nov 7 but marked Pending, while Nov 3 and Nov 4 items are Overdue. A static status will go stale as soon as real data replaces it.
- **Recommendation:** Derive Overdue from the due date.

#### F-37: Column and field labels are abbreviated unevenly · **Low**

- **Where:** Table header "Cust no" vs dialog "Customer no." vs "Customer name". Pay terms display as "COD", "Net 30", "Net 45".
- **Recommendation:** Use full words in headers ("Customer no.").

---

### 2.6 Accessibility

| ID   | Issue                                                                                                                                                                                      | Where                      | Severity |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | -------- |
| F-38 | Tabs use `role="tablist"`/`role="tab"` but there is no `role="tabpanel"`, no `aria-controls`, and no arrow-key navigation, so they behave as buttons while announcing as tabs.             | `CustomersPage`            | Medium   |
| F-39 | Visible keyboard focus is defined only on text inputs. Sidebar links, buttons and table actions rely on browser defaults, which can be hard to see on the dark sidebar and orange buttons. | Global                     | Medium   |
| F-40 | The dropdown menus close on Escape and outside click (good) but do not move focus into the menu or return it to the trigger button.                                                        | `TopbarActions`            | Low      |
| F-41 | Status is conveyed with text _and_ color (good), but the red/green badge pairs rely on `-300` backgrounds with `-800` text, and the `Alert` colors should be checked for contrast.         | Badges and `Alert`         | Low      |
| F-42 | Table action buttons ("Edit", "Delete") repeat on every row without row-specific accessible names. Screen-reader users hear the same label many times.                                     | Customers, User Management | Medium   |

---

## 3. What works well

- **Reusable building blocks:** `TextField`, `Alert`, `AuthSplitLayout`, `CustomerDialog` and `RightsDialog` are consistent with each other and well documented with comments.
- **Semantic structure:** `<dl>` for key facts, `<caption class="sr-only">`, `scope` on headers, `aria-live`-appropriate roles on alerts, and `aria-hidden` icons.
- **Native `<dialog>`** with `showModal()` gives free focus trapping and Escape handling.
- **Clear loading and guard states:** a spinner while the session loads, and role-based redirects.
- **Good empty state:** "No customers found." and the "No actions available" dash for non-manageable users.
- **Honest comments in code** about mock data and missing endpoints, which makes this review easier.

---

## 4. Suggested fix order

| Phase                                   | Items                                                                                                               | Effort          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------- |
| **1. Quick wins** (under a day)         | F-01, F-02, F-03, F-05, F-14, F-20, F-26, F-30                                                                      | Small           |
| **2. Consistency pass** (1 to 2 days)   | Build `PageHeader`, `Card`, `Badge`, `Button`, `DataTable`; apply to F-04, F-08, F-09, F-10, F-11, F-27, F-34, F-35 | Medium          |
| **3. Workflow and logic**               | F-22, F-23, F-24, F-25, F-15, F-21                                                                                  | Medium          |
| **4. Accessibility and responsiveness** | F-06, F-16, F-29, F-31, F-38, F-39, F-42                                                                            | Medium to large |

---
