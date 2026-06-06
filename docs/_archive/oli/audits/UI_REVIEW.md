# UI Review -- Memberry Frontend Audit

**Date:** 2026-05-26
**Scope:** `apps/memberry/src/` (primary) + `apps/admin/src/` (secondary)
**Branch:** `audit/codebase-improvements`

---

## Overall Score: 19/24

| Pillar | Score | Verdict |
|--------|-------|---------|
| Visual Consistency | 3/4 | Strong design token system; hardcoded color leaks in officer pages |
| Component Architecture | 4/4 | Excellent reuse, clean composition, typed props |
| Accessibility | 3/4 | Good ARIA coverage; missing skip-link, inconsistent focus handling |
| Responsive Design | 3/4 | Solid mobile-first layouts; admin blocks mobile entirely |
| Loading/Error States | 3/4 | Skeleton system is best-in-class; a few raw "Loading..." strings remain |
| Form UX | 3/4 | FormField pattern exists but is unused; inline form patterns vary |

---

## Pillar 1: Visual Consistency (3/4)

### Strengths

- **Design token system is comprehensive.** CSS custom properties in `apps/memberry/src/styles/globals.css` define 40+ tokens covering colors, spacing, shadows, radius, and motion. Both light and dark modes are fully tokenized.
- **Typography scale is well-defined.** 13 utility classes (`text-hero` through `text-overline`) map to a documented type scale using DM Sans (display) and Plus Jakarta Sans (body).
- **Glass morphism is consistent.** `GlassCard` component (`components/motion/glass-card.tsx`) uses tokenized `--color-surface-elevated`, `--surface-blur`, and `--shadow-soft` variables. Used consistently across dashboard, profile, events, and training pages.
- **Spacing scale follows 4px base.** Tailwind config overrides spacing to a strict 4/8/12/16/20/24/32/40/48 scale.
- **Border radius is standardized.** 4 values: 8px (sm), 12px (md), 18px (lg), 9999px (full).
- **Dark mode is fully implemented** with proper token inversion and glass surface adjustments.

### Findings

| ID | Severity | File(s) | Finding |
|----|----------|---------|---------|
| VC-1 | HIGH | `routes/_authenticated/org/$orgSlug/officer/payments/$paymentId.tsx` | **10 hardcoded Tailwind color classes** (`bg-green-100 text-green-800`, `bg-red-100 text-red-800`, etc.) for payment status badges. Should use design tokens (`--color-success`, `--color-error`, etc.) via `StatusBadge` pattern. |
| VC-2 | HIGH | `routes/_authenticated/org/$orgSlug/officer/settings/providers.tsx` | Status badges use `bg-green-100 text-green-800`, `bg-yellow-100 text-yellow-800` -- raw Tailwind, not design tokens. Breaks in dark mode. |
| VC-3 | HIGH | `routes/_authenticated/org/$orgSlug/officer/training/$trainingId.tsx`, `routes/_authenticated/my/training.tsx` | Training status styles use `bg-green-100 text-green-700`, `bg-gray-100 text-gray-700` etc. -- ~15 hardcoded colors. |
| VC-4 | MEDIUM | `routes/_authenticated/org/$orgSlug/officer/roster/$memberId.tsx` | Membership status uses inline `bg-gray-100 text-gray-800` instead of `StatusBadge` component. |
| VC-5 | MEDIUM | `routes/_authenticated/org/$orgSlug/officer/compliance.tsx` | Progress bar uses `bg-gray-200` and `bg-red-100` -- hardcoded, no dark mode support. |
| VC-6 | LOW | `apps/admin/src/routes/index.tsx` | Admin dashboard `outcomeColors` map uses `text-green-600`, `text-red-600` -- inconsistent with the admin's own `globals.css` token system. |

**Pattern:** Hardcoded colors cluster heavily in **officer pages** (`org/$orgSlug/officer/*`). Member-facing pages consistently use design tokens. This suggests officer pages were built earlier or by different contributors without the token discipline applied later.

### Remediation

1. Extract a shared `StatusBadge` variant map that covers all status types (payment, training, membership, compliance) using design token variables. Extend the existing `components/patterns/status-badge.tsx` to accept a `domain` prop.
2. Grep for `bg-(red|green|blue|gray|yellow|orange)-` across routes and features and replace with token-based equivalents.

---

## Pillar 2: Component Architecture (4/4)

### Strengths

- **Pattern library is well-structured.** `components/patterns/` contains 11 reusable primitives: `page-header`, `data-table`, `form-field`, `empty-state`, `error-boundary`, `error-state`, `skeleton-loader`, `status-badge`, `stat-card`, `confirm-dialog`, `date-picker`, `avatar-initials`.
- **Motion layer is clean.** `components/motion/` provides `GlassCard`, `CountUp`, `StaggerGrid`, `useSpringTransition` -- used consistently across dashboard, events, training, and profile.
- **Layout components are role-aware.** `member-sidebar`, `member-header`, `member-bottom-nav`, `officer-sidebar`, `officer-mobile-nav`, `org-icon-rail` -- each has clear responsibility and proper responsive behavior.
- **Feature-based organization.** `features/` directory groups domain components by bounded context (dues, booking, comms, certificates, directory, dashboard, elections, profile, surveys, admin, chapters, billing). Clean separation from shared patterns.
- **Props are well-typed.** All pattern components use explicit TypeScript interfaces. Generic `DataTable<TData, TValue>` supports type-safe column definitions.
- **Composition over configuration.** `PageHeader` accepts `actions` as ReactNode. `DataTable` accepts `renderMobileCard` as a render function. `ConfirmDialog` supports `children` for extra content. `ErrorBoundary` accepts custom `fallback`.
- **UI primitives come from `@monobase/ui`** (shadcn/Radix). No raw HTML buttons or inputs in shared components.

### Findings

| ID | Severity | File(s) | Finding |
|----|----------|---------|---------|
| CA-1 | LOW | `components/combobox.tsx` and `components/patterns/combobox.tsx` | Two combobox implementations exist -- one in root `components/`, one in `patterns/`. The root one appears to be an older version. |

### Remediation

1. Audit which routes import which combobox and consolidate to `patterns/combobox.tsx`.

---

## Pillar 3: Accessibility (3/4)

### Strengths

- **ARIA labels are thorough in layout.** `org-icon-rail` uses `aria-label="Organization switcher"`, `aria-label="Switch to {orgName}"`, `aria-current` for active state. Sidebar navs use `aria-label="Member navigation"`, `aria-label="Officer navigation"`.
- **Breadcrumbs use semantic `<nav aria-label="Breadcrumb">`** with `aria-current="page"` on the active item.
- **Error states use `role="alert"`** consistently (`error-boundary`, `error-state`, `form-field`, profile form inline errors).
- **Decorative icons use `aria-hidden="true"`** throughout dashboard and navigation (verified across 10+ instances).
- **Form field pattern injects `aria-describedby` and `aria-invalid`** automatically via `React.cloneElement`.
- **Global focus-visible ring** defined in `globals.css` for all interactive elements (buttons, links, inputs, selects, textareas, `[role="button"]`, `[tabindex]`).
- **`prefers-reduced-motion`** respected: shimmer animations disabled, spring bounce/duration zeroed.
- **Data table uses `role="grid"` and `aria-sort`** on sortable column headers.
- **Notification bell has `aria-label="Notifications"`**.

### Findings

| ID | Severity | File(s) | Finding |
|----|----------|---------|---------|
| A11Y-1 | HIGH | `routes/_authenticated.tsx` | **No skip-to-content link.** `<main id="main-content">` exists but there is no `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to content</a>` for keyboard users. |
| A11Y-2 | MEDIUM | Various features | **Inconsistent focus handling.** Some custom inputs use `focus:outline-none focus:ring-2` (trust-directory, directory-search), others use `focus:outline-none focus:border-{color} focus:ring-[4px]` (profile form). The global `focus-visible` rule in CSS should be the single source, but inline `focus:outline-none` overrides it for mouse users too -- should use `focus-visible:` instead of `focus:`. |
| A11Y-3 | MEDIUM | `routes/_authenticated/org/$orgSlug/officer/settings/cpd.tsx` | Labels use bare `<label>` without `htmlFor` attribute -- not linked to inputs. |
| A11Y-4 | LOW | `components/patterns/status-badge.tsx` | Status badges convey meaning through color alone. No icon or screenreader-only text to distinguish statuses for colorblind users. |
| A11Y-5 | LOW | `apps/admin/src/routes/__root.tsx` | Admin `MobileGate` renders a blocking message on small screens but provides no way to dismiss or proceed -- users on tablets (768-1023px) are fully blocked with no alternative. |

### Remediation

1. Add skip-link in `_authenticated.tsx` layout before the sidebar.
2. Replace `focus:outline-none` with `focus-visible:outline-none` throughout (or rely on the global CSS rule and remove inline overrides).
3. Add `htmlFor` to CPD settings labels.
4. Add a small icon or `sr-only` text to `StatusBadge` for colorblind accessibility.

---

## Pillar 4: Responsive Design (3/4)

### Strengths

- **Dual-layout architecture is solid.** Mobile: OrgIconRail hidden, MemberBottomNav visible, MemberHeader with mobile-specific styling. Desktop: sidebar + header chrome, no bottom nav. Breakpoint at `md` (768px).
- **DataTable has mobile card fallback.** `renderMobileCard` prop enables card layout below 768px, with container query support (`@container`) for nested contexts.
- **Layout dimensions are tokenized.** `--rail-width: 56px`, `--sidebar-width: 180px`, `--bottom-nav-height: 68px` -- consistent reference points.
- **Mobile glass surface tokens adjust** translucency and blur at `max-width: 768px`.
- **Content grids use responsive columns.** `grid grid-cols-1 md:grid-cols-2` and `md:grid-cols-3` throughout profile, events, training.
- **MemberHeader switches** background from `bg-[var(--color-primary)]` (mobile) to glass surface (desktop), with mobile-specific logo and avatar interactions.
- **OrgPickerSheet** provides mobile-friendly bottom sheet for org switching (replaces desktop dropdown).
- **Container queries** for stat grids and data tables provide intrinsic responsiveness.

### Findings

| ID | Severity | File(s) | Finding |
|----|----------|---------|---------|
| RD-1 | HIGH | `apps/admin/src/routes/__root.tsx` | **Admin app blocks all viewports under 1024px** with `MobileGate`. No responsive layout at all -- `hidden lg:flex`. While intentional for an ops dashboard, it means tablets are completely unusable. |
| RD-2 | MEDIUM | `routes/_authenticated/my/profile.tsx` | Profile edit form cards stack vertically on mobile but some field groups (`grid grid-cols-1 md:grid-cols-2`, `md:grid-cols-3`) don't have enough padding/gap on small screens -- fields feel cramped at 320px. |
| RD-3 | LOW | `components/patterns/page-header.tsx` | `flex items-center justify-between` for title + actions. On very narrow screens, long titles + action buttons can wrap awkwardly. No `flex-wrap` or stack-on-mobile logic. |
| RD-4 | LOW | `features/dues/components/financial-dashboard.tsx` | Financial charts and stat grids may overflow horizontally on narrow mobile viewports (no horizontal scroll wrapper or responsive chart sizing observed). |

### Remediation

1. For admin: add a minimal responsive layout or at least lower the gate to 768px for tablet support.
2. Add `flex-wrap gap-2` to PageHeader's action container and test at 320px.
3. Wrap financial dashboard charts in a responsive container with overflow-x-auto.

---

## Pillar 5: Loading/Error States (3/4)

### Strengths

- **Skeleton system is excellent.** `skeleton-loader.tsx` provides 5 variants: `Bone` (base shimmer), `ListSkeleton`, `CardSkeleton`, `ProfileSkeleton`, `TableSkeleton`. All use design tokens and respect `prefers-reduced-motion`.
- **Skeletons are used consistently** in dashboard (`CardSkeleton`), org home (`ListSkeleton`), my-cpd, training, and officer pending states.
- **ErrorBoundary is production-grade.** Handles 401 auto-redirect, console logs component stack, provides retry button with auto-focus, accepts custom fallback.
- **ErrorState component** uses `role="alert"`, `aria-live="polite"`, semantic error colors, and optional retry.
- **EmptyState component** provides consistent zero-data display with icon, headline, description, and CTA.
- **Authenticated layout wraps Outlet in ErrorBoundary** -- all route content has error protection.
- **404 page** is styled with design tokens, not a raw browser error.

### Findings

| ID | Severity | File(s) | Finding |
|----|----------|---------|---------|
| LE-1 | MEDIUM | `routes/_authenticated/settings/account.tsx:132` | Raw `<div className="p-6">Loading...</div>` instead of a skeleton component. |
| LE-2 | MEDIUM | `apps/admin/src/routes/index.tsx` | Admin dashboard audit log section shows `animate-pulse` text ("Loading activity...") instead of a skeleton. |
| LE-3 | LOW | `routes/_authenticated/org/$orgSlug/officer/finances/invoices/index.tsx` | Error state is a bare `<div role="alert">Failed to load invoices</div>` -- no retry button, no icon, doesn't use `ErrorState` component. |
| LE-4 | LOW | Admin app | Admin has only one shared component (`skeletons.tsx`). No error boundary, no empty state, no reusable patterns -- all inline. |

### Remediation

1. Replace raw "Loading..." strings with appropriate skeleton variants.
2. Use `ErrorState` component for inline query error displays.
3. Extract admin shared patterns (or import from memberry if architecturally appropriate).

---

## Pillar 6: Form UX (3/4)

### Strengths

- **FormField pattern component exists** (`components/patterns/form-field.tsx`) with automatic `aria-describedby`, `aria-invalid`, required indicator, error display, and helper text injection. Well-documented with JSDoc and usage example.
- **Toast system uses `sonner` exclusively.** All 30+ toast calls across the codebase use `toast.success()` / `toast.error()` from sonner. No `useToast` from shadcn -- convention is followed perfectly.
- **ConfirmDialog is robust.** Three severity variants (`destructive`, `high-consequence`, `irreversible`). The `irreversible` variant requires typing a confirmation string. Uses AlertDialog from Radix for proper modal accessibility.
- **Zod schema validation** used for profile form with `zodResolver`.
- **Mutation feedback is clear.** Submit buttons show "Saving..." / "Cancelling..." during `isPending`. Error toasts include descriptions when helpful.
- **Phone input** is a dedicated component (`components/phone-input.tsx`).

### Findings

| ID | Severity | File(s) | Finding |
|----|----------|---------|---------|
| FX-1 | HIGH | Routes (all forms) | **FormField component has 0 usage** across all route files (`grep -rn 'FormField' routes/ | wc -l` returns 0). Every form in the app uses inline `<Label>` + `<Input>` + error `<p>` patterns instead. The pattern exists but was never adopted. |
| FX-2 | MEDIUM | `routes/_authenticated/my/profile.tsx` | Profile form defines a local `field()` helper function that duplicates FormField's purpose but with different styling (e.g., `text-sm font-semibold text-[var(--color-text-secondary)] mb-1.5` vs FormField's standard spacing). |
| FX-3 | MEDIUM | `routes/_authenticated/org/$orgSlug/officer/settings/cpd.tsx` | CPD form uses bare `<label>` elements (not `<Label>` from `@monobase/ui`) with no `htmlFor` linking. No error display. |
| FX-4 | MEDIUM | `routes/_authenticated/org/$orgSlug/officer/roster/index.tsx` | Roster add-member form has inline `aria-describedby` and error `<p>` but doesn't use FormField, creating maintenance burden and inconsistent styling. |
| FX-5 | LOW | Various | No client-side field validation feedback on blur -- all validation fires on submit only. Users fill entire forms before learning of errors. |

### Remediation

1. **Priority 1:** Adopt `FormField` component across all forms. Start with the 5 officer settings forms (cpd, providers, roster, certificates, compliance) which have the worst inconsistency.
2. **Priority 2:** Refactor profile page `field()` helper to use `FormField`.
3. **Priority 3:** Add `mode: 'onBlur'` to `useForm` calls for immediate field validation.

---

## Top 10 Remediation Priorities

| Priority | ID | Effort | Impact | Description |
|----------|-----|--------|--------|-------------|
| P1 | VC-1,2,3 | Medium | High | Replace ~40 hardcoded Tailwind color classes in officer pages with design tokens. Broken dark mode. |
| P1 | A11Y-1 | Trivial | High | Add skip-to-content link in authenticated layout. |
| P1 | FX-1 | Medium | High | Adopt FormField component across all forms (currently 0 usage despite existing). |
| P2 | A11Y-2 | Low | Medium | Fix `focus:outline-none` to `focus-visible:outline-none` across custom inputs. |
| P2 | LE-1,2 | Low | Medium | Replace raw "Loading..." text with skeleton components. |
| P2 | FX-3 | Low | Medium | Fix CPD form labels -- add `htmlFor`, use `<Label>` component. |
| P2 | RD-3 | Low | Medium | Make PageHeader responsive-safe with `flex-wrap`. |
| P3 | CA-1 | Trivial | Low | Remove duplicate combobox component. |
| P3 | A11Y-4 | Low | Low | Add icons or sr-only text to StatusBadge for colorblind users. |
| P3 | LE-3 | Low | Low | Use ErrorState component for officer invoice error display. |

---

## Cross-App Consistency: Memberry vs Admin

| Dimension | Memberry | Admin | Gap |
|-----------|----------|-------|-----|
| Design tokens | Full CSS variable system | Partial -- uses shadcn defaults (`bg-card`, `text-muted-foreground`) | Admin should adopt memberry's extended token set |
| Typography | Custom 13-style scale | Default Tailwind | Admin needs typography parity |
| Components | 11 shared patterns + 5 layout + 4 motion | 1 shared component (`skeletons.tsx`) | Admin needs pattern extraction |
| Dark mode | Fully tokenized | Not implemented | Admin should inherit memberry's dark tokens |
| Responsive | Full mobile support | Desktop-only (1024px gate) | Intentional but tablet support missing |
| Error handling | ErrorBoundary + ErrorState | Inline error divs | Admin needs error boundary |

---

## Architecture Observations

1. **Token discipline is strong in member-facing pages** and weak in officer-facing pages. This is the single biggest consistency gap.
2. **The FormField component represents dead code** -- well-designed, well-documented, never used. Either adopt it or remove it.
3. **The admin app is architecturally immature** compared to memberry. It shares `@monobase/ui` primitives but has no shared pattern layer, no dark mode, no responsive design, and minimal accessibility infrastructure.
4. **Motion/animation layer is tasteful** -- spring transitions, count-up, stagger grid, glass cards add polish without overwhelming. `prefers-reduced-motion` is respected.
5. **Container queries for DataTable** are a forward-looking pattern that makes the component intrinsically responsive -- good architectural decision.
