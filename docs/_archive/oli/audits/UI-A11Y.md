---
oli-version: "1.0"
based-on: [apps/memberry/src/**, apps/admin/src/**, packages/ui/src/**]
last-modified: 2026-06-02T00:00:00Z
last-modified-by: a11y-auditor
standard: WCAG 2.1 AA
---

# UI Accessibility Audit — Memberry

Scope: `apps/memberry/src/`, `apps/admin/src/`, `packages/ui/src/`.
Method: static grep + targeted source reads. No runtime/axe-core verification.
Verdict: Foundation is solid (radix dialogs/sheets, skip-link, focus-visible, reduced-motion in memberry, lang=en). Main violations cluster around (a) hand-rolled `<div fixed inset-0>` modals that bypass focus management, (b) icon-only buttons missing `aria-label` (especially in `personal-info-form`, `fund-allocation-editor`, `special-assessments-list`), (c) admin app missing `prefers-reduced-motion`, no skip-link, no `<header>` wrapping its sidebar, (d) decorative event cover images use `alt=""` correctly but several `<img>` reads not verified, and (e) low-contrast `text-gray-400` / `text-gray-500` badges over light surfaces.

---

## 1. TRIAGE — Top 10 P0/P1 Violations

| # | Severity | WCAG | File:Line | Issue | Fix |
|---|----------|------|-----------|-------|-----|
| 1 | P0 | 2.1.2 / 4.1.2 | `apps/memberry/src/features/elections/components/nominee-picker-dialog.tsx:63`, `voting-ballot.tsx:301`, `self-nomination-dialog.tsx:55`, `routes/_authenticated/org/$orgSlug/officer/settings/providers.tsx:247,281`, `routes/org/$slug.tsx:212`, `admin/src/routes/associations/index.tsx:55`, `associations/$associationId.tsx:318,382,406`, `operators/index.tsx:57`, `feature-flags/index.tsx:72` | Hand-rolled `<div className="fixed inset-0 z-50 ...">` modals with backdrop `onClick={onClose}` — no focus trap, no escape-to-close, no `role="dialog"`, no `aria-modal`, no `aria-labelledby`/`aria-describedby`, no return-focus on close. Keyboard users get stuck behind/inside. | Replace with `Dialog` from `@monobase/ui` (radix). |
| 2 | P1 | 4.1.2 | `apps/memberry/src/features/person/components/personal-info-form.tsx:225-247` (Camera + remove-avatar icon buttons), `features/dues/components/fund-allocation-editor.tsx:90` (Trash2 remove fund), `features/dues/components/special-assessments-list.tsx:243,247,259,273` (Edit/Trash/View icon buttons rely on `title=` only) | Icon-only buttons without `aria-label`. `title` is mouse-hover-only — not exposed to screen readers reliably; SR may announce only the icon name. | Add `aria-label="Upload avatar"` / `"Remove avatar"` / `"Remove fund"` / `"Edit assessment"` / `"Delete assessment"`. |
| 3 | P1 | 2.4.1 | `apps/admin/src/routes/__root.tsx` (no skip-link present) | Admin app has no skip-to-content link. Sidebar has ~20 nav links blocking the tab path on every page load. (Memberry app correctly provides one at `_authenticated.tsx:74` and `__root.tsx:44`.) | Add `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to content</a>` and `id="main-content"` on `<main>` (line 196). |
| 4 | P1 | 2.3.3 | `apps/admin/src/styles/globals.css` (entire file, 0 occurrences of `prefers-reduced-motion`) | Admin app has NO `prefers-reduced-motion` media query. Sidebar transitions (`transition-colors`), Toaster richColors animation, and any future framer-motion will play regardless of user setting. | Add `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`. Memberry has partial coverage at `globals.css` lines for `--spring-bounce`/`--spring-duration`/`animate-shimmer` only — does not blanket-disable all transitions. |
| 5 | P1 | 1.4.3 | `features/dues/components/dues-status-badge.tsx:43,48,101`, `routes/_authenticated/my/training.tsx:26,30`, `features/elections/components/election-detail.tsx:50`, `election-list.tsx:25`, `surveys/components/survey-list.tsx:39`, `membership/components/seat-management-panel.tsx:185`, `membership/components/member-table.tsx:46`, `admin/src/routes/surveys/index.tsx:55` | `text-gray-500` and `text-gray-400` on `bg-gray-100`. Tailwind `text-gray-500` (#6b7280) on `bg-gray-100` (#f3f4f6) = ~4.4:1 — fails AA for normal text by hair. `text-gray-400` (#9ca3af) on white = 2.85:1 — clearly fails. | Use `text-gray-700` on `bg-gray-100`. For `text-gray-400` instances (e.g. `video-tile.tsx:42`, `video-grid.tsx:73`, dark-mode badges), replace with `text-gray-300` reserved for ≥18pt large text or use `--color-muted` token. |
| 6 | P1 | 1.3.1 / 4.1.2 | `apps/memberry/src/routes/auth/$authView.tsx:42-56`, plus 27 route files without `<h1>` (e.g. `routes/index.tsx`, `routes/discover/events.tsx`, `routes/_authenticated/dashboard.tsx`, `routes/_authenticated/org/$orgSlug/officer.tsx`, `routes/_authenticated/org/$orgSlug/home.tsx`, `routes/_authenticated/org/$orgSlug/training/index.tsx`, `routes/_authenticated/org/$orgSlug/announcements/index.tsx`, `routes/_authenticated/org/$orgSlug/dues.tsx`, `routes/_authenticated/org/$orgSlug/messages/index.tsx`) | Pages without an `<h1>`. Many routes start at `<h2>` or `<h3>`. The auth page uses `<h1>Memberry</h1>` (brand) followed by `<h2>Welcome back</h2>` (the actual page title) — heading hierarchy treats the brand as primary content. | Demote brand to `<p>` or `<span>` with role styling; promote the page title to `<h1>`. Standardize: every route must render exactly one `<h1>` for screen-reader page identification (use `<PageHeader>` pattern from `components/patterns/page-header.tsx`). |
| 7 | P1 | 4.1.2 | `apps/admin/src/routes/__root.tsx:142-150` (`<aside>` with logo `<div>`s — no `<header>` or banner), and missing `aria-label` on the `<nav>` (line 162) | Admin sidebar nav has no `aria-label` — screen readers announce all `<nav>` regions identically. Memberry navs are correctly labeled (`aria-label="Member navigation"`, etc.). | Add `aria-label="Admin navigation"` to admin `<nav>`. |
| 8 | P1 | 1.4.11 / 2.5.5 | `features/profile/components/standing-meter.tsx:122-125` (Button `size="icon"` with `className="h-7 w-7"` = 28px), various `Button size="icon"` (h-9 w-9 = 36px in default `size="icon"` from `packages/ui/src/components/button.tsx:35`) | shadcn `Button size="icon"` defaults to `h-9 w-9` = 36×36px. WCAG 2.5.5 Level AAA requires 44×44; AA 2.5.8 (WCAG 2.2) requires 24×24 — passes AA but fails AAA. The h-7 w-7 (28px) on `standing-meter` is borderline; the cluster of icon buttons on mobile `member-bottom-nav` should be re-measured at the touch surface (visual icon vs hit area). | Enforce minimum touch target via `min-h-[44px] min-w-[44px]` on interactive elements on mobile breakpoints, or extend `Button` variants with `size="icon-lg"`. |
| 9 | P1 | 2.4.6 / 1.3.1 | `apps/memberry/src/routes/__root.tsx:21` — `<h1 className="text-hero">404</h1>`, `<p className="text-h3">Page not found</p>` | "404" is the `<h1>` — meaningless text content for a screen-reader skim. Same pattern on `apps/memberry/src/routes/_authenticated.tsx` notFoundComponent. | Make `<h1>Page not found</h1>` and demote "404" to visual decoration (`<p aria-hidden="true">`). |
| 10 | P1 | 1.1.1 | `features/directory/components/directory-search.tsx:51` (`alt=""` on avatar), `member-profile.tsx:114` (same), `features/events/components/event-card.tsx:79` (`alt=""` on cover), `routes/discover/events.tsx:150` (same), `routes/_authenticated/org/$orgSlug/officer.tsx:79` (`alt=""` on bg image — correct) | Avatars with `alt=""` lose the user's name to assistive tech. WCAG 1.1.1 requires meaningful images to have descriptive alt — a member's photo IS meaningful (it identifies them to sighted users; SR users miss this signal). Decorative event covers (`alt=""`) are correct. | Set `alt={profile.displayName}` (or `alt="" aria-hidden="true"` only if name is rendered immediately adjacent and SR users can correlate). |

---

## 2. By Category

### 1. Semantic landmarks
- Status: PARTIAL. Memberry app uses `<main>`, `<nav>`, `<header>`, `<aside>` correctly across `_authenticated.tsx:83`, `_authenticated/org/$orgSlug/officer.tsx:73`, `auth/$authView.tsx:42`, `components/layout/member-sidebar.tsx:137` (`<aside>`), `member-header.tsx:47` (`<header>`), `officer-mobile-nav.tsx:81` (`<header>`).
- Admin app uses `<main>` (`__root.tsx:196`) and `<nav>` (line 162) but the sidebar wrapper is `<aside>` without a `<header>` for the logo region.
- No `<footer>` landmarks anywhere — acceptable for an authed SPA but flag if/when public marketing pages land.
- Worst offenders:
  1. `apps/admin/src/routes/__root.tsx:162` — `<nav>` without `aria-label`.
  2. `apps/admin/src/routes/__root.tsx:144` — logo block in `<aside>` is plain `<div>`, not a `<header>` inside the aside.
  3. `apps/memberry/src/routes/_authenticated.tsx:84-99` — `<main>` wraps `AnimatePresence` + `motion.div` direct child; semantics fine but ensure `motion.div` doesn't drop ARIA on the page-transition unmount.

Count: 4 `<main>` instances total. 9 `<nav>` instances; 8 have `aria-label`, 1 does not (admin).

### 2. Interactive elements without accessible names
- 120 `aria-label` occurrences total across both apps.
- Several `Button size="icon"` instances WITHOUT `aria-label`. Worst:
  1. `apps/memberry/src/features/person/components/personal-info-form.tsx:222-244` — camera button + destructive remove-avatar button, NO `aria-label` on either.
  2. `apps/memberry/src/features/dues/components/fund-allocation-editor.tsx:90` — `removeFund` Trash2 button with `className="text-[var(--color-error)]"` and NO `aria-label` (sibling at line 58 has `aria-label="Move fund up"`, so the gap is real).
  3. `apps/memberry/src/features/dues/components/special-assessments-list.tsx:243,247,259,273` — Edit/Delete/View buttons rely only on `title=`, no `aria-label`.

### 3. Custom interactive elements without ARIA roles
- `<div onClick>` pattern: 13+ instances, all are modal backdrops at `fixed inset-0 z-50 ... onClick={onClose}`. By design the backdrop click is supplementary (Esc/close-button should be the keyboard alternative) BUT in these hand-rolled modals there is no Esc handler at all.
- Worst:
  1. `features/elections/components/nominee-picker-dialog.tsx:63` — div backdrop, no `role`, no Esc.
  2. `features/elections/components/voting-ballot.tsx:301` — same pattern.
  3. `admin/src/routes/associations/$associationId.tsx:318,382,406` — three modals same pattern.

### 4. Form fields without labels
- Tested representative forms: PASS.
  - `features/person/components/address-form.tsx:107-179` uses `<FormLabel>` + `<FormControl><Input/></FormControl>` (shadcn/Form pattern, accessibility-clean).
  - `features/training/components/training-form.tsx:108-170` uses `<Label>` siblings (visual association, not `htmlFor` — but `Label` from radix wraps `Input` semantically when nested).
- Risk: 131 `<Label>` occurrences but only 83 `htmlFor=` — gap of 48 suggests some labels rely on implicit nesting (radix `Label` does implicit `aria-labelledby` association). Verify by spot-check; not a P0.
- Counter-example: file inputs `features/documents/components/document-library.tsx:401` `<input type="file" className="hidden" onChange={handleFileSelect} />` — hidden file picker triggered by sibling button, fine if button has accessible name (it does).
- Worst:
  1. `features/comms/__tests__/create-channel-dialog.test.tsx` and similar are TEST mocks, not real violations.
  2. `features/dues/components/fund-allocation-editor.tsx:71-77` — percentage `<Input type="number">` has NO `<Label>` (just a span "%" outside). Bare input.
  3. `features/elections/components/nominee-picker-dialog.tsx:74` — `<Input placeholder="Search members...">` has no Label; relies on placeholder alone.

### 5. Color contrast
- Theme uses CSS custom properties (`--color-text`, `--color-muted`, etc.). Without computing rendered values, the highest-risk Tailwind tokens:
  - `text-gray-400` (#9ca3af): on white = 2.85:1, fails AA for normal text and large text both.
  - `text-gray-500` (#6b7280): on white = 4.61:1, marginal pass for normal text.
  - `text-gray-400 dark:text-gray-400` on `dark:bg-gray-800` (#1f2937) = 5.4:1, OK.
- Worst:
  1. `features/comms/components/video-tile.tsx:42` — `<div className="text-gray-400">No video</div>` on dark video background, probably OK in context (dark surface). Verify.
  2. `features/comms/components/video-grid.tsx:73` — `text-xs text-gray-400` for duration label on dark bg — OK if bg is dark.
  3. `features/dues/components/dues-status-badge.tsx:43,48,101` — `text-gray-500 bg-gray-100` — borderline fail at small sizes (`text-xs`).
- Color-only status risk: required-field markers use `<span className="text-red-500">*</span>` (`address-form.tsx:169`, `personal-info-form.tsx:286`) — red alone signals "required." Acceptable because `<FormLabel>` already includes the asterisk as text content; SR reads "First Name *". OK.

### 6. Focus management
- Radix-based Dialog/Sheet (`packages/ui/src/components/dialog.tsx`, `sheet.tsx`) PROPERLY traps focus and returns focus on close (radix native).
- 13 production Dialog usages identified — good.
- HOWEVER 13+ hand-rolled `<div fixed inset-0>` modals BYPASS radix and have:
  - No focus trap
  - No focus-return on close
  - No Esc-to-close
  - No `role="dialog"` / `aria-modal="true"` / `aria-labelledby`
- Skip-to-content: PRESENT in memberry (`__root.tsx:44`, `_authenticated.tsx:74`, `_authenticated/org/$orgSlug/officer.tsx:56`). MISSING in admin (`apps/admin/src/routes/__root.tsx`).
- Route-change focus restoration: `_authenticated.tsx` uses `AnimatePresence mode="wait"` + `motion.div key={location.pathname}` — page content is replaced but focus is NOT reset to `<main>` or to a `<h1>`. Screen-reader users won't get a "page changed" cue. ARIA-Live announcement of new route would help.

### 7. Keyboard nav gaps
- DropdownMenu (`packages/ui/src/components/dropdown-menu.tsx`) is radix — keyboard works out-of-box.
- Custom dropdown in `features/training/components/training-card.tsx:50-78` — `setMenuOpen((v) => !v)` opens a custom panel of `<a>` links. No Esc handler, no arrow-key nav, no outside-click handler. Hand-rolled.
- Table arrow-key navigation: NOT IMPLEMENTED anywhere. Tables in `features/membership/components/member-table.tsx`, `features/dues/components/payment-history-table.tsx`, etc. use standard `<table>` semantics (good) but no roving tabindex. Acceptable for static data tables; flag if interactive cell-edit is added.
- DragAndDrop keyboard alt: `fund-allocation-editor.tsx:55` uses move-up/down buttons (PASS). No traditional HTML5 drag-and-drop seen in features.

### 8. Touch targets
- `Button` default `size="icon"` = `h-9 w-9` (36px) per `packages/ui/src/components/button.tsx:35`. Below WCAG 2.5.5 AAA (44×44). Meets WCAG 2.2 AA 2.5.8 (24×24) — passes AA, fails AAA.
- Smaller overrides exist:
  - `features/profile/components/standing-meter.tsx:125` — `h-7 w-7` = 28px.
  - `features/comms/components/dm-list.tsx:77` — `h-7 w-7` icon-button.
  - Multiple `h-7 w-7` and `h-8 w-8` overrides — flag on mobile for tap accuracy.
- No `<button>` with `<svg>` only and zero padding found — Button component enforces padding via cva.

### 9. Image / icon a11y
- `<svg>` direct usage in TSX: 10 occurrences total, vs 22 `aria-hidden` occurrences. The product uses `lucide-react` (~95% of icons) which renders to `<svg>`. lucide-react does NOT default to `aria-hidden`. Verify whether the icons inside Buttons are intercepted by Button's `[&_svg]:pointer-events-none` — pointer events yes, but `aria-hidden` no. Most lucide icons inside a labeled `<Button>` are fine because the button provides the accessible name; standalone lucide icons (e.g. inline status indicators) need `aria-hidden="true"` or an `aria-label`.
- Worst:
  1. `features/dues/components/proof-upload-form.tsx:191` — `<CheckCircle className="h-4 w-4 text-green-600" />` standalone, no `aria-hidden`, no `aria-label`. SR reads "img" or nothing.
  2. `features/dues/components/dues-status-badge.tsx` — icons inside badges, similar pattern.
  3. `features/directory/components/trust-card.tsx:46` correctly uses `<ShieldCheck ... aria-label="Verified license" />` — good pattern to replicate.
- `<img>` alt: 14 instances scanned. Logos correctly have `alt="Memberry"`. Background image at `officer.tsx:79` correctly `alt=""`. Event covers `alt=""` — acceptable (event title is rendered separately). Avatars `alt=""` — see triage item #10.

### 10. Live regions
- `role="alert"` and `aria-live="polite"` are used in 15+ places (financial-dashboard, dues-invoice-list, payment-history-table, alert-banner, dues-gate-banner, etc.) — GOOD coverage in dues module.
- Sonner toaster (`sonner` lib) used at `apps/memberry/src/routes/__root.tsx:62` and `apps/admin/src/routes/__root.tsx:198`. Sonner internally uses `role="status"` (and `role="alert"` for errors). NOT directly verifiable by grep; rely on lib default.
- Loading skeletons: most use `<Skeleton>` from radix — no `role="status"` announcement. Status-distribution-chart, monthly-trend-chart, collections-area-chart, dues-status-card correctly add `role="status"` (good).
- Worst:
  1. `features/comms/components/dm-list.tsx` — new DM arrival is NOT announced via `aria-live`.
  2. Many tables show "Loading..." text without `aria-live`.
  3. Form submission success often only shows a toast (sonner handles it).

### 11. Heading hierarchy
- Memberry `<h1>` count: 26 occurrences, `<h2>`: 39, in routes only.
- 27 route files lack `<h1>` (see triage #6) — these rely on the route hierarchy header from a parent layout, but a parent layout `<h1>` was not found.
- Auth view (`auth/$authView.tsx:46`) has `<h1>Memberry</h1>` then `<h2>{title}</h2>` — brand-as-h1 anti-pattern (triage #6).
- 404 pages have `<h1>404</h1>` (triage #9).

### 12. Link affordance
- Tanstack Router `<Link>` is used heavily. Active state on memberry sidebar uses background + color change; admin sidebar uses `border-l-2` + bg color (good visual differentiation, plus `aria-current='page'`).
- Anchor styling in body text: `text-[var(--color-primary)] underline` patterns in PageHeader breadcrumbs. Many in-card links rely on color only — verify on a sample (e.g. `routes/_authenticated/my/billing.tsx`) for underline absence. Quick spot: `features/training/components/training-card.tsx:47` — link styled by color only on the title `<a>`. Not P0 since hovered/focused state changes, but body-text links should be underlined by default.

### 13. Reduced motion
- Memberry: `apps/memberry/src/styles/globals.css` has `@media (prefers-reduced-motion: reduce)` blocks. They scope to `--spring-bounce: 0; --spring-duration: 0.01s;` and `.animate-shimmer { animation: none !important; }`. Spring transitions go fast; CSS `transition-colors`, `transition-shadow`, framer-motion `AnimatePresence` are NOT explicitly disabled. Framer-motion respects `prefers-reduced-motion` by default ONLY if `MotionConfig reducedMotion="user"` is wrapped. NOT FOUND in this codebase.
- Admin: NO `prefers-reduced-motion` at all (triage #4).
- 250 `transition-*` / `animate-*` Tailwind class usages across memberry+admin features.
- Worst:
  1. `apps/admin/src/styles/globals.css` — full gap.
  2. `apps/memberry/src/routes/_authenticated.tsx:85-94` — page-transition `motion.div` without `MotionConfig`.
  3. `apps/memberry/src/components/motion/stagger-grid.tsx` — staggered list animations, no reduced-motion variant.

### 14. Language attribute
- `apps/memberry/index.html:2` — `<html lang="en">` ✓
- `apps/admin/index.html:2` — `<html lang="en">` ✓
- No `lang` attribute on dynamic content (e.g. user-provided org names that might be non-English). Acceptable for v1.

### 15. Skip links
- Present in memberry (3 instances: `__root.tsx:44`, `_authenticated.tsx:74`, `officer.tsx:56`).
- ABSENT in admin (triage #3).

---

## 3. Per-Module A11y Score (1-10)

Score model: 10 = WCAG AA fully verifiable from static analysis; 1 = pervasive failures across categories.

| Module | Path | Score | Notes |
|--------|------|-------|-------|
| m01 auth/onboarding | `routes/auth/$authView.tsx`, `routes/onboarding.tsx`, `routes/verify-email.tsx`, `routes/join.tsx`, `routes/invite/$token.tsx` | 6 | `<main>` present. Heading anti-pattern (brand-as-h1). Forms delegated to `@daveyplate/better-auth-ui` — opaque. |
| m02 profile | `features/profile/`, `features/person/`, `routes/_authenticated/my/profile.tsx` | 6 | shadcn Form pattern is correct. Icon buttons on avatar lack `aria-label` (P1). Touch-target h-7 on dismiss. |
| m05 membership | `features/membership/`, `features/chapters/` | 6 | Tables use `<table>` semantics. `text-gray-500` badges borderline. `member-table.tsx:46` removed status low contrast. |
| m06 dues | `features/dues/` | 7 | Best `aria-live` coverage in repo. `proof-upload-form.tsx` has good error `role="alert"`. Icon-only buttons in `special-assessments-list` and `fund-allocation-editor` missing `aria-label` (P1). |
| m07 comms | `features/comms/` | 6 | `<nav aria-label>` on lists. Good. Custom dropdowns in `training-card.tsx` missing keyboard handlers. `video-tile.tsx`/`video-grid.tsx` use `text-gray-400` (dark bg, likely OK). |
| m08 events | `features/events/`, `routes/discover/events.tsx`, `routes/events/$eventSlug.tsx`, `routes/_authenticated/org/$orgSlug/events/$eventId.tsx` | 6 | Event cards have `alt=""` on covers (correct decorative pattern). Calendar nav buttons properly aria-labeled. No `<h1>` on some routes. |
| m09 training | `features/training/`, `routes/_authenticated/org/$orgSlug/training/index.tsx` | 5 | `training-card.tsx` custom dropdown lacks keyboard nav. Form uses `<Label>` siblings (implicit). Status badges low contrast. |
| m10 credits / CPD | `routes/_authenticated/org/$orgSlug/my-cpd.tsx`, `officer/settings/cpd.tsx` | 5 | Route lacks `<h1>`. CPD tracking widgets not deeply audited. |
| m11 docs / certs | `features/documents/`, `features/certificates/`, `routes/verify/$credentialNumber.tsx` | 6 | Document upload uses hidden `<input type="file">` triggered by labeled button (OK). Certificate preview is read-only display. |
| m12 elections | `features/elections/` | 4 | 3 hand-rolled modals (nominee-picker, voting-ballot confirm, self-nomination) — all P0 focus-management failures. |
| m14 dashboard | `features/dashboard/`, `routes/_authenticated/dashboard.tsx`, `routes/_authenticated/org/$orgSlug/home.tsx` | 6 | `<section>` landmarks present. Stats use semantic markup. No `<h1>` on `home.tsx`. |
| m19 committee | (governance routes) `routes/_authenticated/org/$orgSlug/governance/index.tsx` | 5 | Route lacks `<h1>`. |
| m20 booking | `features/booking/`, `routes/_authenticated/my/bookings/` | 5 | Time-pickers (`DateTimePicker`) — opaque, not audited deeply. Forms use `<Label>`. |
| m21 billing | `routes/_authenticated/my/billing.tsx`, `features/dues/components/gateway-setup.tsx` | 6 | gateway-setup uses radix `Dialog` (good). Sonner toasts for confirmations. |

Range: min = 4 (m12 elections), max = 7 (m06 dues).

---

## 4. Cross-cutting Patterns

| Pattern | Files affected (count) | Single fix |
|---------|------------------------|------------|
| Hand-rolled `<div fixed inset-0 z-50>` modals bypassing radix Dialog | 13+ files across `features/elections/`, `routes/_authenticated/org/$orgSlug/officer/settings/providers.tsx`, `routes/org/$slug.tsx`, `apps/admin/src/routes/associations/`, `operators/index.tsx`, `feature-flags/index.tsx` | One sweep: migrate to `<Dialog>` from `@monobase/ui`. Will gain focus trap, Esc, return-focus, ARIA. |
| Icon-only buttons relying on `title=` or no label at all | `features/dues/components/special-assessments-list.tsx`, `features/dues/components/fund-allocation-editor.tsx`, `features/person/components/personal-info-form.tsx`, `features/comms/components/message-composer.tsx`, `features/comms/components/dm-list.tsx`, `features/training/components/training-card.tsx`, `features/surveys/components/survey-results.tsx`, `features/surveys/components/question-editor.tsx`, `admin/src/routes/surveys/index.tsx`, `admin/src/routes/associations/*` | Add a lint rule requiring `aria-label` when `<Button size="icon">` has no text child. ESLint plugin `jsx-a11y/control-has-associated-label` does this. |
| `text-gray-400` / `text-gray-500` on light bg | `features/dues/components/dues-status-badge.tsx`, `features/membership/components/member-table.tsx`, `features/membership/components/seat-management-panel.tsx`, `features/elections/components/election-list.tsx`, `features/elections/components/election-detail.tsx`, `features/surveys/components/survey-list.tsx`, `routes/_authenticated/my/training.tsx`, `admin/src/routes/surveys/index.tsx` | Codemod: replace `text-gray-500` → `text-gray-700` (or `--color-text-secondary`) on `bg-gray-100`. |
| Routes without `<h1>` | 27+ route files in memberry | Centralize via `<PageHeader>` pattern (already exists at `components/patterns/page-header.tsx`) — make it the canonical wrapper and audit all routes for adoption. |
| Standalone lucide icons (status indicators) without `aria-hidden` | `features/dues/components/proof-upload-form.tsx:191`, `features/dues/components/alert-banner.tsx:38`, `features/dues/components/dues-status-badge.tsx`, dozens more | Helper `<Icon>` wrapper that defaults `aria-hidden="true"`. |
| Custom dropdown menus (training-card, etc.) | `features/training/components/training-card.tsx`, similar patterns in other listing cards | Replace with `<DropdownMenu>` from `@monobase/ui`. |

---

## 5. Quick Wins (≤30 min each)

1. **Add skip-link to admin** — `apps/admin/src/routes/__root.tsx`. Copy memberry's pattern (`__root.tsx:42-49`). Add `id="main-content"` to `<main>` at line 196. Unlocks WCAG 2.4.1 for entire admin app.
2. **Add `aria-label` to admin `<nav>`** — `apps/admin/src/routes/__root.tsx:162`. One line.
3. **Add prefers-reduced-motion to admin globals.css** — Add 5-line `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }` block.
4. **Add `aria-label` to 4 personal-info-form buttons** — `apps/memberry/src/features/person/components/personal-info-form.tsx:222, 240`. "Upload avatar", "Remove avatar".
5. **Add `aria-label` to fund-allocation-editor remove button** — `apps/memberry/src/features/dues/components/fund-allocation-editor.tsx:90`. "Remove fund".
6. **Add `aria-label` to 4 special-assessments-list buttons** — lines 243, 247, 259, 273. Replace `title=` with `aria-label=` (or keep both).
7. **Fix 404 page heading hierarchy** — `apps/memberry/src/routes/__root.tsx:21-22` and `_authenticated.tsx` notFoundComponent. Promote "Page not found" to `<h1>`, demote "404" to decorative.
8. **Wrap framer-motion in MotionConfig** — `apps/memberry/src/routes/__root.tsx`. Add `<MotionConfig reducedMotion="user">` around `<Outlet />`. Auto-disables motion app-wide on user preference.
9. **Replace 3 election custom modals with `<Dialog>`** — `nominee-picker-dialog.tsx`, `voting-ballot.tsx:301-340`, `self-nomination-dialog.tsx`. Same scaffold (Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription). ~25 min each, highest a11y ROI.
10. **Fix `text-gray-500` on `bg-gray-100` badges** — global find/replace in 8 status-badge files. `text-gray-500` → `text-gray-700`. ~10 min.

---

## 6. CSS Audit

| Concern | Memberry | Admin |
|---------|----------|-------|
| `prefers-reduced-motion` | PARTIAL (`globals.css` — disables `.animate-shimmer` + scales `--spring-bounce`/`--spring-duration` only; does NOT blanket-disable `transition-colors`, `transition-shadow`, framer-motion `AnimatePresence`) | **MISSING ENTIRELY** |
| `:focus-visible` global ring | PRESENT (`globals.css` Section 10.5 — `:focus-visible { outline: 2px solid var(--color-primary-subtle); outline-offset: 2px; }` plus stronger ring for `button, a, input, select, textarea, [role="button"], [tabindex]`). EXCELLENT. | NOT VERIFIED — globals.css does not appear to define focus-visible. Inherits Tailwind's `focus-visible:ring-*` from `Button` cva at `packages/ui/src/components/button.tsx:14`. Acceptable but app-wide global ring stronger. |
| `color-scheme` meta tag | NOT FOUND in either `index.html`. Without `<meta name="color-scheme" content="light dark">`, system scrollbars / form controls may not pick up dark-mode preference. | Same. |
| Dark mode | `.dark` variant present in memberry tokens (sidebar tokens etc.). Admin uses `bg-[#2D2635]` hardcoded sidebar — not theme-token-driven. | Hardcoded |
| Forced-colors mode (Windows High Contrast) | NOT TESTED — no `@media (forced-colors: active)` rules. Most radix primitives handle it OK but custom modals will lose backgrounds. | Same. |
| Reduced transparency | No `@media (prefers-reduced-transparency)` rules. Backdrop blurs (`--surface-blur`, `--nav-blur`) play regardless. | Same. |

---

## Summary

- Foundation strong: radix-based primitives, skip-link in memberry, focus-visible CSS, lang attribute, mostly-good landmarks.
- Three concentrated weaknesses:
  1. **Hand-rolled modals** — 13+ files bypass radix, no focus trap. P0.
  2. **Icon-only buttons without `aria-label`** — recurring pattern in dues, profile, surveys.
  3. **Admin app lags behind memberry**: no skip-link, no `prefers-reduced-motion`, no `aria-label` on nav.
- Per-module range: 4 (elections) to 7 (dues).
- Biggest quick-win: migrate the 3 elections hand-rolled modals + 10 admin modals to `<Dialog>` — single mechanical fix removes the largest pool of P0 violations.

