# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- Fix UUID passed as orgSlug in dashboard/my routes — eliminates redirect round-trip on every org navigation
- Fix getTraining handler using fetch-then-check org isolation (TOCTOU) — now uses scoped query
- Fix getTraining auth guard returning raw JSON instead of throwing UnauthorizedError
- Fix useMyOrgs using untyped API response — now properly typed with MembershipApiResponse
- Fix silent error swallowing on membership fetch — OrgIconRail now shows error state
- Fix OrgProvider context value not memoized — reduces unnecessary re-renders
- Fix OrgProvider rendering children with empty orgId during loading
- Fix slug redirect silently catching network errors — now only catches 404/400

### Removed
- Delete dead `association:member/getMyMemberships.ts` handler (duplicate, not wired)
- Delete dead `training/getTraining.ts` handler and test (no auth, not wired)

### Added
- Add getTraining tests for wired handler (auth, org isolation, happy path, cross-org attack)
- Expand getMyMemberships tests (orgSlug presence, empty result, orgId alias enrichment)
- Add useMyOrgs hook tests (fetch, active org detection, error state, field mapping)
- Add OrgProvider context tests (slug resolution, officer check, context value)
- Add OrgIconRail component tests (render, active highlight, error state)
- Add OrgPickerSheet component tests (open/close, org list, status badges)
- Add CHANGELOG.md

## [0.1.0.0] - 2026-05-02

### Added
- **Memberry healthcare AMS app** with 11 modules covering the full association management lifecycle
- **Member dashboard** with org cards, stats, activity feed, and quick links
- **Dues & payments** module: config, funds, payments, refunds, financial dashboard, CSV reports, gateway setup, reminder processor
- **Membership** module: roster, detail views, applications, categories, bulk import
- **Events** module: CRUD, registration with capacity checks, check-in, attendance tracking
- **Training** module: CRUD, enrollment, completion, credit awards
- **Elections** module: CRUD, nominations, voting, tallies, status transitions
- **Communications** module: announcements with publish/archive lifecycle
- **Certificates** module: issuance with unique certificate numbers
- **Platform admin** app: association management, feature flags, impersonation
- **Design system** with purple-dominant palette, General Sans + Plus Jakarta Sans typography, and 22 shadcn/ui components
- **Desktop sidebar + mobile bottom nav** layout shell per DESIGN.md
- **Auth infrastructure** with invite tokens, professional fields, member onboarding
- **Database schemas** for all modules with Drizzle ORM migrations
- **Seed data script** for manual testing across all modules
- **Full test pyramid** for custom modules: 1267 API unit tests, 7 contract test suites (Hurl), 20 E2E specs (Playwright)
- **Shared test utilities**: make-ctx.ts with role helpers and repo stubs
- **VERTICAL_TDD.md** development protocol documentation
- Upgrade guide (removed — see CHANGELOG for version notes)

### Changed
- Reorganized E2E tests into journeys/member/officer directory structure
- Updated account app with onboarding flow, professional fields, and format-date robustness
- Extended SDK with association-scoped hooks

### Fixed
- Auth middleware wired on all custom module routes (previously unprotected)
- Removed /api prefix from module route registrations (Vite proxy strips it)
- Replaced shadcn useToast with sonner toast across 11 components
- Resolved TS4111 in make-ctx.ts index signature access
- CORS, auth role parsing, and date guard fixes
