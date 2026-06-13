# AHA Module/Group Gap Plan: Person & Profile (+ deletion cascade)

Date: 2026-06-11
Prompt: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Person & Profile (+ deletion cascade) |
| Module slug | person-profile |
| Type | Business Module (Central PII hub) + Domain Workflow Group (person.deleted cascade) |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/person-profile-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m02-member-profile/MODULE_SPEC.md` (Spec v2.0, 2026-05-21) |
| Supporting PRDs/specs used | `docs/product/modules/m02-member-profile/API_CONTRACTS.md`, `docs/architecture/adr/0005-person-module-as-pii-safeguard.md`, `docs/architecture/adr/0006-domain-event-bus-for-cross-module-cascades.md` (referenced via ADR-0005), `docs/product/EVENT_CONTRACTS.md`, `docs/product/MODULE_SPEC.member.directory.md` (privacy/directory seam), CLAUDE.md §P1.6 |
| PRD/spec coverage quality | Strong |
| Paths inspected | `services/api-ts/src/handlers/person/**` (handlers, repos, jobs, utils), `services/api-ts/src/core/domain-event-consumers.ts`, `core/domain-events.ts`, `core/domain-events.registry.ts`, `services/api-ts/src/generated/openapi/routes.ts` + `validators.ts` (person sections), `services/api-ts/src/app.ts` (hand-wired person routes), `specs/api/src/modules/person.tsp` + `person-custom.tsp`, `apps/memberry/src/routes/_authenticated/my/{profile,settings,id-card}.tsx`, `apps/memberry/src/routes/_authenticated/settings/{account,security}.tsx`, `apps/memberry/src/features/person/components/personal-info-form.tsx`, `specs/api/tests/contract/person-*.hurl` + `persons-extended-flow.hurl`, `docs/quality/HAND_WIRED_ROUTES.yaml`, `services/api-ts/src/handlers/member/directory/searchDirectory.ts`, `services/api-ts/src/handlers/association:member/utils/trust-signals.ts`, `association:member/repos/directory.schema.ts` |
| PRDs/specs inspected | m02 MODULE_SPEC.md (full), m02 API_CONTRACTS.md (endpoint inventory), ADR-0005 (full), EVENT_CONTRACTS.md (full), MODULE_SPEC.member.directory.md (full) |
| KG used | Yes (existing `.understand-anything/` graph via `docs/aha/kg/knowledge-graph-status.md`; secondary evidence only) |
| KG refreshed | No |
| `/understand-domain` used | Yes (status doc only; product docs richer per `docs/aha/kg/domain-knowledge-status.md`) |
| `/understand-domain` refreshed | No |
| Webwright used | No — static review sufficient; browser tooling skipped for batch run |
| Playwright/E2E inspected | Yes (inspected only — `apps/memberry/tests/e2e/profile.spec.ts`, `settings.spec.ts`, `member/digital-id-card.spec.ts`; nothing executed) |
| Existing tests inspected | 29 unit test files in `handlers/person/`, `core/domain-event-consumers.test.ts`, `core/auth-password-session-revocation.test.ts`, 3 person Hurl contract files, 3+ E2E specs |
| Cross-cutting audit reviewed | Not Available (prompt 05 not yet run) |
| Database/schema audit reviewed | Not Available (prompt 06 not yet run) |
| Limitations | Static review only; no runtime/browser verification ("Static review sufficient; browser tooling skipped for batch run"). Generated `validators.ts` inspected at the relevant schemas only. Better-Auth email-change internals not traced (`[NEEDS CONFIRMATION]` items below). |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| M02 Member Profile spec | `docs/product/modules/m02-member-profile/MODULE_SPEC.md` | PRD/module spec | Current (v2.0, validated vs MASTER_PRD v3.0) | Primary: workflows WF-010–WF-014, BRs M2-R1…R14, ACs AC-M02-001…008 |
| M02 API contracts | `docs/product/modules/m02-member-profile/API_CONTRACTS.md` | API contract | Current but path-drifted (`/my/*` vs actual `/persons/me/*`) | Endpoint expectations, domain events per endpoint |
| ADR-0005 | `docs/architecture/adr/0005-person-module-as-pii-safeguard.md` | implementation plan/ADR | Current (2026-06-06) | PII centralization rule, cascade routing via `accountDeletionCascade.ts` |
| EVENT_CONTRACTS.md | `docs/product/EVENT_CONTRACTS.md` | API contract (events/jobs) | Partially stale (claims pg-boss at-least-once for domain events; actual bus is in-process at-most-once; describes `accountDeletionCascade` indirectly) | `person.deletionProcessor` job contract, event catalog, Flow 3 deletion flow |
| Directory module spec | `docs/product/MODULE_SPEC.member.directory.md` | module spec | Current (R4) | Privacy seam: directory visibility model vs M02 privacy settings; documents the `searchDirectory` 403 gotcha and missing `(orgId, personId)` uniqueness |
| CLAUDE.md §"Domain-event cascades (P1.6)" | `CLAUDE.md` | implementation note | Current | Declares the 9-subscriber `person.deleted` cascade as the design baseline |
| Hand-wired route allowlist | `docs/quality/HAND_WIRED_ROUTES.yaml` | API contract | Current | ID card (2 routes) + data export (3 routes) registered hand-wired by design |

## 3. Expected vs Actual

Expected (per m02 spec): a member can (1) view/edit profile incl. photo, (2) control directory privacy per org with effect within 1 minute, (3) manage notification preferences per category, (4) change password/email securely, (5) export their data (rate-limited, 7-day TTL), (6) request account deletion with a 30-day grace, blocked by pending payments or sole-officer status, with anonymization + cascade after grace, and (7) download a QR-verified digital ID card per org.

Actual:

- **Profile view/edit**: Implemented. Frontend (`apps/memberry/src/routes/_authenticated/my/profile.tsx`) edits via `updatePerson` (`PATCH /persons/:person` with `'me'` alias), which supports the full field set incl. `bio`, `licenseNumber`, `prcId`, `contactInfo`, `primaryAddress`. The *contract* self-service endpoint `updateMyProfile` (`PATCH /persons/me`) accepts a much narrower body (`PersonMeUpdateRequest`) and silently drops its own `phone` field (see §10 G-05). No license-format validation anywhere (BR-23).
- **Privacy settings**: **Broken end-to-end.** The handler reads `organizationId` from the body but the TypeSpec contract field is `orgId`; the generated Zod validator passes only `orgId`, so every real request through `PATCH /persons/me/privacy` throws `ValidationError('organizationId is required')` (§10 G-01). Even when fixed, 4 of 7 visibility toggles (`emailVisible`, `phoneVisible`, `photoVisible`, `addressVisible`) are not consumed by the directory module at all — only the 3 trust-signal toggles are enforced (§10 G-02).
- **Notification preferences**: Implemented per person+category (push/email toggles, in-app always on per M2-R8). Per-org scoping is half-implemented: insert uses fail-open `ctx.get('organizationId')`, lookup ignores org (§13).
- **Security settings**: Password change + 2FA + sessions implemented (`apps/memberry/src/routes/_authenticated/settings/security.tsx`; revocation covered by `core/auth-password-session-revocation.test.ts`, AC-M02-008 tests). Email change with OTP (M2-R1) has no visible UI flow and `updatePerson` accepts `contactInfo.email` changes without verification `[NEEDS CONFIRMATION]` (auth login email is Better-Auth-owned and separate).
- **Data export**: Implemented synchronously (both `GET /persons/me/export` and the "async-shaped" `POST /persons/me/data-export` generate inline). Shared 24h rate-limit ledger works. Payload omits certificates (spec WF-014) and the `exportMyData` response shape does not match its own `MyDataExport` contract model (§10 G-08). ZIP packaging deferred (documented in-code as EM-M02-9f0a1b2c P3).
- **Account deletion**: Implemented well at the request/cancel/processor level: M2-R5 guards (pending dues payments, sole-officer), 30-day schedule, idempotent daily `deletionProcessor`, session kill before scrub, audit without PII, `person.deleted` cascade with 9 subscribers covering ~24 tables, all unit-tested. Gaps: anonymization misses `bio` (and `gender`) in both scrub sites (§10 G-03); `person.deletion.requested` / `person.deletion.cancelled` / `person.anonymized` / `data-export.ready` events have **zero consumers** so officers are never notified (§10 G-07); no persistent grace-period banner (AC-M02-003); `executeAccountDeletion.ts` is an unrouted dead handler duplicating the scrub list (§12).
- **Digital ID card**: Implemented (hand-wired `GET /persons/me/id-card/:orgId` + `/pdf`, pdf-lib, HMAC-signed QR per BR-18, `/verify/:memberId` link). Gaps: HMAC falls back to the literal string `'fallback-secret'` when `AUTH_SECRET` is unset (§10 G-04); frontend uses `memberships[0]` with no org selector for multi-org members (WF-012 step 1).
- **Cascade**: `accountDeletionCascade.ts` is the documented emit-only shim; `core/domain-event-consumers.ts` implements 9 `person.deleted` subscribers matching CLAUDE.md P1.6 and is well-tested (`core/domain-event-consumers.test.ts` incl. failure-isolation test). The bus awaits `Promise.allSettled` so subscribers complete before the processor continues, but failures are log-only — at-most-once with no retry/aggregation, while `EVENT_CONTRACTS.md` §0.1 claims at-least-once with pg-boss retries (doc/impl mismatch). Chat/DM content (`comms`), email queue rows, `notifications` recipients, survey responses, bookings, and S3 objects behind deleted `documents`/avatar are not in the cascade `[NEEDS PRODUCT DECISION]`.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-010 profile view/edit | Edit personal info, photo, license | Edit via `updatePerson` ('me' alias); photo upload only in onboarding/settings-account, not profile edit form | `my/profile.tsx` (ProfileEditForm, no avatar field); `personal-info-form.tsx` (ImageCropperDialog) | `updatePerson.ts`; `updateMyProfile.ts` (narrow contract) | `person.schema.ts` | `updatePerson.test.ts`, `updateMyProfile.test.ts`, `profile.spec.ts` (E2E) | Partially Implemented | Yes (G-05, G-12, G-13) |
| M2-R1 email change OTP | OTP on new email before switch | No email-change UI; `contactInfo.email` mutable via `updatePerson` without verification | `settings/security.tsx` has no email card | `updatePerson.ts:80` | — | none | Missing `[NEEDS CONFIRMATION]` | Yes (G-11) |
| M2-R2 password change revokes sessions | Immediate revocation | Implemented in Better-Auth integration | `ChangePasswordCard` | `core/auth-password-session-revocation*` | better-auth session | `ac-m02.member-profile.test.ts` AC-M02-008 block; `core/auth-password-session-revocation.test.ts` | Implemented | No |
| M2-R3 / AC-M02-002 privacy toggle → directory ≤1min | Toggle changes directory visibility | PATCH endpoint always 400s (field-name mismatch); email/phone/photo/address toggles unenforced in directory even if saved | `my/settings.tsx:317` sends `orgId` | `updateMyPrivacySettings.ts:26` reads `organizationId`; validator `UpdatePrivacySettingsRequestSchema` passes `orgId` only | `privacy-settings.schema.ts` (7 flags) | Unit tests bypass validator (fake-green); contract asserts `status < 500` | Missing (broken) | **Yes (G-01, G-02)** |
| M2-R4 / AC-M02-006 export rate limit 1/24h | 429 on second request | Implemented, shared ledger across both export endpoints | `data-export.tsx` | `requestDataExport.ts:36-49`, `exportMyData.ts:30-42` | `data-export.schema.ts` | `ac-m02` AC-M02-006 block, `requestDataExport.test.ts` | Implemented | No |
| M2-R5 / AC-M02-007 deletion guards | Block on pending payments / sole officer | Implemented (dues payments in-flight statuses; sole *active officer in org*) | `my/settings.tsx` GeneralSection | `requestMyAccountDeletion.ts:37-82` | `dues-payments.schema`, `governance.schema` | `requestMyAccountDeletion.test.ts`, AC-M02-007 tests, `person-lifecycle.hurl` | Implemented (scope `[NEEDS CONFIRMATION]` re unpaid invoices) | Minor (Q-3) |
| M2-R6 / BR-32 financial retention 7yr anonymized | Payments preserved, proof scrubbed | `duesPayments` proof fields nulled, amounts preserved; person row retained for FK | — | `domain-event-consumers.ts:1221-1228` | `dues-payments.schema` | `domain-event-consumers.test.ts` | Implemented | No |
| M2-R7 / BR-19 ID card regeneration | Regenerate on profile/status change | Cards generated on-the-fly; `person.updated` + `membership.status.changed` consumers notify member | — | `domain-event-consumers.ts:1034-1098` | — | covered in consumers test file | Implemented | No |
| M2-R8 in-app always on | Cannot disable in-app | In-app not stored as a preference; UI states it | `my/settings.tsx:244` | `notification-preferences.schema.ts` (push/email only) | same | `notification-preferences.test.ts` | Implemented | No |
| M2-R9 / AC-M02-001 photo validation 5MB, formats | Format+size check, crop | Upload via storage module; crop dialog exists in `personal-info-form.tsx`; not on profile edit screen | `ImageCropperDialog` | storage handlers `[SHARED DEPENDENCY]` | avatar JSONB | storage SVG tests (per audit index) | Partially Implemented | Yes (G-13) |
| M2-R10 audit trail on profile changes | Immutable audit | x-audit middleware on all person mutations + handler-level audit | — | `routes.ts:3164-3271` x-audit registrations | audit schema | `auth-audit-logging.test.ts` | Implemented | No |
| BR-31 SVG sanitization | Strip scripts from uploads | Owned by storage module | — | `[SHARED DEPENDENCY]` storage | — | SVG-upload tests exist (audit index §9) | Implemented (out of module) | No |
| BR-18 / AC-M02-004 QR HMAC + real-time verify | Tamper-proof QR, live status | HMAC-SHA256 over payload; `/verify/:memberId` link; **fallback secret if env missing** | `my/id-card.tsx` verifyUrl | `utils/id-card-data.ts:77` | — | `id-card-data.test.ts` | Implemented but flawed | Yes (G-04) |
| BR-21 / AC-M02-005 multi-org independent display | All orgs as separate cards; ID card org selector | Profile lists all memberships; ID card hardcodes `memberships[0]` | `my/profile.tsx` membership cards; `my/id-card.tsx:57` | `getMyMemberships.ts` | membership schema | `getMyMemberships.test.ts`; `digital-id-card.spec.ts` | Partially Implemented | Yes (G-14) |
| BR-01 status computed not stored | Status from dues_expiry_date | ID card reads `membership.status` stored column (M05-owned) | — | `utils/id-card-data.ts:55` | `membership.schema` | — | Unclear `[CROSS-MODULE RISK]` (M05 owns status storage) | Note only |
| WF-011 deletion lifecycle + grace banner | Banner on every page during grace | Deletion status surfaced only inside Settings → General | grep: `deletionScheduledAt` only in `my/settings.tsx`, `settings/account.tsx` | `getPerson` returns deletion fields | `person.schema.ts:43-45` | E2E settings only | Partially Implemented | Yes (G-09) |
| WF-011 cascade (BR-32/DPA) | Anonymize PII + cross-module cleanup | 9 subscribers, ~24 tables; **`bio`/`gender` never scrubbed**; comms/chat, notifications, email queue, S3 objects untouched | — | `jobs/deletionProcessor.ts:73-91`, `executeAccountDeletion.ts:70-86`, `domain-event-consumers.ts:1152-1397` | `person.schema.ts:40` (bio) | `deletionProcessor.test.ts`, `domain-event-consumers.test.ts` | Partially Implemented | **Yes (G-03, G-15, G-16)** |
| Spec 10b DeletionRequested/Cancelled → officer notification | Officers notified of request/cancel | Events emitted; zero consumers registered | — | `requestMyAccountDeletion.ts:99`, `cancelMyAccountDeletion.ts:39`; no `person.deletion.*` in `domain-event-consumers.ts` | — | none | Missing | Yes (G-07) |
| WF-014 export contents + ready notification | profile, memberships, payments, credits, certificates + notify | Sync generation; no certificates; `data-export.ready` has no consumer; `exportMyData` response omits `payments`/`notifications`/`categories` required by its own `MyDataExport` model | `data-export.tsx` | `requestDataExport.ts:63-97`, `exportMyData.ts:48-91`; `person-custom.tsp:52-72` | `data-export.schema.ts` | `requestDataExport.test.ts`, `exportMyData.test.ts` | Partially Implemented | Yes (G-08, G-07) |
| Spec §7 Person fields `subSpecialization`, `yearsOfPractice`, `affiliation` | Extended profile fields | Not in schema (schema has `bio` instead, which spec lacks) | — | — | `person.schema.ts` | — | Missing (spec/schema drift) | Yes (Q-5) `[NEEDS PRODUCT DECISION]` |
| Spec §18 feature flags (export, digest, share link) | Flags gate features | No flag checks found in person handlers | — | — | — | — | Not Required for V1 (flags default-on/off; share-link off and absent) | No |
| API contract `confirmation: "DELETE"` server-side | Server validates typed confirmation | Frontend-only (`confirmText` state); API body empty | `my/settings.tsx` | `requestMyAccountDeletion.ts` (no body) | — | — | Partially Implemented | Yes (G-18, P3) |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| M2-R3 / AC-M02-002 | `PATCH /persons/me/privacy` rejects every contract-valid request: handler reads `b['organizationId']`, contract/validator/frontend all carry `orgId` | P0 | V1 REQUIRED | `updateMyPrivacySettings.ts:26` vs `person-custom.tsp:202`, `validators.ts:9523-9532`, `my/settings.tsx:317` | Read `orgId` from validated body (or alias both); add route-level test through the Zod validator |
| M2-R3 / AC-M02-002 | `emailVisible`/`phoneVisible`/`photoVisible`/`addressVisible` enforced nowhere — directory uses its own `directory_profiles.contactEmail/contactPhone/photoUrl` + `visibility` enum; only trust-signal flags consumed | P1 | V1 REQUIRED (decide model first) | grep: `personPrivacySettings` consumed only by `trust-signals.ts:55,72-74`, `lookupCredentialPublic.ts`, consumers, seed; `directory.schema.ts:35-41` | `[NEEDS PRODUCT DECISION]` pick one privacy source of truth (M02 toggles vs directory-profile curation); then either enforce the 4 toggles in directory projections or remove them from UI/API |
| BR-32 / DPA-02 | Anonymization scrub omits `bio` (free text, PII-bearing) and `gender` in both scrub sites | P1 | V1 REQUIRED | `jobs/deletionProcessor.ts:73-91`, `executeAccountDeletion.ts:70-86`, `person.schema.ts:40` | Add `bio: null` (and decide on `gender`) to the single consolidated scrub list; regression test |
| BR-18 / AC-M02-004 | QR HMAC uses `process.env['AUTH_SECRET'] ?? 'fallback-secret'` — forgeable ID cards if env missing; secret shared with auth | P1 | V1 REQUIRED | `handlers/person/utils/id-card-data.ts:77` | Fail closed (throw) when secret missing; prefer dedicated `ID_CARD_HMAC_SECRET` via `core/config.ts` |
| `PersonMeUpdateRequest.phone` | `updateMyProfile` never maps `phone`; returns 200 while silently dropping it. Handler also maps 6+ fields the validator strips (dead code masking the contract) | P1 | V1 REQUIRED | `person-custom.tsp:285` + `validators.ts:7591-7601` vs `updateMyProfile.ts:32-45` | Map `phone` → `contactInfo.phone`; delete dead field mappings; contract test asserting phone round-trips |
| Spec 10b DeletionRequested/Cancelled → M05; edge case "all 5 officers notified" | No consumers for `person.deletion.requested` / `person.deletion.cancelled` | P2 | V1 RECOMMENDED | emits at `requestMyAccountDeletion.ts:99`, `cancelMyAccountDeletion.ts:39`; `domain-event-consumers.ts` has no `person.deletion.*` handler | Add consumers notifying active officers of orgs the person belongs to |
| WF-014 step 3 | `data-export.ready` event has no consumer → no notification | P3 | V1 RECOMMENDED (low) | `requestDataExport.ts:116`; no consumer registered | Add in-app notification consumer, or drop the emit and document sync behavior |
| WF-014 / `MyDataExport` model | Export omits certificates; `GET /persons/me/export` response shape violates its own TypeSpec model (`profile/payments/credits/notifications/categories` keys absent) | P2 | V1 RECOMMENDED | `exportMyData.ts:85-91` vs `person-custom.tsp:52-72` | Align handler response to `MyDataExport` (or fix the model); include certificates + `prcId` |
| AC-M02-003 | No persistent deletion-grace banner on every page | P2 | V1 RECOMMENDED | grep `deletionScheduledAt` → only `my/settings.tsx`, `settings/account.tsx`; nothing in `_authenticated.tsx` layout | Banner in `_authenticated` layout keyed off `getPerson('me').deletionScheduledAt` |
| BR-23 / WF-010 step 4 | No license-format validation (regex) server- or client-side | P2 | V1 RECOMMENDED | `validators.ts` `z.string()` for licenseNumber; `updatePerson.ts:85`; `profile.tsx:387` plain string | Add per-association regex validation when association config exposes it; else document deferral |
| M2-R1 | Contact email mutable without OTP; no email-change UI | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | `updatePerson.ts:80`; `settings/security.tsx` lacks email card | Confirm auth-email vs contact-email product intent; gate contact-email change or document split |
| WF-012 step 1 | ID card has no org selector for multi-org members (`memberships[0]`) | P2 | V1 RECOMMENDED | `my/id-card.tsx:57` (`Array.isArray(memberships) ? memberships[0] : null`) | Org dropdown bound to `/persons/me/id-card/:orgId` |
| CLAUDE.md "never log PII" / DPA-05 | `createPerson` logs raw email in info log | P2 | V1 RECOMMENDED | `createPerson.ts:101` (`email: body.contactInfo?.email`) | Log `hasEmail` boolean only (pattern already used in its audit details) |
| EVENT_CONTRACTS §0.1/§0.2 | Doc claims at-least-once pg-boss delivery for domain events; actual bus is in-process `Promise.allSettled`, log-only on failure (at-most-once) | P2 | V1 RECOMMENDED (doc fix) `[SHARED DEPENDENCY]` | `core/domain-events.ts:58-82` vs EVENT_CONTRACTS §0.1 | Correct EVENT_CONTRACTS; consider cascade outcome aggregation (see §13) |
| API contract `/my/delete-account` confirmation body | Typed-"DELETE" confirmation not enforced server-side | P3 | V2 DEFERRED | `requestMyAccountDeletion.ts` (no body read); `my/settings.tsx` confirmText | Optional body validation; frontend gate acceptable for V1 |
| Spec §7 `subSpecialization`/`yearsOfPractice`/`affiliation` | Fields specced, absent from schema | P3 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | `person.schema.ts` | Decide if fields are still wanted; if not, amend spec |
| m02 API_CONTRACTS paths | `/my/*` documented vs `/persons/me/*` actual | P3 | V1 RECOMMENDED (doc fix) | API_CONTRACTS.md §2 vs `routes.ts:3164+` | Update doc paths |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `executeAccountDeletion.ts` HTTP-shaped handler, never routed, duplicating the anonymization field list | grep: no references outside own file/test; `routes.ts`/`app.ts` clean; in-file SECURITY NOTE confirms | Not in spec (spec routes deletion via `person.deletionProcessor`) | Two scrub lists drift (both already omit `bio`) | Consider removal later — fold scrub into one shared function used by the job |
| Dual export endpoints (`GET /persons/me/export` sync + `POST /persons/me/data-export` "async") | `exportMyData.ts`, `requestDataExport.ts`; shared rate-limit ledger | Spec defines one async export | Confusing surface; shapes differ | Keep but clarify — document GET as legacy; align shapes |
| `bio` field on Person | `person.schema.ts:40`, `person.tsp:80` | Not in m02 spec §7 (spec has subSpecialization/yearsOfPractice/affiliation instead) | Anonymization missed it (G-03) | Keep but clarify in spec; fix scrub |
| `credentialsVisible`/`duesStatusVisible`/`ceComplianceVisible` privacy flags | `privacy-settings.schema.ts:23-25` | Not in m02 spec §7 (4 fields specced) | None — these are the only *enforced* flags (trust-signals) | Keep; add to spec |
| Auto-create person on profile 404 | `my/profile.tsx:46-63` (`createPerson.mutate` on error) | Not specced | Masks missing-onboarding bugs; retry loop risk guarded by isPending/isSuccess | Keep but clarify |
| `person.anonymized` event emit | `executeAccountDeletion.ts:112` (dead handler) | Spec 10b lists PersonAnonymized consumers M05/M06/M07 | No consumers; emit lives in dead code only | `[NEEDS CONFIRMATION]` — if needed, emit from `deletionProcessor` instead |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WF-010 Profile edit | Member | /my/profile → Edit | edit → validate → save → directory refresh | Implemented via `updatePerson` ('me'); no license regex; photo upload elsewhere | Minor | `my/profile.tsx:446`, `updatePerson.ts` |
| Privacy settings | Member | Settings → Privacy | toggle → PATCH → directory effect ≤1min | **Broken at API; 4/7 toggles unenforced downstream** | **Yes** | G-01/G-02 |
| WF-011 Account deletion | Member, System | Settings → Delete | request (guards) → 30d grace → daily processor → sessions killed → cascade → anonymize → audit | Implemented; `bio` unscubbed; officers not notified; no banner | Yes | `requestMyAccountDeletion.ts`, `jobs/deletionProcessor.ts`, `domain-event-consumers.ts:1152+` |
| WF-012 Digital ID card | Member | /my/id-card | select org → preview → PDF/QR → third-party verify | Implemented; first-org only; HMAC fallback secret | Yes | `my/id-card.tsx`, `utils/id-card-data.ts`, `getMyIdCardPdf.ts` |
| WF-013 Notification prefs | Member | Settings → Notifications | per-category toggles | Implemented; org-scoping half-done | Minor | `updateMyNotificationPreferences.ts` |
| WF-014 Data export | Member | Settings → Export | request → generate → notify → download → 7d expiry | Sync generation; no notify; content/contract drift | Yes | `requestDataExport.ts`, `getDataExportDownload.ts` |
| person.deleted cascade | System | processor emit | 9 subscribers clean ~24 tables across 8 modules | Implemented + tested; at-most-once, log-only failures; comms/notifications/S3 out of scope | Partial | `domain-event-consumers.ts:1146-1397`, `core/domain-event-consumers.test.ts:268-480` |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Privacy toggle persists | 200 + row upserted | Missing (always 400 via route) | G-01 evidence chain | V1 REQUIRED | Fake-green unit tests bypass validator |
| Privacy toggle visible in directory | email/phone/photo/address gated | Missing | G-02 | V1 REQUIRED (post-decision) | Trust-signal flags work |
| Deletion request guards | 4xx with reason codes | Implemented | `requestMyAccountDeletion.ts:37-82` | V1 REQUIRED | PENDING_PAYMENTS / SOLE_OFFICER codes |
| Grace-period banner | Banner on every page + cancel | Partially Implemented | Settings-only display | V1 RECOMMENDED | AC-M02-003 |
| Officers notified on request/cancel | In-app notification | Missing | no `person.deletion.*` consumer | V1 RECOMMENDED | Spec 10b + edge cases |
| Processor anonymizes all PII | All PII fields scrubbed | Partially Implemented | `bio` (and `gender`) survive | V1 REQUIRED | G-03 |
| Sessions killed pre-scrub | Login disabled | Implemented | `deletionProcessor.ts:64`, T-19-05 | — | Tested |
| Cascade cleans dependent modules | 19 steps / 9 subscribers | Implemented (declared scope) | consumers + tests | — | comms/notifs/S3 out of declared scope — see §21 |
| Cascade failures recoverable | Retry or aggregate outcome | Missing | `domain-events.ts:70-81` log-only | V1 RECOMMENDED | EVENT_CONTRACTS mismatch |
| Export ready notification | Notify member | Missing | no `data-export.ready` consumer | V1 RECOMMENDED (low) | Sync response mitigates |
| Export download TTL | Block after 7 days | Implemented | `getDataExportDownload.ts:40-42` | — | `expired` enum value never written (cosmetic) |
| ID card QR verifiable | HMAC valid, real-time status | Partially Implemented | fallback secret | V1 REQUIRED | G-04 |
| ID card per org | Org selector | Missing (first org only) | `my/id-card.tsx:57` | V1 RECOMMENDED | Backend already per-org |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| View own profile + all org memberships | Member | Profile + independent org cards | Implemented | No | V1 REQUIRED | `my/profile.tsx`, `getMyMemberships.ts` |
| Edit profile fields | Member | Save + immediate reflect | Implemented | No | V1 REQUIRED | `updatePerson.ts`, E2E B2 tests |
| Upload/crop photo | Member | 5MB, format check, crop | Partially (onboarding/settings-account only) | Yes | V1 RECOMMENDED | `personal-info-form.tsx` vs `profile.tsx` |
| Toggle directory privacy | Member | Per-org, per-field | Missing (broken) | Yes | V1 REQUIRED | G-01/G-02 |
| Manage notification prefs | Member | Per-category push/email | Implemented | Minor | V1 REQUIRED | `updateMyNotificationPreferences.ts` |
| Change password / 2FA / sessions | Member | Secure self-service | Implemented | No | V1 REQUIRED | `settings/security.tsx` |
| Change login email w/ OTP | Member | Verified change | Missing | Yes | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | G-11 |
| Export personal data | Member | Rate-limited full export | Partially | Yes | V1 REQUIRED | G-08 |
| Request/cancel deletion | Member | Guards + grace + cancel | Implemented | Minor | V1 REQUIRED | handlers + tests |
| Automatic anonymization | System | Full PII scrub + cascade | Partially | Yes | V1 REQUIRED | G-03 |
| Download QR ID card | Member | Per-org PDF, verifiable | Partially | Yes | V1 REQUIRED | G-04, G-14 |
| Admin reads/updates any person | Admin/support | PA-gated | Implemented (list admin/support; `updatePerson` is owner-only — admin "update any profile" per spec §6 not exposed) | Minor | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | `routes.ts:3156-3163`, `updatePerson.ts:36-38` |
| Share verification link | Member | Public verify page | Implemented (`/verify/:memberId`) — flag `profile_idcard_share_link` default false in spec | No | V1 RECOMMENDED | `my/id-card.tsx` verifyUrl |

## 10. Critical Gaps

| # | Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G-01 | Privacy settings PATCH broken: handler expects `organizationId`, contract/validator/frontend send `orgId` → 100% of real requests 400 | API/handler | **P0** | V1 REQUIRED | `updateMyPrivacySettings.ts:26`; `person-custom.tsp:200-203`; `validators.ts:9523`; `my/settings.tsx:317`; fake-green: `updateMyPrivacySettings.test.ts:28` passes `organizationId` directly; `persons-extended-flow.hurl` §11 asserts `status < 500` | A P0 spec workflow (Privacy Settings) is fully non-functional; UI optimistically flips toggles that never persist — privacy harm (photoVisible default true cannot be turned off) | Read `orgId`; route-level test through Zod validator; tighten Hurl assert to 2xx + readback |
| G-02 | email/phone/photo/address visibility toggles have no downstream enforcement; directory keeps its own PII copy (`contactEmail`,`contactPhone`,`photoUrl`) + own visibility enum — duplicate sources of truth, ADR-0005 tension | Cross-module (directory) | P1 | V1 REQUIRED | grep `personPrivacySettings` consumers; `trust-signals.ts:72-74` enforces only 3 flags; `directory.schema.ts:35-41` | Members believe toggles protect PII; they don't. `[CROSS-MODULE RISK]` `[NEEDS PRODUCT DECISION]` | Decide single privacy model; enforce or remove toggles |
| G-03 | Anonymization omits `bio` (free-text PII) and `gender` in both scrub sites | backend/job | P1 | V1 REQUIRED | `deletionProcessor.ts:73-91`; `executeAccountDeletion.ts:70-86`; `person.schema.ts:40` | DPA 2012 right-to-erasure incomplete; bio can contain clinic address/phone | Consolidate scrub list into one function; add `bio: null`; regression test |
| G-04 | ID-card QR HMAC falls back to hardcoded `'fallback-secret'`; reuses AUTH_SECRET | security | P1 | V1 REQUIRED | `utils/id-card-data.ts:77` | Forgeable member credentials (BR-18 broken) in any env missing AUTH_SECRET | Throw when unset; dedicated config key |
| G-05 | `updateMyProfile` silently drops contract field `phone`; carries dead mappings for validator-stripped fields | API/handler | P1 | V1 REQUIRED | `person-custom.tsp:285`; `validators.ts:7591-7601`; `updateMyProfile.ts:32-45` | Contract clients lose data with 200 OK — trust/data-loss | Map phone→contactInfo.phone; remove dead code; contract round-trip test |
| G-06 | Profile "publish to directory" can create duplicate directory profiles: detection query (`searchDirectory`) always 403s (public-prefix bypass), so `directoryProfile` is always null → every publish click POSTs a new profile; no `(orgId, personId)` uniqueness | Cross-module (directory) | P1 | V1 REQUIRED | `my/profile.tsx:75-99` (search→find me→else POST); MODULE_SPEC.member.directory §3 (searchDirectory 403), §9 (no uniqueness; public lookup picks first match) | Duplicate/stale public profiles; member cannot manage which one the public sees | `[CROSS-MODULE RISK]` Fix search route or use a direct "my profile" lookup; add uniqueness in directory module's plan |
| G-07 | `person.deletion.requested` / `person.deletion.cancelled` / `person.anonymized` / `data-export.ready` events emitted with zero consumers | backend/events | P2 | V1 RECOMMENDED | emits in 4 handlers; `domain-event-consumers.ts` registry lacks all 4 | Spec 10b officer notifications and export notification never happen; dead contract surface | Add officer-notification + export-ready consumers; drop unused emits otherwise |
| G-08 | Data export content/contract drift: no certificates; no `prcId`; `exportMyData` response shape ≠ `MyDataExport` model (missing `payments`, `notifications`, `categories`, key names differ) | API/handler | P2 | V1 RECOMMENDED | `exportMyData.ts:56-91` vs `person-custom.tsp:52-72`; spec WF-014 step 2 | DPA portability incomplete; SDK types lie | Align response to model; add certificates + prcId |
| G-09 | No persistent deletion-grace banner (AC-M02-003) | UI | P2 | V1 RECOMMENDED | grep `deletionScheduledAt` in apps/memberry → settings files only | Member may forget pending deletion → surprise data loss | Layout-level banner + cancel CTA |
| G-10 | License format validation (BR-23) absent at every layer | validation | P2 | V1 RECOMMENDED | `validators.ts` plain string; `profile.tsx:387` | Bad license data poisons directory/verification/credential matching | Add validation once association regex source exists `[NEEDS PRODUCT DECISION]` on regex source |
| G-11 | Email change without OTP; no email-change UI (M2-R1) | security/UX | P2 | V1 RECOMMENDED | `updatePerson.ts:80`; `settings/security.tsx` | Unverified contact-email changes can misroute dues/ballot/notification email | Confirm intent; gate or document `[NEEDS CONFIRMATION]` |
| G-12 | ID card no org selector (first membership only) | UI | P2 | V1 RECOMMENDED | `my/id-card.tsx:57,80` | Multi-org members can't get cards for other orgs despite per-org backend | Org dropdown |
| G-13 | Photo upload absent from profile edit form (exists only in onboarding/settings-account) | UI | P3 | V1 RECOMMENDED | `profile.tsx` ProfileEditForm field list; `personal-info-form.tsx` | WF-010 step 3 friction; inconsistent UX | Reuse `PersonalInfoForm` avatar section on profile edit |
| G-14 | `createPerson` logs raw email PII | logging | P2 | V1 RECOMMENDED | `createPerson.ts:101` | Violates CLAUDE.md no-PII-logs + DPA-05 | Log boolean only |
| G-15 | Cascade is at-most-once, log-only on subscriber failure; EVENT_CONTRACTS claims pg-boss at-least-once | core-platform | P2 | V1 RECOMMENDED | `domain-events.ts:70-81`; EVENT_CONTRACTS §0.1-0.3 | Silent partial DPA cleanup; misleading ops doc | `[SHARED DEPENDENCY]` Fix doc now; consider per-subscriber outcome record or retry in core-platform audit |
| G-16 | Cascade scope excludes comms chat/DMs, `notifications` rows, email queue, survey responses, bookings, S3 objects behind deleted documents/avatar | cross-module | P2 | V1 RECOMMENDED (decision first) | `domain-event-consumers.ts:1146-1397` (declared 9-subscriber scope); CLAUDE.md P1.6 | Residual PII references after "deletion" | `[NEEDS PRODUCT DECISION]` enumerate retention intent per table; extend subscribers where required |
| G-17 | `executeAccountDeletion.ts` dead/unrouted, duplicating scrub logic | backend | P2 | V1 RECOMMENDED | grep no callers; in-file note | Drift between two scrub lists (already happened: bio) | Remove or reduce to shared function |
| G-18 | Server doesn't validate `confirmation: "DELETE"` body | API | P3 | V2 DEFERRED | `requestMyAccountDeletion.ts` | Front-end gate sufficient for V1 | Optional |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Settings → Privacy → flip "Email" toggle | 200, persisted, directory reflects ≤1min | Optimistic UI flips; API returns 400 `organizationId is required`; nothing persists | G-01 chain (`my/settings.tsx:311-323` optimistic + PATCH) | P0 | Route-level handler test with validator; Hurl PATCH expecting 200 + GET readback; E2E real toggle persistence after reload |
| Profile → "Publish to directory" clicked twice | One profile, visibility updated | Search 403 → `directoryProfile` null → POST creates duplicate each click | `my/profile.tsx:75-99`; directory spec §9 | P1 | Integration test: publish twice → exactly one profile |
| SDK client PATCH `/persons/me` with `{phone}` | Phone saved | 200 OK, phone discarded | `updateMyProfile.ts` vs validator | P1 | Contract test asserting phone round-trip |
| Member in grace period browses app | Banner with countdown + cancel everywhere | No banner outside Settings → General | grep evidence (G-09) | P2 | E2E: request deletion → dashboard shows banner |
| Multi-org member opens /my/id-card | Org selector, card per org | First membership's card only | `my/id-card.tsx:57` | P2 | E2E with 2-org fixture |
| Member expects deletion request to alert officers | Officers notified | No consumer; nothing sent | G-07 | P2 | Consumer unit test (pattern exists in `domain-event-consumers.test.ts`) |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `executeAccountDeletion.ts` | handler never routed/called | grep: only own test references; routes/app clean | Scrub-list drift (manifested: bio) | Remove later; fold scrub into shared fn used by `deletionProcessor` |
| `person.deletion.requested`/`.cancelled`, `person.anonymized`, `data-export.ready` emits | events with no consumers | `domain-events.registry.ts:22-41` registered; no `domainEvents.on` for them | Dead contract; spec promises unmet | Add consumers (G-07) or remove emits |
| `updateMyProfile` mappings for `contactInfo`, `primaryAddress`, `languagesSpoken`, `licenseNumber`, `prcId`, `avatar` | dead code (validator strips fields) | `updateMyProfile.ts:36-45` vs `validators.ts:7591-7601` | Masks the real contract; confuses maintainers | Delete with G-05 fix |
| 4 of 7 privacy flags (`emailVisible` etc.) | fields saved but not enforced | G-02 | Trust gap | Decide + enforce or remove |
| `dataExportStatusEnum` values `requested`/`expired` | enum states never written (rows go processing→ready/failed; expiry checked at read) | `data-export.schema.ts:17-22`; `requestDataExport.ts:54,104` | Cosmetic | Keep; optionally lazy-mark expired |
| `updateNotificationPreferences.ts` / `updatePrivacySettings.ts` (non-`My` variants) | duplicate older handlers alongside `updateMy*` | `handlers/person/` listing; `privacy.test.ts` tests `updatePrivacySettings` | Two code paths for same feature | `[NEEDS CONFIRMATION]` check route wiring; consolidate |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `orgId` vs `organizationId` body-key mismatch (G-01) | API | §10 G-01 | P0 | Fix handler key |
| Generated Zod makes required `orgId: UUID` optional (`.optional()`), so even a correct handler wouldn't get required-field enforcement | API/generator | `person-custom.tsp:202` (required) vs `validators.ts:9524` | P2 | `[SHARED DEPENDENCY]` generator bug — note for cross-cutting audit |
| `notification_preference.organizationId` notNull but insert relies on fail-open `ctx.get('organizationId')` (optional org middleware on `/persons/*`); lookup ignores org while unique index is (person, category, org) | schema/handler | `updateMyNotificationPreferences.ts:22,56`; `app.ts:437-441`; `notification-preferences.schema.ts:17,23` | P2 | Resolve org from membership or make prefs explicitly global; add no-org-context test `[NEEDS CONFIRMATION]` |
| `exportMyData` response ≠ `MyDataExport` TypeSpec model | API | G-08 | P2 | Align |
| Person spec §7 fields (`subSpecialization`, `yearsOfPractice`, `affiliation`) absent; `bio` present but unspecced | schema vs spec | `person.schema.ts` vs m02 §7 | P3 | Reconcile spec |
| Export payload stored as JSONB in `data_export.payload` — full PII snapshot persists in DB after 7-day link expiry (no purge job) | schema/job | `data-export.schema.ts:32`; no cleanup job in `EVENT_CONTRACTS` §2 or `person/jobs/index.ts` | P2 | Add purge of expired export payloads (DPA data-minimization) |
| `createPerson` drops `licenseNumber`/`specialization`/`prcId`/`preferredLanguage`/`avatar` from create body | API/handler | `createPerson.ts:47-61` vs `PersonCreateRequest` | P3 | Map remaining fields or trim contract |
| ID card reads stored `membership.status` (BR-01 says compute from dues_expiry_date) | backend | `utils/id-card-data.ts:55` | P3 | `[CROSS-MODULE RISK]` M05 owns status semantics — note for membership-lifecycle audit |
| `directory_profiles` duplicates person PII (contactEmail/contactPhone/photoUrl) vs ADR-0005 | schema | `directory.schema.ts:35-38`; ADR-0005 "no module stores its own copy" | P2 | `[CROSS-MODULE RISK]` flag to directory/database-schema audits |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| QR HMAC fallback secret (G-04) | credential integrity | `id-card-data.ts:77` | P1 | Fail closed |
| `listPersons` correctly admin/support-gated with bulk-export audit | PA read-any | `routes.ts:3156-3163` | — | None (good) |
| `getPerson /persons/:person` carries pii-accessed audit; ownership/role checks inside handler `[NEEDS CONFIRMATION]` for read-any roles per spec §6 | PA read-any | `routes.ts:3262-3268` | P3 | Verify support/admin read path matches spec §6 during fix batch |
| `updatePerson` is strictly owner-only — spec §6 "Update any profile: super, admin" not implemented | PA update-any | `updatePerson.ts:36-38` | P3 | `[NEEDS PRODUCT DECISION]` platform-admin may have its own path (platformadmin module) — confirm before adding |
| `executeAccountDeletion` not HTTP-exposed (defensive note honored) | deletion | grep routes/app | — | Keep unrouted; see G-17 |
| Contact email change unverified (G-11) | identity | `updatePerson.ts:80` | P2 | Confirm + gate |
| `createPerson` forces `id = user.id`, prevents PII spoofing for others | identity | `createPerson.ts:41-50` | — | None (good) |
| Impersonation write-block applies globally before person routes | impersonation | `app.ts:292-294` | — | None (good) |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Anonymization leaves `bio`/`gender` (G-03) | DPA erasure | scrub lists | P1 | Fix scrub |
| Deletion audit events PII-free (DPA-05) and emitted by processor + (dead) executor | audit trail | `deletionProcessor.ts:93-114` | — | Good |
| Cascade failures only logged — no durable record of which modules completed cleanup for a given person | compliance evidence | `domain-events.ts:74-81`; `accountDeletionCascade.ts` returns emit-only result | P2 | Consider per-person cascade outcome row or structured audit entries (V1 RECOMMENDED, smallest viable: audit event per failed subscriber) |
| Export payload (full PII) retained in DB indefinitely | DPA minimization | §13 | P2 | Purge job |
| Financial retention (BR-32) honored: duesPayments amounts kept, proof scrubbed; merchant accounts deactivated not deleted | financial | `domain-event-consumers.ts:1221-1228,1367-1380` | — | Good |
| `dunningEvents` hard-deleted in cascade while spec retains financial trail 7yr — dunning is communications history, likely fine | financial | `domain-event-consumers.ts:1196-1198` | P3 | `[NEEDS CONFIRMATION]` retention intent |

## 16. Knowledge Graph Findings

KG used as secondary evidence (status: partially stale, not regenerated per `docs/aha/kg/knowledge-graph-status.md`). Direct inspection superseded it for this audit; findings below were verified by grep/code, with KG/audit-index used for blast-radius framing.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| `person.deleted` blast radius spans 8 module owners / ~24 tables via `core/domain-event-consumers.ts` | audit index §7 "Person deletion cascade — High risk"; consumers file imports from 12 schema files | Any schema rename in those modules silently breaks cascade (imports are compile-checked, but new tables aren't auto-included) | Add a checklist item in db-migrate skill: "does person.deleted need a new cleanup?" (doc-only) |
| Privacy-settings schema consumed by only 4 files (seed, consumers, trust-signals, lookupCredentialPublic) | grep | Confirms G-02 enforcement gap | Per G-02 |
| Hand-wired person routes (5) match HAND_WIRED_ROUTES.yaml allowlist | `app.ts:514-549`; yaml lines 65-78 | No drift | None |
| `updateMyProfile` vs `updatePerson` dual write path; frontend uses the latter | `profile.tsx:446` `path: { person: id || 'me' }` | Contract endpoint untested by real UI traffic — bugs like G-05 invisible | Round-trip contract tests for `updateMyProfile` |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Two competing directory-privacy models coexist: M02 per-field toggles vs directory-module curated profile + 3-level visibility | m02 spec §5 M2-R3 vs MODULE_SPEC.member.directory §1 | Member-facing privacy promise ambiguous; engineering can't "fix" G-02 without a product call | `[NEEDS PRODUCT DECISION]` — pick the model before the G-02 fix batch |
| Deletion grace UX is a domain trust requirement (healthcare professionals, DPA 2012) | m02 WF-011, AC-M02-003 | Banner gap (G-09) is a trust issue, not polish | Keep V1 RECOMMENDED |
| "Outstanding payments" deletion guard interpreted as in-flight payment records, not unpaid invoices | `requestMyAccountDeletion.ts:40-44` (statuses pending/submitted/underReview) | A member with an overdue invoice but no payment record can delete; org loses receivable linkage (anonymized per BR-32 anyway) | `[NEEDS PRODUCT DECISION]` Q-3 |
| EVENT_CONTRACTS Flow 3 matches implementation order (sessions → cascade → anonymize) | `deletionProcessor.ts:62-91` | Doc trustworthy here except delivery-guarantee section | Fix §0.1 only |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. No Webwright/Playwright executed; existing E2E specs inspected statically only (see §19/§20). No evidence files saved.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| (none executed) | — | — | — | When fixing G-01, add a real-backend E2E privacy-toggle persistence check rather than relying on `settings.spec.ts` C2 (empty-state only) |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `handlers/person/updateMyPrivacySettings.test.ts` | backend/unit | Handler logic with hand-built ctx (`_body: { organizationId }`) — **bypasses Zod validator, fake-green vs G-01** | Low |
| `handlers/person/privacy.test.ts` | backend/unit | Legacy `updatePrivacySettings` variant | Low |
| `handlers/person/requestMyAccountDeletion.test.ts`, `cancelMyAccountDeletion.test.ts`, `executeAccountDeletion.test.ts`, `accountDeletionCascade.test.ts` | backend/unit | Guards, grace math, cascade emit | High |
| `handlers/person/jobs/deletionProcessor.test.ts` + `jobs/index.test.ts` | backend/unit | Idempotency, batch isolation, scrub set (as written — doesn't catch bio omission since assertion mirrors impl) | Medium |
| `core/domain-event-consumers.test.ts` | integration-ish unit | All 9 `person.deleted` subscribers incl. failure isolation; `person.updated` ID-card notify | High |
| `handlers/person/ac-m02.member-profile.test.ts` | backend/unit | AC-M02-006/007/008 logic blocks | Medium |
| `handlers/person/requestDataExport.test.ts`, `exportMyData.test.ts`, `getDataExportStatus.test.ts` | backend/unit | Rate limit, payload assembly, status | Medium |
| `handlers/person/utils/id-card-data.test.ts` | backend/unit | QR payload/signature assembly | Medium (doesn't test missing-secret behavior) |
| `handlers/person/{createPerson,getPerson,listPersons,updatePerson,updateMyProfile,getMyMemberships,getMyOfficerRole,getMyCredits,...}.test.ts` (29 files total in module) | backend/unit | CRUD + me-scope handlers | Medium-High |
| `handlers/person/profile-spec-compliance.test.ts` | backend/unit | Spec-shape checks for profile flows | Medium |
| `core/auth-password-session-revocation.test.ts` | backend/unit | M2-R2 | High |
| `specs/api/tests/contract/person-lifecycle.hurl`, `person-validation.hurl`, `persons-extended-flow.hurl` | contract | CRUD, me-scope reads, deletion request/cancel, privacy/notif PATCH — but privacy PATCH asserts only `status < 500` (passes on 400) | Low-Medium |
| `apps/memberry/tests/e2e/profile.spec.ts`, `settings.spec.ts`, `member/digital-id-card.spec.ts`, `mobile/profile.spec.ts`, `actions/profile-settings-actions.spec.ts` | E2E | Profile view/edit, notification toggle PATCH fired, privacy empty state, ID card render | Medium (privacy persistence not covered) |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| `updateMyPrivacySettings` invoked through generated Zod validator (route-level) asserting 2xx with `orgId` body + persisted row | backend/unit + integration | Kills the G-01 fake-green class | **Before** (red test reproduces bug) |
| Hurl: privacy PATCH expects 200 + follow-up GET readback of flipped flag | contract | Current assert `< 500` hides 400s | Before/during G-01 |
| E2E: flip privacy toggle → reload → state persisted (real backend) | E2E/Playwright | UI optimism currently masks failure | During G-01 |
| Anonymization scrubs `bio` (and decided `gender`) — processor + shared scrub fn | backend/unit | G-03 regression guard | Before G-03 |
| `updateMyProfile` round-trips `phone`; rejects/ignores nothing silently | contract + unit | G-05 | Before G-05 |
| id-card-data throws when HMAC secret missing | backend/unit | G-04 | Before G-04 |
| Officer notification consumers for `person.deletion.requested`/`.cancelled` | backend/unit (consumer pattern exists) | G-07 | During G-07 |
| Publish-to-directory idempotency (no duplicate profiles) | integration | G-06 | Before G-06 `[CROSS-MODULE RISK]` |
| `updateMyNotificationPreferences` with no org context (header absent) | backend/unit | §13 notNull insert risk | Before fix |
| Export response matches `MyDataExport` schema; includes certificates/prcId | contract | G-08 | During G-08 |
| Expired-export payload purge (once job added) | backend/unit | §13 retention | During fix |
| Deletion-grace banner visible on dashboard during grace | E2E | G-09 | During G-09 |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Directory module (search 403, no uniqueness, own PII copy, own visibility model) | cross-module | G-02, G-06; MODULE_SPEC.member.directory §3/§9 | Privacy promise + publish journey break here | `[CROSS-MODULE RISK]` — coordinate with chapters-directory audit; product decision first |
| `core/domain-events.ts` delivery semantics | shared/platform | G-15 | Cascade reliability + doc mismatch affect every event consumer | `[SHARED DEPENDENCY]` — fix EVENT_CONTRACTS doc in this module's batch; reliability change belongs to core-platform |
| TypeSpec→Zod generator marking required props optional | shared/platform | `validators.ts:9524` vs `person-custom.tsp:202` | Same bug class may exist across modules | `[SHARED DEPENDENCY]` — candidate for prompt 05 cross-cutting audit |
| Storage module (avatar upload, SVG sanitize, S3 object lifecycle on deletion) | cross-module | BR-31/M2-R9; G-16 (orphaned S3 objects) | Photo rules + erasure completeness | `[CROSS-MODULE RISK]` — storage-files audit |
| Membership module (`membership.status` stored field used on ID card; membership repo used in exports/guards) | cross-module | `id-card-data.ts:55` | BR-01 semantics owned by M05 | Note for membership-lifecycle audit |
| Better-Auth (email change, session kill, 2FA) | shared/platform | G-11; `deletionProcessor.ts:64` | M2-R1 enforcement location unclear | `[NEEDS CONFIRMATION]` in auth-rbac audit |
| `duesPayments` / `officerTerms` schemas imported by person handlers for deletion guards | database/schema | `requestMyAccountDeletion.ts:7-8` | Schema moves break guards | Covered by compile-time imports; note in db audit |
| Org-context fail-open middleware on `/persons/*` | shared/platform | `app.ts:437-441` | Notification-pref insert depends on it | Verify in core-platform audit |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Read `orgId` in `updateMyPrivacySettings`; tighten contract assert; add validator-inclusive test | G-01 | P0 | V1 REQUIRED | unit (red first), Hurl 2xx+readback, E2E persistence | Smallest fix is one key rename |
| Product decision then enforce/remove the 4 unenforced privacy flags | G-02 | P1 | V1 REQUIRED | integration on directory projection | Blocked by decision; touches directory module |
| Consolidate scrub into `anonymizePerson()` used by processor; add `bio` | G-03, G-17 | P1 | V1 REQUIRED | unit asserting full field list incl. bio | Delete or gut `executeAccountDeletion.ts` in same batch |
| Fail-closed HMAC secret (config-driven) | G-04 | P1 | V1 REQUIRED | unit: throws when unset | Consider dedicated env var |
| Map `phone` in `updateMyProfile`; delete dead mappings | G-05 | P1 | V1 REQUIRED | contract round-trip | 10-line fix |
| Fix profile→directory publish detection (use owned-profile lookup, not search); duplicate-guard | G-06 | P1 | V1 REQUIRED | integration idempotency | Coordinate with directory module fix-plan |
| Add `person.deletion.requested/cancelled` consumers notifying org officers | G-07 | P2 | V1 RECOMMENDED | consumer unit tests | Pattern identical to existing consumers |
| Align export payload/shape; add certificates + prcId; purge expired payloads | G-08, §13 | P2 | V1 RECOMMENDED | contract + unit | ZIP stays V2 |
| Grace-period banner in `_authenticated` layout | G-09 | P2 | V1 RECOMMENDED | E2E | Small UI |
| License regex validation (needs association regex source) | G-10 | P2 | V1 RECOMMENDED | unit + form validation | `[NEEDS PRODUCT DECISION]` regex source |
| Stop logging raw email in `createPerson` | G-14 | P2 | V1 RECOMMENDED | log-shape unit (optional) | One-liner |
| Notification-pref org resolution (derive from memberships or make global) | §13 | P2 | V1 RECOMMENDED | unit no-org case | Decide per-org vs global with product |
| Correct EVENT_CONTRACTS §0.1–0.3 delivery-guarantee claims | G-15 | P2 | V1 RECOMMENDED | n/a (doc) | Reliability upgrade itself → core-platform |
| Audit event per failed `person.deleted` subscriber | G-15/§15 | P2 | V1 RECOMMENDED | consumer failure test | Smallest compliance-evidence step; full retry = V2 |
| ID-card org selector | G-12 | P2 | V1 RECOMMENDED | E2E 2-org fixture | Backend ready |
| Avatar upload on profile edit (reuse PersonalInfoForm section) | G-13 | P3 | V1 RECOMMENDED | E2E | Reuse, don't rebuild |
| Update m02 API_CONTRACTS paths to `/persons/me/*` | §5 doc drift | P3 | V1 RECOMMENDED | n/a | Doc-only |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| ZIP packaging + signed S3 URL for data export | V2 DEFERRED | Already tracked in-code as EM-M02-9f0a1b2c P3; JSON attachment works |
| Server-side `confirmation: "DELETE"` body validation | V2 DEFERRED | Frontend gate adequate; no safety hole (auth + guards still apply) |
| Distributed/pg-boss-backed domain event bus with retries/DLQ | V2 DEFERRED `[DO NOT OVERBUILD]` | Core-platform scope; smallest V1 step is failure-audit events, not a queue migration |
| `subSpecialization` / `yearsOfPractice` / `affiliation` person fields | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Specced but never built; no UI demand evidence |
| Admin "update any profile" endpoint in person module | DO NOT ADD (here) `[NEEDS PRODUCT DECISION]` | platformadmin module is the privileged surface; duplicating write paths violates ADR-0005 spirit |
| Consent-management fields on Person | DO NOT ADD | Explicitly out of scope per CLAUDE.md + m02 §20.2 |
| Real-time (websocket) propagation of privacy changes to open directory views | DO NOT ADD `[DO NOT OVERBUILD]` | Spec only requires ≤1-minute cache invalidation |
| New `person.*` events beyond registry | DO NOT ADD | Wire existing dead emits first (G-07) |
| `profile_idcard_share_link` feature-flag plumbing | V2 DEFERRED | Verify link already exists; flag default false — don't build flag machinery for it now |

## 24. Audit Decision

**FAIL**

Rationale: one P0 — the Privacy Settings workflow (a P0 workflow in the m02 spec) is non-functional through the real route stack (`orgId`/`organizationId` mismatch, G-01) and is masked by validator-bypassing unit tests and a `status < 500` contract assertion. Five P1s compound it: privacy toggles unenforced downstream (G-02), incomplete DPA anonymization (`bio`, G-03), forgeable ID-card QR under missing env (G-04), silent data loss on the contract profile-update endpoint (G-05), and duplicate directory-profile creation from the publish journey (G-06). The rest of the module is genuinely solid — deletion lifecycle, cascade subscribers, rate-limited export, and session security are implemented and well-tested — so remediation is narrow and well-bounded, but a module whose privacy controls fail 100% of the time cannot pass as the platform's PII hub.

## 25. Open Questions

| # | Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- | --- |
| Q-1 | Which privacy model wins for the directory: M02 per-field toggles or directory-profile curation + 3-level visibility? | `[NEEDS PRODUCT DECISION]` | Determines the G-02 fix (enforce vs remove 4 toggles) | Product (Elad) |
| Q-2 | Is changing `person.contactInfo.email` without OTP acceptable given the Better-Auth login email is separate? | `[NEEDS CONFIRMATION]` | M2-R1 scope; dues/election emails may route to contact email | Product + auth-rbac audit |
| Q-3 | Does "pending payments" deletion guard include unpaid/overdue invoices, or only in-flight payment records? | `[NEEDS PRODUCT DECISION]` | Guard scope (M2-R5) | Product |
| Q-4 | Should `gender` be scrubbed at anonymization alongside `bio`? | `[NEEDS PRODUCT DECISION]` | DPA field-level erasure policy | Product/compliance |
| Q-5 | Are `subSpecialization`/`yearsOfPractice`/`affiliation` still wanted, or should m02 §7 be amended to match schema (incl. `bio`)? | `[BLOCKED BY MISSING SPEC]` (spec/schema conflict) | Spec-truth for future audits | Product |
| Q-6 | Must chat/DM content, `notifications` rows, email-queue rows, and S3 objects be cleaned on person deletion, or is retention intentional? | `[NEEDS PRODUCT DECISION]` | Cascade completeness (G-16) | Product/compliance |
| Q-7 | Are the legacy `updatePrivacySettings.ts`/`updateNotificationPreferences.ts` (non-`My`) handlers still routed anywhere? | `[NEEDS CONFIRMATION]` | Duplicate code paths | Eng (fix batch) |

## 26. Notes for Gap Plan Organizer

- **Batch 1 (do first, no blockers, small diffs)**: G-01 (orgId key fix + validator-inclusive test + Hurl tightening), G-03+G-17 (consolidated scrub incl. `bio`), G-04 (fail-closed HMAC), G-05 (phone mapping + dead-code removal), G-14 (PII log line). All are V1 REQUIRED/RECOMMENDED, module-local, test-first friendly.
- **Blocked by product decisions**: G-02 (Q-1), G-16 (Q-6), G-10 regex source, Q-3 guard scope, Q-4 gender. Do not implement until answered.
- **Cross-module — coordinate, don't fix here**: G-06 (directory search 403 + uniqueness — directory module), G-15 reliability upgrade (core-platform), generator required→optional bug (`validators.ts:9524`, feed to prompt 05), `directory_profiles` PII duplication (db audit), BR-01 stored status (membership-lifecycle audit).
- **Tests to write first**: route-level privacy test through Zod validator (reproduces G-01 red), anonymization full-field assertion, `updateMyProfile` phone round-trip contract test, HMAC missing-secret unit test. Beware the established fake-green pattern: handler unit tests that hand-build `_body` bypass generated validators — any fix batch should add at least one validator-inclusive test per touched handler.
- **Implemented-but-unspecced items not to expand**: dual export endpoints, auto-create person on profile 404, `person.anonymized` emit in dead code.
- **Truly V1 P2s worth including if capacity allows**: G-07 officer-notification consumers, G-08 export shape/certificates, G-09 grace banner, G-12 org selector, export-payload purge.
- **Must NOT be implemented yet**: pg-boss event bus migration, consent fields, admin update-any in person module, ZIP export.

---

Next recommended step:
Module/group: Person & Profile (+ deletion cascade)
Module slug: person-profile
Primary PRD/spec: docs/product/modules/m02-member-profile/MODULE_SPEC.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/person-profile-gap-plan.md
