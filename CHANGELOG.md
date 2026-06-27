# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.6.0] - 2026-06-27

### Added
- **Slice-2b — officer pay-link + dues management app (`apps/org`).** A new authed officer PWA (the second app on the lean scaffold, port 3005) that closes the officer half of the first-peso loop. Dr. Olive signs in (email + password over better-auth, cookie session), the app resolves her chapter, and she can: view the member roster, mint a tokenized pay-link for a member (tied to an outstanding dues invoice or an ad-hoc amount), share it by copy/SMS, revoke a just-minted link, and see who has paid on a dues dashboard (collected ₱, collection rate, paid/unpaid/overdue, recent payments, outstanding invoices). Built on `@monobase/ui` Friendly-Clarity tokens with the older-dentist accessibility baseline (18px base, ≥48px tap targets, WCAG AA, `role="alert"`/`role="status"`, labeled controls).
- **CSRF-aware authed SDK client** — a configured `@monobase/sdk-ts` client that sends the session cookie (`credentials: 'include'`), mirrors the `csrf_token` cookie into the `x-csrf-token` header on mutating non-allowlisted requests (matching the engine allowlist exactly), and injects the selected `x-org-id` on org-scoped reads. The reusable pattern for every future authed app.
- **Shared `centavosToPhp`** money formatter lifted into `@monobase/ui` so both apps render PHP centavos identically (`₱X,XXX.00`, tabular figures).

### Changed
- **Officer authorization is anchored to the engine, not a client pre-check.** `apps/org` relies on the engine's role/officer enforcement (403 on `listOrgMembers` and `send-link`), surfaced as a clear "officer or admin access required" state, rather than a client-side officer gate.

### Fixed
- **Money request/display boundary is bigint-safe** — amounts are coerced to `BigInt` only at the send-link request seam and to `Number` at every display boundary, with a double-tap guard so an officer can never mint two pay-links for one debt.

### Infrastructure
- **Test files are now typechecked** in `apps/org` (`tsconfig.test.json` + a typed SDK-mock helper) so a mock whose shape drifts from the real API fails compilation instead of passing green while production breaks. New CI `org` job (build → typecheck-incl-tests → unit tests) wired into the gate.

## [0.1.5.0] - 2026-06-27

### Added
- **Slice-2a — first-peso login-free pay-link page (`apps/member`).** A new minimal Vite + React + TanStack Router app — the canonical lean-app scaffold every later app copies — with one login-free route `/pay/:token`. A member opens a tokenized dues link, sees the amount GCash-style (`₱X,XXX.00`, tabular figures), taps **Pay now**, completes a PayMongo (test-mode) checkout into the org's own account, and lands on a clear paid / cancelled / error result. Built on `@monobase/ui` Friendly-Clarity tokens with the older-dentist accessibility baseline (18px base, ≥48px tap targets, WCAG AA, `role="alert"` on errors, labeled controls).
- **`usePayLink` state machine** — a single testable hook encapsulating validate + checkout + bounded 202-retry (3 attempts, no infinite loop) + `?status=success|cancelled` return handling, mapping every engine response (200/202/400/409/410/502) to a discriminated UI state. Double-tap can't fire two checkouts; a returned `cancelled` link can be re-paid and surfaces real outcomes instead of getting stuck.
- **Dev seed helper** (`services/api-ts/scripts/seed-paylink.ts`) that mints a real openable pay-link the wired engine can validate (slice-1 `payment_token` path) and encrypts the per-org gateway secret with the running API's `AUTH_SECRET`, so checkout decryption works end-to-end.
- Unit tests (SDK mocked, 31 tests) covering every state transition + a mocked-PayMongo Playwright E2E of the pay flow. A CI `member` job (build → typecheck → test) gates the new app.

## [0.1.4.0] - 2026-06-27

### Added
- **Slice-1 — login-free dues pay-link over PayMongo (test mode).** A member can tap an officer-sent pay-link, land on a no-login page, and pay dues (GCash / Maya / card) straight into the chapter's **own** PayMongo connected account — the founder is never in the money flow. Double-tapping the link can never double-charge: the token is claimed with a single-winner DB mutex before PayMongo is ever called, and a per-attempt Idempotency-Key makes a lost-response retry return the same checkout session.
- **Per-org PayMongo webhook** (`POST /webhooks/paymongo/:organizationId`) that verifies each event with **that org's** webhook secret, validates amount/currency/org against the recorded payment, and settles atomically. Claim-dedupe and settlement run in one transaction, so a crash mid-settle rolls back cleanly and the provider's redelivery reconciles instead of being silently deduped away.
- **Officer revoke** (`POST /org/:organizationId/payments/:tokenId/revoke`) — kill an unused pay-link; org-scoped with no cross-org existence leak.
- Per-org gateway resolver that decrypts each org's stored PayMongo secret per request; optional `Idempotency-Key` on the checkout adapter.

### Fixed
- **Latent lost-money bug:** collected online dues now actually reconcile into reports. Settlement moves the payment `pending → completed`, the invoice `→ paid`, and stamps the token used in a single lock-ordered, idempotent transaction — proven by a regression test asserting `totalCollected` moves 0 → amount and stays put on redelivery.

### Changed
- Re-pointed `POST /pay/:token/checkout` from Stripe to PayMongo behind the existing billing seam (additive; orphan handlers untouched). Schema gains additive pay-link columns (claim/session/revoke, per-org webhook secret) and invoice currency (PHP, centavos).

## [0.1.3.0] - 2026-06-26

### Added
- **T8 — "Friendly Clarity" design system in `packages/ui`.** Design tokens (`tokens.css`) and a shared Tailwind preset (`tailwind-preset.ts`) that every lean app (org, member, console) extends — one design language, no per-app forks. Plum + cream palette, Hanken Grotesk, 18px root type scale, 8px spacing, ≥48px tap targets, and the older-dentist accessibility baseline from DESIGN.md.
- **Shared pattern components:** `StatusBadge` (text + color membership statuses, never color alone), `EmptyState`, `ErrorState` (`role="alert"` + retry), and `ConfirmDialog` (consequential-mutation guard with a type-to-confirm `irreversible` variant). All exported from `@monobase/ui`.

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
