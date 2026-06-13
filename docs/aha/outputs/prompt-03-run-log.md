# AHA Prompt 03 — Gap-Plan Organize Run Log

Automated batch run of `docs/aha/prompts/03-organize-gap-plan-for-fixing.md` across all 14 queue modules.
One general-purpose organizer subagent per module, isolated context, **organize-only** (no audit redo, no source/test edits, no fixes, no commits).
Each subagent read only its raw gap plan + `00-aha-shared-rules.md` + `03` prompt + `module-audit-index.md` + `kg/` status (and inspected referenced source files only to clarify severity/dependencies/files-touched — not to re-audit), then wrote one `docs/aha/module-fix-plans/<slug>-fix-ready-plan.md` using the 14-section §13 template.

- **Run completed:** 2026-06-11 (Asia/Manila). Dispatched via Workflow (run `wf_2beae16c-08b`), 14 agents in parallel (concurrency-capped → auto-batched). **14/14 succeeded on first attempt, 0 retries, 0 BLOCKED.** No session-limit hit (subagent_tokens = 1,634,308, not 0). Duration ~8 min.
- **Disk verification:** all 14 files present, each has exactly 14 sections, §14 (Instructions for 04 Fix Prompt) is the last section in every file (200–269 lines each). `git status` shows changes only under `docs/aha/` — no source/test modifications, no commits.

## Results

| # | Module/Group | Slug | Audit (from 02) | Organizer Decision | Active Fixes | First Batch | Blocked | Product-Decision | Deferred | Fix-ready plan path |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Membership Lifecycle | membership-lifecycle | FAIL | PARTIALLY READY | 20 | Batch A — P0 status-truth (cron + read consistency) | 7 | 10 | 8 | `docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md` |
| 2 | Dues & Payments | dues-payments | FAIL | PARTIALLY READY | 16 | Batch A — P0 financial-integrity blockers (+ Batch F receipt-counter migration) | 6 | 10 | 19 | `docs/aha/module-fix-plans/dues-payments-fix-ready-plan.md` |
| 3 | Billing (Stripe) | billing-stripe | FAIL | PARTIALLY READY | 14 | Batch A — P0 core-workflow / safety blockers | 6 | 8 | 13 | `docs/aha/module-fix-plans/billing-stripe-fix-ready-plan.md` |
| 4 | Training & Credits | training-credits | FAIL | PARTIALLY READY | 14 | Batch A — P0 credit-award journey + same-path correctness | 5 | 9 | 10 | `docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` |
| 5 | Elections & Governance | elections-governance | FAIL | PARTIALLY READY | 11 | Batch A (FIX-001 close-voting op only, driven by FIX-007) | 5 | 6 | 10 | `docs/aha/module-fix-plans/elections-governance-fix-ready-plan.md` |
| 6 | Communications (+ feed) | communications | FAIL | PARTIALLY READY | 11 | Batch A — P0 delivery spine + prefs pipeline | 4 | 6 | 7 | `docs/aha/module-fix-plans/communications-fix-ready-plan.md` |
| 7 | Realtime Comms | realtime-comms | FAIL | PARTIALLY READY | 18 | Batch A — P0 real-time chat delivery | 5 | 6 | 9 | `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` |
| 8 | Platform Admin (+ admin app) | platform-admin | FAIL | PARTIALLY READY | 18 | Batch D — Test hardening / honest baseline | 6 | 8 | 5 | `docs/aha/module-fix-plans/platform-admin-fix-ready-plan.md` |
| 9 | Person & Profile (+ deletion cascade) | person-profile | FAIL | PARTIALLY READY | 14 | Batch A (FIX-001 privacy PATCH) + Batch D RED slice, then Batch B | 6 | 8 | 11 | `docs/aha/module-fix-plans/person-profile-fix-ready-plan.md` |
| 10 | Documents & Credentials | documents-credentials | FAIL | PARTIALLY READY | 15 | Batch B1 — Documents reliability / permission / compliance | 6 | 7 | 9 | `docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md` |
| 11 | Marketplace/Ads/Reviews | marketplace-advertising | FAIL | PARTIALLY READY | 12 | Batch A — P0 dropped-prefix blocker + regression net (FIX-001/002) | 5 | 7 | 9 | `docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md` |
| 12 | Notifications & Email | notifications-email | PARTIAL PASS | PARTIALLY READY | 13 | Batch D + Batch B (BR-57) — test foundation + reason-aware transactional override | 5 | 7 | 11 | `docs/aha/module-fix-plans/notifications-email-fix-ready-plan.md` |
| 13 | Auth/RBAC enforcement | auth-rbac | PARTIAL PASS | PARTIALLY READY | 10 | Batch D (RED) + Batch A (P1 enforcement) + Batch G (matrix rewrite) | 5 | 6 | 12 | `docs/aha/module-fix-plans/auth-rbac-fix-ready-plan.md` |
| 14 | Surveys & Polls | surveys-polls | PARTIAL PASS | PARTIALLY READY | 11 | Batch A — P1 publish→respond loop (read-auth subset) | 5 | 8 | 10 | `docs/aha/module-fix-plans/surveys-polls-fix-ready-plan.md` |

**Totals:** 14/14 organized · Organizer decisions: **PARTIALLY READY 14 · READY 0 · NOT READY 0** · Active fixes: **197** · Blocked items: **81** · Product-decision/confirmation items: **106** · Deferred items: **141**.

> Every module landed **PARTIALLY READY** (none fully READY): each has an evidence-backed first batch that runs now, but later batches in every module are gated by product decisions, missing-spec/env blockers, or isolated shared/platform + database/schema dependencies. No module is NOT READY — every one has at least one unblocked, fix-ready batch.

## Organizer decisions per module (one line)

1. **membership-lifecycle** — Batches A/B fix-ready now (cron column bug + read-consistency org guards); state-machine cluster FIX-007..011 blocked on 6 product decisions + additive `resigned_at` migration (Batch F). Invoice half of G-07 deferred to dues-payments (cross-module).
2. **dues-payments** — Batch A (3 P0: webhook→ledger seam, cross-org refund, receipt collision) + Batch B (P1 RBAC/validation/privacy) ready; Batch C dunning/funnel/gateway-refund decision-gated. Receipt-counter migration isolated to Batch F, gateway-refund + double-expiry to Batch E. Correction logged: gateway creds are AES-GCM encrypted (gap-plan "plaintext" note outdated).
3. **billing-stripe** — Batch A (P0 secret-key redaction + webhook pagination) + Batch B P1 handler-local ready; FIX-001 touches shared `core/billing.ts` (redaction-only); webhook fixes have blast radius into platformadmin/booking. stripe-mock CI `[BLOCKED BY ENVIRONMENT]`; FIX-012/013 `[NEEDS CONFIRMATION]` held out of first batch.
4. **training-credits** — Batch A (P0 G1/G8/G6 credit-award journey) ready; paid trainings + manual-entry policy + 45-vs-60 default + fractional credits decision-gated. Shared caution: credits schema/repo in `association:member/repos/` feed 3 handler dirs — fix in place, do not relocate (collides with deferred P1-11 split). 3 runtime `[NEEDS CONFIRMATION]` must be verified with live tests.
5. **elections-governance** — FIX-001 (close-voting `votingOpen→awaitingConfirmation` op) starts now; G2 position-identity (P0) coding blocked on product/tech decision, isolated to Batch F. 4 product decisions gate scope. Key files (governance.tsp, handlers, ELECTION_VALID_TRANSITIONS) verified present.
6. **communications** — Batch A (5 P0 delivery spine + prefs) ready; canonical broadcast primitive (announcements vs messages) is a product decision, defaulted to announcements to keep Batch A unblocked. Feed (m13) → Blocked. Shared bootstrap/event-bus → Batch E; topicId-UUID mapping → Batch F.
7. **realtime-comms** — Batch A (G1 real-time delivery + G6 upsert-admin security) ready; G2/G5/G7 gated by PD-1/PD-3. Verified: `sendChatMessage.ts` has no broadcast call; `vite.config.ts` lacks `ws:true`; `orgContextOptionalMiddleware` shared across 9 prefixes → G4 fixed module-locally. Shared WS flag → Batch E (do not touch); `org_id` NOT NULL migration → Batch F.
8. **platform-admin** — **First batch is Batch D (test hardening), not a P0 batch** — fake-green AC suite + 10-handler test backfill + contract tightening is decision-free and must precede the gated RBAC/flag-enforcement/impersonation P1s (FIX-008/009/010 + UI block) which need product decisions. Runtime confirmations `[BLOCKED BY ENVIRONMENT]`.
9. **person-profile** — P0 FIX-001 (privacy PATCH `orgId`/`organizationId` key mismatch) + Batch D RED slice run first, then Batch B. G-02 unenforced privacy toggles blocked on privacy-model decision; directory publish duplicates cross-module (chapters-directory); generated-Zod required→optional bug routed to prompt 05; domain-events reliability routed to core-platform audit.
10. **documents-credentials** — First batch **B1** (G3 access-log write + G4 searchDocuments status enforcement) fully unblocked; P0 verify-chain Batch A gated on Q1 (canonical verify URL/token format); certificates Batch C gated on Q8 backfill + cert-schema migration (Batch F) + m09 cross-module seam. Shared concentration (domain-event-consumers, TypeSpec generate, id-card files, routeTree.gen.ts) → Batch E.
11. **marketplace-advertising** — Batch A = single root-cause fix (G-01 dropped `/association` route prefix across ~14 routes) + regression net, kept as one shared/platform batch. Blocked on authority model (G-06), review-deletion policy (G-13), vendor-identity. 2 runtime `[NEEDS CONFIRMATION]` (cross-org read leak, listListings status filter). Batch F empty (no migration). Reviews sub-module healthy — minimal changes.
12. **notifications-email** — No P0. First = Batch D (BR test registration) + Batch B BR-57 slice (reason-aware transactional override). FIX-003 blocked by provider/env; FIX-004/005 by preference-store decision; FIX-006 by push-scope decision. Verified: `isSuppressed` returns bool only (`core/email.ts:270`); zero callers of dunning/task-overdue triggers; `react-onesignal` never imported; `notification_preference` has no send-path consumer.
13. **auth-rbac** — No P0. First = Batch D (RED tests) + Batch A (P1 platform-mutation role checks) + Batch G (fake-green RBAC matrix rewrite). Verified: `createAssociation.ts:21-22` checks `role!=='super'` but `createOrganization`/`setFeatureFlag`/`transitionOrgStatus` lack any role check; `requireOfficerTerm` has no 2FA branch despite docstring; `officerAuthMiddleware` has zero mounts. Correction logged: `requireOfficerTerm` has no title arg → 2FA fix must inspect fetched `terms[].positionTitle`. G3 session-role provisioning blocked on product decision. Batch F empty.
14. **surveys-polls** — No P0. First = Batch A read-auth subset (FIX-001/002 officer gate on getSurvey/listSurveys). Rest of publish→respond loop (targeting/discovery/publish-notify) + M18-R2 decision-gated (PD-1/2/3) + cross-module/schema dep (Batch F: targetAudience union normalization + person-deletion FK cascade verification).

## Cross-cutting signals surfaced by the organize pass (for prompts 05/06, not acted on here)

- **Shared/platform isolation (Batch E) recurs:** billing `core/billing.ts`, communications event-bus bootstrap, realtime-comms WS flag, documents `core/domain-event-consumers.ts` + TypeSpec generate pipeline, marketplace dropped-prefix generator seam. Multiple modules independently routed platform edits into a dedicated Batch E — confirms a cross-cutting generated-route/middleware-wiring + shared-bootstrap theme for prompt 05.
- **Database/schema isolation (Batch F) recurs:** membership `resigned_at` (additive), dues receipt-counter, documents cert-schema, realtime-comms `org_id` NOT NULL, surveys targetAudience union + person-deletion FK. Candidate inputs for prompt 06.
- **Fake-green test suites flagged as first-batch work** in platform-admin (Batch D first), auth-rbac (Batch D/G first), dues-payments (synthetic Stripe metadata), training-credits, documents — test hardening is genuinely the safest opening move for the no-P0 / fake-green modules.
- **Product-decision load is heavy (106 items).** Most later batches are decision-gated, not code-blocked. A focused product-decision pass before prompt 04 would unblock the largest share of deferred scope.

## Recommended first prompt-04 target

**Primary: `membership-lifecycle` → Batch A — P0 status-truth (cron + read consistency).**
Highest core-value weight (the automatic membership status lifecycle is the product's central promise, and it is dead end-to-end: `statusRecomputeCron.ts:59-79` selects nonexistent `is_expired`/`is_pending_payment` columns). Batch A is fully fix-ready now (no product decision, no migration — the migration is only for the deferred state-machine cluster in Batch F), root-cause not symptom, and fixing it unblocks dependent dues/credit/election eligibility logic.

```txt
Next recommended step:
Module/group: Membership Lifecycle
Module slug: membership-lifecycle
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md
Recommended batch: Batch A — P0 status-truth (cron + read consistency)
```

**Immediate second: `dues-payments` → Batch A (+ Batch F receipt migration).** Financial-integrity P0×3 (lost online payments via dead webhook→ledger seam, cross-org refund, receipt-number collision). Batch A is fix-ready; pair with the isolated Batch F receipt-counter migration.

**Decision-free quick wins (good parallel prompt-04 candidates, no product decision needed):** `platform-admin` Batch D and `auth-rbac` Batch D/A/G — both rebuild fake-green test baselines before touching enforcement, the safest opening move for the PARTIAL-PASS modules.

## Verification

- 14 fix-ready plans present under `docs/aha/module-fix-plans/`, each with the full 14-section §13 template; §14 (Instructions for 04 Fix Prompt) is the last section in every file.
- `git status` shows changes only under `docs/aha/` (no source/test modifications).
- No commits made. Prompt 04 not run.
