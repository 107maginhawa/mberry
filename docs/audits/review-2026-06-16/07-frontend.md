# C7 — Frontend Review (apps/memberry)

Scope: apps/memberry (Vite + TanStack Router/Query + Radix/shadcn + `@monobase/sdk-ts`).
Method: structure map + risk-pattern grep, then targeted Reads. Findings grounded in real `file:line`.

Legend: `file:line` — **[Priority][Intra|Cross]** problem. Why. Fix.
Priority: P0 (broken/unsafe) · P1 (should fix) · P2 (polish).

## Clean / passed checks (no findings)
- `dangerouslySetInnerHTML`: **0 occurrences** app-wide. No raw-HTML injection sink.
- Announcement body renders as JSX text, not HTML — `features/communications/components/announcement-content.tsx` renders `{ann.content}` inside `<div className="whitespace-pre-wrap">`. Safe; React escapes. No XSS.
- `useToast` (shadcn): **0 occurrences** — toasts use `sonner` (`toast.success(...)`) per CLAUDE.md. Compliant.
- `/login` route refs: **0** — auth uses `/auth/sign-in` / `/auth/sign-up` everywhere (matches convention).
- No tokens/secrets in `localStorage` — only non-sensitive keys (org id, unread counts, dismiss flags, export rate-limit timestamp). Acceptable.
- `<ErrorBoundary>` exists (`components/patterns/error-boundary.tsx`) and wraps `_authenticated.tsx:93` and officer shell `officer.tsx:75`. Class boundary with `componentDidCatch`.

---

## A11y

### `features/directory/components/trust-card.tsx:35` — **[P1][Intra]** member photo `<img ... alt="">`
Real member avatar marked decorative (`alt=""`), so screen readers announce nothing for a meaningful person image. Same pattern in `directory-search.tsx:51` and `member-profile.tsx:114`.
Why: photo conveys identity; empty alt drops it for AT users.
Fix: `alt={profile.displayName}` (and the fallback initials div should get `aria-hidden` or `aria-label`).
```tsx
<img src={profile.photoUrl} alt={profile.displayName} className="w-11 h-11 rounded-full object-cover" />
```
Note: `verify/$id.tsx:249` already does this correctly (`alt={holder.displayName}`) — use as the reference. Logos with `alt="Memberry"` and the bg decoration `officer.tsx:80 alt=""` are correct as-is.

### Icon-only buttons rely on `title=` / nothing instead of `aria-label` — **[P1][Intra]**
`size="icon"` buttons across the app lack an accessible name. Examples:
- `features/dues/components/special-assessments-list.tsx:256,260,272,286` — `<Button size="icon" ... title="Edit">`. `title` is a tooltip, not a reliable accessible name (not exposed by all AT, not keyboard-discoverable).
- `features/surveys/components/question-editor.tsx:125,159`, `survey-list.tsx:221`, `survey-results.tsx:421,429`
- `features/comms/components/message-composer.tsx:87`, `training/components/training-card.tsx:56`, `documents/components/document-library.tsx:126`, `dues/components/fund-allocation-editor.tsx:58,90`, `elections/components/election-form.tsx:308`, `election-detail.tsx:379`, `events/components/event-card.tsx:115`.
Why: icon-only control with no text → AT announces "button" with no purpose.
Fix: add `aria-label` to every icon-only button (keep `title` for sighted tooltip).
```tsx
<Button size="icon" variant="ghost" aria-label="Edit assessment" title="Edit" onClick={...}>
```
Positive reference: filter selects already do this — `events/components/event-list.tsx:139` and `training/components/training-list.tsx:176` set `aria-label="Filter ... by type"` on `SelectTrigger`.

### `features/dues/components/payment-history-table.tsx:113` — **[P1][Intra]** clickable `<TableRow onClick>` not keyboard-operable
Row navigates on click but has no `role="button"`/`tabIndex`/`onKeyDown`, so keyboard users can't reach or activate it. Also uses `window.location.assign(...)` → full-page reload (see Perf).
Why: mouse-only navigation; fails keyboard + SR operability.
Fix: make the receipt # / name cell a real `<Link>`, or add row semantics:
```tsx
<TableRow role="button" tabIndex={0}
  onClick={go}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }}>
```
Best: wrap a cell in TanStack `<Link to="/org/$orgSlug/officer/payments/$id">` for built-in a11y + client nav.

### Color-only status signaling — **[P2][Intra]**
`announcement-content.tsx` STATUS_BADGE maps states to `bg-green-100/text-green-800`, `bg-red-100/text-red-800`, etc. These badges DO include a text label (`Sent`, `Failed`) so they pass — good. Audit `DuesStatusBadge` (used in `payment-history-table.tsx:120`) to confirm it ships a text label, not just a colored dot; if dot-only, add visible/`sr-only` text.

### Heading order — **[P2]** spot-check
`announcement-content.tsx` uses `<h2>` for body under a `PageShell title` — verify PageShell renders `<h1>` so order is h1→h2 (no skipped levels). Low risk; confirm in `components/patterns/page-shell.tsx`.

---

## Security (frontend)
- No `dangerouslySetInnerHTML`, no `react-markdown`/`marked`/`DOMPurify` rendering of user content. Announcement, DM, chat, and message bodies all render through JSX text interpolation (React-escaped). **No XSS sink found.**
- `localStorage` use is non-sensitive (no auth tokens). Better-Auth manages session via cookies, not JS-readable storage.
- **[P2][Cross]** `data-export.tsx:42,93` enforces an export rate-limit purely client-side via `localStorage` (`RATE_LIMIT_KEY`). Trivially bypassed (clear storage). Ensure the **server** also rate-limits the export endpoint; treat the client check as UX-only.

---

## Performance

### Search inputs query on every keystroke (no debounce) — **[P1][Intra]**
- `features/directory/components/directory-search.tsx:19-25` — `useQuery({ ...searchDirectoryOptions({ query: { q: search } }) })` keyed directly on `search`; every character fires a directory search request.
- `features/membership/components/member-table.tsx:153` — same: `onChange={(e) => setSearch(e.target.value)}` feeds the list query with no debounce.
- `features/training/components/training-list.tsx:171` — same.
Why: N requests per typed word; server load + flicker + race conditions.
Fix: debounce the value before it hits the query key (300ms), as already done well in `features/comms/components/message-search.tsx:28-45` (debounced state + `enabled: query.length >= 2`). Reuse that pattern:
```tsx
const debounced = useDebouncedValue(search, 300)
const { data } = useQuery({ ...searchDirectoryOptions({ query: { q: debounced || undefined } }), enabled: debounced.length === 0 || debounced.length >= 2 })
```

### No list virtualization anywhere — **[P2][Intra]**
`useVirtual` / `react-window` / `@tanstack/react-virtual`: **0 occurrences**. Member directory, member-table, payment history, completion-table, document-library render full result sets. member-table paginates (`PAGE_SIZE`) so OK; but directory-search and chat/DM message lists are unbounded. For large orgs (member directories, long message threads) add virtualization. Low priority until datasets grow — confirm pagination caps server-side.

### Index-based keys on dynamic rows — **[P2][Intra]**
Most `key={i}` are on static skeletons (fine). Real-data offenders to fix:
- `features/dues/components/report-results.tsx:100` — `<TableRow key={i}>` over fetched report rows.
- `features/dues/components/fund-allocation-editor.tsx:54` & `dues-config-form.tsx:327` — editable rows keyed by index → wrong row reconciles on insert/delete/reorder, can corrupt controlled inputs.
- `features/booking/components/booking-widget.tsx:71` — `key={index}` on slot list.
Why: index keys break React identity on reorder/removal → stale state, focus loss.
Fix: key by a stable id (`row.id`, `fund.id`, `slot.startTime`).

### `window.location.assign` for in-app nav — **[P1][Cross]**
`payment-history-table.tsx:113` navigates via `window.location.assign(...)` → full document reload, drops SPA state, refetches everything, loses scroll. Use TanStack Router `<Link>`/`navigate()`.

### Pervasive `(x: any)` in `.map()` — **[P2][Cross]**
`directory-search.tsx:47`, `trust-directory.tsx:134`, `member-table.tsx:168`, `attendance-view.tsx:163`, `completion-table.tsx:230`, `member-dashboard.tsx:50`, `affiliation-list.tsx:39`, etc. Not a runtime bug, but defeats the generated `@monobase/sdk-ts` types — field renames in the spec won't surface as compile errors (silent blank cells). Replace `any` with `DirectoryProfile`/generated row types (directory-search already imports `DirectoryProfile` but then maps `(p: any)`).

---

## Responsive
- Tables use shadcn `<Table>` (ships an `overflow-auto` wrapper) — horizontal scroll on narrow screens is handled by the primitive. Spot-confirm `completion-table.tsx`, `officer-management.tsx`, `survey-results.tsx` actually wrap (these are wide). **[P2]**
- Hardcoded `w-[...]px` are mostly `min-w`/`max-w` bounds and skeletons (acceptable). Watch:
  - `components/notification-drawer.tsx:191` `w-[400px] max-w-full` — `max-w-full` saves it on mobile. OK.
  - `features/directory/components/trust-directory.tsx:81` `w-[220px]` aside is gated `hidden lg:block`. OK.
- No fixed-pixel page layouts found; layout is flex/grid + container queries (`globals.css:292,295`). Responsive posture is reasonable.

---

## Patterns / Cross
- Toasts: `sonner` everywhere. ✓
- Auth route `/auth/sign-in`. ✓
- Query error/loading handling: generally present (`isLoading`, `error` branches in directory-search, announcement page renders a `role="alert"` error block). **[P2]** Audit list components that destructure only `data` (e.g. `profiles = data?.data ?? []`) without an `error` branch → on failure they render an empty grid indistinguishable from "no results" (directory-search handles it; some `(p:any)` maps elsewhere may not). Ensure every primary query surfaces an error state, not a silent blank.
- Optimistic mutations: invoice "mark as paid" (`officer/finances/invoices/index.tsx:118`) clears selection + invalidates on success — confirm rollback on error (toast + restore selection) so a failed bulk action doesn't leave UI in a falsely-cleared state. **[P2][Cross]**

---

## Testing / E2E coverage
E2E lives in `apps/memberry/tests/e2e/` (Playwright). Strong coverage already: `auth.spec.ts`, `auth/*` (otp, session, claim, expiry, password-reset), `billing.spec.ts`, `profile.spec.ts`, `security.spec.ts`, `cross-org-isolation.spec.ts`, `cross-persona/*` (election tally, dues receipt, event rsvp, application approval, suspend→lockout), `member/*` (events, documents, data-export, capacity, pay-token, gateway-error), `_a11y.spec.ts`. Many `stubs/*` are placeholders.

Gaps — highest-value missing real-flow E2E:
1. **Member search/directory flow** — no spec drives `directory-search` typing → results → open profile. This is the path with the debounce + alt-text + `any`-type risks above; untested end-to-end.
2. **Announcement read flow (member)** — `announcements/$announcementId` (load → render content → back). Comms Wave 4b ships announcements but no E2E exercises the member detail view / error + not-found states.
3. **Officer payment-history → payment detail navigation** — the clickable-row flow (`payment-history-table` → `/officer/payments/$id`). Currently mouse-only + full reload; no test covers keyboard activation or the navigation itself.

(Secondary: training search/filter; bulk "mark invoices paid" optimistic rollback on failure.)

---

## Top 3 Critical (C7)
1. **P1 — Un-debounced search queries** (`directory-search.tsx:19`, `member-table.tsx:153`, `training-list.tsx:171`): fire a request per keystroke. Reuse the existing `message-search.tsx` debounce pattern. Highest real-cost, easy fix.
2. **P1 — Icon-only buttons + meaningful member `<img alt="">` lack accessible names** (special-assessments-list, survey/question editors, message-composer, etc.; `trust-card.tsx:35`, `directory-search.tsx:51`, `member-profile.tsx:114`): screen-reader users get unlabeled controls and unannounced people. Add `aria-label` / real `alt={displayName}`.
3. **P1 — Clickable `<TableRow>` is mouse-only + full page reload** (`payment-history-table.tsx:113`): no keyboard/role + `window.location.assign` drops SPA state. Convert to TanStack `<Link>` (fixes a11y + perf together).
