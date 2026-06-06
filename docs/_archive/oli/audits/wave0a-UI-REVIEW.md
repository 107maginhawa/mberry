# Wave 0a -- UI Review

**Audited:** 2026-05-23
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists)
**Screenshots:** Captured (login page only -- authenticated views blocked by auth gate, code-only audit for inner pages)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Generic error copy ("Something went wrong") and "Login" label instead of "Sign in" |
| 2. Visuals | 3/4 | Strong glass-morphism system, but OrgProvider renders null during load (flash) |
| 3. Color | 2/4 | Hardcoded hex #554B68 in 4 files bypasses design token system; Tailwind palette colors (emerald/amber/red) mixed with CSS vars |
| 4. Typography | 2/4 | 9+ distinct pixel-based font sizes bypass the typography scale; dual system (text-h4 tokens AND text-[14px] literals) |
| 5. Spacing | 3/4 | Consistent Tailwind spacing in layout, but 213 arbitrary bracket values across 30 files |
| 6. Experience Design | 3/4 | Good state coverage (loading, error, empty), but OrgProvider shows nothing during load and no confirmation on destructive org-leave |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **Hardcoded #554B68 in auth/branding files** -- Breaks token-based theming; any palette change requires 4-file grep-and-replace instead of 1 CSS var update -- Replace with `text-[var(--color-primary)]` in `auth/$authView.tsx:47`, `verify-email.tsx:55`, `onboarding.tsx:228`, `main.tsx:26`
2. **OrgProvider renders null while loading** -- Users see blank white flash on every org-scoped page load before content paints -- Add a skeleton/spinner fallback at `OrgProvider.tsx:84` instead of `return null`
3. **Typography dual system: 9+ hardcoded pixel sizes** -- `text-[10px]` through `text-[24px]` used alongside semantic tokens (text-h4, text-body-sm), creating unmaintainable sprawl -- Consolidate to semantic tokens only; map each pixel size to a token

---

## Detailed Findings

### Pillar 1: Copywriting (2/4) -- WARNING

**Generic error patterns:**
- `error-boundary.tsx:52` -- "Something went wrong" with fallback "An unexpected error occurred. Please try again." Used as global fallback for all errors. No context-specific messaging.
- `org/$slug.tsx:126` -- "Something went wrong. Please try again." on application submission failure.
- `my/organizations.tsx:62,221` -- same generic "Something went wrong" on org-leave and join failures.
- 28+ instances of "Please try again" across the codebase -- no differentiation between transient network errors and permanent failures.

**CTA label issues:**
- Auth page uses "Login" button label (visible in screenshot) while all internal routing uses `/auth/sign-in`. Inconsistent terminology. The CLAUDE.md explicitly states "Auth route is `/auth/sign-in`, not `/login`" yet the button says "Login".
- `org/$slug.tsx:290` -- "Submit Application" is acceptable but verbose; "Apply" would be tighter.
- `my/credits/log.tsx:142` -- Button text "Add Credit Entry" is clear but could be "Log Credits".

**Good patterns found:**
- Alert banners have contextual, dynamic copy ("Dues overdue -- 2 unpaid invoices").
- Empty states use descriptive headlines ("No memberships yet", "No upcoming events").
- Quick action labels are concise and action-oriented ("Pay Dues", "ID Card", "Certificates").

### Pillar 2: Visuals (3/4) -- WARNING

**Strengths:**
- Consistent glass-morphism system (GlassCard, backdrop-blur, elevated surfaces) across dashboard, org home, and all card components.
- Clear visual hierarchy: PageHeader title > section h2 > card content.
- Icon-button accessibility: all icon-only buttons have aria-labels (`org-icon-rail.tsx:75`, `member-header.tsx:81`).
- Status dot system (emerald/amber/red) provides instant visual status communication.
- Skip-to-content link implemented (`_authenticated.tsx:44-49`).
- CreditRing SVG has proper `role="img"` and `aria-label` (`action-widget.tsx:108`).

**Issues:**
- `OrgProvider.tsx:84` -- renders `null` during initial load. No loading indicator, no skeleton. Users see a blank page flash on every org-scoped route transition.
- `org-icon-rail.tsx:46` -- returns `null` when orgs list is empty. No empty state or "join" prompt in the rail position. The rail just vanishes, shifting layout.
- `member-header.tsx:63` -- mobile logo uses `img` tag with `/memberry-logo-white.png` but no width/height specified, causing potential CLS (cumulative layout shift).
- Desktop header shows `userName` in muted text on the left (`member-header.tsx:69`) -- low visual weight for a key identifier.

### Pillar 3: Color (2/4) -- WARNING

**Hardcoded colors (BLOCKER pattern):**
- `#554B68` hardcoded in 4 files: `auth/$authView.tsx:47`, `verify-email.tsx:55`, `onboarding.tsx:228`, `main.tsx:26`. This is the brand purple used for the "Memberry" logo text but bypasses the `--color-primary` CSS variable entirely.
- `border-[#554B68]` in `main.tsx:26` for spinner.

**Tailwind palette mixed with CSS variables:**
- 85 instances of raw Tailwind colors (bg-emerald-500, bg-amber-500, bg-red-500, bg-gray-*, bg-blue-*, bg-purple-*) across 30 files.
- Alert banner uses `bg-red-50 border-red-200 text-red-800` / `bg-amber-50 border-amber-200 text-amber-800` / `bg-blue-50 border-blue-200 text-blue-700` instead of CSS var equivalents (`alert-banner.tsx:142-145`).
- Standing colors in dashboard OrgCard use raw Tailwind: `bg-emerald-500`, `bg-amber-500`, `bg-red-500` (`dashboard.tsx:394-396`).
- Training status styles use `bg-amber-100 text-amber-700`, `bg-gray-100 text-gray-700` (`training.tsx:143-157`).

**60/30/10 assessment:**
- 60% neutral: CSS vars (--color-surface, --color-text, --color-muted) well-used as background/text. Pass.
- 30% secondary: --color-surface-warm, --color-surface-elevated correctly used for cards. Pass.
- 10% accent: --color-primary used for CTAs, active states, links. However, primary also used for decorative elements (icon colors in quick actions, all 6 icons are primary-colored `quick-actions.tsx:65`). Accent slightly overused.

### Pillar 4: Typography (2/4) -- WARNING

**Dual type system creates maintenance burden:**

Semantic tokens in use (good): `text-h1`, `text-h2`, `text-h3`, `text-h4`, `text-hero`, `text-body-sm`, `text-subtitle` -- 45 instances across 20 files.

Hardcoded pixel sizes in use (bad): 9+ distinct sizes scattered across all components:
- `text-[10px]` -- badge text, org-icon-rail error
- `text-[11px]` -- status labels, nav labels, secondary metadata
- `text-[12px]` -- action labels, table headers, link text
- `text-[13px]` -- body copy, error messages, descriptions
- `text-[14px]` -- card titles, sidebar nav, form inputs
- `text-[16px]` -- sheet title
- `text-[20px]` -- stat values
- `text-[24px]` -- widget hero values
- Plus standard Tailwind sizes: `text-xs`, `text-sm`, `text-2xl`, `text-3xl`, `text-4xl`

This is 15+ distinct font size declarations. Even with tolerance, more than double the recommended 4-size maximum for a consistent type scale.

**Font weight distribution (79 instances across 20 files):**
- `font-medium` and `font-semibold` dominate. Reasonable 2-weight system.
- `font-bold` used for hero numbers and card titles. Third weight adds emphasis hierarchy. Acceptable.
- `font-display` used for numeric displays -- good design intent.

### Pillar 5: Spacing (3/4) -- WARNING

**Layout spacing is consistent:**
- Root content area: `px-5 md:px-6 py-5 md:py-7` (`_authenticated.tsx:60`). Clean responsive step.
- Section spacing: `space-y-6` (dashboard), `space-y-8` (org home). Consistent rhythm.
- Card internal padding: `p-4` and `p-5` used consistently across GlassCard instances.
- Grid gaps: `gap-2`, `gap-3`, `gap-4` follow 4px increments.

**Arbitrary values (213 occurrences across 30 files):**
- Most are legitimate dimension specs: `w-[56px]` (icon rail width), `max-h-[70vh]` (sheet), `min-h-[130px]` (widget), `max-w-[1200px]` (content).
- Pixel-based roundings: `rounded-[12px]`, `rounded-[8px]`, `rounded-[16px]` -- could map to CSS var `--radius-*` tokens.
- Magic number: `pl-[17px]` in `member-sidebar.tsx:33` (compensating for 3px border-left + 5 unit padding). Fragile.
- `w-[180px]` sidebar width, `w-[56px]` rail width, `w-[280px]` dropdown width -- all magic numbers that should be design tokens.

**Bottom nav height offset:**
- `pb-[68px]` on main content (`_authenticated.tsx:54`) matches `h-[68px]` on bottom nav (`member-bottom-nav.tsx:13`). Coupled but correct.

### Pillar 6: Experience Design (3/4) -- WARNING

**State coverage (strong):**
- Loading: `CardSkeleton`, `ListSkeleton` used in dashboard and org home. 95+ loading/isLoading references across 30 files.
- Error: `ErrorBoundary` wraps all authenticated content (`_authenticated.tsx:61`). Error fallback auto-focuses retry button (`error-boundary.tsx:43`). Error states in ActionWidget, OrgAnnouncements, CreditBreakdown.
- Empty: `EmptyState` pattern component used in 15+ locations with contextual headlines and CTAs.
- Alert banners: Priority-sorted alerts with contextual actions ("Pay now", "Renew now", "Vote").

**Issues:**
- `OrgProvider.tsx:83-84` -- renders `null` while resolving org slug. No loading indicator. Users navigating between orgs see a blank flash. This is a UX regression for multi-org users who switch frequently.
- No confirmation dialog for "Leave organization" (`my/organizations.tsx:55`). Destructive action fires immediately on button click. Only feedback is a success/error toast.
- Desktop dropdown for org switching (`member-header.tsx:113-156`) uses `mousedown` listener for close-on-outside-click but no keyboard escape handler. Focus trap not implemented.
- `org-icon-rail.tsx:46` -- when user has 0 orgs, rail returns null instead of showing a helpful empty state. Layout shifts left.
- Animation on every route change (`_authenticated.tsx:55-59`) -- AnimatePresence with spring transition on `location.pathname`. Could cause perceived sluggishness on rapid navigation.

**Accessibility (good coverage):**
- `aria-label` on org switcher, notification bell, skip link
- `role="alert"` and `aria-live="polite"` on error states
- `role="img"` on status dots and CreditRing SVG
- `sr-only` class for screen-reader-only status text

---

## Files Audited

### Core Layout (Wave 0a scope)
- `apps/memberry/src/components/layout/org-icon-rail.tsx`
- `apps/memberry/src/components/layout/org-picker-sheet.tsx`
- `apps/memberry/src/components/layout/member-header.tsx`
- `apps/memberry/src/components/layout/member-sidebar.tsx`
- `apps/memberry/src/components/layout/member-bottom-nav.tsx`
- `apps/memberry/src/providers/OrgProvider.tsx`
- `apps/memberry/src/routes/_authenticated.tsx`

### Dashboard
- `apps/memberry/src/routes/_authenticated/dashboard.tsx`
- `apps/memberry/src/features/dashboard/components/alert-banner.tsx`
- `apps/memberry/src/features/dashboard/components/quick-actions.tsx`
- `apps/memberry/src/features/dashboard/components/action-widget.tsx`
- `apps/memberry/src/features/dashboard/components/org-announcements.tsx`
- `apps/memberry/src/features/dashboard/components/credit-breakdown.tsx`

### Auth & Shared
- `apps/memberry/src/routes/auth/$authView.tsx`
- `apps/memberry/src/components/patterns/empty-state.tsx`
- `apps/memberry/src/components/patterns/error-boundary.tsx`

### Org Routes
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/home.tsx`
