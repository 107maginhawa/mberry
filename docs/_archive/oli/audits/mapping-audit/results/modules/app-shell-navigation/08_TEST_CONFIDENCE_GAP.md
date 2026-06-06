# 08 Test Confidence Gap — App Shell / Navigation

**Module**: App Shell / Navigation
**Audit Date**: 2026-05-26

---

## Test Files Covering This Module

| File | Type | Covers |
|---|---|---|
| `tests/e2e/auth.spec.ts` | E2E | Sign-in flow, auth guard, sidebar post-login, unauthenticated redirect |
| `tests/e2e/auth/session-expiry.spec.ts` | E2E | Auth guard redirects, session persistence, sign-out |
| `tests/e2e/auth/session-management.spec.ts` | E2E | Session persistence across navigation, security settings |
| `tests/e2e/auth/otp-registration.spec.ts` | E2E | Auth flow (registration) |
| `tests/e2e/auth/password-reset.spec.ts` | E2E | Auth flow (password reset) |
| `tests/e2e/journeys/navigation.spec.ts` | E2E | Officer sidebar sections, nav item links, member sidebar isolation |
| `tests/e2e/error-boundaries.spec.ts` | E2E | ErrorBoundary on API 500, org not found |
| `components/layout/org-icon-rail.test.tsx` | Unit | OrgIconRail component |
| `components/layout/org-picker-sheet.test.tsx` | Unit | OrgPickerSheet component |

---

## Coverage Matrix

| Shell Feature | E2E Covered | Unit Covered | Notes |
|---|---|---|---|
| Auth guard redirect (unauthenticated) | YES | N/A | session-expiry.spec: 3 redirect tests |
| Auth guard redirect (officer pages) | YES | N/A | session-expiry: unauthenticated officer page test |
| Sign-in → dashboard flow | YES | N/A | auth.spec A1, A2 |
| Sidebar visible after sign-in | YES | N/A | auth.spec: checks Home + Profile links |
| Officer sidebar sections (president) | YES | N/A | navigation.spec: MEMBERS, FINANCES, etc. |
| Officer sidebar nav links (hrefs) | YES | N/A | navigation.spec: 6 links verified |
| Officer sidebar link click → route | YES | N/A | navigation.spec: Roster + Events |
| Member sidebar isolation (no officer sections) | YES | N/A | navigation.spec: MEMBERS/FINANCES not visible |
| Session persistence across navigation | YES | N/A | session-management: profile, settings, credits |
| Sign-out clears session | YES (partial) | N/A | Flexible check — sign-out button finding is fragile |
| ErrorBoundary on API 500 | YES | N/A | error-boundaries.spec |
| OrgIconRail rendering | NO | YES | Unit test exists |
| OrgPickerSheet rendering | NO | YES | Unit test exists |
| Bottom nav mode switching | NO | NO | Not tested |
| Org switching (desktop rail) | NO | NO | Unit test doesn't test navigation |
| Org switching (mobile sheet) | NO | NO | Not tested |
| Position-based sidebar filtering (treasurer/secretary) | NO | NO | Only president tested |
| Officer mobile nav (hamburger drawer) | NO | NO | Not tested |
| Drawer close on navigation | NO | NO | Known gap (P2 bug) |
| UUID → slug redirect | NO | NO | Not tested |
| `/join` route existence | NO | NO | Not tested |
| Double-render prevention (officer+member shell) | NO | NO | Implicit in journey tests |
| `requireOrgOfficer` non-officer redirect | NO | NO | No test for member accessing officer URL |
| org membership check (non-member accessing org pages) | NO | NO | No test |
| Skip-to-main a11y link | NO | NO | Not tested |
| Org-mode sidebar switch | NO | NO | Not tested |

---

## E2E Test Quality Notes

### navigation.spec.ts
- Uses hardcoded `ORG_ID = 'ed8e3a96-...'` UUID — brittle if seed data changes
- Navigates directly to `/org/${ORG_ID}/officer/dashboard` (UUID-style) — relies on UUID redirect working
- Checks exact `href` attributes — good (tests actual routing, not just visibility)
- Tests officer sidebar only with full-access (president) persona — other positions not covered

### auth.spec.ts
- Tests post-login sidebar: checks `role="complementary"` (aside) for "Memberry" text and Home/Profile links — reasonable but fragile to sidebar restructure
- Tests user email visible in sidebar — catches data display regression
- Auth guard tests clear cookies before testing — correct isolation

### session-expiry.spec.ts
- Sign-out test is fragile: `if (hasSignOut)` conditional — test passes even if sign-out UI is absent
- Session persistence tests are solid — navigate across 3 routes and verify no auth redirect

### error-boundaries.spec.ts
- API 500 test uses `page.route()` intercept — correct approach
- Org 404 test checks for error text OR redirect — flexible but may allow false passes

---

## Unit Test Coverage

| Component | Test File | What's Tested |
|---|---|---|
| OrgIconRail | `org-icon-rail.test.tsx` | Rendering (inferred from file existence) |
| OrgPickerSheet | `org-picker-sheet.test.tsx` | Rendering (inferred from file existence) |
| NotificationDrawer | `components/__tests__/notification-drawer.test.tsx` | Rendering |

No unit tests found for:
- `MemberSidebar`
- `MemberBottomNav`
- `MemberHeader`
- `OfficerSidebar`
- `OfficerMobileNav`
- `ErrorBoundary`
- `guards.ts`

---

## Coverage Score

| Area | Coverage |
|---|---|
| Auth guard / redirect | 85% |
| Officer layout guard | 40% (only happy path tested) |
| Member sidebar | 30% (post-login check only) |
| Officer sidebar | 60% (president only) |
| Mobile nav | 0% |
| Org switching | 10% (unit tests exist, no nav tested) |
| Position-based filtering | 20% (president only) |
| Error boundaries | 60% (API 500 + org 404) |

**Overall shell E2E coverage**: ~45%

---

## Priority Gaps

| Priority | Missing Test | Risk |
|---|---|---|
| P1 | Non-officer accessing `/org/:slug/officer/*` should redirect to dashboard | No test — relies entirely on guard code |
| P1 | `requireOrgOfficer` with invalid slug/orgId | No test for slug-not-found path |
| P2 | Treasurer sees only FINANCES/DOCUMENTS/SETTINGS sections | Not tested |
| P2 | Secretary sees only MEMBERS/COMMUNICATIONS/FEEDBACK | Not tested |
| P2 | OfficerMobileNav drawer closes after link click | Bug not covered by test |
| P2 | Bottom nav switches between personal and org modes | No test |
| P2 | Org switching via OrgIconRail rail click | No E2E test |
| P2 | UUID URL redirects to slug URL | No E2E test |
| P3 | `/join` route exists and renders | No test |
| P3 | Skip-to-main link works for keyboard users | No a11y test |
