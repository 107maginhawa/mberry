# AHA Fix-Ready Plan: Notifications & Email

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Notifications & Email |
| Module slug | notifications-email |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/notifications-email-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/notifications-email-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS (carried from gap plan §24) |
| Superpowers used | No (organizer ran without `/using-superpowers`; not required for this organization pass) |
| Organizer decision | PARTIALLY READY |
| Reason | Five P1 gaps are real and evidence-backed, but only two (BR test registration; BR-57 reason-aware transactional override) are fully fix-ready now. The other three P1s are gated by product/environment decisions: web-push scope (Q1), email provider + webhook shape (Q2 `[BLOCKED BY ENVIRONMENT]`), and preference store ownership (Q3 `[NEEDS PRODUCT DECISION]`). No P0 exists; nothing blocks a core workflow outright, so the module can be fixed in staged batches rather than one pass. |
| Limitations | Static review only (no server boot, no Hurl execution, no browser/OneSignal verification). Whether dunning-escalation / task-overdue notifications fire via an alternate direct-insert path was confirmed by grep (zero callers of the trigger functions) but the *absence of an alternate notification path* is still marked `[NEEDS CONFIRMATION]`. Email-queue 30-day cleanup job existence unverified (`[NEEDS CONFIRMATION]`). PII-in-logs and audit-extension claims not re-verified beyond gap plan. |

## 2. Fix Strategy Summary

**What to fix first:** Test foundation, then the single safest high-trust backend fix.

- **Batch D (test hardening) goes first and is a hard prerequisite for everything else.** All 8 M22 business rules (BR-52..BR-59) have zero registered tests (`br-registry.json` arrays empty); `bun run test:br` reports 0% coverage for M22. BR-52/BR-54/BR-59 already have de-facto coverage and only need tagging+registration; BR-53/BR-55/BR-56/BR-57/BR-58 need failing-first tests written. Without this, no other P1 fix can be verified safely (gap plan §10, §20, §26).
- **Batch B (P1 backend) second, starting with BR-57.** The reason-aware transactional-suppression override (FIX-002) is the smallest blast-radius, highest member-trust fix: an unsubscribed member currently silently loses dues invoices, receipts, and security mail. Confirmed: `isSuppressed()` (`core/email.ts:270`, `suppression.repo.ts:51`) returns only a boolean and Guard 1 (`core/email.ts:499-512`) is category-blind. The fix is additive — add a reason-returning lookup, keep the boolean wrapper for existing callers.

**What not to fix (now):** Everything in gap plan §23 — admin email UI, `POST /email/send` direct-send, `DELETE /email/templates/:id`, SMS channel, domain-event emission (EmailSent/Failed/Bounced/Complaint), delivery receipts, multi-channel `channels[]` fan-out, and the `globalThis.app.email` → injected-EmailService refactor. Also do not expand `consentValidated` into a real consent engine. These are deferred or DO NOT ADD.

**Major risks:** `core/email.ts` is shared/platform — its guards are exercised by Better-Auth verify/reset/2FA mail, communication announcement jobs, dues dunning mail, and the notification-repo `globalThis.app.email` bridge. Any Guard 1 / `isSuppressed` change MUST be additive and MUST be regression-tested against the auth-mail path (`[CROSS-MODULE RISK]`). The preference fix spans 3 modules + memberry UI and cannot start until the store-ownership product decision lands.

**One pass or multiple batches:** Multiple batches. Batches D and B (BR-57 only) can run in the first `04` pass. The bounce webhook (Batch E, FIX-003) is blocked on Q2 provider confirmation `[BLOCKED BY ENVIRONMENT]`. Preference enforcement (FIX-004/005) is blocked on Q3 `[NEEDS PRODUCT DECISION]`. Web push (FIX-006) is blocked on Q1. Batch C (selected P2 completeness) runs after the P1 backbone.

**Shared/platform/database work required:** Yes — `core/email.ts` (shared), `app.ts` + `HAND_WIRED_ROUTES.yaml` (new bounce webhook route), and cross-module preference convergence (person + communication + notifs). **No database migration is required for the active P1 set** — `email_suppression.reason` and `email_category` columns already exist.

**Product decisions / environment blockers:** Q1 (push scope), Q2 (provider/webhook — also env), Q3 (preference store owner), Q5 (phantom endpoints). These gate FIX-003, FIX-004, FIX-005, FIX-006, and FIX-009.

## 3. Active Fix Scope

Only P0/P1, selected P2 (workflow completeness), V1 REQUIRED, and selected low-risk V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | All 8 M22 BRs (BR-52..BR-59) have zero registered tests; `test:br` gate reports 0% for M22 | P1 | V1 REQUIRED | D | Test-first prerequisite for every other P1/P2 fix; coverage gate is load-bearing | `br-registry.json` BR-52..59 `tests:{backend:[],contract:[],e2e:[]}`; no `BR-5[2-9]` tags in module tests (gap plan §5, §10, §20) |
| FIX-002 | Transactional email blocked by `unsubscribe` suppression (BR-57 / AC-M22-006 missing) | P1 | V1 REQUIRED | B | Unsubscribed members silently lose dues invoices, receipts, security mail; smallest blast radius, highest trust payoff; no schema change | `core/email.ts:499-512` Guard 1 category-blind; `isSuppressed` boolean-only (`core/email.ts:270`, `suppression.repo.ts:51`); blanket `unsubscribe` write in `unsubscribeEmail.ts` (gap plan §5, §10, §11) |
| FIX-003 | No bounce/complaint ingestion (BR-55/BR-56, WF-124, AC-M22-004/005) — auto-suppression can never fire | P1 | V1 REQUIRED | E | Repeated sends to dead/complaining addresses wreck sender reputation; spec marks WF-124 P0; CAN-SPAM posture. Blocked on Q2 provider/webhook shape | grep: `hard_bounce`/`complaint` only in `suppression.schema.ts` enum; no handler/TypeSpec op/job; Stripe webhook precedent at `HAND_WIRED_ROUTES.yaml:47` (gap plan §5, §10, §13) |
| FIX-004 ✅ **FIXED 2026-06-13** | Notification preferences never enforced at delivery; person-owned `notification_preference` has zero send-path consumers | P1 | V1 REQUIRED | B | Per-category enforcement built against canonical `person_subscription` (Q3) via `NotificationPreferencePort`; type→category resolver added; in-app-always + fail-open invariants. 15/15 tests RED→GREEN. See fix-report Batch D. | Enforcement gate in `createNotificationForModule`; port `core/ports/notification-preference.port.ts`; resolver `handlers/notifs/repos/notification-category.ts`; adapter in `communication.repo.ts`. `[NEEDS CONFIRMATION]` topic↔category vocabulary (fix-report D.8) |
| FIX-005 | Preference UI writes a *different* table (`person_subscriptions`) than person-owned endpoints; divergent category vocabularies | P1 | V1 REQUIRED | B | Two tables can disagree; UI saves to wrong store so enforcement (FIX-004) would never see toggles. Blocked on Q3 (same decision) | `notification-preferences.tsx` → `/association/person-subscriptions`; `NOTIFICATION_CATEGORIES` vs UI `CATEGORIES` mismatch (gap plan §4, §10, §13, §21) |
| FIX-006 | Web push unwired in frontend: `react-onesignal` dep never imported; compose UI advertises push | P1 | V1 REQUIRED (or explicit descope) | B | Push-channel sends are paid OneSignal calls no web user can receive; compose UI misleads officers. Path depends on Q1 | `react-onesignal@^3.4.0` in `package.json:82` with zero imports (confirmed); `compose-form.tsx:179` promises device push; backend push send exists (`notification.repo.ts:442`) (gap plan §5, §10, §11, §12) |
| FIX-007 | No `DELETE /email/suppressions/:id` — admin cannot unblock a wrongly suppressed address (WF-125 half-missing) | P2 | V1 RECOMMENDED | C | WF-125 is P0 in spec; wrong/typo suppression is otherwise permanent without DB surgery | `email.tsp:645-651` GET only; no delete handler in `handlers/email/` (gap plan §5, §9, §10) |
| FIX-008 | Enqueue-time validation missing (BR-53 TEMPLATE_INACTIVE / BR-58 MISSING_REQUIRED_VARIABLES) | P2 | V1 RECOMMENDED | C | Bad enqueues become silent failed queue items instead of caller-visible errors; internal correctness | `core/email.ts` queueEmail checks only `templateTags` non-empty; AC text demands enqueue-time rejection (gap plan §4, §5) |
| FIX-009 | `triggerDunningEscalation` / `triggerTaskOverdue` have no callers — escalation/overdue notifications likely never fire | P2 | V1 RECOMMENDED | C | Slice 027 GAP-012/GAP-017 regress silently; seed masks it. Gated on Q4 (confirm no alternate path) | Confirmed: zero callers of both functions; only 2 importers of `notification-triggers` (waitlist, late-cancel); seed fakes rows `seed/layer-4-cross-module.ts:70-73` (gap plan §5, §10, §11, §12) |
| FIX-010 | Hurl `email-extended-flow.hurl` cancel/retry steps use placeholder UUID with `HTTP *` (route-exists only, not transition) | P2 | V1 RECOMMENDED | D | Contract suite does not actually prove queue cancel/retry transitions | `email-extended-flow.hurl` placeholder `00000000-...` + `HTTP *` (gap plan §19, §20) |
| FIX-011 | Reconcile M22 §8/§12 phantom endpoints + false "COMPLETE" claims; sync MODULE_SPEC.notifs (status enum, no sms, 4 triggers) | P2/P3 | V1 RECOMMENDED (doc fix) | C | Future agents will "implement to spec" and re-add endpoints product may not want; cheap doc-only | `m22-email/MODULE_SPEC.md` §8 vs handler mapping; `notification.schema.ts` enums vs MODULE_SPEC.notifs (gap plan §4, §5, §12). Q5 settles template-delete/direct-send fate |
| FIX-012 | `organizationId: request.organizationId \|\| ''` on a notNull uuid column → runtime cast error if any caller omits orgId | P3 | V1 RECOMMENDED | C | Internal callers omitting orgId hit a Postgres uuid error at runtime; cheap early-validation guard | `notification.repo.ts:145`; `InternalNotificationRequest.organizationId?` optional (gap plan §10, §13) `[NEEDS CONFIRMATION]` whether any caller omits it |
| FIX-013 | Remove `'sms'` from internal `InternalNotificationRequest.channels` type until schema enum supports it; document `channels[0]`-only behavior | P3 | V1 RECOMMENDED | C | `sms` insert would crash (pgEnum lacks value); type advertises unsupported capability | `notification.schema.ts` interface accepts `'sms'`; `notification_channel` enum lacks it; `createNotificationForModule` uses `channels?.[0]` only (`notification.repo.ts:148`) (gap plan §6, §12, §13) |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch D | Test hardening / regression coverage (BR registration + contract hardening) | FIX-001, FIX-010 | Low (tests only; no prod behavior change for tagging) | **Run first in current `04` pass.** FIX-001 is a prerequisite for B and C. FIX-010 may slip to a later pass if time-boxed. |
| Batch B | P1 reliability / trust / preference / push gaps | FIX-002, FIX-004, FIX-005, FIX-006 | High (shared `core/email.ts`; cross-module preference store; paid push integration) | **Split.** FIX-002 runs in the same first `04` pass as Batch D (smallest blast radius, no product decision needed). FIX-004 + FIX-005 run only after Q3 product decision. FIX-006 runs only after Q1 product decision. |
| Batch E | Shared/platform dependency: bounce/complaint webhook (touches `app.ts` + `HAND_WIRED_ROUTES.yaml` + contract CI) | FIX-003 | High (new public pre-auth route; shared app wiring) | **Separate `04` pass, after Q2 provider+webhook confirmation.** `[BLOCKED BY ENVIRONMENT]` for live verification. Isolated from module-local batches per shared-dependency rule. |
| Batch C | Selected P2 V1 completeness + low-risk P3 cleanups | FIX-007, FIX-008, FIX-009, FIX-011, FIX-012, FIX-013 | Medium (FIX-009 is cross-module; rest module-local) | **Later `04` pass(es), after the P1 backbone.** FIX-009 only after Q4 confirmation. FIX-011 doc reconciliation may need Q5. FIX-007/008/012/013 module-local, no decision needed. |

No database/schema-only batch (Batch F) is required: the active P1/P2 set needs no migrations (`email_suppression.reason`, `email_category`, `notification_preference` columns already exist). Eventual preference-table deprecation is flagged for prompt 06, not this module pass.

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Tag BR-52 onto suppression-drop test; BR-54 onto retry-cap test; BR-59 onto cancellation-audit test; register all in `br-registry.json` | backend/unit + data/schema (registry) | `bun run test:br` reports BR-52/54/59 covered for M22 (no longer 0%) | Existing: `handlers/email/repos/suppression.repo.test.ts`, `handlers/email/retryEmailQueueItem.test.ts` (or `queue.repo.test.ts`), `handlers/email/cancelEmailQueueItem.test.ts`; registry `docs/ver-3/business/br-registry.json` |
| FIX-002 | BR-57 failing-first: transactional email to an `unsubscribe`-suppressed recipient is sent; transactional to `hard_bounce`/`complaint` is still blocked; bulk to `unsubscribe` is still blocked | backend/unit | Reason-aware Guard 1: `transactional` bypasses `unsubscribe` only, never bypasses `hard_bounce`/`complaint`; bulk unaffected | New cases in `services/api-ts/src/core/email.test.ts` (or `handlers/email/repos/suppression.repo.test.ts` for the reason-returning lookup); tag BR-57 |
| FIX-003 | BR-55/BR-56 failing-first: provider webhook payload (signature-verified) for hard bounce → `addSuppression(reason:'hard_bounce')`; complaint → `'complaint'`; bad signature → 401 | backend/unit + contract | Webhook ingests bounce/complaint and writes correct suppression reason; rejects unsigned/forged payloads | New: `handlers/email/<bounceWebhook>.test.ts` + new contract `specs/api/tests/contract/email-bounce-webhook.hurl`; tag BR-55/BR-56 |
| FIX-004 | Preference-enforcement failing-first: notification with channel=email/push for a category the member disabled is skipped; in-app is always delivered regardless of prefs | backend/unit + integration | `NotificationRepository` channel dispatch consults the chosen preference store; in-app never suppressed | New cases in `handlers/notifs/repos/notification.repo.test.ts` (or `notifs-handlers.test.ts`) |
| FIX-005 | Component test: preference toggle writes to the chosen (post-Q3) endpoint; shared category constants used | frontend/component + E2E (toggle journey) | UI saves to the same store FIX-004 reads; category vocab matches | Existing `apps/memberry/src/.../preferences-view.test.tsx`; E2E extend `apps/memberry/tests/e2e/settings.spec.ts` |
| FIX-006 | (If wired) push-init test: on login `OneSignal.login(personId)` sets external_id; OR (if descoped) assertion that compose UI hides the push channel | E2E/Playwright (init) OR frontend/component (UI assertion) | Browser subscribes with person-id external_id, OR push option is not offered | New E2E under `apps/memberry/tests/e2e/` (push path) OR extend `compose-form` component test (descope path) |
| FIX-007 | `deleteEmailSuppression` handler test: admin removes a suppression (200 + row gone); non-admin 403; audit event emitted | backend/unit + contract | Admin can unblock an address; RBAC + `x-audit` enforced | New `handlers/email/deleteEmailSuppression.test.ts` + extend `specs/api/tests/contract/email.hurl` |
| FIX-008 | BR-53/BR-58 failing-first: `queueEmail()` rejects inactive template (TEMPLATE_INACTIVE) and missing required variables (MISSING_REQUIRED_VARIABLES) before insert | backend/unit | Enqueue-time validation surfaces caller-visible errors instead of silent failed items | New cases in `core/email.test.ts` (queueEmail) or `handlers/email/repos/template.repo.test.ts`; tag BR-53/BR-58 |
| FIX-009 | Integration: dunning-stage transition → notification row created; committee-task overdue sweep → notification row created | integration | Triggers actually fire from owning jobs (proves wiring, not just function call) | Extend the dunning job test (association:member) and committee-task job test (association:operations); reuse `notification-triggers.test.ts` patterns |
| FIX-010 | Replace placeholder-UUID `HTTP *` steps with a real enqueue → cancel → retry lifecycle | contract | Queue cancel/retry transitions actually succeed against a real item | Rewrite `specs/api/tests/contract/email-extended-flow.hurl` |
| FIX-011 | None (documentation reconciliation only) | n/a | n/a — verify no code drift introduced | `docs/product/modules/m22-email/MODULE_SPEC.md`, `docs/product/MODULE_SPEC.notifs.md` |
| FIX-012 | Unit: `createNotificationForModule` with missing `organizationId` throws `ValidationError` (not a Postgres cast error) | backend/unit | Early validation prevents the `''`-into-uuid runtime error | `handlers/notifs/repos/notification.repo.test.ts` |
| FIX-013 | Type-level: `'sms'` removed from `InternalNotificationRequest.channels`; document `channels[0]`-only | regression (type) | Type no longer advertises an insert that would crash | `services/api-ts/src/handlers/notifs/repos/notification.schema.ts` (type def); covered by typecheck |

Reserve E2E/Playwright for core journeys only: the preference toggle journey (FIX-005) and push-init/descope (FIX-006). All other proofs are backend/unit, integration, or contract.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `docs/ver-3/business/br-registry.json`; `handlers/email/repos/suppression.repo.test.ts`, `retryEmailQueueItem.test.ts`/`queue.repo.test.ts`, `cancelEmailQueueItem.test.ts` (add BR tags) | module-local | Low (tests + registry) |
| FIX-002 | `services/api-ts/src/core/email.ts` (Guard 1), `handlers/email/repos/suppression.repo.ts` (reason-returning lookup, keep `isSuppressed` boolean wrapper), `core/email.test.ts` | shared/platform | High — every email producer (auth, communication, dues, notification bridge) runs Guard 1 |
| FIX-003 | New `handlers/email/<bounceWebhook>.ts`, `specs/api/src/modules/email.tsp` (if TypeSpec'd) OR `app.ts` (hand-wired pre-auth), `docs/quality/HAND_WIRED_ROUTES.yaml`, `suppression.repo.ts` (`addSuppression`), `.github/workflows/contract.yml` (CI sees new route) | shared/platform | High — new public route + app wiring + contract CI |
| FIX-004 | `handlers/notifs/repos/notification.repo.ts` (channel dispatch), possibly `core/notifs.ts`; chosen preference store accessor | module-local + cross-module | Medium — notification dispatch path; touches whichever preference repo wins Q3 |
| FIX-005 | `apps/memberry/src/features/notifications/notification-preferences.tsx` (repoint endpoint), shared category constants (person + communication) | cross-module | Medium — UI + two category vocabularies must converge |
| FIX-006 | `apps/memberry/src/` login/init path (OneSignal SDK), `apps/memberry/public/` (service worker) OR `compose-form.tsx` (hide push); `package.json` (remove dep if descoped) | module-local (frontend) | Medium — frontend init; paid integration |
| FIX-007 | `specs/api/src/modules/email.tsp` (DELETE op + `x-audit`), new `handlers/email/deleteEmailSuppression.ts`, regenerate routes | module-local | Low/Medium — additive endpoint; regen step |
| FIX-008 | `services/api-ts/src/core/email.ts` (`queueEmail` validation) | shared/platform | Medium — `queueEmail` called by all producers; additive guard, fail-fast |
| FIX-009 | dunning job (association:member), committee-task job (association:operations) — additive trigger calls only | cross-module | Medium — edits two other modules' jobs; additive |
| FIX-010 | `specs/api/tests/contract/email-extended-flow.hurl` | module-local (test) | Low |
| FIX-011 | `docs/product/modules/m22-email/MODULE_SPEC.md`, `docs/product/MODULE_SPEC.notifs.md` | module-local (docs) | Low |
| FIX-012 | `handlers/notifs/repos/notification.repo.ts` (orgId validation) | module-local | Low |
| FIX-013 | `handlers/notifs/repos/notification.schema.ts` (type def) | module-local | Low (typecheck-bounded) |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-002 | shared/platform | `core/email.ts` EmailService + `isSuppressed` shape | Guard 1 changes affect every email producer; auth mail (Better-Auth verify/reset/2FA) MUST never be blocked | No new prerequisite; make change additive (return reason; keep boolean wrapper). Regression-test auth-mail path `[CROSS-MODULE RISK]` |
| FIX-003 | shared/platform + environment/tooling | New public pre-auth webhook route in `app.ts` + `HAND_WIRED_ROUTES.yaml` + contract CI; live provider | Webhook payload/signature shape depends on the production provider | Yes — confirm Q2 provider (SMTP/Postmark/OneSignal) + webhook delivery before building `[BLOCKED BY ENVIRONMENT]` |
| FIX-004 | cross-module + product decision | `notification_preference` (person) vs `person_subscriptions` (communication) store ownership | Enforcement must read the same store the UI writes; spans notifs + person + communication | Yes — Q3 must be decided first `[NEEDS PRODUCT DECISION]` `[SHARED DEPENDENCY]` |
| FIX-005 | cross-module + product decision | Same store-ownership decision + shared category constants | UI must write the chosen store with matching category vocab | Yes — Q3 `[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]` |
| FIX-006 | product decision + environment/tooling | OneSignal env (`ONESIGNAL_APP_ID/API_KEY`, `VITE_ONESIGNAL_APP_ID`); push-scope decision | Push fix is unverifiable live without a real/sandbox OneSignal app; build-vs-descope depends on scope | Yes — Q1 `[NEEDS PRODUCT DECISION]`; live verify `[BLOCKED BY ENVIRONMENT]` |
| FIX-008 | shared/platform | `core/email.ts` `queueEmail` consumed by all producers | Stricter enqueue validation rejects previously-silently-accepted bad enqueues | No prerequisite; additive fail-fast. Confirm no producer relies on lenient enqueue `[NEEDS CONFIRMATION]` |
| FIX-009 | cross-module | Dunning job (association:member) + committee-task job (association:operations) | Wiring edits live outside this module; must confirm no alternate notification path exists | Yes — Q4 confirmation `[NEEDS CONFIRMATION]` `[CROSS-MODULE RISK]` |
| FIX-011 | missing spec / product decision | Fate of phantom endpoints (`DELETE template`, `POST /email/send`) | Doc reconciliation must record whether spec or code is the bug | Q5 informs the template-delete/direct-send rows `[BLOCKED BY MISSING SPEC]` |
| FIX-001, FIX-007, FIX-010, FIX-012, FIX-013 | module-local | — | Self-contained within notifications-email (+ registry/contract test files) | No |

**Database/schema:** No migration required for any active fix. `email_suppression.reason`, `email_category`, and `notification_preference` columns already exist. Eventual deprecation of one preference table is a prompt-06 concern — do NOT alter schema in this module pass.

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Is web push in scope for V1 (wire `react-onesignal`) or mobile-only/deferred (hide push channel in compose UI)? | ✅ **DECIDED 2026-06-13** | FIX-006 | Determines whether push is a build or a descope+UI fix | **Descope web push for V1.** FIX-006 built: `WEB_PUSH_ENABLED=false` gates the Push column in the member preference matrix (schema/mobile push kept). See fix-report §N. |
| Q2: Which email provider is authoritative in production (SMTP / Postmark / OneSignal) and does it deliver bounce/complaint webhooks? | `[NEEDS CONFIRMATION]` `[BLOCKED BY ENVIRONMENT]` | FIX-003 | Webhook payload shape + signature scheme depend on it | Eng + Product confirm provider; then build signature-verified webhook to that provider's contract |
| Q3: Which preference store wins — person-owned `notification_preference` or communication-owned `person_subscriptions`? | ✅ **DECIDED 2026-06-13** | FIX-004, FIX-005 | Blocks enforcement + UI convergence; affects 3 modules | **`person_subscription` (DB) is canonical**; OneSignal is a delivery mirror. UI already writes it → FIX-005 satisfied. FIX-004 delivery enforcement deferred `[CROSS-MODULE RISK]` (needs type→category map). See fix-report §N. |
| Q4: Do dunning-stage transitions / committee-task overdue sweeps notify via any path other than the unwired trigger functions? | `[NEEDS CONFIRMATION]` | FIX-009 | If yes → dead-code removal; if no → members miss escalations and triggers must be wired | Eng traces dunning + committee-task jobs (organizer confirmed zero callers of the trigger functions) |
| Q5: Were `DELETE /email/templates/:id` and `POST /email/send` consciously dropped (spec stale) or never built? | `[BLOCKED BY MISSING SPEC]` | FIX-011 | Settles whether spec or code is the bug for the phantom endpoints | Product confirms; recommend: keep both deferred, fix the spec to match code |
| Q6: Does an email-queue 30-day cleanup job exist (WF-110 claims it)? | `[NEEDS CONFIRMATION]` | (Deferred — see §10) | Unbounded queue table growth otherwise | Eng verifies in fix phase; add job only if absent (not in active scope) |
| Q7: Is logging recipient email at info level (`unsubscribeEmail.ts`) acceptable under "never log PII"? | `[NEEDS CONFIRMATION]` | (Deferred — see §10) | DPA 2012 posture | Eng/Compliance confirm; redact if not acceptable |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-003 bounce/complaint webhook | `[BLOCKED BY ENVIRONMENT]` `[NEEDS CONFIRMATION]` | Webhook payload + signature scheme depend on the production email provider, which is unconfirmed; cannot live-verify without a sandbox provider | Q2 confirmation of provider + webhook capability |
| FIX-004 preference enforcement | ✅ **RESOLVED 2026-06-13** | Q3 decided (`person_subscription` canonical); per-category enforcement built via `NotificationPreferencePort`. No longer blocked. | — (done; see fix-report Batch D) |
| FIX-005 preference UI convergence | `[NEEDS PRODUCT DECISION]` | UI repoint + category-constant unification depend on the same store decision | Q3 store-ownership decision |
| FIX-006 web push wiring (build path) | `[NEEDS PRODUCT DECISION]` `[BLOCKED BY ENVIRONMENT]` | Build path needs a scope decision and a real/sandbox OneSignal app for verification; descope path is unblocked | Q1 scope decision (descope path can proceed immediately) |
| FIX-009 trigger wiring | `[NEEDS CONFIRMATION]` | If an alternate notification path exists, wiring would create duplicate notifications | Q4 confirmation that no alternate path fires these notifications |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Admin UI screens for email queue/templates/suppressions | §9, §23 | `V2 DEFERRED` | NAVIGATION_MAP explicitly declares no frontend routes; API-only is the spec'd V1 |
| `POST /email/send` direct-send endpoint | §12, §23, §25 Q5 | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | In spec §8 but absent from spec's own handler mapping; all real senders queue; synchronous public send invites abuse |
| `DELETE /email/templates/:id` | §12, §23 | `V2 DEFERRED` | `archived` status via PATCH covers retirement; hard delete risks dangling queue references |
| SMS channel (delivery, not the FIX-013 type cleanup) | §9, §13, §23 | `V2 DEFERRED` | No schema enum value, no provider, no spec'd requirement beyond a parenthetical |
| Domain events EmailSent/EmailFailed/EmailBounced/EmailComplaint emission | §4, §5, §23 | `V2 DEFERRED` `[DO NOT OVERBUILD]` | No real consumer; logging already covers audit need |
| Delivery receipts / true `delivered` status from OneSignal callbacks | §10, §23 | `V2 DEFERRED` `[DO NOT OVERBUILD]` | Analytics nicety; no V1 workflow depends on it; push marked `delivered` on accept is a minor analytics distortion |
| Multi-channel fan-out from `channels[]` array | §6, §23 | `V2 DEFERRED` `[DO NOT OVERBUILD]` | Callers can issue one request per channel; fan-out duplicates trigger-layer logic |
| Email-queue 30-day cleanup job verify/add | §13, §25 Q6 | `V2 DEFERRED` `[NEEDS CONFIRMATION]` | May already exist (`subDays` imported in `queue.repo.ts`); verify in fix phase, add only if absent — not in active P1/P2 scope |
| Recipient-email-in-logs PII review | §15, §25 Q7 | `[NEEDS CONFIRMATION]` | DPA posture review; low risk; not blocking V1 workflow |
| Template-resolution tag-overlap ambiguity (first-match-any-tag) | §13 | `[DO NOT OVERBUILD]` | Document ordering when touched; no active bug evidence |
| Extract hardcoded retry cap `3` into a constant | §13 | `[DO NOT OVERBUILD]` | Cosmetic; do only opportunistically when touching `queue.repo.ts` |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Replace `globalThis.app.email` bridge with injected EmailService | §6, §16, §23 | Works today; refactor is broad-blast-radius churn not justified by any active gap `[DO NOT OVERBUILD]` |
| Expand `consentValidated` into a real consent engine | §6, §12, §23 | CLAUDE.md: consent management deliberately not yet implemented; keep field dormant `[NEEDS PRODUCT DECISION]` |
| Configurable per-template retry limits | §23 | Hardcoded 3 + backoff meets BR-54; config adds surface without demand |
| Merge notifs into communication module | §17, §23 | MODULE_SPEC.notifs §9 documents dependency-cycle risk; the boundary is by design |
| Add a 4th notification-creation idiom | §16 | Three idioms already exist (direct event-consumer insert, repo, triggers); prefer triggers/repo — do not introduce another |
| Synchronous multi-channel fan-out abstraction | §6, §23 | Premature; duplicates existing trigger-layer behavior `[DO NOT OVERBUILD]` |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | BRs were never registered/tagged; coverage gate structurally blind to M22. Tagging + writing the missing tests fixes the cause, not a symptom |
| FIX-002 | Root cause | Guard 1 / `isSuppressed` lacks reason granularity; suppression is treated as binary. Reason-aware lookup addresses the cause. Keep boolean wrapper additively |
| FIX-003 | Root cause | No ingestion surface exists at all; the schema enum values (`hard_bounce`/`complaint`) are unreachable dead values. Building the webhook is the root-cause fix |
| FIX-004 | Root cause | Delivery path simply never reads any preference store. Adding enforcement in `NotificationRepository` dispatch is the root fix |
| FIX-005 | Root cause | UI was wired to the wrong table (`person_subscriptions`) with a divergent category vocabulary; two stores diverged. Convergence is the root fix |
| FIX-006 | Root cause | The frontend half of the OneSignal integration was never implemented (dep installed, never imported). Wire-or-descope addresses the cause |
| FIX-007 | Root cause | DELETE op was never specified/built (WF-125 only half-implemented). Adding it completes the workflow |
| FIX-008 | Root cause | Validation was deliberately deferred to process time ("validation will happen during processing"). Moving it to enqueue is the root fix |
| FIX-009 | Unclear → confirm | Trigger functions exist with zero callers; whether an alternate path notifies is unconfirmed (Q4). If none, wiring is the root fix; if one exists, the functions are dead code to remove |
| FIX-010 | Symptom (test quality) | Placeholder-UUID `HTTP *` steps mask whether transitions actually work; replacing them proves real behavior |
| FIX-011 | Root cause (doc) | Spec self-contradiction (§8 table vs handler mapping) is the cause of future mis-implementation risk |
| FIX-012 | Root cause | Optional `organizationId?` + `|| ''` fallback against a notNull uuid column; early validation removes the latent crash path |
| FIX-013 | Root cause | Type advertises `'sms'` the schema cannot store; trimming the type removes the latent crash advertisement |

## 13. Recommended First Fix Batch

**Batch name:** Batch D + Batch B (BR-57 slice) — "Test foundation + reason-aware transactional override"

**Included Fix IDs:** FIX-001 (all BR-52..59 tagging/registration + write missing BR-53/55/56/57/58 — note BR-55/56 tests are written here but their *implementation* FIX-003 is deferred to Batch E, so BR-55/56 tests may be authored failing-first and parked, or deferred with FIX-003; at minimum register BR-52/53/54/57/58/59), and FIX-002 (BR-57 reason-aware Guard 1). Optionally FIX-010 if time permits.

**Why this batch comes first:**
1. FIX-001 is a hard prerequisite — `bun run test:br` reports 0% for M22 and no other fix can be verified safely without registered tests (gap plan §10, §26).
2. FIX-002 is the highest member-trust payoff with the smallest blast radius: it needs no product decision, no schema migration, and no new route — only an additive reason-returning suppression lookup plus a category check in Guard 1. It directly protects the platform's core "stay current on dues" value (gap plan §17).

**Tests to write first (failing-first, before implementation):**
- BR-57 unit cases (4): transactional × `unsubscribe` (allow), transactional × `hard_bounce` (block), transactional × `complaint` (block), bulk × `unsubscribe` (block) — in `core/email.test.ts`.
- BR-53/BR-58 enqueue-rejection unit cases (drive FIX-008, but author the tests now if pulling FIX-008 forward; otherwise park).
- Tag existing BR-52 (suppression-drop), BR-54 (retry cap), BR-59 (cancellation audit) tests and register all in `br-registry.json`.
- Auth-mail regression case: Better-Auth verify/reset/2FA email is never blocked by the new Guard 1 logic (`[CROSS-MODULE RISK]`).

**Explicit out-of-scope for this first batch:**
- FIX-003 bounce webhook (Batch E — blocked on Q2).
- FIX-004/FIX-005 preference enforcement + UI convergence (blocked on Q3).
- FIX-006 web push (blocked on Q1).
- FIX-007/008/009/011/012/013 (Batch C, later passes) — unless FIX-008 is explicitly pulled forward.
- Everything in §10 Deferred and §11 Do Not Build — especially admin email UI, direct-send, SMS, domain-event emission, multi-channel fan-out, and the email-service DI refactor.
- No database migration. No schema changes.

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Notifications & Email
- **Exact module slug:** notifications-email
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/notifications-email-fix-ready-plan.md`
- **Exact batch to execute first:** Batch D + Batch B (BR-57 slice) — FIX-001 (BR tagging/registration + missing BR tests) then FIX-002 (reason-aware transactional suppression override). Do not start any other batch in this pass.
- **Tests to prioritize (write failing-first, then implement minimal fix):**
  1. BR-57 unit cases in `services/api-ts/src/core/email.test.ts` (transactional bypasses `unsubscribe` only; never bypasses `hard_bounce`/`complaint`; bulk unaffected).
  2. Tag + register BR-52/BR-54/BR-59 onto existing tests in `handlers/email/repos/suppression.repo.test.ts`, retry test (`retryEmailQueueItem.test.ts` / `queue.repo.test.ts`), `cancelEmailQueueItem.test.ts`; update `docs/ver-3/business/br-registry.json`.
  3. Auth-mail regression test proving Better-Auth verify/reset/2FA email is not blocked by Guard 1 changes.
- **Files likely to touch:** `services/api-ts/src/core/email.ts` (Guard 1), `services/api-ts/src/handlers/email/repos/suppression.repo.ts` (add a reason-returning lookup; keep the `isSuppressed` boolean wrapper for existing callers), `services/api-ts/src/core/email.test.ts`, and the BR-tagged test files + `br-registry.json`.
- **Shared / database cautions:**
  - `core/email.ts` is shared/platform — Guard 1 runs for auth mail, communication jobs, dues dunning, and the notification-repo `globalThis.app.email` bridge. Make the suppression change **additive** (new reason-returning method; existing `isSuppressed` boolean wrapper unchanged) `[SHARED DEPENDENCY]` `[CROSS-MODULE RISK]`.
  - **No database migration** is required — `email_suppression.reason` and `email_category` already exist. Do not generate or run migrations in this pass.
  - Do not touch `app.ts` or `HAND_WIRED_ROUTES.yaml` in this batch (those belong to the deferred FIX-003 bounce-webhook batch).
- **Items NOT to implement in this pass:**
  - FIX-003 (bounce webhook — `[BLOCKED BY ENVIRONMENT]`, needs Q2), FIX-004/FIX-005 (preference enforcement + UI — needs Q3), FIX-006 (web push — needs Q1), FIX-009 (trigger wiring — needs Q4).
  - All of §10 Deferred and §11 Do Not Build: admin email UI, `POST /email/send`, `DELETE /email/templates/:id`, SMS channel delivery, domain-event emission, delivery receipts, multi-channel `channels[]` fan-out, `globalThis.app.email` DI refactor, `consentValidated` consent engine, configurable retry limits, merging notifs into communication.
  - Do not expand scope into FIX-007/008/010/011/012/013 unless explicitly instructed to pull a specific one forward.

---

Next recommended step:
Module/group: Notifications & Email
Module slug: notifications-email
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/notifications-email-fix-ready-plan.md
Recommended batch: Batch D + Batch B (BR-57 slice) — Test foundation + reason-aware transactional override
