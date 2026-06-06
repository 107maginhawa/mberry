# 04 Frontend Interaction Integrity — App Shell / Navigation

**Module**: App Shell / Navigation
**Audit Date**: 2026-05-26

---

## Component Inventory

| Component | File | Renders In |
|---|---|---|
| `MemberSidebar` | `components/layout/member-sidebar.tsx` | `AuthenticatedLayout` (desktop) |
| `MemberBottomNav` | `components/layout/member-bottom-nav.tsx` | `AuthenticatedLayout` (mobile) |
| `MemberHeader` | `components/layout/member-header.tsx` | `AuthenticatedLayout` (all) |
| `OrgIconRail` | `components/layout/org-icon-rail.tsx` | `AuthenticatedLayout` (desktop) |
| `OfficerSidebar` | `components/layout/officer-sidebar.tsx` | `OfficerLayout` (desktop) |
| `OfficerMobileNav` | `components/layout/officer-mobile-nav.tsx` | `OfficerLayout` (mobile) |
| `OrgPickerSheet` | `components/layout/org-picker-sheet.tsx` | `MemberHeader` (mobile) |
| `ErrorBoundary` | `components/patterns/error-boundary.tsx` | Wraps `<Outlet />` in both layouts |

---

## Interactive Element Audit

### MemberSidebar
- All nav items: `<Link>` components with TanStack Router
- Active state: `activeProps` / `activeOptions={{ exact: false }}` — correct link highlighting
- Mode switching: `orgSlug ? buildOrgSections(orgSlug) : PERSONAL_SECTIONS` — pure derived render, no interaction needed
- "Officer View" link: conditionally rendered based on `isOfficer` prop — no interaction issue
- No click handlers, no modals, no form elements
- **Integrity**: PASS

### MemberBottomNav
- All items: `<Link>` with `activeProps` for highlight
- Mode: `orgSlug ? buildOrgNav(orgSlug) : PERSONAL_NAV` — same pattern as sidebar
- Min touch target: `min-w-[44px] min-h-[44px]` — meets a11y spec
- **Integrity**: PASS

### MemberHeader
- Bell → `/my/notifications`
- Org pill (desktop): dropdown menu showing orgs + switch action
- Avatar (mobile): triggers `OrgPickerSheet` via `setSheetOpen(true)`
- User name display: pulls from `user.name` prop
- Notifications badge: fetches unread count via API query
- Dropdown sign-out: calls `authClient.signOut()` + redirect
- **Integrity**: PASS (functional pattern matches existing auth/session design)

### OrgIconRail
- Org avatars: `<Button>` with `navigate({ to: /org/${org.orgSlug}/home })` — correct
- Active ring: CSS ring class on active org avatar
- Role badge (Officer/Member/Lapsed): rendered in Tooltip content
- `+` button: `navigate({ to: '/join' })` — route may not exist (see Report 03)
- Error state: renders fallback "Failed to load orgs" text
- Empty state: renders `+` link to `/my/organizations`
- **Integrity**: PARTIAL — `/join` route not confirmed

### OfficerSidebar
- All nav: `<Link>` with `activeOptions={{ exact: false }}`
- Position filtering: `allowedSections` set computed from `POSITION_NAV_CONFIG`
- Fallback: unrecognized position shows all sections
- "Back to Member View" → `/dashboard`
- User initials avatar: computed from `userName.split(' ').map(n => n[0]).join('').slice(0, 2)`
- **Integrity**: PASS (with noted fallback risk)

### OfficerMobileNav
- Hamburger button: `setDrawerOpen(true)` → Sheet component
- Same position filtering logic as desktop sidebar
- Bell icon → `/my/notifications`
- Nav links inside Sheet drawer: correct org-scoped hrefs using `useParams` for `orgSlug`
- Sheet close: links call `setDrawerOpen(false)` on click (implicit via Sheet?)
- **Potential issue**: Sheet items do not explicitly call `setDrawerOpen(false)` on link click — drawer may stay open after navigation

### OrgPickerSheet
- Org selection: `handleSelectOrg(org)` → `onOpenChange(false)` + `navigate` — correct close+navigate
- "Join another org" link: `to="/join"` — same missing route concern
- **Integrity**: PASS for existing orgs; `/join` destination unconfirmed

### ErrorBoundary
- Class component with `getDerivedStateFromError` + `componentDidCatch`
- Shows `ErrorFallback` with "Retry" button on error
- Retry: `setState({ hasError: false, error: null })` — clears error to re-render children
- Focus management: `retryRef.current?.focus()` on mount — a11y correct
- Console logging: `console.error('[ErrorBoundary]', ...)` — no PII risk (logs error object)
- **Integrity**: PASS

---

## Theme / Design System

- No dedicated ThemeProvider found — design system uses CSS custom properties (`var(--color-*)`, `var(--radius-*)`)
- CSS variables defined in `src/styles/globals.css` (not audited directly but referenced everywhere)
- No dark mode toggle in shell (not implemented — CSS var approach would support it)
- `AuthUIProviderTanstack` from `@daveyplate/better-auth-ui` wraps root — provides auth UI theming

---

## Animation / Motion

- `AuthenticatedLayout` uses `AnimatePresence` + `motion.div` with `useSpringTransition` for page transitions
- Page key: `location.pathname` — correct trigger for enter/exit animations
- Mode: `"wait"` — ensures exit animation completes before new page enters
- **Integrity**: PASS

---

## Accessibility

| Feature | Status | Evidence |
|---|---|---|
| Skip-to-main link | Present in both layouts | `href="#main-content"` sr-only link |
| `main` element has `id="main-content"` | Yes | `<main id="main-content">` |
| Nav landmarks | `<nav aria-label="...">` | Both sidebars and bottom nav use aria-label |
| `<aside>` used for sidebars | Yes | All sidebar wrappers |
| Min touch target 44px | Yes | Bottom nav items: `min-w-[44px] min-h-[44px]` |
| Focus management on error | Yes | `retryRef.current?.focus()` |
| Role attribute on error | Yes | `role="alert"` on ErrorFallback |

---

## Findings

| Severity | Finding | File | Evidence |
|---|---|---|---|
| P2 | OfficerMobileNav drawer may not close on link click | `officer-mobile-nav.tsx` | Links inside Sheet don't call `setDrawerOpen(false)` |
| P2 | `/join` navigation target not confirmed to exist | `org-icon-rail.tsx`, `org-picker-sheet.tsx` | `to="/join"` in both files |
| INFO | No dark mode toggle in shell | N/A | CSS var approach supports it but no control exposed |
| INFO | OfficerSidebar fallback shows all sections for unknown position titles | `officer-sidebar.tsx` | `else { sections.forEach(...) }` safety-net |
