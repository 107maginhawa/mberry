# AHA Prompt 02 — Per-Module Audit Run Log

Automated batch run of `docs/aha/prompts/02-module-or-group-audit-gap-plan.md` across all 14 queue modules.
One general-purpose subagent per module, isolated context, audit-only (no source/test edits, no fixes, no commits).
Static code review; Webwright/Playwright execution skipped for batch (noted in each output's §1/§18).

- **Run completed:** 2026-06-11 (Asia/Manila). Modules 9/11/12/14 hit a mid-run session-limit on the first pass; re-dispatched after reset. `notifications-email` and `realtime-comms` completed their files before the limit (summaries re-harvested from disk §10/§24).
- **Severity counts below = §10 Critical Gaps table (consolidated/deduped view)**, matching how peer modules self-reported. §5 PRD-gap counts differ slightly per module and live inside each file.

## Results

| # | Module/Group | Slug | Decision | P0 | P1 | P2 | Gap-plan path |
|---|---|---|---|---|---|---|---|
| 1 | Membership Lifecycle | membership-lifecycle | **FAIL** | 1 | 9 | 8 | `docs/aha/module-gap-plans/membership-lifecycle-gap-plan.md` |
| 2 | Dues & Payments | dues-payments | **FAIL** | 3 | 7 | 9 | `docs/aha/module-gap-plans/dues-payments-gap-plan.md` |
| 3 | Auth/RBAC enforcement | auth-rbac | **PARTIAL PASS** | 0 | 6 | 8 | `docs/aha/module-gap-plans/auth-rbac-gap-plan.md` |
| 4 | Training & Credits | training-credits | **FAIL** | 1 | 9 | 11 | `docs/aha/module-gap-plans/training-credits-gap-plan.md` |
| 5 | Elections & Governance | elections-governance | **FAIL** | 2 | 5 | 9 | `docs/aha/module-gap-plans/elections-governance-gap-plan.md` |
| 6 | Billing (Stripe) | billing-stripe | **FAIL** | 2 | 6 | 11 | `docs/aha/module-gap-plans/billing-stripe-gap-plan.md` |
| 7 | Platform Admin (+ admin app) | platform-admin | **FAIL** | 0 | 8 | 12 | `docs/aha/module-gap-plans/platform-admin-gap-plan.md` |
| 8 | Person & Profile (+ deletion cascade) | person-profile | **FAIL** | 1 | 5 | 11 | `docs/aha/module-gap-plans/person-profile-gap-plan.md` |
| 9 | Communications (+ feed) | communications | **FAIL** | 3 | 4 | 5 | `docs/aha/module-gap-plans/communications-gap-plan.md` |
| 10 | Documents & Credentials | documents-credentials | **FAIL** | 1 | 7 | 9 | `docs/aha/module-gap-plans/documents-credentials-gap-plan.md` |
| 11 | Notifications & Email | notifications-email | **PARTIAL PASS** | 1 | 5 | 4 | `docs/aha/module-gap-plans/notifications-email-gap-plan.md` |
| 12 | Realtime Comms | realtime-comms | **FAIL** | 3 | 6 | 6 | `docs/aha/module-gap-plans/realtime-comms-gap-plan.md` |
| 13 | Marketplace/Ads/Reviews | marketplace-advertising | **FAIL** | 1 | 8 | 6 | `docs/aha/module-gap-plans/marketplace-advertising-gap-plan.md` |
| 14 | Surveys & Polls | surveys-polls | **PARTIAL PASS** | 0 | 6 | 8 | `docs/aha/module-gap-plans/surveys-polls-gap-plan.md` |

**Totals:** 14/14 audited · **FAIL: 11 · PARTIAL PASS: 3 · PASS: 0** · P0: 19 · P1: 91 · P2: 117

## Top finding per module (one line)

1. **membership-lifecycle (P0):** nightly status recompute cron (`statusRecomputeCron.ts:59-79`) selects nonexistent `is_expired`/`is_pending_payment` columns → automatic ACTIVE→GRACE→LAPSED lifecycle dead end-to-end; plus cross-org lifecycle mutations and IDOR on `getMembershipApplication`.
2. **dues-payments (P0×3):** online one-tap payment never writes a DuesPayment row (`checkoutPaymentToken.ts` metadata mismatch → webhook dead-letters); cross-org refund unguarded (`refundDuesPayment.ts`); receipt numbers hardcode `'ORG'` prefix under a global unique constraint → multi-org collision.
3. **auth-rbac (P1):** platform mutations (`createOrganization`, feature-flag set/delete, org transitions) lack super-role checks (read-only roles can mutate); inline `requireOfficerTerm` enforces no 2FA; role hierarchy helpers have zero call sites.
4. **training-credits (P0):** attendance→credit journey broken end-to-end (officer UI never sends member id, `checkInCustomTraining` persists nothing, the only credit-awarding endpoint has no FE consumer); required-credits has 4 conflicting sources of truth incl. client-supplied on regulator-facing transcript.
5. **elections-governance (P0×2):** no API op transitions `votingOpen → awaitingConfirmation` so no election can ever be certified; `createElection` stores random-UUID position slots while votes/nominees FK the governance `position` table → structurally inconsistent.
6. **billing-stripe (P0×2):** Stripe secret key logged in plaintext at SDK init (`core/billing.ts:93-96`); webhook payment confirmation breaks silently past 500 invoices (`InvoiceRepository.findAll()` hard `limit(500)` + in-memory filter).
7. **platform-admin (P1):** ~30 mutating `/admin` handlers enforce only platform-admin membership (analyst/support can mutate flags/orgs/subscriptions); impersonation never swaps identity; DB feature flags written but never read; AC test suite is fake-green.
8. **person-profile (P0):** `PATCH /persons/me/privacy` broken 100% (handler reads `organizationId`, contract/FE send `orgId`); DPA anonymization omits `bio`/`gender`; ID-card QR HMAC falls back to hardcoded `'fallback-secret'`.
9. **communications (P0×3):** announcement delivery dead end-to-end (`registerCommunicationJobs` never called, no `announcement.published` subscriber); officer "Send Now" silently saves a draft; member notification prefs broken both directions (contract shape + uuid-column type mismatch).
10. **documents-credentials (P0):** ID-card QR verification broken end-to-end (unsigned `/verify/<personId>`, no backend verify route, 3 sibling dynamic routes shadow each other); `document_access_log` never written; cert PDF has placeholder content and `bulkIssueCertificates` sets `trainingId = organizationId`.
11. **notifications-email (P1):** bounce/complaint auto-suppression (WF-124) does not exist; no transactional-override so unsubscribed members lose dues/security email; prefs stored in two competing tables enforced by neither path; web push dead on FE; 8 M22 rules have zero test coverage.
12. **realtime-comms (P0×3):** REST-persisted chat messages never broadcast + client speaks a different WS frame dialect than `core/ws.ts` emits; officer channel creation always fails validation; DMs have no creation path → Messages surface renders permanent empty states.
13. **marketplace-advertising (P0):** TypeSpec `/association/...` route prefix dropped in generated routes → org-context middleware never runs → `organization_id` NOT NULL violation → every marketplace/advertising write 500s; advertising opt-out/report rails are hollow; buy flow dead-ends.
14. **surveys-polls (P1):** `getSurvey`/`listSurveys` have no officer gate (members read draft surveys + targeting config); M18-R5 distribution/targeting collected but never enforced and officer-published surveys never reach members (broken publish→respond loop); no publish notification.

## Cross-cutting patterns observed (for prompts 05/06, not audited here)

- **Cross-org / tenant-isolation gaps** recur: membership-lifecycle, dues-payments (refund), billing (`?merchant=`), communications, realtime-comms, surveys. Candidate cross-cutting finding.
- **Generated-route / middleware-wiring seams** are the dominant failure class: dropped `/association` prefix (marketplace), uncalled job registries (communications, training), FE↔WS contract drift (realtime-comms), hand-wired-outside-TypeSpec → no SDK hook → no UI consumer (platform-admin, billing).
- **Fake-green tests**: handlers/AC suites that test local helpers or validator-bypassing fakes pass while production paths are broken (platform-admin, documents, person-profile, training, marketplace). Test-infra audit warranted.
- **Multiple sources of truth**: required-credits (training ×4), notification prefs (×2 tables), dues invoice vs billing invoice systems.

## Recommended first prompt-03 target

**Primary: `membership-lifecycle`** — foundational AMS spine. P0 kills the automatic membership status lifecycle (the product's central promise) and 9 P1s include cross-org tampering. Fixing it unblocks dependent dues/credit/election eligibility logic.

```txt
Next recommended step:
Module/group: Membership Lifecycle
Module slug: membership-lifecycle
Primary PRD/spec: docs/product/modules/m05-membership/MODULE_SPEC.md (+ MODULE_SPEC.member.membership.md, STATE_MACHINES.md, docs/quality/SCOPE.membership.md)
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/membership-lifecycle-gap-plan.md
```

**Immediate second: `dues-payments`** — financial data-integrity P0×3 (lost payments, cross-org refund, receipt collision). Highest risk class once the lifecycle spine is fixed.

Worst-FAIL cluster by P0 density (3 each): dues-payments, communications, realtime-comms. Order prompt-03 by core-value weight: membership → dues → billing-stripe → training-credits → elections-governance, then the comms/platform/content modules.

## Verification

- 14 gap-plan files present under `docs/aha/module-gap-plans/`, each with the 26-section template through §26.
- `git status` shows only new files under `docs/aha/` (no source/test modifications).
- No commits made.
