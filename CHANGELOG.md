# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.22.2] - 2026-06-28

### Fixed
- Officers can now create paid events again. The create-event form sent the
  registration fee as a bigint, which serialized to a JSON string the engine
  rejected, so every paid event failed with "Could not create the event."
- Officers can now send dues pay-links again (single and bulk). The amount was
  sent as a bigint and rejected the same way, breaking the core "send a member
  their dues link" flow. Both paths now send a number and are verified live.

## [0.1.22.1] - 2026-06-28

Follow-up accessibility pass after re-running the impeccable audit on 0.1.22.0. Targets the remaining gaps to lift every surface to an 18+/20 audit score (packages/ui 17→~19, member 17→~19, console 19→20, org 18→~20).

### Fixed
- **Shared components meet the 16px text floor and 48px tap floor.** Form error messages, dropdown/tab/toggle/command menus, and other interactive controls in the design system rendered below 16px (leftover shadcn defaults); they now use the 18px tokens. Checkbox, switch, slider, and the dialog close button gained full 48px tap areas. A textarea regression that shrank text to 15.75px on desktop was removed.
- **Officers see plain-language dues statuses.** The dues list showed raw codes like "underReview" and "generated"; it now shows "Under review", "Overdue", etc.
- **Member payment-result screens use real icons** instead of bare ✓/ℹ characters, and the critical payment-error line is now full-size body text.
- **Console alerts** (create-org errors, "stats unavailable") are now full-size body text instead of 15.75px.
- Smaller consistency fixes: org amount input uses the shared field component; semantic color classes replace arbitrary CSS-var utilities.

### Note
- Deliberately did **not** add a responsive table-to-card reflow to the shared `Table`: no phone-primary table surface exists and the console table is design-exempt, so it stays a desktop pattern. Tracked in the audit report.

## [0.1.22.0] - 2026-06-28

Impeccable technical audit (a11y / perf / theming / responsive / anti-patterns) across `packages/ui` + all three apps, followed by full P1→P3 remediation. Report: `docs/audits/impeccable-audit-2026-06-28.md`. All four surfaces scored in the "Good" band with no P0s; fixes land in the shared design system where possible (no per-app forks).

### Fixed
- **Readable shared components.** Form labels, table text, and select menus rendered below the 16px floor (shadcn defaults left un-retuned); they now use the 18px design-system tokens. Select controls are a full 48px tap target. Older users on phones can read and tap them.
- **Officer "Send pay-link" no longer reloads the whole app.** The most-used roster action was a plain link that triggered a full page reload (re-login, re-fetch, lost scroll) on every tap; it's now in-app navigation. Faster and keeps your place on slow mobile connections.
- **Officer screens show loading skeletons** instead of plain "Loading…" text (Roster, Dues, Events, Payment settings), so the page doesn't jump when data arrives.
- **Member pay page is now navigable by screen readers.** The login-free pay-link and its result screens gained a page landmark and a real heading — previously absent on the most important money screen.
- **Console org list** now shows a proper empty state ("Create your first organization") and a friendly error state instead of a bare line of text, and its column sort headers are tappable on touch.
- **Smaller fixes:** receipts no longer print "Paid —" for a payment with no date (the line is omitted); the dues summary stacks instead of clipping large peso amounts on narrow phones; the brand font preconnects for a faster first paint; hand-rolled sign-in inputs now use the shared field component with its standard focus ring.

## [0.1.21.2] - 2026-06-28

### Fixed
- **Dashboard error tiles no longer show a box-in-a-box.** When a member dashboard tile (membership, receipts, events, digital card) failed to load, the error message rendered as a second framed box nested inside the tile's card. The error now fills the tile body flush, with no double frame. The "Try again" retry and screen-reader alert behavior are unchanged.

## [0.1.21.1] - 2026-06-28

### Fixed
- **Officer app sign-in works in local dev.** The API now trusts `http://localhost:3005` (officer app) and `http://localhost:3006` (console) as origins, alongside `:3004` (member). Before, officers hit "Invalid origin" CSRF errors the moment they tried to sign in or take any action locally. Production origins are unaffected — they come from the explicit `CORS_ORIGINS` env var.

## [0.1.21.0] - 2026-06-28

Error-tile retry parity across `apps/org`, mirroring the member dashboard harden. When a screen fails to load, officers now get a **Try again** button that refetches instead of a dead-end "Please refresh." Wiring stays app-level; the shared `ErrorState` component is unchanged.

### Changed
- **Retry on the Dues screen.** Recent-payments and outstanding-invoices error tiles now refetch on **Try again**. Reworded "Could not load X. Please refresh." → "We couldn't load X."
- **Retry on Events.** The events list error swaps its bespoke inline banner for the shared `ErrorState` with a **Try again** that refetches (kept the officer/admin access hint).
- **Retry on the Roster.** A failed roster load (often a 403 for non-officers, but also a network blip) now shows a real error with **Try again** instead of a passive "Roster unavailable" empty state.
- **Retry on Payment settings.** The gateway-status load error becomes a shared `ErrorState` with **Try again** (kept the 2FA officer caption).

## [0.1.20.0] - 2026-06-28

UI/UX audit pass over `apps/org`, `apps/member`, and `packages/ui` (impeccable). Fixes land in the shared design system so all three apps benefit, no per-app forks.

### Added
- **Persistent header on the member app.** Every signed-in member screen (dashboard and digital card) now shows the shared app header with a clear **Sign out**. Before, sign-out lived only at the bottom of the dashboard and was missing from the card screen entirely.
- **Retry on the member dashboard.** When membership, receipts, or events fail to load, the tile now shows a **Try again** button that refetches, instead of a dead-end "Please refresh." A network blip is one tap to recover.
- **Reduced-motion respected.** Users who ask their device to reduce motion no longer get the skeleton shimmer or transitions (global guard in the design system).

### Fixed
- **Pay-now button was nearly unreadable.** The login-free pay-link's primary button rendered dark-on-plum (about 1.8:1 contrast) because the shared class merger dropped its text color. The button is now white-on-plum (12.6:1). This was the single most important button in the product. Same class of bug could have silently stripped the text color from any colored button given a custom text size.
- **Inputs now meet the 48px tap target** and never shrink below 16px text on desktop (was 36px tall with 14px text), so older users on phones can tap and read them.
- **Plain-language sign-in errors.** Officers and members no longer see raw technical strings like "Invalid origin"; errors map to clear next steps ("We couldn't verify this device. Refresh the page and try again."), and a dropped network connection now shows a friendly message instead of leaving the button stuck on "Sending…".
- **Roster CSV file picker** now meets the 48px tap target.
- Stronger keyboard focus rings and a pressed state on buttons; card descriptions and payment-settings help text raised to readable sizes; the pay card's all-caps eyebrow replaced with a plain readable label.

### Changed
- Card depth and the warm cream background now use the design system's own tokens (brand shadow + the four-radial cream wash from DESIGN.md) instead of flat defaults.
- Tap-target sizing is defined once via the `min-h-tap` token across both apps (no more hardcoded `48px`).

## [0.1.19.0] - 2026-06-28

### Added
- **Publish events (`apps/org`).** The Events screen now lists the chapter's events with a status badge each, drafts first. A **Publish** button on draft rows (with a confirm — "Members will see this event and can register") makes the event visible to members, who previously could never see officer-created events. Newly created events appear in the list immediately, ready to publish.

### Fixed
- A failed publish now shows an error toast instead of silently doing nothing; if an event was already published elsewhere, the list reconciles automatically; and all Publish buttons disable while a publish is in progress so a second one can't be lost.

## [0.1.18.0] - 2026-06-28

### Added
- **Bulk send-pay-link (`apps/org` roster).** Officers can now mint pay-links for many members at once: tap **Select**, check members (or **Select all**), and **Send links to N selected**. Each member gets a pay-link for their oldest outstanding dues; members with no dues are skipped. A money-confirm step gates the batch, links mint one at a time with live progress, and a results screen shows per-member status with **Copy** and **Copy all sent links** (distribute manually until SMS lands). Single-send (custom amount) is unchanged.

### Changed
- **Cleaner officer navigation.** Removed the redundant per-page "Back to dashboard" / "Roster" links on Events, Announcements, Payment settings, and Import — the shared app header already provides navigation on every screen.

### Fixed
- Bulk send mints exactly the members shown in the confirmation count (a member hidden by search can no longer be charged past the confirmed number), a failed dues lookup surfaces as an error instead of a false "no dues", and a second bulk send in the same session works correctly.

## [0.1.17.0] - 2026-06-28

### Added
- **Passwordless officer sign-in (`apps/org`).** Officers now sign in with a 2-step email OTP (Step 1 of 2 / Step 2 of 2 indicator), the same flow as members, instead of email + password. Reuses the existing `/auth/email-otp/*` endpoints; production two-factor for privileged officer roles still applies on top.
- **Shared app shell with sign-out (`packages/ui` `AppHeader`).** Console and org now have a persistent header (title + scrollable nav + a labelled **Sign out** "emergency exit") on every authed screen — closing the cross-app gap where there was no way to sign out. One shared component, no per-app fork.
- **Org primary nav consolidated into the header** with current-location highlighting, replacing the scattered per-page links.
- **Search on long lists.** Officer **Roster** and the console **Organizations** table both gained client-side search; the console table also gained sortable Name / Created columns.
- **Money-step confirmation (`apps/org` Send pay-link).** Sending a pay-link (invoice or custom amount) and revoking a link now pop a confirm dialog ("Send ₱X to [member]?" / "Revoke?"), so a typo'd custom amount or a fat-finger revoke can't fire a live-money action by accident.

### Changed
- **Member home is now a "poster" (`apps/member`).** A single `StandingHero` answers standing + dues + the Pay action above the fold, with receipts/events/digital-card/contact-officer demoted below it (replaces the four equal-weight tiles). Adds an actionable **Contact your chapter** affordance (tel:/mailto:) and a sign-out control.
- **Design-system consistency sweep.** Shared `Button` now defaults to a 48px tap target (dense `sm`/`xs` are explicit opt-ins); console moved off raw Tailwind type/inline font-size onto design tokens + `StatusBadge`; `CreateEventForm` groups its 8 fields into Basics / When / Details sections.

### Fixed
- Member pay-link cancelled state now shows a "Payment cancelled — you can try again" banner instead of looking like a glitch.

## [0.1.16.0] - 2026-06-28

### Changed
- **Wave C founder checklist updated for the Connect-PayMongo UI (B5).** `docs/WAVE_C_FOUNDER_CHECKLIST.md` now describes the officer **Payment settings** screen as the primary way to load a chapter's PayMongo keys (with the `seed-paymongo-creds.ts` script as the scripted/CI alternative), and marks the "officer Connect-PayMongo UI" backlog item DONE. Docs only.

## [0.1.15.0] - 2026-06-28

### Added
- **Wave B / B5 — officer Connect-PayMongo screen (`apps/org` + engine).** An officer (Treasurer/President) can now connect their chapter's PayMongo account from a new **Payment settings** screen instead of running a seed script: paste the public key, secret key, and webhook secret, see connection status, run **Test connection**, and **Disconnect**. The screen shows the exact per-org webhook URL to register in PayMongo and notes that **test keys (`pk_test_`/`sk_test_`) work end-to-end with no live activation**, so a chapter can be dogfooded before going live. The dues-gateway request now accepts a `webhookSecret` (stored AES-256-GCM encrypted), `upsertDuesGatewayConfig` marks the gateway `connected` so checkout works immediately, and `testDuesGatewayConnection` now makes a real authenticated PayMongo call (`GET /v1/payments`) that confirms or downgrades the connection.

### Security
- **Secret-leak fix:** the gateway-config read paths now strip **both** the encrypted secret and the encrypted webhook secret from every response. Secret key and webhook secret are write-only — never returned, never pre-filled in the UI (password inputs), never logged.
- The connect/test/disconnect actions are officer-gated (admin + Treasurer/President, two-factor required in production); a 403 surfaces as a friendly alert.

### Notes
- The webhook URL shown is derived from the configured public API origin (`VITE_API_URL`); registering it in the PayMongo dashboard (event `payment.paid`) remains a manual step. This replaces the `seed-paymongo-creds.ts` script for officer self-service.

## [0.1.14.0] - 2026-06-28

### Added
- **Wave C — founder onboarding checklist + per-org PayMongo credential seed.** `docs/WAVE_C_FOUNDER_CHECKLIST.md` is a concrete G1 (business entity + production secrets) / G2 (per-chapter PayMongo connected account + webhook registration) / G3 (PH SMS sender) checklist, with a "LIVE-gated vs buildable-now" status table and the full first-peso click-through. Since there is no officer "Connect PayMongo" UI yet, `services/api-ts/scripts/seed-paymongo-creds.ts` loads a chapter's PayMongo keys into its `dues_gateway_config` row (AES-256-GCM encrypted, `connected=true`) and prints the webhook URL to register — the one manual step to take a chapter live once G2 lands. No engine, spec, or SDK change (a doc + a dev script).

## [0.1.13.0] - 2026-06-28

### Added
- **Wave B / B2 — member self-serve dues payment (`apps/member` + engine).** The member dues tile is now actionable: when a member has outstanding dues, a **"Pay now"** button mints a one-tap payment link for their own invoice and takes them straight to the existing login-free `/pay/:token` checkout. This adds one new member-authenticated engine endpoint, `POST /org/{organizationId}/payments/mint-mine` (`mintMyPaymentLink`), that reuses the same PayMongo payment-token rail as the officer-sent links — the member is never in a separate money flow. The amount is always derived server-side from the member's own invoice (never trusted from the client), and the endpoint enforces invoice ownership, organization match, and unpaid status. To support member-initiated links, `payment_token.created_by_officer` is now nullable (migration 0086).

### Security / correctness
- **No double-charge:** minting is guarded so a member can hold at most one active payment link per invoice — the check and the token creation run in a single transaction with a row lock on the invoice, so even two simultaneous "Pay now" taps resolve to one link (the second returns "a payment is already in progress"). The button also disables after the first tap.
- **Self-scope only:** a member can only mint a link for an invoice they own, in an organization they belong to, that is still unpaid — verified by real-Postgres integration tests (ownership / cross-org / paid / cancelled / concurrent-double-mint all covered).

### Notes
- **LIVE checkout is G2-gated** (PayMongo platform account). The mint endpoint, token, and `/pay` page work in test mode now; real card / GCash payment needs G2. Carried to the founder checklist.
- **Deferred (flagged):** partial payments and choosing among multiple invoices (v1 pays the first outstanding invoice); an officer-sent link concurrent with a member self-mint can still create two active links for one invoice (the officer endpoint is unchanged) — handled by the locked v1 manual-refund policy.

## [0.1.12.0] - 2026-06-28

### Added
- **Wave B / B4 — upcoming events tile for members (`apps/member`).** The member dashboard now has its fourth tile: **Upcoming events**. It lists the next published events in the member's chapter (title, date, location, fee or "Free", and spots-left when capacity is set). Free events get a one-tap **RSVP** button; the button switches to "Registered" (disabled) after a successful RSVP, and a full event shows "Added to the waitlist". Paid events show the price and a "Paid registration coming soon" note (paid checkout is deferred). Built on `@monobase/ui` Friendly-Clarity tokens with the older-user accessibility baseline (≥18px text, ≥48px tap targets, per-event RSVP labels, loading/error/empty states). Engine stays frozen — pure-FE over the existing public events + register endpoints; no handler, spec, migration, or generated-SDK change.

### Notes
- **Deferred (flagged):** paid event checkout (runs the legacy Stripe rail + is G2-gated), event detail/calendar, and un-RSVP. **Coherence gap:** events created by an officer in B3 are saved as drafts with chapter-internal visibility, so they are not yet discoverable in this member tile — the member events list only shows network-visible, published events. An officer "publish event / make network-visible" flow is a deferred follow-up; until then this tile reads from any already-published events.

## [0.1.11.0] - 2026-06-28

### Added
- **Wave B / B3 — minimal events for officers (`apps/org`).** An officer can now **create an event** and **post an announcement** from the org app. The new `/events` screen has a single-task "Create event" form (title, type, start/end, optional location, capacity, registration fee in PHP, description); the optional fee is sent as integer centavos over the existing `POST /association/events`. The new `/announcements` screen posts an announcement (title + message) and **actually publishes it** by chaining the create + publish endpoints, so "Announcement posted" is truthful (not a hidden draft). Both screens link from the dashboard. Built on `@monobase/ui` Friendly-Clarity tokens with the older-user accessibility baseline (≥18px text, ≥48px tap targets, labeled inputs, native date/select controls, `role="alert"` errors, one primary task per screen). Engine stays frozen — pure-FE over existing handlers; no handler, spec, migration, or generated-SDK change.

### Notes
- **Two-factor required in production.** Both creating events and posting announcements are gated by an officer position that requires two-factor authentication in production (President/Secretary, and the event route because it allows President). Without 2FA the officer gets a friendly "Two-factor authentication required" alert (no crash); each form shows an up-front note. **Founder action:** the pilot officer must enable 2FA before creating events / posting announcements in production.
- **Deferred (flagged):** event/announcement list & manage views, event editing/cancellation, scheduling, CPD/credit-bearing events, capacity-waitlist UI. Member-facing event view + RSVP is the next sub-slice (B4).

## [0.1.10.0] - 2026-06-28

### Added
- **Wave B / B1 — digital membership card (`apps/member`).** A signed-in member can open a digital membership card from the dashboard ("View digital card" → `/card`). The card shows their organization, name, license number, membership status, photo (with initials fallback), and a "Valid until" date, plus a scannable QR code ("Scan to verify membership") and their credential number. It consumes the existing `GET /persons/me/id-card/:orgId` endpoint over a raw authenticated fetch (the endpoint is wired in the engine but not in the SDK), so the engine stays frozen — no handler, spec, migration, or generated-SDK change. Built on `@monobase/ui` Friendly-Clarity tokens with the older-user accessibility baseline (≥18px text, ≥48px tap targets, labeled QR, image alt text, back-to-dashboard link, one primary task per screen). The QR encodes a self-contained `payload.signature` so a future verifier can validate it server-side via the existing public credential-verify endpoint.

### Notes
- **Deferred (flagged):** a public verifier/scan UI, PDF download, and wallet passes are out of scope for this slice. The login-free `/pay/:token` page stays untouched and unauthenticated.

## [0.1.9.0] - 2026-06-27

### Added
- **Wave A — founder/platform-operator console (`apps/console`).** The last of the three lean apps. A founder/platform operator can sign in with email + password and, from one authed PWA, see every organization on the platform plus basic stats, and create a new organization. The home screen shows a stats strip (organizations, associations, and snapshot-derived members / active / revenue / average collection) over an organizations table, with a primary "Create organization" action. The create-org form posts to the existing `POST /admin/organizations` (super-admin gated), picking an association from a dropdown and an org type (chapter / society / national / clinic); engine errors (not-super, duplicate name, association-not-found) surface as inline alerts. Built on `@monobase/ui` Friendly-Clarity tokens with the older-user accessibility baseline (≥18px text, ≥48px tap targets, `role="alert"` on errors, labeled inputs, one primary task per screen). New port 3006; a new CI `console` job (build → typecheck-incl-tests → test) gates it.
- **Honest empty-states for snapshot-derived stats.** Platform members / revenue / collection figures come from a monthly snapshot job, not from creating orgs or importing rosters, so on a fresh platform they are genuinely unavailable. The console shows a skeleton while loading, "Stats unavailable" on error, and "No snapshot for this month yet" (em-dash tiles) when ready-but-empty — never a confident `0` / `₱0.00`. Organizations and Associations counts come from live tables and are always real.
- **Founder bootstrap seed script (`services/api-ts/scripts/seed-console.ts`).** A dev-only, additive seed that creates a super platform-admin user plus one association so the console flow can run end-to-end against a local stack. The engine stays frozen otherwise — no handler, spec, migration, or generated-SDK change in this slice.

### Notes
- **Deferred (flagged, not silently cut):** seeding the first officer account at org-creation time and generating each org's PayMongo connect-onboarding link. Officer onboarding is already served by the shipped roster import + email-OTP account-claim; PayMongo connect onboarding is blocked on the PayMongo platform account (G2) and is net-new payment-rail work. Console v1 deliberately creates the organization row only.

## [0.1.8.0] - 2026-06-27

### Added
- **Slice-3 — member dashboard + passwordless login (`apps/member`).** A chapter member can now sign in without a password and see their own dues at a glance. On a new `/sign-in` screen they enter their email, receive a 6-digit one-time code by email, and verify it — better-auth creates their session. The new `/dashboard` shows three read-only tiles: membership status (org name, active/expired, renewal date), dues owed (the sum of any outstanding invoices, with a note to pay via the link their chapter sent), and recent receipts (receipt number, amount, date, status). Built on `@monobase/ui` Friendly-Clarity tokens with the older-dentist accessibility baseline (≥18px text, ≥48px tap targets, `role="alert"` on errors, labeled inputs, one primary task per screen). The public login-free `/pay/:token` page stays untouched and unauthenticated; the pay-success screen now offers a "Create an account to track your dues" link into sign-in.
- **Account-claim by email (engine, additive).** When a member who was added via roster import logs in for the first time, the engine now links their new login to their existing roster record by matching the email — so their real memberships, dues, and receipts appear immediately instead of an empty dashboard. The link is gated on a verified email (the one-time code proves inbox ownership), so a password signup can never seize a roster member's identity.

### Changed
- **`apps/member` is now an authenticated app.** It gained the CSRF-aware SDK client, a session probe, an organization selector, and a route guard (mirroring `apps/org`), while keeping the `/pay/:token` flow public. Money is coerced to `Number` at every display boundary, and the member's organization is resolved reactively from their session so dues load as soon as the session does.

### Notes
- Additive-only on the engine: the sole engine change is the account-claim logic in the better-auth user-creation hook (`core/auth.ts`); TypeSpec specs, the generated SDK, and all other handlers are byte-untouched, and there is no migration.
- OTP delivery is by email (the engine's only OTP channel). Phone-first OTP and member self-serve "pay now" are flagged engine follow-ups, out of scope here. Live end-to-end OTP delivery waits on email/SMS infrastructure (G3) and the founder's PayMongo paperwork (G2).

## [0.1.7.0] - 2026-06-27

### Added
- **Slice-2c — roster CSV import (`apps/org`).** An officer can now populate the chapter roster — the funnel asset that feeds dues and future health apps — by uploading a CSV. On a new `/import` screen, the officer picks a membership tier, uploads a `.csv` exported from a spreadsheet, sees a parsed preview (member count plus advisories for rows missing an email/license or a first name), and clicks "Import N members". The frozen engine match-or-creates membership rows and returns a summary the officer sees immediately: new members added, already-members skipped, and a per-row list of any failures. The roster screen's empty state and header now link straight to import. After a successful import the roster refreshes automatically.
- The CSV is parsed entirely in the browser (RFC-4180: quoted commas, escaped quotes, embedded newlines, CRLF, and a leading UTF-8 BOM from Excel-on-Windows) and posted as a JSON array — no file upload plumbing. Headers auto-map case-insensitively (`first name`/`firstName`, `email`, `PRC`/`license`, `member no`, etc.). Files over the engine's 500-row cap are blocked client-side with a clear message.
- Built on `@monobase/ui` Friendly-Clarity tokens with the older-dentist accessibility baseline (≥18px text, ≥48px tap targets, `role="alert"` on every error, labeled inputs, one primary task per screen). Authorization is the engine's (Secretary/President via `requirePosition`, which also enforces 2FA in production) — a 403 surfaces as a friendly message, with no redundant client-side gate.

### Notes
- Engine, TypeSpec specs, and the generated SDK are byte-untouched (additive-only). The feature is pure new UI in `apps/org` over two already-shipped, frozen engine endpoints (`importRosterMembers`, `listMembershipTiers`).
- Live officer click-through and a real import against a seeded chapter wait on the founder's PayMongo/entity paperwork (G2) — not blocking this slice.

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
