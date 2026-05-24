# Wave 0a UI Audit Report

**Date:** 2026-05-23
**Scope:** 16 Wave 0a files (layout, providers, routes, dashboard components, auth pages)
**Baseline:** 8-pillar adversarial audit, post-fix verification (commit 63e4515)
**Method:** Code-only (no dev server screenshots)

---

## Health Score Summary

| # | Category | Score | Key Finding |
|---|----------|-------|-------------|
| 1 | Form Composition | 3/4 | Forms use react-hook-form + zod properly; onboarding uses `document.querySelectorAll('form')` anti-pattern |
| 2 | Accessibility | 2/4 | Good ARIA on org-icon-rail; notification bell link and bottom nav items lack min touch targets; dropdown is custom div, not ARIA listbox |
| 3 | Responsive Design | 3/4 | Desktop/mobile split is well-handled; no tablet breakpoint awareness in dashboard grid |
| 4 | Loading & Error States | 3/4 | Skeleton, empty state, and error states present in dashboard; OrgProvider spinner verified; some dashboard queries have no loading UI |
| 5 | Component Library Usage | 3/4 | Consistently uses @monobase/ui primitives; member-header dropdown is a raw div instead of DropdownMenu/Popover |
| 6 | Design Token Compliance | 2/4 | No hardcoded hex colors; many hardcoded px values in arbitrary Tailwind; Tailwind semantic color classes (bg-gray-*, text-red-*) used instead of CSS vars |
| 7 | Data Patterns | 3/4 | Empty states handled; no pagination on dashboard queries; no optimistic updates on cancel/leave |
| 8 | Interaction Patterns | 3/4 | Toast feedback via sonner; Escape handler verified on dropdown; no dirty-form warning on onboarding |

**Overall: 22/32**

---

## Verification of Recent Fixes (commit 63e4515)

| Fix | Status | Evidence |
|-----|--------|----------|
| #554B68 replaced with var(--color-primary) | PASS | Grep for hex colors in src/*.tsx returns 0 matches |
| Typography migrated from text-[Npx] to tokens | PARTIAL | text-[0.625rem] still used in 7 locations (badge/label micro-text); text-[26px], text-[28px], text-[30px], text-[22px] remain in non-Wave-0a files |
| Status colors use CSS vars | PASS | alert-banner, action-widget, org-picker-sheet all use var(--color-success/warning/error/info) |
| OrgProvider has spinner instead of null | PASS | OrgProvider.tsx:84-88 renders animate-spin div with border-[var(--color-primary)] |
| OrgIconRail has empty state | PASS | org-icon-rail.tsx:46-57 renders dashed Plus button with aria-label |
| Member header has Escape handler | PASS | member-header.tsx:52-53 adds keydown listener for Escape |
| Mobile logo has width/height | PASS | member-header.tsx:72 has width={96} height={24} |

---

## Detailed Findings

### Category 1: Form Composition (3/4)

**What works:**
- PersonalInfoForm and AddressForm use react-hook-form + zodResolver with proper FormField/FormControl/FormMessage wrappers
- Onboarding multi-step form preserves data across steps via state

**Findings:**

- **P2 | onboarding.tsx:288,314** — `document.querySelectorAll('form')` is a DOM escape hatch. The submit buttons use `form="step-1-form"` attribute but then also manually query DOM. If another form is mounted on the page, this selects the wrong one. Fix: Remove the onClick handler and rely solely on `type="submit" form="step-1-form"`.
- **P3 | onboarding.tsx** — No form-level error summary. If createPerson.mutate fails, error feedback relies on the meta toast, which is good, but there's no inline error display on the card itself.
- **P3 | organizations.tsx:183-184** — Transfer dialog Input has no aria-describedby linking to help text. The Label and Input are siblings but not explicitly connected via htmlFor/id.

### Category 2: Accessibility (2/4)

**What works:**
- Skip-to-content link on _authenticated.tsx:44-49
- org-icon-rail: aria-label on all buttons, aria-current on active, nav landmark with aria-label
- alert-banner: role="alert" on container, aria-hidden on icons
- action-widget: role="img" + aria-label on status dots, sr-only duplicate for screen readers
- CreditRing SVG: role="img" + aria-label

**Findings:**

- **P0 | member-header.tsx:180-190** — Notification bell is a Link with only an icon (Bell). No aria-label or sr-only text. Screen readers announce it as an empty link. Fix: Add `aria-label="Notifications"`.
- **P0 | member-header.tsx:106-119** — Desktop dropdown menu is a raw `<div>` toggled by state. No ARIA `role="menu"`, no `role="menuitem"` on children, no `aria-expanded` on trigger, no keyboard arrow navigation. This is a custom dropdown without any ARIA menu pattern. Fix: Replace with shadcn DropdownMenu or add full ARIA menu roles.
- **P1 | member-bottom-nav.tsx:13-25** — Bottom nav link touch targets are not explicitly sized. The Link elements contain an icon (22px) + text (text-xs) with gap-[3px] and no padding. Total touch area is likely under 44x44px on mobile. Fix: Add `min-h-[44px] min-w-[44px]` or `p-2` to each link.
- **P1 | member-header.tsx:86-101** — Mobile org avatar button is `p-0` with a small avatar inside. Touch target depends on avatar size, likely under 44px. Fix: Add min-w-[44px] min-h-[44px].
- **P1 | org-picker-sheet.tsx:95-98** — Status dots (w-1.5 h-1.5 = 6px) are color-only indicators with no text/shape alternative visible inline. The STATUS_LABEL text is nearby (good), but the dot alone could be missed. Partial mitigation exists.
- **P2 | member-sidebar.tsx** — Desktop sidebar logo img (`/memberry-logo.png`) has no width/height attributes (contrast with mobile logo which was fixed). Fix: Add explicit width/height.
- **P2 | verify-email.tsx:60-61** — Icon circle uses `bg-blue-100` and `text-blue-600` (hardcoded Tailwind colors instead of semantic tokens).
- **P3 | member-header.tsx:122-165** — Dropdown items are Buttons (good for keyboard), but no `role="menu"`/`role="menuitem"` markup, no focus trapping inside dropdown.

### Category 3: Responsive Design (3/4)

**What works:**
- Layout splits well: OrgIconRail + MemberSidebar hidden on mobile (`hidden md:flex`), MemberBottomNav shown only on mobile (`md:hidden`)
- MemberHeader adapts: colored bar on mobile, neutral on desktop, different avatar behaviors
- OrgPickerSheet provides mobile-specific bottom sheet for org switching
- Dashboard grid uses `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` for org cards
- Content area has `pb-[var(--bottom-nav-height)] md:pb-0` to avoid bottom nav overlap

**Findings:**

- **P2 | dashboard.tsx:254** — Action widgets grid is `grid-cols-1 sm:grid-cols-3`. Jumps from 1 col to 3 cols with no intermediate. On tablets (768px), 3 narrow widgets may feel cramped. Fix: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- **P2 | quick-actions.tsx:57** — Quick actions grid is `grid-cols-3 md:grid-cols-6`. On mobile, 3 columns with text labels can be tight on very small screens (320px). Consider `grid-cols-2 sm:grid-cols-3 md:grid-cols-6`.
- **P3 | events.tsx:260** — Events grid uses `sm:grid-cols-2 lg:grid-cols-3` which is good, but the wrapping div has `p-6` which combined with the parent layout's `px-5 md:px-6` creates double padding.

### Category 4: Loading & Error States (3/4)

**What works:**
- Dashboard: membershipsQuery.isLoading shows CardSkeleton
- OrgProvider: spinner while org resolves (verified)
- Events page: full skeleton grid during loading, error state with EmptyState, empty state per filter
- Organizations page: ListSkeleton during loading, EmptyState when no memberships
- Dashboard action widgets: errorMessage prop renders role="alert" error card
- credit-breakdown and org-announcements: error states with role="alert" aria-live="polite"

**Findings:**

- **P2 | dashboard.tsx** — Action widgets (Dues, CPD Status, Next Event) have no loading skeleton. When `invoicesQuery`, `creditSummaryQuery`, etc. are loading, the widgets render with `value=""` or `value="Paid"` immediately, which can flash incorrect content before real data arrives. Fix: Add isLoading check to ActionWidget or show CardSkeleton.
- **P2 | dashboard.tsx:356-491** — OrgCard makes its own `useQuery(['officer-role', orgId])` but has no loading state for the officer badge. It renders `null` while loading, which is fine, but the card layout shifts when the badge appears. Fix: Show skeleton or reserve space.
- **P3 | member-header.tsx:36-43** — Notification count query has no error handling. If it fails, it silently shows 0. Could flash a broken state. Low severity since 0 is a reasonable fallback.

### Category 5: Component Library Usage (3/4)

**What works:**
- Buttons, Badge, Sheet, Dialog, Card, Progress, Input, Label, Tooltip all from @monobase/ui
- Alert/AlertDescription used in verify-email
- ConfirmDialog pattern for destructive actions (leave org)
- AvatarInitials as a reusable pattern component
- GlassCard as a motion-enhanced wrapper

**Findings:**

- **P1 | member-header.tsx:122-165** — Desktop org dropdown is a manually built `<div>` with click-outside and Escape handlers. This should be a shadcn `DropdownMenu` or `Popover` component which provides ARIA roles, keyboard navigation, focus trapping, and animation for free. The current implementation lacks proper menu semantics.
- **P2 | events.tsx:214-229** — The Upcoming/All toggle uses two `Button` components to simulate a tab/segmented control. This should be shadcn `Tabs` or a custom `SegmentedControl` component for proper `role="tablist"` semantics.
- **P3 | onboarding.tsx:224** — Background uses `bg-gray-50` (Tailwind color) instead of `bg-background` or `bg-[var(--color-surface)]`. Same for verify-email.tsx `bg-background` (OK) vs pay/$token.tsx `bg-gray-50` (not OK, but outside Wave 0a scope).

### Category 6: Design Token Compliance (2/4)

**What works:**
- All hex colors removed (verified: 0 matches)
- CSS custom properties used extensively: --color-primary, --color-surface, --color-muted, --color-border-light, --color-error, --color-success, --color-warning, --color-info
- Spacing mostly uses Tailwind scale (gap-2, p-4, py-3, etc.)
- Border radius uses --radius-md, --radius-sm in some places
- Shadow uses --shadow-soft token

**Findings:**

- **P1 | action-widget.tsx:21** — `neutral: 'bg-gray-400'` uses Tailwind's gray palette instead of a CSS var. Fix: Use `bg-[var(--color-muted)]` or define a --color-neutral token.
- **P1 | action-widget.tsx:37-40** — Error state uses `text-red-400`, `text-red-600`, `border-red-200/60`. These should be `text-[var(--color-error)]` and `border-[var(--color-error)]` for theme consistency.
- **P1 | credit-breakdown.tsx:30, org-announcements.tsx:32** — `text-red-600` instead of `text-[var(--color-error)]`.
- **P1 | verify-email.tsx:60-61** — `bg-blue-100`, `text-blue-600` hardcoded Tailwind colors instead of semantic tokens.
- **P1 | onboarding.tsx:224** — `bg-gray-50` instead of token.
- **P1 | onboarding.tsx:231** — `text-gray-600` instead of `text-[var(--color-muted)]`.
- **P1 | organizations.tsx:143** — `hover:border-red-300 hover:text-red-600 hover:bg-red-50` on Leave button. Should use error CSS vars.
- **P1 | events.tsx:24-29** — Registration status badges use hardcoded Tailwind colors (`bg-emerald-100 text-emerald-800`, `bg-amber-100 text-amber-800`, etc.) instead of CSS var tokens. This is a semantic mapping that should use the app's status color system.
- **P1 | events.tsx:136** — Cancel button uses `text-red-600 border-red-200 hover:bg-red-50` instead of error tokens.
- **P2 | text-[0.625rem]** — Used 7 times across Wave 0a files for micro-text (badge labels, notification count). This is a hardcoded font size not in the Tailwind scale. Consider defining a `text-micro` utility in the theme.
- **P2 | Multiple files** — Hardcoded px values in arbitrary Tailwind brackets: `w-[34px]`, `h-[34px]`, `rounded-[12px]`, `rounded-[8px]`, `rounded-[16px]`, `max-w-[120px]`, `-left-[10px]`, `w-[3px]`, `h-[20px]`, `min-w-[16px]`, `min-h-[130px]`. These should map to design tokens (e.g., --rail-icon-size, --radius-lg) or standard Tailwind scale values.

### Category 7: Data Patterns (3/4)

**What works:**
- Dashboard: empty states for memberships, events, announcements, credits
- Events page: filter between upcoming/all with appropriate empty state per filter
- Organizations: empty state with CTA to find organizations
- Dashboard queries use `retry: false` to avoid hammering failing endpoints

**Findings:**

- **P2 | dashboard.tsx:45-52** — Memberships query fetches all with no pagination. For users with many orgs, this could be slow. Similarly, invoicesQuery loops through all orgIds sequentially (line 88-98), which is O(n) API calls.
- **P2 | events.tsx:175-177** — `listMyCustomEventsOptions()` fetches with no explicit limit. Default may return all events. Should paginate or set a reasonable limit.
- **P3 | organizations.tsx:196-222** — Transfer mutation has no optimistic update or query invalidation on success. The `queryClient.invalidateQueries` exists for leave but is missing in the transfer success handler.
- **P3 | events.tsx:63-72** — Cancel mutation invalidates query on success (good) but has no optimistic update for instant UI feedback.

### Category 8: Interaction Patterns (3/4)

**What works:**
- Toast feedback via sonner on: leave org, transfer request, resend verification email, profile creation
- Escape key closes header dropdown (verified)
- ConfirmDialog for destructive leave action with variant="destructive"
- Cancel button on events shows Loader2 spinner during isPending
- Onboarding: disabled buttons during createPerson.isPending

**Findings:**

- **P2 | onboarding.tsx** — No dirty-form warning. If user fills step 1, navigates to step 2, and hits browser back, all data is lost without warning. Fix: Add `useBeforeUnload` or `onBeforeRouteLeave` with a dirty check.
- **P2 | member-header.tsx:122-165** — Desktop dropdown has no focus management. When opened, focus stays on the trigger button. User must Tab to reach dropdown items. Fix: Auto-focus first item on open, trap focus within dropdown.
- **P3 | organizations.tsx:124** — "Pay Dues" button on grace/lapsed members has `onClick={(e) => { e.preventDefault(); e.stopPropagation() }}` which does nothing. No navigation, no toast, no action. This is a dead button. Fix: Navigate to dues page or show a toast explaining what to do.
- **P3 | member-header.tsx** — No loading indicator for the notification count. The bell icon shows 0 initially, then pops to the real number. Could benefit from a brief skeleton or fade-in.

---

## Top 5 Priority Fixes

| # | Severity | Issue | File:Line | Fix |
|---|----------|-------|-----------|-----|
| 1 | P0 | Notification bell has no accessible name | member-header.tsx:180 | Add `aria-label="Notifications"` to the Link |
| 2 | P0 | Desktop org dropdown lacks ARIA menu roles | member-header.tsx:106-165 | Replace raw div with shadcn DropdownMenu or add role="menu", role="menuitem", aria-expanded |
| 3 | P1 | Bottom nav touch targets under 44px | member-bottom-nav.tsx:14-24 | Add `min-h-[44px] min-w-[44px] justify-center` to each Link |
| 4 | P1 | Hardcoded Tailwind colors (red-*, gray-*, blue-*) instead of CSS vars | action-widget.tsx:21,37-40; verify-email.tsx:60-61; onboarding.tsx:224,231; events.tsx:24-29; organizations.tsx:143 | Replace with var(--color-error), var(--color-muted), var(--color-info-bg) equivalents |
| 5 | P1 | Custom dropdown instead of DropdownMenu primitive | member-header.tsx:106-165 | Use shadcn DropdownMenu for keyboard nav, focus trap, ARIA, animation |

---

## Files Audited

```
apps/memberry/src/components/layout/org-icon-rail.tsx
apps/memberry/src/components/layout/org-picker-sheet.tsx
apps/memberry/src/components/layout/member-header.tsx
apps/memberry/src/components/layout/member-sidebar.tsx
apps/memberry/src/components/layout/member-bottom-nav.tsx
apps/memberry/src/providers/OrgProvider.tsx
apps/memberry/src/routes/_authenticated.tsx
apps/memberry/src/routes/_authenticated/dashboard.tsx
apps/memberry/src/features/dashboard/components/alert-banner.tsx
apps/memberry/src/features/dashboard/components/quick-actions.tsx
apps/memberry/src/features/dashboard/components/action-widget.tsx
apps/memberry/src/features/dashboard/components/org-announcements.tsx
apps/memberry/src/features/dashboard/components/credit-breakdown.tsx
apps/memberry/src/routes/auth/$authView.tsx
apps/memberry/src/routes/verify-email.tsx
apps/memberry/src/routes/onboarding.tsx
apps/memberry/src/routes/_authenticated/my/organizations.tsx
apps/memberry/src/routes/_authenticated/my/events.tsx
```
