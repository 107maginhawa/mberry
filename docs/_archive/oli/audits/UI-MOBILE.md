---
oli-version: "1.0"
based-on:
  - apps/memberry/src/**
  - apps/memberry/index.html
  - apps/memberry/tailwind.config.ts
  - packages/ui/src/components/**
last-modified: 2026-06-02T11:38:56Z
last-modified-by: mobile-auditor
viewport: 375px
---

# Memberry Mobile Audit — 375px viewport

## 1. VERDICT

**RESPONSIVE BUT ROUGH — 5.5 / 10**

Memberry is *not* desktop-with-stacked-mobile (a mobile shell exists and is real), but it's also not mobile-first. The member-facing surfaces (`/dashboard`, `/my/*`, bottom-nav routes) were designed for 375px — bottom tab bar, sticky mobile header, hamburger drawer, sidebar hidden behind `md:flex`. The officer/admin surfaces (`/org/$orgSlug/officer/**`) were designed for desktop and the mobile drawer was bolted on after: data-heavy tables, dialogs, multi-column grids, and icon-only `size="icon"` buttons (36×36) that drop below the 44×44 touch floor. Safe-area insets are absent everywhere, `inputMode` is never set (zero usages across 200+ inputs), and `type="tel"` is never used despite phone-input being a custom feature.

Net: a phone-only member can plausibly read, navigate, and pay dues. A phone-only officer cannot work efficiently — but the desktop sidebar collapses cleanly so the app at least *renders*, doesn't break the layout, and most tables horizontally scroll because the shared `<Table>` wraps in `overflow-auto` by default.

---

## 2. TOP 10 MOBILE-BREAKING FINDINGS

1. **Officer roster table has 9 columns at 14px / no card-fallback** — `apps/memberry/src/features/membership/components/member-table.tsx:235` (TableHeads at L245–252). At 375px it h-scrolls but unusable: name+status+dues+training+expiry+joined in one row. **Fix:** use the `DataTable.renderMobileCard` prop that already exists in `components/patterns/data-table.tsx:34`.

2. **Officer payments / invoices tables — no horizontal-scroll affordance** — `routes/_authenticated/org/$orgSlug/officer/finances/invoices.tsx:241`, `routes/_authenticated/org/$orgSlug/officer/finances/invoices/index.tsx:293`, `routes/_authenticated/org/$orgSlug/officer/finances/members.tsx:209`. Tables scroll via `<Table>`'s built-in `overflow-auto` but no gradient/shadow edge indicator — users won't discover the scroll. **Fix:** add right-edge mask on `<Table>` wrapper.

3. **`min-w-[700px]` and `min-w-[500px]` on member-facing tables** — `routes/_authenticated/my/training.tsx:131` (`min-w-[700px]`), `routes/_authenticated/my/credits/index.tsx:125` (`min-w-[500px]`). Forces horizontal scroll on every phone, including the member's own credit ledger which is a primary use case. **Fix:** card-stack at `<md`.

4. **17 Dialog usages, 0 Sheet usages outside layout** — every modal in `features/dues/`, `features/membership/`, `features/comms/`, `features/admin/`, `features/surveys/` is `<Dialog>` (centered, `max-w-lg`). On 375px Dialog still works (Sheet's `max-w-lg` collapses), but a slide-up bottom-sheet would be the right pattern for forms like `features/dues/components/refund-form.tsx`, `record-payment-form.tsx`, `features/comms/components/create-channel-dialog.tsx`. **Fix:** introduce a `ResponsiveSheet` primitive (Sheet `<md`, Dialog `≥md`).

5. **Icon-only buttons `size="icon"` = 36×36, below 44×44 touch floor** — defined in `packages/ui/src/components/button.tsx:27`. Used 50+ times across `features/dues/special-assessments-list.tsx:243,247,259,273`, `features/comms/dm-list.tsx:74`, `chat-thread.tsx:114`, `message-composer.tsx:86`, `features/surveys/survey-results.tsx:414,422`, etc. **Fix:** bump icon size to `h-11 w-11` (44px) at `<md` via a `size="icon-mobile"` variant.

6. **No safe-area inset anywhere** — `grep -rln 'safe-area\|pb-safe\|env(safe-area' src/` → 0 hits. Bottom nav `member-bottom-nav.tsx:23` is `fixed bottom-0` with `h-[var(--bottom-nav-height)]=68px`, but iOS home-indicator (34px) overlaps the bottom 34px of the nav. **Fix:** `pb-[env(safe-area-inset-bottom)]` on the nav and on the outermost layout, `viewport-fit=cover` in `index.html`.

7. **`inputMode` set 0 times; `type="tel"` set 0 times across all inputs** — `features/person/components/phone-input.tsx` is a custom phone field but doesn't pass `type="tel"` or `inputMode="tel"` to the underlying `<input>`. Same for currency inputs in `features/dues/components/dues-config-form.tsx` (no `inputMode="decimal"`). Result: numeric keyboard never auto-opens. **Fix:** add `inputMode` to phone, currency, OTP, ZIP fields.

8. **5+ `grid-cols-2` without breakpoint downshift inside dues / booking / governance** — `features/dues/components/special-assessments-list.tsx:312,371`, `features/dues/components/dues-config-form.tsx:225,260`, `features/booking/components/booking-event-editor.tsx:234`, `routes/_authenticated/org/$orgSlug/governance/index.tsx:61,66`, `routes/_authenticated/org/$orgSlug/officer/payments/$paymentId.tsx:61`. At 375px each column is ~170px — labels truncate, inputs cramp. **Fix:** `grid-cols-1 sm:grid-cols-2`.

9. **Booking widget grids are `grid-cols-4` always** — `features/booking/components/booking-widget.tsx:62,100` (`grid-cols-4`, `grid-cols-3`), `booking-widget-skeleton.tsx:16,28,61,71`. Time slots become 80px tiles with truncated time labels. **Fix:** `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`.

10. **Tooltip-only labels on icon buttons** — `features/dues/components/special-assessments-list.tsx:243` (`title="Edit"`), `:273` (`title="View Collection"`). Tooltips never fire on touch. `OrgIconRail` (`components/layout/org-icon-rail.tsx`) uses `<Tooltip>` for org names but is `hidden md:flex` (mobile uses `OrgPickerSheet`) so that one is safe — but the `special-assessments` row icons are exposed on mobile. **Fix:** visible labels or expand to a Sheet action menu on `<md`.

---

## 3. MOBILE PRIMITIVES INVENTORY

**Exists:**
- `MemberBottomNav` — `components/layout/member-bottom-nav.tsx` — fixed bottom tab bar, `md:hidden`, 44×44 touch targets, context-aware (personal vs org).
- `MemberSidebar` — `components/layout/member-sidebar.tsx:42` — `hidden md:flex`, doesn't render on mobile (bottom-nav replaces it).
- `OfficerMobileNav` — `components/layout/officer-mobile-nav.tsx` — sticky 48px header + `<Sheet side="left" w-[280px]>` drawer. Real mobile primitive, not stacked sidebar.
- `OfficerSidebar` — `components/layout/officer-sidebar.tsx` — `hidden md:flex`, drops out cleanly on mobile.
- `OrgPickerSheet` — `components/layout/org-picker-sheet.tsx` — bottom-sheet for org switching on mobile (desktop uses `OrgIconRail`).
- `NotificationDrawer` — `components/notification-drawer.tsx:192` — `Sheet side="right"` with `w-[400px] max-w-full`. Caps at viewport on 375px.
- `MemberHeader` — `components/layout/member-header.tsx:47` — different bg on mobile vs desktop (primary purple vs glass). Mobile-aware.
- `DataTable.renderMobileCard` — `components/patterns/data-table.tsx:34` — opt-in mobile card fallback prop. **Defined but unused anywhere.**
- `Sheet` (Radix-backed) — `packages/ui/src/components/sheet.tsx` — variants for top/bottom/left/right, `w-3/4 sm:max-w-sm` defaults.

**Gaps:**
- No `ResponsiveDialog` / `ResponsiveSheet` primitive (Dialog `≥md`, Sheet `<md`). Every form modal is centered Dialog.
- No `MobileTable` primitive — `DataTable.renderMobileCard` exists but every actual table uses raw `<Table>` (18 callsites in features, 11 in routes).
- No `MobileActionMenu` for icon-only row actions. Inline icon buttons everywhere.
- No safe-area utility (`pb-safe`, `pt-safe`) in `tailwind.config.ts` or `globals.css`.
- No mobile-tuned button size variant (`icon` is fixed h-9 w-9).
- `Input` default is `text-base` (16px) — *good*, no zoom-on-focus. But `text-sm` is sometimes overridden in field components — verify per usage.

---

## 4. TABLES AUDIT

| File:line | Cols | Wrapper | min-width | Mobile behavior |
|---|---|---|---|---|
| `features/membership/components/member-table.tsx:235` | 9 | `<Table>` (auto overflow) | none | h-scroll, no affordance, no card fallback |
| `features/dues/components/dues-invoice-list.tsx:80` | 6 | `<Table>` | none | h-scroll |
| `features/dues/components/payment-history-table.tsx:101` | 5–6 | `<Table>` | none | h-scroll |
| `features/dues/components/special-assessments-list.tsx` (table at row L243 area) | 5+ | `<Table>` | none | h-scroll + icon-only actions |
| `features/dues/components/report-results.tsx:77` | varies | `<Table className="border">` | none | h-scroll |
| `features/dues/components/top-unpaid-list.tsx:45` | 3–4 | `<Table>` | none | h-scroll |
| `features/training/components/completion-table.tsx:202` | 5+ | `<Table>` | none | h-scroll |
| `features/membership/components/seat-management-panel.tsx:163` | 4 | `<Table>` | none | h-scroll |
| `features/membership/components/category-editor.tsx:143` | 4 | `<Table>` | none | h-scroll |
| `features/membership/components/institutional-membership-table.tsx:125` | 5+ | `<Table>` | none | h-scroll |
| `features/admin/components/officer-management.tsx:109` | 5 | `<Table>` | none | h-scroll |
| `features/account/components/data-export.tsx:150` | 4 | `<Table>` | none | h-scroll |
| `features/chapters/components/affiliation-list.tsx:28` | 3–4 | `<Table>` | none | h-scroll |
| `features/communications/components/template-list.tsx` | 4 | `<Table>` | none | h-scroll |
| `features/surveys/components/survey-results.tsx` | varies | `<Table>` | none | h-scroll |
| `routes/_authenticated/my/training.tsx:131` | 6 | `<Table>` | **`min-w-[700px]`** | **forced h-scroll always** |
| `routes/_authenticated/my/credits/index.tsx:125` | varies | `<Table>` | **`min-w-[500px]`** | **forced h-scroll always** |
| `routes/_authenticated/org/$orgSlug/officer/finances/invoices.tsx:241` | 7 (incl checkbox) | `<Table>` | none | h-scroll |
| `routes/_authenticated/org/$orgSlug/officer/finances/invoices/index.tsx:293` | 5+ | `<Table>` | none | h-scroll |
| `routes/_authenticated/org/$orgSlug/officer/finances/members.tsx:209` | 5+ | `<Table>` | none | h-scroll |
| `routes/_authenticated/org/$orgSlug/officer/settings/providers.tsx:169` | 4 | `<Table>` | none | h-scroll |
| `routes/_authenticated/org/$orgSlug/officer/payments/$paymentId.tsx:72` | 4 | `<Table>` | none | h-scroll |
| `routes/_authenticated/org/$orgSlug/officer/roster/import.tsx:260` | varies | `<Table>` | none | h-scroll |
| `routes/_authenticated/org/$orgSlug/officer/documents/$documentId.tsx:221,276` | 4 | `<Table>` | none | h-scroll |
| `routes/_authenticated/org/$orgSlug/officer/reports/credits.tsx:111` | 5+ | `<Table>` | none | h-scroll |

**Summary:** 25 tables. The shared `<Table>` wraps in `overflow-auto` (good). **Zero use horizontal-scroll edge affordance**, **zero use `DataTable.renderMobileCard`**, **2 add `min-w-[700px]/500px`** which *forces* horizontal scrolling on phones (worse than the default).

---

## 5. TOUCH TARGET VIOLATIONS — per module

Counts are `size="icon"` (button.tsx → h-9 w-9 = 36×36) usages — each is a violation. Plus inline `h-7 w-7` / `h-6 w-6` clickable elements.

| Module | size="icon" / inline small clickables |
|---|---|
| m02 profile (`features/person/`) | 2 |
| m05 membership (`features/membership/`) | ~3 |
| m06 dues (`features/dues/`) | 6 (special-assessments alone: 4) |
| m07 comms (`features/comms/`) | 11 (dm-list, message-composer, chat-thread, thread-panel, message-reactions, call-controls, message-search) |
| m08 events / booking (`features/booking/`, `features/events/`) | 2 |
| m09 training (`features/training/`) | 1 |
| m12 elections / surveys (`features/surveys/`) | 7 (survey-results: 2; question-editor: 2; survey-list: 1; survey-builder: 2) |
| m15 admin (`features/admin/`) | 1 |
| m19 profile standing (`features/profile/`) | 1 |
| m21 dues fund allocation (`fund-allocation-editor.tsx`) | 2 |

**Total: ~36 inline `size="icon"` violations** + ~10 inline `h-6/h-7/h-8 w-X` clickables. Header / bottom-nav buttons explicitly use `min-w-[44px] min-h-[44px]` — those are fine.

---

## 6. PER-MODULE MOBILE SCORE

| Module | Score | Why |
|---|---|---|
| m01 auth (Better-Auth UI) | 7/10 | Inherits Better-Auth's mobile styles. Single-column flow. No custom mobile work needed. |
| m02 profile (`features/person/`, `/my/profile`) | 6/10 | Forms use `grid gap-4 md:grid-cols-2` (correct). Phone-input lacks `type="tel"`/`inputMode`. Avatar icon-only buttons at h-8 w-8. |
| m05 membership (officer roster, member detail) | 3/10 | 9-col member table at 14px, no card fallback. Member-detail uses `md:grid-cols-2` (good). Officer surface dominated by data tables. |
| m06 dues (member dues + officer config) | 4/10 | Member side: payment history table OK with h-scroll. Officer side: 6 inline `size="icon"` actions on assessment rows, multiple `grid-cols-2` without breakpoint, modals are Dialog not Sheet. |
| m07 comms (chat, DMs, channels) | 5/10 | Chat thread is single-column and scrollable. Icon-only composer/search/reaction buttons all under 44px. Video call controls (`call-controls.tsx`) are 24×24 icons in a row — needs bigger tap area for in-call. |
| m08 events (browse / detail / attendance) | 6/10 | Event-calendar `min-w-[180px]` on month label fine. Attendance QR scanner `max-w-[300px]` mx-auto (good). Event-form uses `sm:grid-cols-2` (good). |
| m09 training (member / officer training) | 4/10 | `routes/_authenticated/my/training.tsx:131` forces `min-w-[700px]` — primary member view requires horizontal scroll. Completion-table uses raw `<Table>`. |
| m10 credits (`/my/credits`) | 3/10 | `routes/_authenticated/my/credits/index.tsx:125` forces `min-w-[500px]`. Credit ledger is a frequent-touch member feature — should be card-stacked. |
| m11 docs (`/officer/documents/$documentId`) | 5/10 | Document tables h-scroll. PDF preview not audited but iframe likely OK. |
| m12 elections | 5/10 | Election-form uses `grid-cols-2` without breakpoint (`election-form.tsx:229,251`). Voting UI not deeply checked. |
| m19 committee / governance | 5/10 | `governance/index.tsx:61,66` uses `grid-cols-2` without breakpoint — committee cards cramp to ~170px on 375px. |
| m20 booking (host directory, widget) | 4/10 | `booking-widget.tsx:62,100` uses `grid-cols-4`/`grid-cols-3` for time slots without breakpoint. Tiles become unusably narrow. |
| m21 billing (Stripe Connect setup) | 6/10 | Gateway-setup is a Dialog form, single-column. Not heavily mobile-tested but no obvious 375px breakage. |

**Range: 3 / 10 (m05, m10) → 7 / 10 (m01 auth)**.
Member-facing modules average ~5; officer-facing modules average ~4.

---

## 7. TOP 5 MOBILE QUICK WINS — ranked by ROI

1. **Add `pb-[env(safe-area-inset-bottom)]` + `viewport-fit=cover`** — 2 file edits (`apps/memberry/index.html` meta tag, `member-bottom-nav.tsx:23` className). Fixes iOS home-indicator overlap across the entire app. ~5 minutes, app-wide.

2. **Card-stack the 2 forced `min-w` tables on member surfaces** — `routes/_authenticated/my/training.tsx:131` and `routes/_authenticated/my/credits/index.tsx:125`. Replace with `DataTable` + `renderMobileCard` (prop already exists at `components/patterns/data-table.tsx:34`). Removes the worst member-side mobile failure.

3. **Bump `size="icon"` to 44×44 at `<md`** — single edit in `packages/ui/src/components/button.tsx:27`. Change `icon: "h-9 w-9"` to `icon: "h-11 w-11 md:h-9 md:w-9"` (or add `size="icon-mobile"` variant). Fixes ~36 callsites at once. Risk: layout shift in tight desktop toolbars — verify in `features/comms/`.

4. **Add `inputMode` defaults to phone-input, currency-input, OTP forms** — touches `features/person/components/phone-input.tsx`, `features/dues/components/dues-config-form.tsx`, `record-payment-form.tsx`, `refund-form.tsx`. Opens correct mobile keyboard. ~6 file edits.

5. **Add `grid-cols-1 sm:grid-cols-N` downshift on the 5 known offenders** — `features/dues/components/dues-config-form.tsx:225,260`, `features/booking/components/booking-event-editor.tsx:234`, `routes/_authenticated/org/$orgSlug/governance/index.tsx:61,66`, `routes/_authenticated/org/$orgSlug/officer/payments/$paymentId.tsx:61`. Mechanical change; immediate readability win in officer flows.

---

## Additional notes

- `apps/memberry/index.html` viewport meta is correct: `width=device-width, initial-scale=1.0`, no `maximum-scale=1` (good — zoom not blocked).
- Tailwind `tailwind.config.ts` uses default breakpoints (`sm: 640, md: 768, lg: 1024, xl: 1280`). 219 responsive class lines across 200+ TSX files — responsive is a real practice, just inconsistent.
- `_authenticated.tsx:84` correctly uses `pb-[var(--bottom-nav-height)] md:pb-0` to reserve space for fixed bottom nav. Good.
- `_authenticated.tsx:88` content container uses `max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-7` — `px-5` (20px) on mobile is fine, not over-padded.
- DataTable component (`components/patterns/data-table.tsx`) uses `containerType: 'inline-size'` — container queries are wired in but not exploited by any caller.
- `notification-drawer.tsx:192` uses `w-[400px] max-w-full` — caps to viewport correctly. Good pattern.
- No `onContextMenu` / right-click dependencies found.
- One `onMouseEnter` usage (`features/surveys/components/question-renderers/rating-question.tsx`) — a star-rating hover preview, gracefully degrades on touch.
