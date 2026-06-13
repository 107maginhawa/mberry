# AHA Module/Group Gap Plan: Training & Credits

Date: 2026-06-11 — Prompt: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Training & Credits |
| Module slug | `training-credits` |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/training-credits-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m09-training.md`, `docs/product/modules/m10-credit-tracking.md`, `docs/product/MODULE_SPEC.member.credits.md` |
| Supporting PRDs/specs used | `docs/quality/SCOPE.credits.md`, `docs/ver-3/ux/screens/{member/credits.md, member/credits-log.md, member/training.md, officer/training*.md, officer/reports-credits.md}`, `docs/execution/slices/m09-training-paid-gate-completion-lock/` |
| PRD/spec coverage quality | Strong (m09 + m10 detailed; MODULE_SPEC.member.credits current as of cutover `0f25bcef`) |
| Paths inspected | `services/api-ts/src/handlers/association:operations/` (training handlers + `repos/training.schema.ts`, `accredited-provider.schema.ts`), `services/api-ts/src/handlers/member/credits/` (all handlers + `utils/`), `services/api-ts/src/handlers/association:member/repos/credits.{schema,repo}.ts`, `services/api-ts/src/handlers/association:member/jobs/creditIssue.ts`, `services/api-ts/src/handlers/person/getMyCredits.ts`, `services/api-ts/src/generated/openapi/routes.ts`, `services/api-ts/src/app.ts`, `specs/api/src/association/operations/training.tsp`, `specs/api/src/association/member/credits.tsp`, `apps/memberry/src/routes/_authenticated/my/{credits/, training.tsx}`, `apps/memberry/src/routes/_authenticated/org/$orgSlug/{training/, officer/training/, officer/settings/cpd.tsx, officer/reports/credits.tsx, my-cpd.tsx}`, `apps/admin/src/routes/training/`, `specs/api/tests/contract/{credits-flow,credit-compliance-flow,training-flow,assoc-training-*}.hurl`, `specs/api/tests/contract/member/credits/*.hurl`, `apps/memberry/tests/e2e/{member,officer,states,actions}/*training*|*credit*` |
| PRDs/specs inspected | m09, m10, MODULE_SPEC.member.credits, SCOPE.credits, ver-3 UX screens for member/officer training + credits |
| KG used | Yes (status notes at `docs/aha/kg/knowledge-graph-status.md`; 3,474-node graph of 2026-06-06 used as secondary evidence only) |
| KG refreshed | No (direct code inspection answered all wiring questions) |
| `/understand-domain` used | Yes (status notes only; product docs richer per `docs/aha/kg/domain-knowledge-status.md`) |
| `/understand-domain` refreshed | No |
| Webwright used | No |
| Playwright/E2E inspected | Yes (file inventory + spot checks; not executed) |
| Existing tests inspected | Backend unit tests in both handler dirs, Hurl contract files, Playwright spec inventory (see §19) |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | Static review sufficient; browser tooling skipped for batch run. No server boot, no test execution. Findings relying on runtime behavior are marked `[NEEDS CONFIRMATION]`. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| M09 Training PRD | `docs/product/modules/m09-training.md` | PRD | Current | Training lifecycle, enrollment modes, attendance→credit award, certificates, business rules M9-R1..R11, AC patterns |
| M10 Credit Tracking PRD | `docs/product/modules/m10-credit-tracking.md` | PRD | Current | Credit cycles, AUTO/MANUAL entries, cross-org aggregation, carryover, compliance views, transcript |
| MODULE_SPEC member/credits | `docs/product/MODULE_SPEC.member.credits.md` | Module spec (post-cutover) | Current | Authoritative map of the 11 generated + 2 hand-wired credit operations and ownership |
| SCOPE.credits | `docs/quality/SCOPE.credits.md` | Decomposition/scope doc | Current | TypeSpec interface inventory, hand-wired holdouts, hurl plan, `createCreditEntry.ts` scope note (§10.E) |
| ver-3 UX screens | `docs/ver-3/ux/screens/{member,officer,org-member}/…` | UX spec | Current | Screen-level expectations for `/my/credits`, `/my/training`, officer training + reports |
| m09 paid-gate slice | `docs/execution/slices/m09-training-paid-gate-completion-lock/` | Execution slice | Current | BR-41 paid gate + AC-M09-005 completion lock provenance |

## 3. Expected vs Actual

**Expected (m09/m10):** Officer creates/publishes credit-bearing training (one of 5 platform types, optional fee, enrollment mode); member browses/enrolls (paying if required); officer confirms attendance (QR/manual/completion); confirmation auto-creates an AUTO `CreditEntry` respecting the hosting-org credit-tracking toggle; member self-reports MANUAL entries with no approval gate; member sees cross-org cycle summary/compliance and downloads a regulator-grade transcript PDF; officer sees an org compliance table (CSV-exportable), configures CPD requirements per org, and can award/adjust/void credits with mandatory reasons.

**Actual:** TypeSpec/route surface is broad (training CRUD + lifecycle, courses/quizzes, accredited providers, CPD config, compliance, manual award/adjust/void, peer credits, transcript) and member/officer/admin pages exist for all major screens. However the **credit-award seam is broken end-to-end**: the officer attendance UI never sends the member id and the backend check-in handler writes nothing; the only credit-awarding endpoint (`completeTrainingEnrollment`) has zero frontend consumers. Cycle boundaries are computed three different incompatible ways at the three credit-write paths. Transcript/compliance sums ignore `status='voided'` and ignore `org_cpd_config`, with required-credit values hardcoded or client-supplied. Paid trainings are a dead end (enrollment 422s with `PAYMENT_REQUIRED`; no training payment path exists). Training `type` (M9-R1), enrollment modes (M9-R4), credit-value lock (M9-R2), and toggle enforcement (M9-R8) are not implemented in schema/handlers even though TypeSpec and frontend reference them. `[INFERRED]` from full handler/schema/route/page reads cited below.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SO-1 create + publish training | Officer-only create with type/fee/mode/visibility; draft→published | Create/publish handlers exist, officer-gated; type/mode dropped | `officer/training/new.tsx` | `createTraining.ts`, `publishTraining.ts`; routes.ts:2092-2098 (`requirePositionMiddleware ["Society Officer","President"]`) | `training` table lacks `type`, `enrollment_mode` | `createTraining.test.ts`, `publishTraining.test.ts`, `assoc-training-main-flow.hurl` | Partially Implemented | Yes (type/mode dropped) |
| M9-R1 5 platform training types | `type` persisted, immutable set, filterable | TypeSpec has `TrainingType` (training.tsp:24); validator `SearchTrainingsQuery.type` exists; DB has **no `type` column**; `createTraining.ts` does not persist it | `my/training.tsx` renders `training.type` (always undefined) | `validators.ts:12271`; `createTraining.ts:28-40` | `repos/training.schema.ts` `trainings` table — no type column | none | Missing | Yes — P1 |
| M9-R2 credit value locked after first attendance | `creditAmount` immutable post-confirmation | `updateTraining.ts` spreads body with no lock/status guard | — | `updateTraining.ts:31-33` | no lock flag | none | Missing | Yes — P1 |
| M9-R3 cancel does not revoke credits | Training cancel keeps awarded credits | No training-program cancel handler found; `cancelCustomTraining` cancels **the caller's enrollment** yet emits `training.cancelled` | — | `cancelCustomTraining.ts:30-53` | — | none | Partially Implemented / Misleading | Yes — P1 |
| M9-R4 enrollment modes (open/approval/invitation) | Mode enforced at enroll time | Only open enrollment exists; enum lacks `pending_approval/pending_payment/waitlisted`; no invitation table | `my/training.tsx` maps those statuses (dead UI states) | `enrollInCustomTraining.ts` (no mode logic) | `enrollmentStatusEnum` = enrolled/completed/cancelled/noShow | none | Missing | Yes — P2 `[NEEDS PRODUCT DECISION]` |
| M-19 4b paid enrollment via checkout | Paid training → payment → enrollment confirmed | Enroll throws `PAYMENT_REQUIRED` (BR-41); **no training payment endpoint exists** (`registerAndPayForEvent` is events-only); FE reads nonexistent `training.fee/price` | `org/$orgSlug/training/$trainingId.tsx:121,179-226` | `enrollInCustomTraining.ts:37-42`, `createTrainingEnrollment.ts:44-50` | `registrationFee` column exists | `register-and-pay.test.ts` (events) | Partially Implemented | Yes — P1 |
| SO-3 confirm attendance → auto credit | Officer confirms per member; AUTO CreditEntry created once | `checkInCustomTraining` writes **nothing** (returns enrollment); attendance UI never sends memberId; `completeTrainingEnrollment` awards credits but has **no frontend consumer** | `officer/training/$trainingId/attendance.tsx:31-36` (no memberId in request; local `useState` fakes check-in) | `checkInCustomTraining.ts:26-42`; `completeTrainingEnrollment.ts:61-87`; grep: zero `completeTrainingEnrollment` references in `apps/` | no attendance table | `training-enrollment.test.ts` (AC-M09-001/003/005 — API level only), `check-in.test.ts` | Partially Implemented (API) / Missing (journey) | Yes — **P0** |
| M9-R8 / 10.5 credit-tracking toggle | Hosting-org toggle suppresses credit award | `isEnabled(org,'creditTracking')` exists + unit-tested, but `completeTrainingEnrollment` never consults it | — | `completeTrainingEnrollment.ts:61` (no toggle check); `member/credits/credits.test.ts:836-852` | platformadmin feature flags | toggle util tested; enforcement untested | Partially Implemented | Yes — P2 |
| M9-R10 duplicate check-in prevention | One credit per member per training | Credit-level guard exists (`findByTrainingAndPerson` + `uq_credit_source_person`); check-in itself writes nothing so "duplicate check-in" is vacuously prevented | attendance.tsx fakes BR-17 toast | `credits.repo.ts:71-90`; `credits.schema.ts` unique index | — | `training-enrollment.test.ts` AC-M09-003 | Implemented (credit level) | No |
| AC-M09-005 post-completion lock | Completed enrollment immutable | FSM guard via `assertValidTransition` | — | `completeTrainingEnrollment.ts:44-49` | — | `training-enrollment.test.ts` | Implemented | No |
| 10.1/BR-11 credit cycle config | Per-org cycle (length, start, required) drives all entries | `org_cpd_config` exists; **three divergent cycle computations** at write paths (see §13-F2) | `officer/settings/cpd.tsx` | `completeTrainingEnrollment.ts:69` (hardcoded 2y, activity-date anchor), `awardManualCredit.ts:30-33` (2020-epoch inline), `creditIssue.ts` (`computeCycleBoundaries` + config) | `org_cpd_config` (60/3/40/1 defaults) | `credit-cycle.test.ts`, `getCpdConfig/updateCpdConfig.test.ts` | Partially Implemented | Yes — P1 |
| 10.2 MANUAL member entry, no approval gate | Member self-reports; counts immediately | Routed (`POST /persons/me/credit-entries`, routes.ts:3179) → `createCreditEntry.ts`; sets `verificationStatus='pending'` (schema default) while officer awards set `'verified'` — whether pending entries count in summaries is unverified | `my/credits/log.tsx:50` | `createCreditEntry.ts:57-71` | `verification_status` default `'pending'` | `credits.test.ts` describes | Implemented but Untested `[NEEDS CONFIRMATION]` | Yes — P2 |
| 10.3/BR-14 cross-org aggregation | Sum across orgs, respecting each org's toggle | `sumCreditsByOrg` sums **all** rows for person in date window — no `status`/`verificationStatus`/toggle filter; **voided credits still count** | `/my/credits` page | `credits.repo.ts:175-194`; `voidCreditEntry.ts` sets `status='voided'` | `status` enum exists, unused in reads | `credits.test.ts` BR-14 describe | Partially Implemented | Yes — P1 |
| 10.4/BR-12 carryover capped 50% | Server-computed carryover line item | `calculateCarryover` correct, but transcript takes `previousCycleEarned` **from the client query** | — | `getCreditTranscript.ts` query iface; `credit-cycle.ts:calculateCarryover` | — | `credit-cycle.test.ts`, e2e `credit-carryover.spec.ts` | Partially Implemented | Yes — P2 |
| 10.6 member compliance view | Earned vs required from org config | `/persons/me/credits` (`getMyCredits`) + `my-cpd.tsx` with SDL cap display | `my-cpd.tsx`, `my/credits/index.tsx` | `getMyCredits.ts` reads `orgCpdConfig` | — | e2e `credits.spec.ts` | Implemented | Minor |
| 10.7 officer compliance view + CSV | Table from org config; prorated pace flags; CSV export | Two parallel reports: `getComplianceReport` (matview, generated route) and `getCreditCompliance` (`/credit-compliance/:orgId`, query-param defaults 40/2); FE hardcodes `requiredCredits=45&cyclePeriodYears=3`; no CSV; no prorated flag | `officer/reports/credits.tsx:30,111` | `getComplianceReport.ts`; `getCreditCompliance.ts:40-44`; routes.ts:885,2873 | `compliance_standings` matview | `getComplianceReport.test.ts`, e2e `reports-credits.spec.ts` | Partially Implemented | Yes — P1 (sources of truth) |
| 10.8/M-24 transcript PDF | Regulator-grade, all orgs, certificate numbers | Hand-wired `/persons/me/credit-transcript(/pdf)`; **`requiredCredits`, `cyclePeriodYears`, `registrationDate` are client-supplied query params** — member controls own compliance verdict on the PDF; ignores `org_cpd_config` | export from `/my/credits` `[NEEDS CONFIRMATION]` (no Export button found in index.tsx) | `app.ts:522-543`; `getCreditTranscript.ts` | — | `getCreditTranscriptPdf.test.ts` (188 LOC) | Partially Implemented | Yes — P1 |
| SO-10/AC officer adjust with mandatory reason, audit-logged | Reason required, immutable log | `adjustCreditEntry` enforces ≥10-char reason, position-gated, idempotency key, `credit.adjusted` event; reason stored in `attestation` JSON not dedicated columns | — | `adjustCreditEntry.ts:27-45,68-72` | PRD wants `adjusted_by/adjustment_reason` columns; impl uses `attestation` jsonb | `adjustCreditEntry.test.ts`, hurl `credits-manual-award/void` | Implemented | Minor (P3) |
| Officer manual award (MODULE_SPEC) | President/Secretary/Treasurer award with SDL cap warning | Implemented incl. SDL cap warning + idempotency | — | `awardManualCredit.ts` | `uq_credit_source_person` | `awardManualCredit.test.ts`, `member/credits/credits-manual-award.hurl` | Implemented | No |
| M9 PRC accreditation (providers) | Accredited provider registry + training link | Implemented (CRUD, status enum, expiry) | admin/officer views | `*OrgAccreditedProvider*.ts` | `accredited-provider.schema.ts`; `prc_accreditation_number` on training | `org-accredited-providers.test.ts` | Implemented | No |
| M-21 certificates | Cert after date passed + attendance confirmed | Lives in `member/certificates/` — `[CROSS-MODULE RISK]` only the `training.completed` emit audited here | — | `completeTrainingEnrollment.ts:89-100` | — | cert tests exist | Implemented (emit side) | Out of scope |
| Credit value decimal (min 0.5) | Fractional CPD units storable | `credit_amount`/`creditAmount` are **`integer`** columns on both `training` and `credit_entry` | SO-1 step 5 ("Minimum 0.5") | — | `training.schema.ts`, `credits.schema.ts` | none | Missing | Yes — P2 `[NEEDS PRODUCT DECISION]` |
| Courses + quizzes (online learning) | Not in m09/m10 V1 journeys explicitly | `course`, `course_enrollment`, `quiz_attempt` tables + 12 handlers | admin "Training & Courses" page | `createCourse.ts` etc. | training.schema.ts | `courses.test.ts`, `quiz.test.ts` | Possible Overbuild | See §6 |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| SO-3 attendance→credit (core CPD value) | Officer attendance UI never transmits memberId; backend check-in is a no-op; credit-awarding endpoint unwired in any app | P0 | V1 REQUIRED | `attendance.tsx:31-36` (mutation sends only `{path:{trainingId},query:{organizationId}}`, then `setCheckedIn(local Set)`); `checkInCustomTraining.ts:29` (looks up **caller's** enrollment, writes nothing); grep `completeTrainingEnrollment` in `apps/` = 0 hits | Wire attendance UI to `completeTrainingEnrollment` per enrollee (or make check-in accept person/enrollment id, persist attendance, and award credit); delete the local-state fake |
| M9-R8 toggle | Credits awarded regardless of org credit-tracking toggle | P2 | V1 RECOMMENDED | `completeTrainingEnrollment.ts:61` has no `isEnabled(org,'creditTracking')` check (util exists, tested at `member/credits/credits.test.ts:836-852`) | Check toggle before credit insert |
| BR-11/10.1 single cycle authority | 3 incompatible cycle computations stamp `cycleStart/cycleEnd` | P1 | V1 REQUIRED | `completeTrainingEnrollment.ts:69` `getCycleForDate(activityDate, activityDate, 2)` → degenerate cycle anchored at the activity itself, hardcoded 2y; `awardManualCredit.ts:30-33`/`adjustCreditEntry.ts:36-45` inline 2020-epoch month math; `creditIssue.ts` `computeCycleBoundaries(now, cfg)` | One shared cycle service reading `org_cpd_config`; backfill/verify existing rows |
| 10.3/void integrity | Voided/pending entries counted in transcript + compliance | P1 | V1 REQUIRED | `credits.repo.ts:175-194` (`sumCreditsByOrg` has no `status='active'` filter); `voidCreditEntry.ts` sets `status='voided'` | Filter `status='active'` (and decide on `verificationStatus`) in all aggregate reads |
| 10.7/10.8 required-credits authority | 4 competing values: org config 60/3, `getCreditCompliance` defaults 40/2, FE hardcode 45/3, client-supplied transcript params | P1 | V1 REQUIRED | `getCreditCompliance.ts:40-44`; `officer/reports/credits.tsx:30`; `app.ts:523-534`; `org_cpd_config` defaults | All compliance/transcript reads resolve from `org_cpd_config`; remove client-supplied `requiredCredits` |
| 10.8 transcript trust | Member-controlled `requiredCredits/registrationDate` on a regulator-facing PDF | P1 | V1 REQUIRED | `app.ts:522-543` hand-wired query schema; `getCreditTranscript.ts` query iface | Derive from membership record + org config server-side |
| M-19 4b paid training | Paid trainings unenrollable; no payment path; FE reads nonexistent `fee/price` fields | P1 | V1 REQUIRED `[NEEDS PRODUCT DECISION]` (or hide paid option until M06 wiring) | `enrollInCustomTraining.ts:37-42`; `createTrainingEnrollment.ts:44-50`; `training/$trainingId.tsx:121`; no `registerAndPayForTraining` exists | Either build training pay-and-enroll (mirroring `registerAndPayForEvent`) or block fee>0 at creation until supported |
| M9-R2 credit lock | `updateTraining` mutates creditAmount/status freely after attendance | P1 | V1 REQUIRED | `updateTraining.ts:31-33` | Reject creditAmount change once any auto credit exists for training |
| M9-R1 training type | `type` accepted by API, dropped by handler, absent from DB; search filter advertised but unbackable | P1 | V1 REQUIRED | training.tsp:24,167,732; `validators.ts:12271`; `training.schema.ts` (no column); `createTraining.ts:28-40` | Add `type` column + persist + filter (or remove from spec — `[NEEDS PRODUCT DECISION]`) |
| Lifecycle semantics | Member self-`completeCustomTraining` (terminal) blocks officer completion → credits permanently lost; member enrollment-cancel emits `training.cancelled` | P1 | V1 REQUIRED | `completeCustomTraining.ts:44-53`; `cancelCustomTraining.ts:49-53`; FSM guard in `completeTrainingEnrollment.ts:44` | Restrict self-complete or make officer path idempotent-award; rename/scope events (`enrollment.cancelled`) |
| Trust: silent credit failure | Credit insert failure swallowed with bare `catch {}` — completion succeeds, credit silently missing, nothing logged | P1 | V1 REQUIRED | `completeTrainingEnrollment.ts:84-86` | Log + surface `creditAwarded:0` reason; consider enqueue retry via `creditIssue` job |
| M9-R4 enrollment modes | approval/invitation modes absent; FE renders dead statuses | P2 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | `enrollmentStatusEnum`; `my/training.tsx` ENROLLMENT_VARIANT | Defer; remove dead FE states meanwhile |
| Duplicate enrollment | No unique constraint / pre-check on (trainingId, personId) | P2 | V1 RECOMMENDED | `enrollInCustomTraining.ts:51-56`; `training_enrollment` table indexes only | Add existing-enrollment check + unique index |
| Active-membership gate | Enrollment only role-gated, no M05 active-membership check | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` whether role implies active | `enrollInCustomTraining.ts` | Verify role semantics; add membership check if needed |
| Decimal credits | Integer columns block 0.5-unit CPD | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `training.schema.ts`, `credits.schema.ts` integer columns vs SO-1 step 5 | Migrate to numeric if PRC fractional units required |
| 10.7 CSV export + prorated pace | Not implemented | P2 / P3 | V1 RECOMMENDED (CSV) / V2 DEFERRED (prorated) | `officer/reports/credits.tsx` (no export) | Client-side CSV from standings is enough |
| M9-R9 waitlist for trainings | Events have waitlist; trainings do not | P3 | V2 DEFERRED | `listWaitlistEntries.ts` (events only) | Defer |
| M9-R6 network approval workflow | Absent | P3 | V2 DEFERRED | no `network_approval_*` columns | Defer ("when configured" in PRD) |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Courses + course enrollments + quiz attempts (12 handlers, 3 tables) | `createCourse.ts`, `quiz.test.ts`, `training.schema.ts` | m09 mentions "Online Course / Webinar" as a training *type*, not a separate LMS | Parallel learning model splits CPD sources; `course_completion` source feeds credits via `creditIssue` job | Keep but clarify; Do not expand `[DO NOT OVERBUILD]` |
| `getCreditCompliance` (`/credit-compliance/:orgId`) alongside `getComplianceReport` matview | routes.ts:2873 vs 885; `getCreditCompliance.ts` per-member loop, query-param config | MODULE_SPEC lists both | Two officer compliance answers that disagree (40/2 defaults vs matview) | Consolidate onto matview path; `[NEEDS CONFIRMATION]` which the product keeps |
| `creditIssue` background job pipeline (4 source types) | `association:member/jobs/creditIssue.ts` | MODULE_SPEC/Wave-2b | Third cycle computation; unclear which flows enqueue it vs inline insert in `completeTrainingEnrollment` | Keep but clarify single award pipeline |
| Per-member `registrationDate`-anchored legacy cycle mode | `credit-cycle.ts getCycleForDate` | BR-11 legacy mode documented | Misused at call sites (activityDate passed as registrationDate) | Keep util; fix call sites |
| `listOfficerTermsSummary` retagged under credits | MODULE_SPEC §1 | Documented decision | None | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Publish training | Officer | New CPD program | create → (approve) → publish → notify | create/publish handlers + officer pages; no type/mode/approval | Partial | routes.ts:2092; `publishTraining.ts` |
| Enroll (free) | Member | Browse training | view → enroll → confirmation | Works (published-only, capacity check) | Dup-enroll possible | `enrollInCustomTraining.ts`; `training/$trainingId.tsx` |
| Enroll (paid) | Member | Paid training | pay → enroll | Dead end (`PAYMENT_REQUIRED`, no pay path) | **Yes** | `enrollInCustomTraining.ts:37-42` |
| Confirm attendance → award credit | Officer | Session day | check-in per member → AUTO CreditEntry | UI fakes check-in locally; backend no-op; award endpoint unwired | **Yes (P0)** | `attendance.tsx:31-36`; `checkInCustomTraining.ts` |
| Self-report manual credit | Member | External activity | log form → entry → counts | Routed + UI; lands `pending` while totals' treatment unverified | Partial | routes.ts:3179; `my/credits/log.tsx:50` |
| View compliance / transcript | Member | Cycle review | summary → PDF | Works, but config client-supplied; voided counted | Partial | `getCreditTranscript.ts`; `credits.repo.ts:175` |
| Org compliance report | Officer | Periodic | standings table → CSV | Two backends, FE hardcodes 45/3, no CSV | Partial | `reports/credits.tsx:30` |
| Officer award/adjust/void | Officer | Correction | position-gated mutations w/ reason + idempotency | Implemented + tested + hurl | No (void read-side gap in §5) | `awardManualCredit.ts` etc. |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Training create w/ type+credit value | 5 types, decimal credits ≥0.5, validation | Partially Implemented | `createTraining.ts`; integer `credit_amount` | V1 REQUIRED | type dropped, no 0.5 floor |
| Publish | draft→published, visibility | Implemented | `publishTraining.ts`, `publishTraining.test.ts` | V1 REQUIRED | status guard `[NEEDS CONFIRMATION]` |
| Member enroll (open, free) | published-only, capacity | Implemented | `enrollInCustomTraining.ts:32-49` | V1 REQUIRED | add dup guard |
| Paid gate | block unpaid; provide payment route | Partially Implemented | BR-41 block only | V1 REQUIRED | payment path missing |
| Officer per-member attendance confirm | persists attendance + awards once | Missing | `checkInCustomTraining.ts` writes nothing | V1 REQUIRED | P0 journey |
| Credit entry stamped with org cycle | from `org_cpd_config` | Partially Implemented | 3 divergent computations (§5) | V1 REQUIRED | |
| Toggle suppression (M9-R8) | no credit when hosting org disabled | Missing | no check in award path | V1 RECOMMENDED | |
| Member manual entry counts immediately | per 10.2 | Unclear | `pending` default vs aggregates `[NEEDS CONFIRMATION]` | V1 REQUIRED | decide pending semantics |
| Void removes from totals | voided excluded everywhere | Missing | `sumCreditsByOrg` no status filter | V1 REQUIRED | |
| Transcript from server-derived config | org config + membership reg date | Missing | client query params | V1 REQUIRED | |
| Officer compliance from org config | one source of truth | Partially Implemented | matview path OK; second path + FE hardcode | V1 REQUIRED | |
| Carryover server-computed | derive previous-cycle earned | Partially Implemented | client `previousCycleEarned` | V1 RECOMMENDED | |
| Enrollment modes / invitations | approval, invitation | Missing | enum/table absent | V2 DEFERRED | |
| Waitlist + 24h paid promotion | M9-R9 | Missing | events-only waitlist | V2 DEFERRED | |
| Network approval workflow | M9-R6 | Missing | — | V2 DEFERRED | |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Create/publish/edit training | Officer | CRUD + publish, officer-gated | Implemented (minus type/lock) | Yes | V1 REQUIRED | routes.ts:2092-2098 |
| Browse + enroll free | Member | discover, enroll, see status | Implemented | Dup guard | V1 REQUIRED | `my/training.tsx`, detail page |
| Enroll paid | Member | pay → enrolled | Missing path | Yes | V1 REQUIRED | §5 |
| Confirm attendance + award | Officer | per-member confirm, idempotent credit | Missing (journey) | **Yes** | V1 REQUIRED | §5 P0 |
| Self-report manual credit | Member | log + counts | Partially Implemented | pending semantics | V1 REQUIRED | `createCreditEntry.ts` |
| View my credits/compliance | Member | totals, SDL cap, history | Implemented | voided counted | V1 REQUIRED | `my-cpd.tsx`, `getMyCredits.ts` |
| Download transcript PDF | Member | regulator-grade | Partially Implemented | trust params | V1 REQUIRED | `app.ts:542-543` |
| Org compliance + CSV | Officer | table + export | Partially Implemented | sources of truth, no CSV | V1 REQUIRED / CSV V1 RECOMMENDED | `reports/credits.tsx` |
| Configure CPD requirements | Officer | get/update org config | Implemented | consumers ignore it | V1 REQUIRED | `cpd.tsx`, `updateCpdConfig.ts` |
| Award/adjust/void credits | Officer | position-gated, reasoned, idempotent | Implemented | void read-side | V1 REQUIRED | handlers + hurl |
| Peer credits view | Member | directory profile credits | Implemented | — | V1 RECOMMENDED | `listMemberCreditsForPeer.ts` |
| Accredited provider registry | Officer/Admin | CRUD + link to training | Implemented | — | V1 RECOMMENDED | provider handlers/tests |
| License renewal tie-in (m11) | Member | credits → credential renewal | Out of scope here | — | `[CROSS-MODULE RISK]` | `member/credentials/*ProfessionalLicense*.ts` |
| Courses/quizzes LMS | Member | online learning | Implemented | overbuild risk | DO NOT ADD (expansion) | §6 |
| Training waitlist | Member | FIFO + paid promotion | Missing | — | V2 DEFERRED | §5 |
| Invitation-only training | Officer | invite flow | Missing | — | V2 DEFERRED | §5 |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| G1: Attendance→credit award journey broken end-to-end | UI↔API↔data | **P0** | V1 REQUIRED | `attendance.tsx:31-36` (memberId never sent; local Set fakes state); `checkInCustomTraining.ts:26-42` (no write, checks caller's own enrollment); 0 frontend consumers of `completeTrainingEnrollment` | "Track CE credits" is the platform's stated core value; today no officer flow produces an AUTO CreditEntry | Make check-in accept enrollee identity, persist, and award via the single credit pipeline; or wire UI to `completeTrainingEnrollment` per row |
| G2: Three incompatible cycle computations | backend/data | P1 | V1 REQUIRED | `completeTrainingEnrollment.ts:69`, `awardManualCredit.ts:30-33`, `creditIssue.ts` | Entries for the same member land in different cycle windows → wrong compliance, wrong transcript | Single cycle service from `org_cpd_config` |
| G3: Voided/pending entries counted in aggregates | backend/data | P1 | V1 REQUIRED | `credits.repo.ts:175-194` no status filter; `voidCreditEntry.ts` | Officer void has no effect on member-visible totals/PDF | `status='active'` filter (+ verification policy) in every aggregate read |
| G4: Compliance "required credits" has 4 sources of truth incl. client-supplied | backend+FE | P1 | V1 REQUIRED | `getCreditCompliance.ts:40-44` (40/2), `reports/credits.tsx:30` (45/3), `org_cpd_config` (60/3), `app.ts:523-534` (client) | Officer and member can see contradictory compliance verdicts; member can self-certify on PDF | Resolve from `org_cpd_config` everywhere; delete query overrides |
| G5: Paid training dead end | API+FE | P1 | V1 REQUIRED `[NEEDS PRODUCT DECISION]` | `enrollInCustomTraining.ts:37-42`; FE `fee/price` fields don't exist (`registrationFee`) | Paid CPD events are the monetization premise of m09 | Build training payment path or forbid fee>0 at create until M06 wiring |
| G6: Lifecycle self-service corruption | API | P1 | V1 REQUIRED | `completeCustomTraining.ts` (member self-complete, terminal, no credit); `cancelCustomTraining.ts:49-53` (member enrollment-cancel emits `training.cancelled`) | Self-complete permanently blocks officer credit award; wrong domain event can trigger cross-module cancel consumers `[CROSS-MODULE RISK]` | Gate or re-scope both ops; rename event to `training.enrollment.cancelled` |
| G7: M9-R2 credit lock + M9-R1 type missing | API+schema | P1 | V1 REQUIRED | `updateTraining.ts:31`; no `type` column | Credit-value drift after award corrupts history; type is the CPD reporting taxonomy | Lock creditAmount post-award; add/persist `type` |
| G8: Silent credit-award failure | backend | P1 | V1 REQUIRED | `completeTrainingEnrollment.ts:84-86` bare `catch {}` | Member "completed" with zero credits and no trace | Log + report + retry path |
| G9: Toggle (M9-R8) unenforced | backend | P2 | V1 RECOMMENDED | no `isEnabled` check at award | AC explicitly requires it | Add check |
| G10: Duplicate enrollment possible | API+schema | P2 | V1 RECOMMENDED | no unique (trainingId, personId) | capacity distortion; `enrollments[0]` picks arbitrarily | unique index + pre-check |
| G11: `my/training.tsx` counts `enrolled` as earned credits | UI | P2 | V1 RECOMMENDED | `my/training.tsx` `isCompleted = status === 'enrolled'` | Member dashboard overstates earned CPE | fix predicate to `completed` |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Officer marks member present at `/org/$orgSlug/officer/training/$trainingId/attendance` | Member's attendance recorded; credit awarded; persists on reload | Toast "checked in"; only local `useState`; reload loses it; backend untouched; if officer not enrolled themselves, backend 422 `NOT_ENROLLED` | `attendance.tsx:24,31-36,53-55`; `checkInCustomTraining.ts:29-33` | P0 | E2E: officer checks in member → reload → member's `/my/credits` shows AUTO entry |
| Member enrolls in paid training at `/org/$orgSlug/training/$trainingId` | Checkout → enrolled | Fee never displayed (`training.fee ?? training.price` vs API `registrationFee`); Enroll → 422 `PAYMENT_REQUIRED` toast, no recovery | detail page lines 121,179-226; `enrollInCustomTraining.ts:37-42` | P1 | E2E paid training: fee visible, enroll blocked with payment CTA (or pay-flow once built) |
| Member self-completes training (`POST /association/training-lifecycle/:id/complete`) | N/A (officer action per PRD) | Member marks own enrollment completed → no credit → officer completion now 409 → credits unrecoverable | `completeCustomTraining.ts:40-47` + FSM in `completeTrainingEnrollment.ts:44` | P1 | backend test: self-complete then officer complete → credit still awarded or self-complete forbidden |
| Officer voids credits, member checks totals | Voided excluded from `/my/credits`, transcript, compliance | Still counted (`sumCreditsByOrg` unfiltered) | `credits.repo.ts:175-194` | P1 | backend test: void → transcript total drops |
| Officer compares Settings→CPD (60/3) with Reports→Credits | Same requirement basis | Report uses hardcoded 45/3 query | `cpd.tsx:23,44` vs `reports/credits.tsx:30` | P1 | E2E: change config → report reflects it |
| Member "Log Manual Credit" then views totals | Entry counts immediately (10.2) | Entry saved `verificationStatus='pending'`; counting behavior unverified | `createCreditEntry.ts:70`; `getMyCredits.ts` filter `[NEEDS CONFIRMATION]` | P2 | backend test: log manual → summary includes it |
| Member dashboard `/my/training` CPE credits stat | Earned credits = completed trainings | Counts `enrolled` (not yet attended) trainings | `my/training.tsx` totalCredits reduce | P2 | component/E2E assertion on completed-only |
| FE enrollment status badges (`pending_approval`, `pending_payment`, `waitlisted`, `rejected`) | Real states | Backend enum can never produce them | `my/training.tsx` ENROLLMENT_VARIANT vs `enrollmentStatusEnum` | P3 | remove dead states |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `completeTrainingEnrollment` endpoint | API with no frontend consumer | grep `apps/` = 0 hits; only tests/hurl | The only credit-awarding training op is unreachable by users | Wire from attendance UI (G1) |
| `checkInCustomTraining` | No-op write path | handler returns enrollment, persists nothing | Misleading 200s; fake audit entries ("Checked in for training session") | Implement or remove route |
| `training.type` in TypeSpec/validators | Spec field with no storage | training.tsp:167; validators `SearchTrainingsQuery.type`; no DB column | Search filter silently no-ops `[NEEDS CONFIRMATION]` (repo may error) | Persist or remove from spec |
| FE dead enrollment statuses | UI states with no producer | `my/training.tsx` variants | UX confusion | Remove until modes exist |
| `getOrgCpdConfig.ts`/`updateOrgCpdConfig.ts` shims | 1-line re-exports | MODULE_SPEC §1 | None (documented) | Keep |
| `credits-flow.hurl` header claims "credit entry endpoints are not yet routed" | Stale contract test comment | `specs/api/tests/contract/credits-flow.hurl` header vs routes.ts:3179-3199 | Audit confusion; weak assertions (lists only) | Refresh comment + deepen assertions |
| `events.schema.ts` `cpdActivityTypeEnum` import into credits schema | cross-dir schema coupling | `credits.schema.ts:18` | Split-blocker noted for P1-11 mega-module split | Document `[SHARED DEPENDENCY]` |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| F1: No attendance table — attendance is conflated with enrollment status | schema/model | `training.schema.ts` (PRD expects `TrainingAttendance` w/ method, confirmedBy, creditEntryId) | P1 | Minimal: persist confirmedBy/At on enrollment or add attendance table when fixing G1 |
| F2: `cycleStart/cycleEnd` stamped inconsistently (3 algorithms) | backend/data | §10 G2 | P1 | Single cycle service; audit existing rows |
| F3: Aggregates ignore `status`/`verificationStatus` | backend | `credits.repo.ts:175-194` | P1 | Filter in repo |
| F4: `credit_amount` integer (training + credit_entry) vs PRD decimal ≥0.5 | schema | both schema files | P2 | numeric migration `[NEEDS PRODUCT DECISION]` |
| F5: No unique (trainingId, personId) on `training_enrollment` | schema | index list | P2 | unique index |
| F6: `createTraining` accepts `body.organizationId || orgId` — body can override org context | API | `createTraining.ts:29` | P2 | Use ctx org only (position middleware checks ctx org, not body org) `[NEEDS CONFIRMATION]` whether validator strips it |
| F7: `completeTrainingEnrollment` hardcodes `provider: training.organizationId` (uuid as provider name) | backend | `:77` | P3 | store org name or null |
| F8: `getCreditCompliance` loads ≤1000 members then per-member credit queries | backend perf | handler head | P3 | use matview path |
| F9: credits schema/repo live in `association:member/repos/` while handlers live in `member/credits/` | structure | import paths in every credits handler | P3 | documented in MODULE_SPEC; align during mega-module split `[SHARED DEPENDENCY]` |
| F10: transcript carryover from client `previousCycleEarned` | API | `getCreditTranscript.ts` | P2 | compute server-side |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Officer gating on create/update/publish/complete training is present (roles + `requirePositionMiddleware ["Society Officer","President"]`) | officer ops | routes.ts:2092-2098, 2312-2320 | OK | — |
| Credit mutation ops self-enforce President/Secretary/Treasurer | credits | `awardManualCredit.ts:11`, `adjustCreditEntry.ts:13-17`, `voidCreditEntry.ts` | OK | — |
| `getCreditCompliance` sets `organizationId` from the **path param** then position-checks — relies on `requirePosition` validating the term against that org | officer report | `getCreditCompliance.ts:33-36` | P2 `[NEEDS CONFIRMATION]` | Verify `requirePosition` scopes to ctx org; add test for officer-of-other-org access |
| Member-controlled compliance parameters on transcript endpoints (regulator-facing) | member self-service | `app.ts:523-534` | P1 | server-derived config (G4) |
| `createTraining` body-org override (F6) could create trainings under a foreign org if validator passes `organizationId` through | org isolation | `createTraining.ts:29` | P2 | strip body org |
| Member self-complete/self-cancel lifecycle ops are member-reachable by design of route roles | lifecycle | routes.ts:2135-2143 | P1 (G6) | restrict transitions |

## 15. Record Safety / Audit History Findings

Module handles compliance-sensitive professional-education records (PRC CPD).

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Void/adjust keep immutable trail (voidedReason, attestation, `credit.adjusted` event, x-audit middleware) | credit corrections | `voidCreditEntry.ts`, `adjustCreditEntry.ts:68-72` | OK | — |
| Check-in audit middleware logs "update training-enrollment" for a no-op handler — audit log asserts actions that never happened | attendance audit | routes.ts:2126-2132 + `checkInCustomTraining.ts` | P1 | fix with G1 |
| Silent credit-failure leaves no audit trace of the missing award | credit award | `completeTrainingEnrollment.ts:84-86` | P1 | log + audit detail |
| Transcript PDF content depends on client query → not a trustworthy record | compliance record | `app.ts:522-543` | P1 | G4 fix |
| `adjusted_by/adjustment_reason` live in `attestation` jsonb instead of PRD's dedicated columns | adjustment provenance | `adjustCreditEntry.ts:68-72` | P3 | acceptable; document |

## 16. Knowledge Graph Findings

KG (2026-06-06, `.understand-anything/knowledge-graph.json`) used as secondary evidence; all wiring claims below re-verified by direct inspection.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Training handlers (association:operations) depend on credits repo/schema in association:member, util in member/credits — 3-directory coupling | `completeTrainingEnrollment.ts:6-7` imports | Split blast radius for P1-11 mega-module split | `[SHARED DEPENDENCY]` — flag in split plan |
| `credits.schema.ts` imports `cpdActivityTypeEnum` from `association:operations/repos/events.schema.ts` | `credits.schema.ts:18` | Schema-level cross-module cycle (member↔operations) | Document; move enum to shared core during split |
| `completeTrainingEnrollment` has consumers only in tests/hurl, none in apps | grep across `apps/` | Unreachable core endpoint (G1) | Wire UI |
| `domainEvents` `training.completed` consumed by certificates (EM-M11) — emit fires even on member self-complete | `completeTrainingEnrollment.ts:89-100`, `completeCustomTraining.ts:49-53` | Cert-availability notifications can fire without credit award | `[CROSS-MODULE RISK]` align with G6 |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Domain status notes flag "m09↔m06 training payment gate" as an unclear area | `docs/aha/kg/domain-knowledge-status.md` | Matches G5: gate implemented as a hard block, payment leg never built | Product decision on V1 paid trainings |
| CPD journey (`journey-cpd`) rated High risk in audit index §15 | `docs/aha/outputs/module-audit-index.md` §7/§15 | Confirmed: journey is broken at attendance step (G1) | Fix order should start here |
| PRC context (45 vs 60 units, 3-year cycles) appears in FE copy but not in config defaults | `reports/credits.tsx:111` ("45 units / 3-year") vs `org_cpd_config` default 60/3 | Real-world PH PRC requirement is ambiguous in code | `[NEEDS PRODUCT DECISION]` on canonical default |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. No Webwright/Playwright executed; existing Playwright specs inspected statically only (see §19). No evidence files saved.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| `officer/training-completion.spec.ts` exists despite no UI path to `completeTrainingEnrollment` — likely asserts page render or drives API directly | Playwright (inspected, not run) | `apps/memberry/tests/e2e/officer/training-completion.spec.ts` | Possible fake-green coverage of the P0 journey | `[NEEDS CONFIRMATION]` — run and review during fix phase |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `association:operations/training-enrollment.test.ts` | backend/unit | AC-M09-001 auto-credit, AC-M09-003 idempotent re-confirm, AC-M09-005 completion lock | High (API level) |
| `association:operations/{training,training-lifecycle,createTraining,getTraining,publishTraining,check-in}.test.ts` | backend/unit | CRUD, lifecycle, check-in handler behavior | Medium |
| `association:operations/org-accredited-providers.test.ts` | backend/unit | provider CRUD | High |
| `member/credits/{awardManualCredit,adjustCreditEntry,voidCreditEntry,getCpdConfig,updateCpdConfig,getComplianceReport,refreshCompliance,listMemberCreditsForPeer,getCreditTranscriptPdf}.test.ts` | backend/unit | credit mutations, config, compliance, transcript PDF | High |
| `member/credits/credits.test.ts` (871 LOC hybrid) | backend/unit | BR-11/12/13/14, AC-M10-001/003/004, toggle util, + credentials-domain describes | Medium (hybrid, scheduled split per MODULE_SPEC §3) |
| `member/credits/utils/{credit-cycle,transcript-template}.test.ts` | backend/unit | cycle math, carryover cap, PDF template | High |
| `association:member/jobs/{creditIssue,complianceThreshold}.test.ts` | backend/unit | job pipeline | Medium |
| Hurl: `credits-flow`, `credit-compliance-flow`, `training-flow`, `assoc-training-{main,courses,enrollments,lifecycle}-flow`, `member/credits/{credits-manual-award,credits-void-event,credits-cpd-config}.hurl` | contract | endpoint reachability, manual award/void/config round trips | Medium (top-level credits/training flows are shallow; `credits-flow` header stale) |
| Playwright: `member/{credits,credit-carryover,credit-validation,training,training-browse,training-completion-flow}.spec.ts`, `officer/{training,training-completion,cpd-settings,reports-credits}.spec.ts`, `states/{training-states,credits-states}.spec.ts`, `actions/training-actions.spec.ts` | E2E | page-level flows | Unknown (not executed; G1 suggests check-in E2E asserts UI state only) |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Officer checks in member X → member X (not officer) gains AUTO credit, persisted across reload | E2E/Playwright + backend | Proves G1 fix; current specs apparently assert local UI state | Before (failing first) |
| `checkInCustomTraining` persists attendance + is idempotent per member | backend/unit | backend half of G1 | Before |
| Same member/org: credit from training completion, manual award, and job land in the **same** cycle window | backend/unit | G2 regression net | Before |
| Void → transcript/compliance totals exclude entry | backend/unit | G3 | Before |
| `updateOrgCpdConfig` change → `getCreditCompliance`/report/transcript reflect new requiredCredits | integration | G4 | Before |
| Transcript endpoint ignores client `requiredCredits` override | backend/unit + permission | G4 trust | During |
| Paid training: enroll blocked with actionable error; (post-decision) pay→enroll path | backend + E2E | G5 | During |
| Member self-complete then officer complete → credit still awarded (or self-complete 403) | backend/unit | G6 | Before |
| `cancelCustomTraining` emits enrollment-scoped (not training-scoped) event | backend/unit | G6 cross-module | During |
| creditAmount immutable after first auto credit (M9-R2) | backend/unit | G7 | Before |
| `type` persisted + searchable (post-decision) | backend/unit | G7 | During |
| Credit insert failure logged + surfaced (no bare catch) | backend/unit | G8 | During |
| Toggle disabled org → completion records, no credit | backend/unit | G9 / AC M9-R8 | During |
| Duplicate enroll rejected | backend/unit + data/schema | G10 | During |
| Member manual entry (pending) counted/not-counted per decided policy | backend/unit | 10.2 ambiguity | Before (forces the decision) |
| `/my/training` CPE stat counts completed only | frontend/component | G11 | During |
| Officer of org A cannot read org B compliance | permission/RBAC | §14 finding | During |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Credits repo/schema in `association:member/` consumed by `association:operations` training + `member/credits` handlers | cross-module | import paths | Any G1-G3 fix touches all three dirs; P1-11 split must keep them together | `[SHARED DEPENDENCY]` note in SPLIT-PLAN re-scope |
| `cpdActivityTypeEnum` from events schema | database/schema | `credits.schema.ts:18` | enum ownership blocks clean module split | `[SHARED DEPENDENCY]` |
| M06 dues/billing for paid trainings | cross-module | G5; `registerAndPayForEvent` exists for events only | payment leg lives outside this module | `[CROSS-MODULE RISK]` + `[NEEDS PRODUCT DECISION]` |
| `training.completed` → certificates (m11) consumer | cross-module | `domain-event-consumers` EM-M11 ref in handler comment | self-complete emits may notify certs without credit | `[CROSS-MODULE RISK]` |
| platformadmin feature flags (`creditTracking` toggle) | shared/platform | `isEnabled` util + tests | M9-R8 enforcement reads platform org flags | `[SHARED DEPENDENCY]` |
| `compliance_standings` materialized view + `refreshCompliance` | database/schema | refresh calls in 3 credit mutations | migration owns view definition; void/award must keep refreshing | module-local, verify view filters `status` too `[NEEDS CONFIRMATION]` |
| Fractional credits migration (integer→numeric) | database/schema + product decision | F4 | touches generated migrations + TypeSpec types | defer behind product decision |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Implement real per-member check-in (accept enrollee id, persist confirmedBy/At, award via shared pipeline) + wire attendance UI | G1 | P0 | V1 REQUIRED | E2E + backend idempotency | Smallest correct fix may be: attendance UI → `completeTrainingEnrollment` per enrollment row |
| Extract one `resolveCycle(orgId, activityDate)` service over `org_cpd_config`; use in all 4 write paths | G2 | P1 | V1 REQUIRED | cycle-consistency test | reuse `credit-cycle.ts` + `creditIssue.computeCycleBoundaries` |
| Add `status='active'` (+verification policy) filters to `sumCreditsByOrg`, `getMyCredits`, compliance, transcript | G3 | P1 | V1 REQUIRED | void-exclusion tests | check `compliance_standings` view too |
| Replace client-supplied compliance params with server-derived org config + membership registration date | G4 | P1 | V1 REQUIRED | override-ignored test | touches `app.ts` hand-wired routes |
| Point `reports/credits.tsx` at `getComplianceReport` (matview) and delete the hardcoded 45/3 query; deprecate `getCreditCompliance` or make it config-driven | G4 | P1 | V1 REQUIRED | integration | consolidation, not new feature |
| Decide paid-training V1: build `registerAndPayForTraining` mirroring events, or validate fee=0 at create + hide fee UI | G5 | P1 | V1 REQUIRED `[NEEDS PRODUCT DECISION]` | paid-flow E2E | FE field fix (`registrationFee`) either way |
| Guard `updateTraining`: forbid creditAmount/status changes after first auto credit; strip `status` from PATCH body | G7 | P1 | V1 REQUIRED | lock test | |
| Persist `training.type`; make search filter real | G7 | P1 | V1 REQUIRED | type round-trip test | needs migration |
| Restrict `completeCustomTraining` (officer-only or remove) ; rename member-cancel event | G6 | P1 | V1 REQUIRED | transition tests | check TypeSpec roles on lifecycle interface |
| Replace bare `catch {}` with logged failure + `creditAwarded: 0` + retry job enqueue | G8 | P1 | V1 REQUIRED | failure-path test | |
| Enforce `creditTracking` toggle at award | G9 | P2 | V1 RECOMMENDED | toggle test | util exists |
| Unique (trainingId, personId, status!=cancelled) enrollment guard | G10 | P2 | V1 RECOMMENDED | dup test | partial index |
| Decide + implement pending-manual-entry counting policy | 10.2 | P2 | V1 REQUIRED (decision) | summary test | PRD says count immediately → set 'verified' or count pending |
| Fix `/my/training` earned-credit predicate; remove dead status variants | G11 | P2 | V1 RECOMMENDED | component test | |
| Client-side CSV export on compliance report | 10.7 | P2 | V1 RECOMMENDED | — | trivial |
| Strip `body.organizationId` from createTraining | F6 | P2 | V1 RECOMMENDED | org-isolation test | |
| Refresh stale `credits-flow.hurl` header + deepen assertions | §12 | P3 | V1 RECOMMENDED | — | docs/test hygiene |
| numeric credit columns | F4 | P2 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | — | migration risk |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Enrollment modes (approval-required, invitation-only) + TrainingInvitation table | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Open enrollment covers pilot orgs; large schema/UI surface |
| Training waitlist + 24h paid promotion (M9-R9) | `V2 DEFERRED` | Capacity hard-stop acceptable for V1; events waitlist exists as future template |
| Network approval workflow (M9-R6) + TrainingApprovalConfig | `V2 DEFERRED` | PRD itself says "when configured"; no approver model yet |
| Multi-session fields, cover image, rich-text description | `V2 DEFERRED` | cosmetic for V1 |
| Prorated below-pace compliance flagging (10.7) | `V2 DEFERRED` | nice-to-have analytics |
| Expanding courses/quizzes LMS surface | `DO NOT ADD` `[DO NOT OVERBUILD]` | Already beyond m09 scope; stabilize trainings first |
| Per-member credit variation, custom training types | `DO NOT ADD` | Explicitly forbidden by M9-R1/R2 |
| New standalone attendance microservice / generic event-sourcing for credits | `DO NOT ADD` `[DO NOT OVERBUILD]` | A table/columns + one pipeline suffices |

## 24. Audit Decision

**FAIL**

The module's core promise — officer confirms attendance → member earns CPD credits — does not work through the product: the attendance UI never identifies the member, the check-in endpoint persists nothing, and the one endpoint that awards credits has no frontend consumer (P0, G1). Even where credits are written (manual award, job, completion API), three incompatible cycle computations, void-blind aggregates, and four competing "required credits" sources mean compliance numbers and the regulator-facing transcript cannot be trusted (P1 G2-G4). Officer tooling (config, award/adjust/void, providers) and member read views are genuinely solid and well-tested at the unit level, so remediation is targeted, not a rewrite — but reliable V1 use is blocked today.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Are paid trainings in V1 scope, and if so via which M06 path (proof-of-payment vs Stripe)? | `[NEEDS PRODUCT DECISION]` | Determines G5 fix shape | Product (Elad) |
| Should member-submitted manual entries (`verificationStatus='pending'`) count toward totals immediately per 10.2, or is a verification gate intended? | `[NEEDS PRODUCT DECISION]` | Changes aggregate filters in G3 fix | Product |
| Canonical PH default: 45 units (FE copy/PRC) vs 60 (org_cpd_config default)? | `[NEEDS PRODUCT DECISION]` | Seeds + config defaults | Product |
| Are fractional CPD units (0.5) required for PRC compliance (integer→numeric migration)? | `[NEEDS PRODUCT DECISION]` | F4 migration | Product |
| Does `requirePosition` validate the officer term against the ctx org set from the path param in `getCreditCompliance`? | `[NEEDS CONFIRMATION]` | Cross-org officer access | Eng (fix phase) |
| Does `searchTrainings` repo error or silently ignore the `type` filter (no column)? | `[NEEDS CONFIRMATION]` | severity of M9-R1 gap | Eng |
| What do `officer/training-completion.spec.ts` and `member/training-completion-flow.spec.ts` actually assert (UI state vs persisted credit)? | `[NEEDS CONFIRMATION]` | fake-green risk on the P0 journey | Eng |
| Should `completeCustomTraining` (member self-complete) exist at all, or is it scoped to self-paced online types? | `[NEEDS PRODUCT DECISION]` | G6 fix shape | Product |
| Does `compliance_standings` matview filter `status='voided'`? | `[NEEDS CONFIRMATION]` | G3 completeness | Eng |

## 26. Notes for Gap Plan Organizer

- **Batch 1 (P0/P1 core pipeline):** G1 (attendance→credit wiring, both halves), G8 (silent failure), G6 (lifecycle self-service) — these touch `association:operations` handlers + `attendance.tsx` + possibly TypeSpec (check-in body needs enrollee id → regenerate). Write failing E2E + backend tests first (see §20 rows 1-2, 8).
- **Batch 2 (P1 data trust):** G2 (single cycle service), G3 (status filters incl. matview), G4 (required-credits single source: backend defaults, FE hardcode 45/3, transcript client params). Tests for cycle consistency and void exclusion first.
- **Batch 3 (P1 spec alignment):** G7 (type column + credit lock — needs migration + TypeSpec regen), G5 pending product decision.
- **Selected P2 for V1 completeness:** toggle enforcement (G9), duplicate-enrollment guard (G10), `/my/training` stat fix (G11), CSV export, createTraining body-org strip.
- **Blocked on product decisions:** paid trainings (G5), pending-manual-entry policy, fractional credits, 45-vs-60 default, self-complete scope. Do not implement before answers.
- **Do not implement:** §23 items (enrollment modes, waitlist, approval workflow, LMS expansion).
- **Shared-dependency caution:** credits schema/repo sit in `association:member/repos/` and feed three handler dirs; any file moves collide with the deferred P1-11 mega-module split (`.planning/deferred/14-mega-module-split/SPLIT-PLAN.md`) — fix in place, don't relocate.
- **Test-first notes:** existing `training-enrollment.test.ts` (AC-M09-001/003/005) is the anchor for G1 backend regression; `credits.test.ts` hybrid file is scheduled for split — extend, don't reorganize, during fixes.
- **Hygiene:** refresh stale `credits-flow.hurl` header; check `check-in` audit middleware no longer logs no-ops after G1.

---

Next recommended step:
Module/group: Training & Credits
Module slug: training-credits
Primary PRD/spec: docs/product/modules/m09-training.md + docs/product/modules/m10-credit-tracking.md + docs/product/MODULE_SPEC.member.credits.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/training-credits-gap-plan.md
