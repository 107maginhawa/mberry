# 05 Form / Modal / Table / Action Audit — App Shell / Navigation

**Module**: App Shell / Navigation
**Audit Date**: 2026-05-26

---

## Scope

The app shell itself contains minimal form/modal/table elements — it is primarily navigation and layout. This report covers what interactive overlays and actions exist within the shell boundary.

---

## Modals / Sheets in Shell

### OrgPickerSheet (Mobile Org Switcher)
**File**: `components/layout/org-picker-sheet.tsx`

- **Trigger**: Avatar tap in `MemberHeader` on mobile
- **Sheet side**: `"bottom"`, `rounded-t-[16px]`, `max-h-[70vh]`
- **Content**: List of user's orgs as `<Button>` items
- **Actions**:
  - Select org → `navigate({ to: /org/${org.orgSlug}/home })` + close sheet
  - "Join another org" → link to `/join`
- **Status badges**: Active (green), Grace (yellow), Lapsed (red), Pending (blue)
- **Role badges**: Officer / Member via `officerOrgIds` set
- **Findings**:
  - No form validation needed (selection only)
  - `/join` destination may not exist — link target unconfirmed
  - Sheet closes correctly on org selection (`onOpenChange(false)` called before navigate)

### OfficerMobileNav Drawer
**File**: `components/layout/officer-mobile-nav.tsx`

- **Trigger**: Hamburger `<Button>` in mobile officer header
- **Implementation**: `<Sheet>` with `<SheetContent>` side unspecified (defaults to right)
- **Content**: Filtered nav sections with `<Link>` items
- **Actions**: Navigate to officer routes
- **Findings**:
  - Links do not call `setDrawerOpen(false)` explicitly — Sheet may remain open after navigation
  - `SheetHeader` has `SheetTitle` for a11y — compliant
  - No form elements

### NotificationDrawer
**File**: `components/notification-drawer.tsx`
**Note**: Not part of the layout components directly but referenced from `MemberHeader`.

- Not directly audited (separate component), but bell icon in both member and officer headers links to `/my/notifications` route rather than opening an in-shell drawer. The `notification-drawer.tsx` file exists as a component but its integration point was not confirmed from shell layout files alone.

---

## Forms in Shell

### Sign-In Form
**Location**: Rendered by Better-Auth UI at `/auth/sign-in`
**Not in shell layout** — part of public auth routes, not wrapped by `_authenticated.tsx`

- `AuthUIProviderTanstack` in root layout provides the auth UI context
- Form fields: Email, Password
- Submit: Better-Auth `signIn` flow
- Error: Inline (Better-Auth UI handles)
- Redirect on success: `onSessionChange` → `queryClient.invalidateQueries` → `router.invalidate()`

### Settings Modal (Shell-Adjacent)
- Settings accessed via `/my/settings` route — not a modal within the shell
- No modal/overlay settings UI found in shell components

---

## Tables in Shell

None. Shell components (sidebar, header, nav) contain no table elements.

---

## Action Summary

| Action | Component | Type | Outcome |
|---|---|---|---|
| Select org | OrgPickerSheet | Button click | Navigate + close sheet |
| Open officer menu | OfficerMobileNav | Button click | Open drawer Sheet |
| Navigate officer section | OfficerMobileNav | Link click | Route change (drawer may stay open) |
| Switch org (desktop) | MemberHeader dropdown | DropdownMenuItem | Navigate to org home |
| Sign out | MemberHeader dropdown | DropdownMenuItem | `authClient.signOut()` + redirect |
| Open org picker (mobile) | MemberHeader | Button (avatar) | Open OrgPickerSheet |
| Join org | OrgIconRail / OrgPickerSheet | Link/Button | Navigate to `/join` |
| Retry error | ErrorBoundary | Button | Clear error state |
| Skip to content | Both layouts | `<a href="#main-content">` | Focus jump (a11y) |

---

## Findings

| Severity | Finding | File |
|---|---|---|
| P2 | OfficerMobileNav drawer stays open after link navigation | `officer-mobile-nav.tsx` |
| P2 | `/join` route used in two shell components — not confirmed to exist | `org-icon-rail.tsx`, `org-picker-sheet.tsx` |
| INFO | Sign-out action in MemberHeader dropdown — implementation not directly audited (Better-Auth integration) | `member-header.tsx` |
| INFO | No forms, tables, or complex modals in shell proper | N/A |
