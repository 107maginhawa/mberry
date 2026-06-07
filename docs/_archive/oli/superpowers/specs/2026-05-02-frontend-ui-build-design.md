# Frontend UI Build — Design Spec

## Context

Memberry has 9 working API modules, 26 frontend routes (mostly stubs), and 109 screen specs at `docs/ver-3/ux/screens/`. Backend is complete. Frontend needs to go from developer stubs to production UI matching the full UX specifications.

Current state:
- Fonts: Montserrat/Open Sans (wrong) — spec requires General Sans/Plus Jakarta Sans/JetBrains Mono
- Colors: hardcoded hex values — spec defines CSS variable token system
- Components: no shadcn/ui wrappers installed (only Radix primitives)
- Layouts: single sidebar layout — spec defines 3 distinct layouts (member, officer, admin)
- States: no skeleton loaders, no empty states, no error boundaries
- Mobile: desktop-only — spec requires mobile-first member experience

## Strategy: Hybrid Foundation + Flow-First Vertical Slices

Industry-standard "steel thread" approach:

1. **Foundation Layer (Batch 0)** — shared design system, components, layouts
2. **Flow Slices (F1-F10)** — complete user journeys, one at a time, TDD

### Why Hybrid

- Pure persona-first: can't test cross-persona flows until late
- Pure flow-first: every slice reinvents shared components
- Hybrid: build shared infrastructure once, then move fast on flows

## Testing Strategy: Two-Layer TDD

### Layer 1: E2E Journey Tests (per flow slice)

One test file per flow slice. Tests full user journey against real API + seeded DB. No mocks (per VERTICAL_TDD.md).

```
apps/memberry/tests/e2e/
  f1-member-dashboard.spec.ts
  f2-dues-payments.spec.ts
  f3-membership-mgmt.spec.ts
  f4-events-attendance.spec.ts
  f5-training-credits.spec.ts
  f6-communications.spec.ts
  f7-documents-credentials.spec.ts
  f8-elections-governance.spec.ts
  f9-platform-admin.spec.ts
  f10-public-pages.spec.ts
```

**TDD cycle per slice:**
1. Write E2E test for user journey (FAILS — UI is stub)
2. Build UI components + wire data to pass test
3. Add visual/interaction polish (states, responsive, animations)
4. E2E test passes — flow complete

### Layer 2: Playwright Component Tests (per component)

Visual + behavior tests for individual components in isolation.

```
apps/memberry/tests/components/
  stat-card.spec.ts
  member-card.spec.ts
  data-table.spec.ts
  empty-state.spec.ts
  skeleton-loader.spec.ts
  ...
```

Each component test covers:
- All states from spec (loading, empty, populated, error)
- Desktop + mobile viewports
- Visual snapshot baseline via `toHaveScreenshot()`

## Foundation Layer (Batch 0)

### F0.1: Design System Alignment

**Files modified:** `apps/memberry/src/styles/globals.css`, `apps/memberry/tailwind.config.ts`

| Aspect | Current | Target (DESIGN.md) |
|--------|---------|---------------------|
| Heading font | Montserrat | General Sans 700 |
| Body font | Open Sans 600 | Plus Jakarta Sans 400-600 |
| Mono font | none | JetBrains Mono |
| Primary | `#554B68` hardcoded | CSS var `--primary` muted purple |
| Status colors | Tailwind defaults | success #5A8A6B, warning #C4960A, error #B85454, info #5B7EB5 |
| Spacing | ad-hoc | 4px grid (4, 8, 12, 16, 20, 24, 32, 48) |
| Border radius | Tailwind defaults | sm 8px, md 12px, lg 18px, full 100px |
| Dark mode | CSS vars exist | Full token mapping per DESIGN.md |

Replace all hardcoded hex values in components with Tailwind classes referencing CSS variables.

### F0.2: shadcn/ui Component Installation

Install via `/shadcn` skill (never manually create):

**Must-have:** Button, Card, Input, Label, Form, Table, Dialog, Sheet, Badge, Skeleton, Alert, Tabs, DropdownMenu, Command, Separator, Avatar, Progress, ScrollArea, Tooltip

**Already have Radix for:** Select, Switch, Checkbox, Popover, Slider, Toggle — add shadcn wrappers

### F0.3: Layout Shells

Three layouts per spec:

**Officer Layout** (`_authenticated/org/$orgId/officer/_layout.tsx`)
- Fixed 240px sidebar, dark purple (#554B68 via CSS var)
- 7-section nav: Dashboard, Members, Finances, Activities, Communications, Documents, Settings
- Org name + switcher in header, user at bottom
- Mobile: hamburger drawer + bottom action bar

**Member Layout** (`_authenticated/_layout.tsx` or `_authenticated/my/_layout.tsx`)
- Desktop: simplified sidebar (Dashboard, Activities, Credits, Profile)
- Mobile: fixed header (48px) + content + fixed bottom nav (68px, 4 tabs)

**Platform Admin Layout** (`_authenticated/admin/_layout.tsx`)
- Desktop-only, 260px sidebar, darker #2D2635
- Mobile: "Please use desktop" message

**Org-Switcher Component**
- Dropdown in sidebar header for users with 2+ orgs
- Bottom sheet on mobile
- Persists selection in session context
- Changes all org-scoped data

### F0.4: Shared Pattern Components

Built in `apps/memberry/src/components/`:

| Component | Purpose | States |
|-----------|---------|--------|
| SkeletonLoader | Loading placeholder | list (5-7 rows), card, profile, table, single |
| EmptyState | No data messaging | icon + headline + description + CTA (configurable) |
| ErrorBoundary | Error handling | network (full page), inline (widget), form validation |
| PageHeader | Page title area | title + breadcrumbs + optional action buttons |
| DataTable | Server-side data table | pagination, sorting, filtering, bulk select, mobile cards |
| StatCard | Metric display | number + label + trend + accent variant |
| MemberCard | Member summary | avatar + name + status badge + quick actions |
| ConfirmDialog | Action confirmation | destructive (red), high-consequence (count), irreversible (type-to-confirm) |
| StatusBadge | Membership status | Active (green), Grace (amber), Lapsed (red), Pending (blue), Suspended (gray) |

### F0.5: Form System

- `react-hook-form` + `zod` + shadcn `Form` component
- Validation on blur (not on submit, per spec)
- Error messages: specific and actionable (not "Invalid input")
- Required fields: asterisk if most fields optional; "(optional)" label otherwise
- Unsaved changes: confirmation dialog on navigate away

## Flow Slices

### F1: Member Dashboard + Profile (~6 screens)

**Screens:** dashboard, profile view, profile edit, onboarding, org memberships, settings
**Spec files:** `docs/ver-3/ux/screens/member/dashboard.md`, `member/profile.md`, `member/settings.md`, `member/organizations.md`
**Routes:** `/dashboard`, `/my/profile`, `/my/settings`, `/my/organizations`, `/onboarding`

**E2E journey test:**
```
Member logs in
  → sees dashboard with org cards + upcoming events + credit summary
  → taps profile → sees professional info + org memberships
  → edits profile → saves → changes reflected
  → visits settings → toggles notification prefs → saves
```

**Key components:** PersonalDashboard (cross-org aggregate), ProfileCard, OrgMembershipCard, SettingsForm

### F2: Dues & Payments (~8 screens)

**Screens:** member payment history, pay dues, officer invoice list, record payment, dues config, officer financial dashboard, payment receipt
**Spec files:** `docs/ver-3/ux/screens/member/payments.md`, `officer/treasurer/`
**Routes:** `/my/payments`, `/org/$orgId/officer/payments`, `/org/$orgId/officer/settings/dues`

**E2E journey test:**
```
Officer configures dues → creates invoice batch
Member sees dues notice → pays → gets receipt
Officer sees payment recorded → marks manual payment
Officer views collection rate dashboard
```

**Key components:** DuesInvoiceTable (enhanced from current), PaymentForm, CollectionDashboard, ReceiptView

### F3: Membership Management (~6 screens)

**Screens:** officer roster, application form, application review, bulk import, member directory, member detail
**Spec files:** `docs/ver-3/ux/screens/officer/secretary/`, `org-member/directory.md`
**Routes:** `/org/$orgId/officer/roster`, `/org/$orgId/officer/applications`, `/org/$orgId/members`

**E2E journey test:**
```
New user applies for membership
Officer reviews application → approves → member in roster
Officer views roster → filters by status → sees details
Org member searches directory → finds approved member
```

**Key components:** RosterTable (enhanced), ApplicationReview, BulkImport, DirectoryGrid (enhanced)

### F4: Events & Attendance (~8 screens)

**Routes:** `/org/$orgId/officer/events/`, `/my/events`, `/org/$orgId/events/`
**Journey:** Officer creates event → Member registers → Check-in → Attendance recorded

### F5: Training & Credits (~8 screens)

**Routes:** `/org/$orgId/officer/training/`, `/my/credits/`, `/my/training`
**Journey:** Officer creates training → Member enrolls → Completes → Credits issued

### F6: Communications (~4 screens)

**Routes:** `/org/$orgId/officer/communications`, `/org/$orgId/feed`
**Journey:** Officer sends announcement → Members receive notification → View in feed

### F7: Documents & Credentials (~6 screens)

**Routes:** `/my/id-card`, `/my/certificates/`, `/verify/$token`
**Journey:** Member views ID card → Downloads PDF → Verifies credential via QR

### F8: Elections & Governance (~8 screens)

**Routes:** `/org/$orgId/officer/elections/`, `/org/$orgId/voting/`
**Journey:** President creates election → Members vote → Results tallied

### F9: Platform Admin (~31 screens)

**App:** `apps/admin/` (separate app, already exists but bare)
**Routes:** Own route tree within admin app
**Journey:** Admin views all orgs → Drills into org → Manages feature flags ��� Views analytics
**Note:** Separate app per 3-app architecture (account + memberry + admin). Shares design system via shared packages but has own layout shell (desktop-only, darker sidebar).

### F10: Public Pages (~4 screens)

**Routes:** `/`, `/org/$slug`, `/verify/$token`, `/pay/$token`
**Journey:** Visitor sees landing → Views org profile → Verifies credential

## Design System Reference

All visual decisions come from `docs/ver-3/DESIGN.md`. Key references:

- Color system: Section 2 (light + dark mode token mappings)
- Typography: Section 3 (13 text styles, 3 font families)
- Components: Section 6 (buttons, inputs, badges, cards, tables, nav, avatars, progress)
- Layout: Section 7 (desktop officer, mobile member, platform admin)
- Responsive: Section 8 (breakpoints, role-based rules, touch targets)
- Interaction patterns: `docs/ver-3/ux/interaction-patterns.md`
- States: `docs/ver-3/ux/states.md`
- Navigation: `docs/ver-3/ux/navigation.md`

## Verification

After each flow slice:
1. E2E journey test passes (real API, seeded DB)
2. Component tests pass with visual snapshots
3. Desktop + mobile viewports verified
4. `/qa` skill run for visual QA spot-check

After all slices:
1. Full E2E suite passes
2. Visual snapshot baselines reviewed
3. Cross-flow navigation works (member → officer context switch)
4. Dark mode renders correctly across all screens
