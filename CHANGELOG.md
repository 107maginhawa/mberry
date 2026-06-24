# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.2.1] - 2026-06-24

### Removed
- **Lean launch cleanup (T1-T4).** Pruned the repo to a lean product: deleted `apps/memberry` + `apps/admin` (full platform preserved at `/desktop/memberry-full`), the product docs under `docs/` (kept `docs/deploy` + `docs/security`), `plans/`, `.planning/`, `.audits/`, and root `ROADMAP.md` + `ARCHITECTURE.md`. The tested API engine (`services/api-ts`), `packages/*`, `specs/`, CI, and Railway pipeline are untouched.

### Changed
- **Workspace config:** dropped the deleted apps from `package.json` lint-staged + neutralized `test:sanity`; removed the root `test-setup-root.ts` DOM test harness (only served the deleted frontend apps; `services/api-ts` keeps its own bunfig preload).
- **CI reconciled for lean (re-pointed, not retired):** retired the memberry/admin E2E + frontend-build/deploy jobs (all NOTE-marked for re-adding lean-app jobs); kept the engine gates (contract, unit, coverage, build-api, migration-safety) green. `br-coverage` + `coverage-matrix` stay live — stripped deleted-app e2e references and re-baselined to the engine-only floor; lean content gets re-pointed in a later phase.
- **Docs rewritten lean:** `CLAUDE.md` (now encodes the Execution Standards + DESIGN.md/VERTICAL_TDD pointers), `AGENTS.md`, `README.md`, `QUICKSTART.md`; `CONTRIBUTING.md` trimmed with a lean banner. `VERTICAL_TDD.md` kept as the test-protocol anchor.

## [0.1.2.0] - 2026-06-19

### Added
- `DESIGN.md` design system: the Stripe/Linear list-item language, design tokens, card-vs-table responsive rule, and status/UI-state conventions.
- PWA installability: web manifest, `theme-color`, `favicon.svg`, and raster app icons (apple-touch + 192/512 maskable). No service worker — healthcare data is not cached.
- UI-consistency ratchet now blocks raw Tailwind status colors and arbitrary radii in `apps/memberry`, so design drift can't reappear.

### Changed
- The officer roster reflows from a dense table to scannable cards on narrow widths instead of forcing a horizontal scrollbar; the member card uses the Stripe-style list-item layout (no empty `—` placeholders).
- Raw Tailwind status colors and arbitrary `rounded-[Npx]` radii across `apps/memberry` converted to semantic `--color-*` / radius tokens via codemod.
- Status indicators (events, surveys, training, dues, documents, data export) now use the shared `StatusBadge`; loading/empty/error states use the shared `Skeleton`/`EmptyState`/`ErrorState`.

### Fixed
- Consequential one-click actions now require confirmation: mark dues invoice paid, reinstate membership, bulk-approve applications, and cancel event registration.
- Accessibility: visible focus rings on booking card links, `aria-label` on the remove-fund icon button, and a clear empty state for an unavailable invoice.
- Broken `/favicon.svg` reference (404).

## [0.1.1.0] - 2026-06-16

### Fixed
- Close cross-org data leaks: file metadata/download, vendor edits, job-board postings/applications, and peer CPD-credit views now reject access outside your organization
- Block cross-tenant file exfiltration: documents can no longer point at another org's stored file
- Lock down real-time calls/chat: signed per-call tokens, no insecure fallback secret, and per-message membership/org re-checks so removed members stop broadcasting
- Prevent double-bookings and event over-capacity under concurrent signups (atomic claims + database guards)
- Stop refunds from exceeding the original payment and stop Stripe webhooks from double-processing on retry
- Fix scheduled announcements blasting twice, and now honor unsubscribe/consent across email, in-app, and push
- Fix location-type filtering on time slots (was erroring instead of filtering)
- Let members re-register for an event after a no-show or cancellation
- Failed/denied actions are now written to the compliance audit trail
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
- Account-deletion cleanup now also removes a person's reviews, ad opt-outs/reports, chat memberships, and committee roles (data-privacy completeness)
- Major test-coverage expansion: API line coverage 90% → 94%, dues module 0 → 35 tests, plus repo-layer integration tests across many modules (7690 passing)
- Add database migration backing the new booking/event uniqueness guards

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
