# AHA Consolidated Remediation Roadmap

> **Refresh: 2026-06-13 (AHA Step 49 — standing-P0 + cross-module `04` carry-forward drain).** Both standing P0 product decisions are RESOLVED, and the cross-module `04` carry-forwards executed (per-module fix-reports updated, each TDD-verified GREEN):
> - **Documents Q1 (ID-card verify, P0)** — DECIDED: unify on the existing credential `/verify/$id` + HMAC family. Found already shipped (Step 40); closed the residual fake-green AC-M11-006 test. **230 documents tests green.** COMPLETE.
> - **Elections G2 (position identity, P0)** — DECIDED: reference real governance `position(id)` rows. Found already implemented (Step 29/35); re-verified GREEN against local pg. **126 governance + 6 integration tests green.** COMPLETE.
> - **platform-admin FIX-009** (feature-flag enforcement, Q2) — BUILT: new opt-in `featureFlagGate(moduleName)` middleware + precedence (org>assoc>tier, fail-open) + one wired router + route-walk. **15 gate + 700 platformadmin/middleware tests green.** COMPLETE. (FIX-015 disable-module dialog now unblocked.)
> - **platform-admin FIX-010 + FIX-016** (impersonation, Q3) — DECIDED read-only console; BUILT per-request nav audit (both ids) + fixed the broken impersonate member search (repointed to `listPersons`). Identity-swap → V2 `[CROSS-MODULE RISK]`. **293 middleware + 48 admin tests green.** COMPLETE.
> - **platform-admin FIX-011** (TypeSpec migration, Q4) — DECIDED tickets/subscriptions/pricing are V1; MIGRATED 13 hand-wired admin ops to TypeSpec + regen + SDK hooks (unblocks FIX-013 UI). `createTicket` correctly kept public. **434 platformadmin tests green; tsc clean ×4 workspaces.** COMPLETE.
> - **notifications-email FIX-004** (delivery enforcement, Q3) — BUILT: `type→category` resolver + `NotificationPreferencePort` (cross-module read via port) + per-category gate, in-app-always + fail-open invariants. **15 + 515 + 552 regression tests green.** COMPLETE. (`[NEEDS CONFIRMATION]`: topic↔category vocabulary split — enforcement works regardless.)
> - **realtime-comms PD-3 video V1** — BUILT the no-infra slice: capacity cap (6) + no-recording invariant, TDD. **180 comms tests green.** Media/TURN/recording/ungate → V2 `[BLOCKED BY ENVIRONMENT]`; flag stays default-off. PARTIALLY COMPLETE (V1 slice done).
> - **billing-stripe Stripe fee/settlement path** — ~~BLOCKED~~ **RE-SCOPED + RESOLVED (2026-06-13, CONTINUE-49).** Founder locked the revenue model: platform revenue = **tiered SaaS subscription** (org pays platform per pricing-tier band); member dues = **per-org direct charges, NO skim**. This makes `payInvoice.ts platformAmount = 0` **correct by design** (not a gap) and moots the old `[BLOCKED BY MISSING SPEC]` fee-policy block for V1 — that was the skim model the founder did not choose. Platform **subscription billing BUILT** (see CONTINUE-49 refresh below). Org Stripe-Connect onboarding = separate future item.
>
> **Net: both standing P0s resolved; all cross-module `04` carry-forwards drained except the billing fee path (one founder business decision).** No migrations were needed in any pass (next free still `0072`). Working tree preserved; no commits.

> **Refresh: 2026-06-13 (AHA CONTINUE-49 — platform subscription billing built; backlog drained).** Re-scoped task 7 (billing) on the founder-locked revenue model. **Platform subscription billing BUILT** (TDD): `createSubscription` handler (super-only RBAC, unique-per-org), member-count→tier validation (`tier-fit.ts`: `maxMembers` null=unlimited, billable headroom = `active`+`gracePeriod`, cheapest-covering auto-pick), Stripe-**stubbed** `provisionStripeSubscription` populating `stripeSubscriptionId` (live = `[BLOCKED BY ENVIRONMENT]`), and `invoice.payment_failed`→`past_due` webhook transition. TypeSpec-modeled + SDK `createSubscriptionMutation` regenerated. **698 platformadmin+billing tests green / 0 fail; `tsc` clean 5/5 workspaces.** One RED fixed this pass = a dishonest test-mock (`.limit` fell back to the invoice list on no-match) — zero production code changed. No migrations (next free still `0072`). **Net: all 8 CONTINUE-48 backlog tasks resolved.** The fee-path "blocker" is retired — see prologue. Remaining = explicit V2 deferrals + `[NEEDS CONFIRMATION]`/`[BLOCKED BY ENVIRONMENT]` items (notifications topic↔category vocab; realtime video media/TURN; impersonation identity-swap V2; org Stripe-Connect onboarding; FIX-013 admin UI now unblocked).
>
> **Refresh: 2026-06-13 (AHA Step 48 — P1 product-decision drain).** Folds in the autonomous drain of the three remaining P1 product-decision gates, each on pre-authorized recommended defaults: **platform-admin** (Q1 role taxonomy `super/support/analyst` + Q8 analyst read-only → FIX-005 doc-sync + FIX-008 `requireAdminTier` RBAC on the mutating surface, 410+9+15 tests green); **notifications-email** (Q1 web-push descoped → FIX-006; Q3 `person_subscription` canonical → FIX-005 satisfied; FIX-004 enforcement `[CROSS-MODULE RISK]`, FIX-003 `[BLOCKED BY ENVIRONMENT]`); **realtime-comms** (PD-1 channel model **ratified** as already-shipped; PD-2 DM org-scoping **built** — send guard + strict org list filter, 166 comms tests green; PD-3 video *finish* `[CROSS-MODULE RISK]`/`[BLOCKED BY ENVIRONMENT]` — gate already shipped). **Net: the P1 product-decision track is now DRAINED.** Remaining non-deferred items = the standing P0 decisions (elections G2, documents Q1) + cross-module `04` carry-forwards (billing-stripe Stripe-fee path, platform-admin FIX-009/010/011, realtime video-V2/PD-3, notifications FIX-004, elections G2) + explicit V2 deferrals. Realtime PD-1 is no longer a standing P0. Read-only consolidation per `07-consolidate-roadmap.md`.

> **Refresh: 2026-06-12 (AHA Step 28 — Track C consolidation).** Supersedes the prior 2026-06-12 roadmap. This pass folds in **AHA Step 26** (membership orphan-handler delete cleanup + real-PG multi-table approval-transaction rollback guard) and **AHA Step 27** (migration `0068` dup-enroll deploy preflight), and reconciles the full decision-free drain that completed since the last roadmap (membership A/B/C/E2/F + per-module decision-free batches across nearly every module). **Net change vs prior roadmap: the decision-free fix track is now DRAINED — every remaining non-deferred item is gated on a product decision.** Read-only consolidation per `07-consolidate-roadmap.md` — **no code, tests, gap plans, fix-ready plans, or fix reports were modified.**

---

## 1. Executive Summary

- **Audit coverage:** 15 modules/groups have full gap-plan → fix-ready-plan → fix-report chains. Cross-cutting (`05`) and database-schema (`06`) platform audits are complete.
- **Completed fix coverage (advanced this period):** every module's **decision-free batches have now executed**. Membership Lifecycle is effectively fully fixed for V1 (A + B + C + E2 + F + FIX-013, migrations 0065/0066). Training & Credits advanced through Batch C + D + the FIX-004 5th-path completion + a real-browser Batch E proof + **Step 26** + **Step 27**. Jobs Batch B landed (jobs-D1 confirmation resolved). Marketplace ran B + C + D; person-profile ran Batch C (backend + frontend); dues ran the settle-seam pass; communications/documents/notifications/platform-admin/realtime/elections/billing all ran their decision-free P1 batches.
- **Highest risks (still open):** **2 standing P0 product decisions** — elections **G2 position-identity** (FK violation on every nomination/vote insert) and documents **Q1 card-verify token/URL contract**. (Realtime **PD-1 channel-membership model** is RESOLVED/ratified as of Step 48 — org-scoped auto-join shipped; `/messages` is no longer permanently empty.)
- **✅ Track B (membership E2 ratification) — RESOLVED 2026-06-13.** The membership **E2 state-machine** cluster (reinstate semantics, RESIGNED actor, EXPIRED threshold, expulsion-V1, re-application strategy) — built on engineering-chosen defaults (migrations 0065/0066) — was **explicitly ratified by the user**, all five decisions as-is (incl. expulsion-V1 deferred to V2 despite the earlier "2?" interest). No build reopened. No longer a gate — see §13.
- **Biggest blocker:** product-decision throughput, not engineering. With the decision-free backlog drained, **no decision-free `04` work remains to run**; engineering cannot safely start the gated passes (elections G2 schema/migration, documents Q1 URL contract, realtime PD-1 channel model, surveys PD-1/2/3) without the decisions.
- **Recommended next action:** **HALT for the user** on the product-decision agenda (§13), now led by the **2 standing P0s** (elections G2, documents Q1; Track B closed 2026-06-13, realtime PD-1 ratified + P1-decision track drained 2026-06-13). Do NOT auto-decide them.

**Roadmap decision:** `BLOCKED BY PRODUCT DECISION` — both the decision-free track and the P1 product-decision track are now exhausted; the only remaining non-deferred blockers are the 2 standing P0 decisions + cross-module `04` carry-forwards. See §18.

---

## 2. Inputs Reviewed

| Input | Details |
| --- | --- |
| Module audit index | `outputs/module-audit-index.md` (2026-06-11). NOTE: stale on `jobs` (says "NOT AUDITED" but a full gap/ready/report chain + Batch B now exist) and pre-dates the decision-free drain + Steps 26/27. |
| Gap plans reviewed | 15 — auth-rbac, billing-stripe, communications, documents-credentials, dues-payments, elections-governance, jobs, marketplace-advertising, membership-lifecycle, notifications-email, person-profile, platform-admin, realtime-comms, surveys-polls, training-credits |
| Fix-ready plans reviewed | 15 (same set) + membership-lifecycle §8 + its **"Product Decisions — RESOLVED (2026-06-12)"** addendum (Track B) |
| Completed fix reports reviewed | 15 (same set) + `cross-cutting-platform-fix-report.md`. **Newly folded in:** `training-credits-fix-report.md` §"AHA Step 26" + §"AHA Step 27"; `membership-lifecycle-fix-report.md` "Batch F + E2 (2026-06-12)" + "Batch C" sections. |
| Cross-cutting audit reviewed | Yes — `outputs/cross-cutting-pattern-audit.md` (P-1…P-9, F-1…F-5) |
| Database/schema audit reviewed | Yes — `outputs/database-schema-audit.md` (R-1…R-7) |
| KG status reviewed | Yes — `kg/knowledge-graph-status.md` (status only) |
| Domain status reviewed | Yes — `kg/domain-knowledge-status.md` (status only) |
| Other | `outputs/env-validation-pass.md` (2026-06-12). |
| Limitations | Read-only consolidation. Classification per 07 §4 + §9 is from each module's `*-fix-report.md` "Batch executed" + "Completion Decision". Membership E2/F is reported COMPLETE in its fix-report but its six gating decisions were eng-deferred, not user-ratified — represented here as a ratification gate, not unbuilt work. Severity inferred from blast radius where reports were not explicit. |

---

## 3. Current Audit Coverage

| Module/Group | Module Slug | Type | Audit Decision | Gap Plan? | Current Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Membership Lifecycle | membership-lifecycle | Business Module | FAIL → V1 cleared | Yes | **Fixed (V1 decision-free scope)** | A + B + **E2 + F + FIX-013** + **Batch C** all landed (0065/0066). **Track B ratified/CLOSED 2026-06-13**; only V2 items remain. |
| Training & Credits | training-credits | Business Module | FAIL | Yes | Partially Fixed | A + B(+5th-path) + C + D + **Batch E** + **Step 26** + **Step 27** + **Step 47 (TC-DEC-01 proof-of-payment + TC-DEC-02 verification gate)** done. Remaining: TC-DEC-01 **Stripe** variant (billing-stripe `04`) + proof-of-payment **frontend UI** (`[FOLLOW-UP]`). |
| Elections & Governance | elections-governance | Business Module | FAIL | Yes | Partially Fixed | A (FIX-001) + **Batch B (FIX-003 ballot secrecy + FIX-005 immutability)** done. **G2/FIX-002 P0 gated** (Batch F). |
| Jobs | jobs | Business Module | FAIL | Yes | Partially Fixed | A + **Batch B (FIX-003/004 handler-org trust)** done — **jobs-D1 resolved**. *(Index row stale — jobs IS audited.)* Only P3 jobs-D2 left. |
| Marketplace/Ads/Reviews | marketplace-advertising | Business Module | FAIL | Yes | Partially Fixed | **A + B + C (advertising rails) + D (reviews + x-audit)** done. reviewCreative/verifyVendor authority (**G-06**) gated. |
| Person & Profile | person-profile | Business Module | FAIL | Yes | Partially Fixed | A + B + Batch C + **Step 46 (Q-4 gender scrub SHIPPED; Q-1 DECIDED=enforce)** done. Only G-02 toggle enforcement remains — **cross-module → chapters-directory `04`**. |
| Dues & Payments | dues-payments | Business Module | FAIL | Yes | Partially Fixed | A (3×P0 + 0062) + **Batch B subset + settle-seam (FIX-007/010 + cross-org guard) + Step 45 funnel (FIX-009 / Q-PD7+Q-PD8)** done. Only refund gateway (Q-PD6, env-deferred) gated. |
| Communications | communications | Business Module | FAIL | Yes | Partially Fixed | A (delivery spine) + **Batch B (FIX-006 RBAC/FIX-007 tenant/FIX-008 stats + DEC-COMMS-05)** done. feed (m13) blocked on missing spec. |
| Documents & Credentials | documents-credentials | Business Module | FAIL | Yes | Partially Fixed | **B1 + B2** done. Batch A verify-chain (**Q1 P0**) + cert Batch F (Q8 P1) gated. |
| Notifications & Email | notifications-email | API/Integration | PARTIAL PASS | Yes | Partially Fixed | D + B (BR-57) + Batch C subset + stripe-webhook orgId fix + **FIX-006 web-push descope (Q1) + FIX-005 store convergence (Q3)** done 2026-06-13. FIX-004 enforcement `[CROSS-MODULE RISK]`; FIX-003 `[BLOCKED BY ENVIRONMENT]` (Q2 email provider). |
| Platform Admin | platform-admin | Business + FE Group | FAIL | Yes | Partially Fixed | D + **Batch B** + **B-gated (FIX-005 doc-sync + FIX-008 RBAC tiers; Q1/Q8 decided 2026-06-13)** done. FIX-009 (Q2 flag enforcement) + FIX-010 (Q3 impersonation) remain `[CROSS-MODULE RISK]`; FIX-011/013 V2. |
| Realtime Comms | realtime-comms | Business Module | FAIL | Yes | Partially Fixed | A + R-1 + Batch B subset + channels/PD-1 (Steps 29/31/41) + DM-create (42) + video-gate (43) + **PD-2 DM org-scoping (Step 48)** done. PD-1 ratified. PD-3 video *finish* `[CROSS-MODULE RISK]`/`[BLOCKED BY ENVIRONMENT]` (TURN/media). |
| Auth/RBAC | auth-rbac | Security Group | PARTIAL PASS | Yes | Partially Fixed | D + A + G + 5-handler super-gate + C subset done. Batch E (FIX-010 secret fail-fast) + G3/FIX-008 gated. |
| Billing (Stripe) | billing-stripe | API/Integration | FAIL | Yes | Partially Fixed | A + **Batch B remainder (FIX-007/008)** done. **Platform subscription billing BUILT (CONTINUE-49, 2026-06-13)** — `createSubscription` + tier-fit validation + Stripe-stubbed wiring + `invoice.payment_failed`→`past_due`; fee-path "blocker" retired (per-org direct charges, no skim → `platformAmount=0` correct by design). Batch C/D remain; stripe-mock CI env-blocked. |
| Surveys & Polls | surveys-polls | Business Module | PARTIAL PASS | Yes | Partially Fixed | A read-auth subset done. **Next P1 batch BLOCKED** on PD-1/PD-2/PD-3. The one module with un-run decision-free-ish scope, all gated. |
| Cross-Cutting Platform | cross-cutting | Platform | Audited Only (05) | Yes (audit) | Partially Fixed | F-1/F-3/F-5 done. F-2 (route-integrity suite) + F-4 (fake-green CI gate) remain (P1). Do not re-run `05`. |
| Database / Schema | database-schema | Database Group | Audited Only (06) | Yes (audit) | Partially Fixed | R-1/R-2/R-5 done via module batches. R-6 (P1), R-3/R-4 (P2), R-7 (P3) remain. Do not re-run `06`. |

**Not separately run through `02`–`04`** (folded into the above or intentionally delayed; from index): chapters-directory, events-booking *(delayed — Phase 47b refactor in flight)*, committee-management *(recommended next audit — owns matrix §3.28 committee guard)*, professional-feed *(blocked on missing m13 spec)*, org-admin-operations, national-dashboard, storage-files, member-mega-module *(ADR-0010 rebuild-over-split; re-scope deferred)*, core-platform *(person-deletion cascade semantics, V2)*.

---

## 4. Current Fix-Ready Coverage

All 15 modules have `*-fix-ready-plan.md`. The decision-free next-batch column from the prior roadmap has now **executed in every case**; the column below shows the **next remaining batch** and why it is gated.

| Module/Group | Slug | Fix-Ready Plan | Next Remaining Batch | Decision-Free? | Notes |
| --- | --- | --- | --- | --- | --- |
| Membership Lifecycle | membership-lifecycle | §4 + RESOLVED §8 | **Track B ratification** (no new batch) | ✅ CLOSED 2026-06-13 | E2/F ratified as-is by the user; expulsion-V1 confirmed V2; no reopen. |
| Elections & Governance | elections-governance | yes | **Batch F** — G2/FIX-002 position identity | ⛔ Gated (P0) | FIX-004 vote-retention also needs a call. |
| Documents & Credentials | documents-credentials | yes | **Batch A** verify-chain (Q1) + cert **Batch F** (Q8) | ⛔ Gated (P0+P1) | B1/B2 done. |
| Realtime Comms | realtime-comms | yes | PD-3 video *finish* (TURN/media) | ◑ Mostly done | PD-1 channels (Steps 29/31/41) + DM-create (42) + video-gate (43) + **PD-2 DM org-scoping (48)** done. PD-3 finish `[CROSS-MODULE RISK]`/`[BLOCKED BY ENVIRONMENT]`. |
| Surveys & Polls | surveys-polls | yes | **Batch B / FIX-003-005** | ⛔ Gated | PD-1 + PD-2 + PD-3 must resolve first. |
| Training & Credits | training-credits | yes | ✅ **Step 47 done** — TC-DEC-01 proof-of-payment + TC-DEC-02 verification gate built | ✅ Closed (backend) | Carry-forward: Stripe variant → billing-stripe `04`; proof-of-payment frontend UI `[FOLLOW-UP]`. |
| Person & Profile | person-profile | ~~yes~~ | ~~G-02 batch + gender scrub~~ | ✅ Q-4 SHIPPED / Q-1 DECIDED | Step 46: gender scrub done; Q-1=enforce → G-02 carried to chapters-directory `04` (cross-module). |
| Notifications & Email | notifications-email | yes | FIX-004 (enforcement) + FIX-003 (webhook) | ◑ Mostly done | Q1/Q3 decided + FIX-005/006 done 2026-06-13. FIX-004 `[CROSS-MODULE RISK]`; FIX-003 `[BLOCKED BY ENVIRONMENT]` (Q2 email provider). |
| Platform Admin | platform-admin | yes | FIX-009 (Q2) + FIX-010 (Q3) | ◑ Mostly done | Q1/Q8 decided + FIX-005/008 built 2026-06-13. FIX-009/010 `[CROSS-MODULE RISK]`; FIX-011/013 V2. |
| Marketplace/Ads | marketplace-advertising | yes | **Authority re-gate** | ⛔ Gated | G-06. A/B/C/D done. |
| Dues & Payments | dues-payments | yes | **Funnel + refund** | ⛔ Gated | Q-PD6/7/8. A/B/settle-seam done. |
| Auth/RBAC | auth-rbac | yes | **Batch E (FIX-010)** + G3/FIX-008 | ◑ Mostly gated | FIX-010 secret fail-fast is decision-free but low-priority; G3/FIX-008 gated. |
| Billing (Stripe) | billing-stripe | yes | **Batch C/D** | ◑ env-gated | stripe-mock CI. A/B done. |
| Communications | communications | yes | **m13 feed** | ⛔ Gated | `[BLOCKED BY MISSING SPEC]`. Batch B done. |
| Jobs | jobs | yes | **jobs-D2 (P3 listing expiry)** | ✅ Yes (P3 only) | Batch A/B done; only a P3 polish remains. |

**Note:** the only strictly decision-free remaining items are low-value tail polish (auth-rbac FIX-010 secret fail-fast; jobs-D2 P3 listing-expiry). They do not constitute a meaningful "Track A" pass and are not worth a dedicated `04` ahead of the product-decision gate.

---

## 5. Current Completed Fix Coverage

| Module/Group | Slug | Batch(es) Executed | Gaps Fixed (summary) | Remaining | Tests | Completion |
| --- | --- | --- | --- | --- | --- | --- |
| membership-lifecycle | membership-lifecycle | A + B + **E2 + F + FIX-013** + **C** | Lifecycle P0s + resign(`resigned_at`)/reinstate-rejects-terminal/suspend+unsuspend ops/reuse-row re-application/delete-op removal + FIX-013 IDOR + Batch C completeness; migrations **0065/0066** | **Track B ratified/CLOSED 2026-06-13** + V2 | extensive (`resignedAtBackfill.integration.test.ts` real-PG; 6030/1/4) | COMPLETE (E2/F per fix-report; decisions user-ratified 2026-06-13) |
| training-credits | training-credits | A + B + B-FIXROUND + C + D + FIX-004-completion + **Batch E** + **Step 26** + **Step 27** | Credit-award seam, cycle authority (5 paths), void exclusion, single required-credits source, `training.type` + credit lock, dup-enroll guard, real-browser P0 proof, **orphan-handler delete + approval-rollback guard**, **0068 dedup preflight** | Batch B paid-training (TC-DEC-01/02) | see Step 26/27 rows below | PARTIALLY COMPLETE |
| training-credits — **Step 26** | training-credits | Orphan-handler cleanup + multi-table approval rollback (real-PG) | Deleted proven-dead `deleteMembership.ts`/`deleteMembershipApplication.ts` (no route/import/op/test — grep-proven); added `approvalRollback.integration.test.ts` real-PG multi-table rollback guard (CONTROL proves hazard + 2 atomic cases). **No tx fix needed — `approveMembershipApplication` already atomic; test locks the contract.** | — | `approvalRollback.integration.test.ts` **3 pass / 12 expect** (real PG); membership module suite **648 pass**; `typecheck` **5/5** | **COMPLETE** |
| training-credits — **Step 27** | training-credits | `0068` dup-enroll deploy preflight (de-dup before partial unique index) | Migration `0068_training_enroll_unique_active.sql` amended in place: idempotent de-dup PREFLIGHT (soft-cancel loser active enrollments by `completed>enrolled>noShow`, earliest `enrolled_at`, smallest id) prepended BEFORE the `CREATE UNIQUE INDEX`, so first apply on dirty data cannot crash the migrator. Local DB already clean (0 dups) + index applied — preflight is the forward-looking CI/staging/prod guard. | — | `trainingEnrollDedup.integration.test.ts` + `training-enroll-index.schema.test.ts` **6 pass / 25 expect** (real PG, hazard→preflight→index + idempotency); `typecheck` **5/5** | **COMPLETE** |
| elections-governance | elections-governance | A (FIX-001) + **B (FIX-003 + FIX-005)** | Close-voting dead-end + **ballot secrecy/403 self-check** + published-election immutability | Batch F (G2 P0), FIX-004 vote-retention | real-DB integration | PARTIALLY COMPLETE |
| jobs | jobs | A + **B (FIX-003/004)** | `/postings` prefix P0 + **handler-org trust (jobs-D1 resolved)** | jobs-D2 (P3) | yes | COMPLETE (batch) |
| marketplace-advertising | marketplace-advertising | A + **B + C + D** | Dropped-prefix P0 + workflow completion + advertising safety rails (FIX-008/009/010) + reviews scoping + §15 x-audit | G-06 authority re-gate | yes | PARTIALLY COMPLETE |
| person-profile | person-profile | A + D + B + C + **Step 46 (Q-4 + Q-1)** | P0 privacy-key + anonymize (+ **gender scrub, Q-4 shipped**) + Batch C FIX-007/008/009/010/011/012/014; Q-1 DECIDED=enforce | G-02 enforcement → chapters-directory `04` (cross-module) | yes | PARTIALLY COMPLETE |
| dues-payments | dues-payments | A + **B subset + settle-seam + Step 45 funnel** | 3×P0 + 0062 + position-gate/fund-splits/self-scope + FIX-007 cap/eligibility + FIX-010 + cross-org config guard + **FIX-009 (first-invoice consumer + member Pay Now)** | Gateway refund (Q-PD6, env-deferred) | yes | PARTIALLY COMPLETE |
| communications | communications | A + **B** | Delivery spine + prefs + RBAC + tenant isolation + stats + DEC-COMMS-05 PII scoping | m13 feed (missing spec) | yes | PARTIALLY COMPLETE |
| documents-credentials | documents-credentials | **B1 + B2** | Documents reliability/permission/compliance + license-renewal cron + notif gate + audit consumer | Batch A (Q1), F (Q8) | yes | PARTIALLY COMPLETE |
| notifications-email | notifications-email | D + B + **C subset + stripe-webhook orgId** | BR baseline + reason-aware override + DELETE suppression + queue-lifecycle + orgId guards | FIX-003/004/005/006 | yes | PARTIALLY COMPLETE |
| platform-admin | platform-admin | D + **B** + **B-gated** | Honest baseline + invite+consumer + sort + impersonate gate + **FIX-005 spec-sync + FIX-008 admin-tier RBAC (Q1/Q8)** | FIX-009/010 cross-module, FIX-011/013 V2 | yes (410 platformadmin + 9 helper) | PARTIALLY COMPLETE |
| realtime-comms | realtime-comms | A + R-1 (0064) + **B subset** | Real-time delivery + org_id NOT NULL + membership OR-shim + Vite ws:true | PD-1 channels (P0), PD-2, PD-3 | yes | PARTIALLY COMPLETE |
| auth-rbac | auth-rbac | D + A + G + super-gate + C subset | 4 P1 enforcement gaps + matrix rewrite + regression nets | Batch E, G3/FIX-008 | 103 RBAC tests | PARTIALLY COMPLETE |
| billing-stripe | billing-stripe | A + **B remainder (FIX-007/008)** | PII redaction, webhook pagination, 0063, updateInvoice txn, void path | Batch C/D | yes | PARTIALLY COMPLETE |
| surveys-polls | surveys-polls | A read-auth + FIX-010 RED + F cascade half | Read-authorization + person.deleted anonymization | Batch B (PD-1/2/3) | yes | PARTIALLY COMPLETE |
| cross-cutting-platform | cross-cutting | F-1/F-3/F-5 | Generator org-id invariant, sdk-compat additive/breaking, jobs prefix | F-2, F-4 | route-integrity (12) | COMPLETE (subset) |

---

## 6. Fix-Ready But Not Yet Completed

The decision-free batches are exhausted; every "next remaining batch" below is **product-decision-gated** (or low-value tail polish). `04` = `04-module-or-group-fix-tdd.md`.

| Module/Group | Slug | Next Remaining Batch | Why Not Completed Yet | Recommended Next Prompt |
| --- | --- | --- | --- | --- |
| Membership Lifecycle | membership-lifecycle | Track B ratification | ✅ CLOSED 2026-06-13 — E2/F ratified as-is by the user; expulsion-V1 confirmed V2; no reopen | none — Track B resolved |
| Elections & Governance | elections-governance | Batch F (G2/FIX-002) | **P0 product decision** (FK vs jsonb position identity) | resolve G2 → `04` |
| Documents & Credentials | documents-credentials | Batch A (Q1) + F (Q8) | **P0 + P1 product decisions** (verify-token contract; cert backfill) | resolve Q1/Q8 → `04` |
| Realtime Comms | realtime-comms | Batch B remainder (PD-1/2/3) | **P0 + P1 product decisions** (channel model; DM scope; video) | resolve PD-1/2/3 → `04` |
| Surveys & Polls | surveys-polls | Batch B (FIX-003-005) | **Blocked** on PD-1/PD-2/PD-3 | resolve → `04` |
| Training & Credits | training-credits | Batch B paid-training | **Blocked** on TC-DEC-01/02 | resolve → `04` |
| Person & Profile | person-profile | G-02 toggle enforcement | Q-1+Q-4 **resolved (Step 46)**; gender scrub shipped; G-02 enforcement is cross-module | chapters-directory `04` |
| Notifications & Email | notifications-email | FIX-003/004/005/006 | Provider/env (Q1/Q2) + pref-store (Q3) gated | resolve → `04` |
| Platform Admin | platform-admin | Enforcement batch | **Blocked** on Q1/Q2/Q3/Q4/Q8 | resolve → `04` |
| Marketplace/Ads | marketplace-advertising | Authority re-gate | **Blocked** on G-06 | resolve → `04` |
| Dues & Payments | dues-payments | Funnel + refund | **Blocked** on Q-PD6/7/8 | resolve → `04` |
| Communications | communications | m13 feed | `[BLOCKED BY MISSING SPEC]` | obtain m13 spec → `04` |
| Auth/RBAC | auth-rbac | Batch E (FIX-010) + G3 | FIX-010 decision-free but low-value; G3 gated | optional `04` / resolve G3 |
| Billing (Stripe) | billing-stripe | Batch C/D | stripe-mock CI env-blocked | wire stripe-mock → `04` |
| Jobs | jobs | jobs-D2 (P3) | Low-value polish; not worth a pass now | defer |

---

## 7. Top P0/P1 Risks

The prior roadmap's decision-free P1s (elections FIX-003 ballot secrecy, dues position-gate, comms PII scoping, etc.) are now **FIXED** (§5). What remains at the top is the standing **product-decision-gated** risk set.

| Pri | Gap | Module | Slug | Sev | Scope | Evidence | Why It Matters | Recommended Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **G2 / FIX-002 — dual position identity** (jsonb slots vs `position` FK) | Elections | elections-governance | **P0** | V1 REQUIRED | `election_nominee` FK; gap §24; fix-ready §F | UI nomination/vote inserts violate `election_nominee_position_id_position_id_fk`; governance integrity broken | **Product decision first** (§13), then gated Batch F `04`. |
| 2 | **Q1 — card-verify token/URL contract** | Documents | documents-credentials | **P0** | V1 REQUIRED | `id-card.tsx:82`, `getMyIdCardPdf.ts:181`, `verify/$token.tsx:22`, `app.ts:514` | Freezes already-distributed QR/share-link URL stability | **Product+platform decide token format** before freezing Batch A URL contract. |
| 3 | **PD-1 — channel-membership model** | Realtime | realtime-comms | **P0** | V1 REQUIRED | `comms.tsp:35-56`; `createChatRoom.ts:36`; `default-channels.ts` (0 callers) | `/messages` channels are the primary member surface and are **permanently empty** until decided | **Product decision** (§13), then FIX-003/FIX-007 `04`. |
| 4 | ✅ **Track B — membership E2 state-machine ratification** (reinstate/RESIGNED actor/EXPIRED/expulsion-V1/re-application) | Membership | membership-lifecycle | **RESOLVED 2026-06-13** | V1 REQUIRED | `membership-lifecycle-fix-report.md` §"Step 44"; fix-ready-plan §"Step 44" | **Explicitly ratified by the user — all 5 as-is, no override, no build reopened.** Expulsion-V1 confirmed deferred to V2. No longer a gate. | **CLOSED.** No further action. |
| 5 | G3 — TypeSpec session-role gates unassignable in prod | Auth/RBAC | auth-rbac | P1 | V1 REQUIRED | `routes.ts:23-52`; `seed/layer-2-users.ts:350` | accredited-providers/national-dashboard CRUD either 403s all real officers or enforces nothing | Decide canonical role model → dedicated `04`. Do NOT seed more roles. |
| 6 | Q3 — notification preference store of record | Notifications | notifications-email | P1 | V1 REQUIRED | `notification-preferences.tsx`; `routes.ts:3226` consumer-less | Settings toggles decorative; two tables disagree | Pick one store (recommend person-owned), repoint UI, enforce in dispatch. |
| ~~7~~ | ~~Q-1 — directory privacy model~~ **DECIDED (Step 46): enforce the M02 toggles** | Person→Directory | person-profile→chapters-directory | P1 | V1 REQUIRED | `updateMyPrivacySettings`; `directory.schema.ts:35` | 4 PII toggles enforced **nowhere** — directory gates only on its own enum | Q-1 resolved. G-02 enforcement is **cross-module** → chapters-directory `04`: projection reads `person_privacy_setting`, gates email/phone/photo/address per per-org toggles. |
| 8 | G-06 — advertising/vendor verification authority | Marketplace | marketplace-advertising | P1 | V1 REQUIRED | `routes.ts:2866,3552`; m16/m17 | Wrong trust boundary if shipped | Product decides authority model → re-mount or keep interim. |
| 9 | TC-DEC-01/02 — paid-training scope + manual-entry gate | Training | training-credits | P1 | V1 REQUIRED | `enrollInCustomTraining.ts:37`; PRD 10.2 | Paid trainings dead-end; manual-entry counting undefined | Product decides → size training Batch B. |
| 10 | Q-PD7 — first-invoice trigger | Dues | dues-payments | P1 | V1 REQUIRED | `approveMembershipApplication.ts:66`; `generateDuesInvoicesForOrg.ts:75` | Newly-approved members get no invoice → funnel broken | Decide mechanism w/ membership → `04`. |

*(Additional gated P1 decisions — platform-admin Q1/Q2/Q3/Q4/Q8, realtime PD-2/PD-3, surveys PD-1/PD-2/PD-3, notifs Q1/Q2, dues Q-PD6/Q-PD8, training TC-DEC-03/04, documents Q8, cross-cutting P-5 — are enumerated in §13.)*

---

## 8. Recommended Fix Sequence

**No decision-free `04` pass remains to run.** The sequence below is the **gated** order — each pass slots in **only after its §13 decision lands**. The Track B ratification gate is **CLOSED (2026-06-13)**; the lead item is now the elections G2 / FIX-002 P0.

| Order | Module/Group | Slug | Fix Scope | Why Now | Tests Required | Dependencies | Prompt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ✅ **DONE** | Membership Lifecycle | membership-lifecycle | **Track B ratification — CLOSED 2026-06-13** | Explicitly ratified by the user; all 5 as-is; expulsion-V1 confirmed V2; no E2.1 reopen | none (no build reopened) | §13 Track B | CLOSED — no `04` |
| 1 | Elections & Governance | elections-governance | **Batch F** — G2/FIX-002 position identity (schema/migration/seed/FE) | Highest P0 governance-integrity risk | FK-violation regression; nomination/vote insert | G2 decision (+FIX-007 5xx confirm) | resolve → `04` |
| 2 | Documents & Credentials | documents-credentials | **Batch A** verify-chain (Q1) | P0 printed-artifact URL contract | token HMAC + verify route | Q1 decision | resolve → `04` |
| 3 | Realtime Comms | realtime-comms | **FIX-003/007** channel model (PD-1) | P0 `/messages` empty-surface | channel join-table + create-permission | PD-1 decision | resolve → `04` |
| 4 | Training & Credits | training-credits | **Batch B** paid-training + manual-entry | P1 monetization dead-end | fee-path + verification-gate aggregate | TC-DEC-01/02 | resolve → `04` |
| 5 | Person & Profile | person-profile→chapters-directory | **G-02** toggle enforcement (Q-4 gender scrub **SHIPPED** Step 46) | P1 PII-toggle enforcement | per-field directory enforcement | ~~Q-1, Q-4~~ **both DECIDED** | G-02 → chapters-directory `04` (cross-module) |
| 6 | Notifications & Email | notifications-email | **Q3** pref-store + **Q2** provider webhook | P1 decorative toggles; bounce/complaint | pref-store enforce; signed webhook | Q3, Q2 | resolve → `04` |
| 7 | Platform Admin | platform-admin | **Enforcement** (Q1/Q2/Q3) | P1 ~30 mutating /admin handlers ungated | tier RBAC matrix; flag-enforcement | Q1/Q2/Q3 | resolve → `04` |
| 8 | Dues & Payments | dues-payments | ✅ Funnel **DONE (Step 45, Q-PD7+Q-PD8)**; only gateway **refund** (Q-PD6) left | P1 join→pay→active funnel CLOSED | ~~invoice trigger; pay-now~~ done; refund gateway | Q-PD6 (env-deferred) | refund only → `04` after Q-PD6 |
| 9 | Marketplace/Ads | marketplace-advertising | **Authority re-gate** (G-06) | P1 trust boundary | route re-mount + role set | G-06 | resolve → `04` |
| 10 | Surveys & Polls | surveys-polls | **Batch B** (FIX-003-005) | publish→respond loop | targeting/discovery/notify | PD-1/2/3 | resolve → `04` |
| 11 | Documents & Credentials | documents-credentials | **Batch F** cert re-key (Q8) | P1 cert backfill | migration + backfill | Q8 | resolve → `04` |
| 12 | Auth/RBAC | auth-rbac | **G3** role model + Batch E | P1 unassignable gates | TypeSpec + generator regen | G3 (FIX-010 decision-free, optional anytime) | resolve → `04` |

**Strictly decision-free tail (optional, low value, no pass scheduled):** auth-rbac FIX-010 (INVITE_TOKEN_SECRET fail-fast); jobs-D2 (P3 listing expiry); cross-cutting F-2/F-4 platform test-net hardening. Run opportunistically, not ahead of the gate.

---

## 9. Recommended Next Audits

No new module audits are required to proceed — the blocker is product decisions, not audit coverage. New audits are **optional/coverage-expanding**, not blockers.

| Order | Module/Group | Slug | Type | Why Audit Next | Prompt |
| --- | --- | --- | --- | --- | --- |
| 1 | Committee Management | committee-management | Business Module | Owns ROLE_PERMISSION_MATRIX §3.28 committee guard left `[NEEDS CONFIRMATION]`; inside member mega-module | `02` |
| 2 | Core Platform (deletion cascade) | core-platform | Platform/Shared | person.deleted cascade delivery semantics (R-4 / P-8); high blast radius — but **V2** | `02` (defer) |
| 3 | Events & Booking | events-booking | Business Module | Strong coverage; **delayed** — Phase 47b refactor in flight | `02` (after refactor) |
| — | Cross-cutting / Database | cross-cutting / database-schema | — | **Do NOT re-run** `05`/`06` — already audited; remaining items routed into module batches | n/a |

---

## 10. Cross-Cutting Fixes

| Fix | Modules Helped | Evidence | Status | Risk | Timing | Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| F-3 / P-2 / R-6 — generator org-id path-param invariant | person-profile + every org-scoped `/association/*` handler | cross-cutting fix-report §4 | **DONE** | — | — | — |
| F-5 / P-9 — `check:sdk-compat` additive-vs-breaking discrimination | documents, elections, every module adding a TypeSpec op | cross-cutting fix-report §4/§5 | **DONE** | — | — | — |
| F-1 — jobs `/postings` dropped-prefix + re-export invariant | jobs, marketplace, all `/association` re-exports | cross-cutting fix-report §6 | **DONE** (route P0) | Low | — | — |
| **F-2 — unified generated-route integrity suite** | marketplace, jobs, auth-rbac, platform-admin, all modules | audit §5 F-2; `generated-route-integrity.test.ts` (12 pass) | **REMAINING (P1)** — partially built | Med | Opportunistic; specialized platform fix prompt | future platform fix |
| **F-4 — CI gate against assertion-free / mock-only "green" tests** | platform-admin, documents, notifications, auth-rbac + flagged modules | audit §5 F-4 | **REMAINING (P1)** | Med | Opportunistic | future platform fix |
| P-7 — promote `assert-record-org.ts` to shared `core/` helper | membership + org-scoped modules | audit §7 | **DEFERRED** `[DO NOT OVERBUILD]` until ≥3 consumers | Low | V2 | — |

---

## 11. Database / Schema Fixes

| Fix | Affected Modules | Evidence | Status | Risk | Timing | Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| R-1 — chat_room/chat_message `organization_id` NOT NULL + backfill | realtime-comms | migration 0064 | **DONE** | — | — | — |
| R-2 — survey_response identified-response anonymization | surveys-polls | Batch F cascade half | **DONE** | — | — | — |
| R-5 (resigned_at) — membership.resigned_at + backfill | membership-lifecycle | migration **0065** (E2/F pass) | **DONE** | — | — | — |
| dup-enroll partial unique index + idempotent de-dup preflight | training-credits | migration **0068** (**Step 27**) | **DONE** — preflight prepended; first-apply crash-proof on dirty targets | Low | — | — |
| audit_action suspend/unsuspend enum values | membership-lifecycle | migration **0066** (E2/F pass) | **DONE** | — | — | — |
| **R-6 — generator emits required `organizationId`/`orgId` as optional** | person-profile + every org-scoped module | schema audit | **REMAINING (P1)** — path-param leg done (F-3); body/query leg open | Med | Next consolidation window | `04` per-module or platform |
| R-3 — chat_message / chat_room_member / reaction not covered by deletion cascade | realtime-comms, person-profile | schema audit | **REMAINING (P2)** | Med | realtime `04` after PD-1/PD-2 | `04` |
| targetAudience API↔schema union mismatch | surveys-polls | schema audit | **REMAINING (P2)** | Low | surveys Batch F after PD-3 | `04` |
| Q8 — certificate `trainingId=organizationId` re-key + backfill | documents-credentials | schema audit; `bulkIssueCertificates.ts:46` | **REMAINING (P2)** — **gated on Q8** | Med | documents Batch F | resolve → `04` |
| R-4 — person.deleted cascade has no completion guarantee | person-profile + 9+ cascade modules | schema audit | **DEFERRED (V2)** | Med | V2 dedicated core-platform | — |
| R-5 (remainder) — membership.expelled_at | membership-lifecycle | schema audit | **DEFERRED (V2)** — expulsion confirmed V2 at Track B ratification (2026-06-13); will NOT reopen for the pilot | Low | V2 | — |
| R-7 — DB-level immutability on append-only history/audit tables | membership, dues, audit | schema audit | **REMAINING (P3)** V1-RECOMMENDED | Low | opportunistic | `04` |

---

## 12. Test Infrastructure Priorities

| Test Gap | Affected Modules | Why It Matters | Recommended Fix | Priority |
| --- | --- | --- | --- | --- |
| No unified generated-route integrity suite | all generated-route modules | Prefix/officer/position/audit gates protected only by scattered per-module nets | F-2 (one CI net) | **P1** |
| Fake-green / assertion-free / mock-only suites with no CI guard | platform-admin, documents, notifications, dues, billing, training, realtime, person | "Green" tests that assert nothing mask real regressions | F-4 (CI gate + honesty doc) | **P1** |
| Admin app E2E coverage thin (~8 specs vs ~142 memberry) | admin-app, platform-admin | impersonation/operators/feature-flags lightly covered | Expand admin E2E once impersonation (Q3) lands | P2 |
| Full Playwright UI-driven E2E env-fragile (signup `beforeAll`) | all UI | Browser-level proofs flaky | Stabilize signup fixture / seed-based auth | P2 `[BLOCKED BY ENVIRONMENT]` |
| Real-PG integration harness now the proven pattern | training, membership | Step 26/27 + resignedAt backfill show real-PG catches schema/SQL bugs mocks miss | Reuse `pg.Pool` + scratch-schema + skip-if-unreachable harness for new data-layer fixes | P3 (pattern, not a gap) |

---

## 13. Product Decisions Needed

**The sole remaining gate** (decision-free work is drained). Ranked P0 → P3. `[PD]`=`[NEEDS PRODUCT DECISION]` (Elad/product), `[NC]`=`[NEEDS CONFIRMATION]` (eng can resolve), `[MS]`=`[BLOCKED BY MISSING SPEC]`.

### Track B — Membership E2 state-machine ratification — ✅ RATIFIED / CLOSED (2026-06-13)

> **RESOLVED — no longer a gate.** The E2/F state-machine (migrations 0065/0066) was
> **explicitly ratified by the user** on 2026-06-13 via `AskUserQuestion` (per-decision,
> interactive — confirming the earlier Step 29 delegated closure). **All five decisions
> ratified as-is; no override → no E2.1 reopen.** Recorded in
> `membership-lifecycle-fix-report.md` §"Step 44" + `membership-lifecycle-fix-ready-plan.md`
> §"Step 44". The terminal/reinstate vocabulary is reconciled across `STATE_MACHINES.md`,
> `MODULE_SPEC.member.membership.md`, and `membership.tsp` (FIX-019 — verified consistent).

| ID | Decision | Ratified outcome (2026-06-13) |
| --- | --- | --- |
| TB-1 | **Reinstate semantics** | ✅ **Lapsed-only**; REMOVED (resigned/terminated/deceased) terminal + irreversible; SUSPENDED via dedicated unsuspend op. |
| TB-2 | **RESIGNED actor** | ✅ **Officer-recorded only (V1)**; no member self-resign route/UI. |
| TB-3 | **EXPIRED threshold** | ✅ **Dropped from V1 vocabulary** — no state, no job; LAPSED covers "past grace". |
| TB-4 | **Expulsion-V1** ⚠️ | ✅ **Deferred to V2** (explicitly confirmed despite the earlier "2?" signal); `createDisciplinaryAction` stays unrouted; no `expelled_at`. |
| TB-5 | **Re-application strategy** | ✅ **Reuse existing row** — re-approval transitions the `(org, person)` row back with a status-history write; no index change. |

**Status:** CLOSED. No new membership `04` pass. `expelled_at` / EXPIRED job / self-resign
route remain **V2 DEFERRED** (§16). The lead gate is now the 3 standing P0 product decisions below.

### P0 — standing product decisions (block highest-trust unbuilt fixes)

| ID | Decision | Module | Label | Why Needed | Owner / Next Step |
| --- | --- | --- | --- | --- | --- |
| **G2 / FIX-002** | Election position identity: governance `position` FK vs module-local jsonb slots | elections-governance | `[PD]` | Every UI nomination/vote insert violates the `position` FK; fix = schema/migration/seed/FE | Product decides → gated Batch F `04` (confirm runtime 5xx via FIX-007 — `[NC]`). |
| **Q1** | Card-verify token/URL format: reuse credential token vs new HMAC `GET /verify/:token` | documents-credentials | `[PD]` | Freezes printed-artifact URL contract | Product+platform decide before Batch A. |
| **PD-1** | Channel membership: auto-join vs explicit; who may create channels | realtime-comms | `[PD]` | `/messages` channels empty until resolved | Product decides → FIX-003/007 `04`. |

### P1 — resolve next (block core-journey/trust/permission fixes)

| ID | Decision | Module | Label | Why Needed |
| --- | --- | --- | --- | --- |
| TC-DEC-01 | Paid trainings in V1? proof-of-payment or Stripe? | training-credits | ✅ **DECIDED (Step 47)** → proof-of-payment built; Stripe deferred to billing-stripe `04` | ~~Paid trainings dead-end~~ resolved (payment_pending + submit/confirm). |
| TC-DEC-02 | Member manual entries count immediately or behind verification gate? | training-credits | ✅ **DECIDED (Step 47)** → verification gate built | ~~FIX-005 filter undefined~~ resolved (aggregates + matview require `verified`). |
| ~~Q-4~~ | Scrub `gender` at anonymization alongside `bio`? | person-profile | ✅ **DECIDED (Step 46): YES — scrub. SHIPPED.** | `gender: null` in `anonymizePersonFields`; RED→GREEN regression. |
| ~~Q-1~~ | Directory privacy model: per-field toggles vs curation + 3-level | person-profile | ✅ **DECIDED (Step 46): ENFORCE the M02 toggles.** | G-02 enforcement is cross-module → chapters-directory `04` (projection reads `person_privacy_setting`). |
| Q8 | Certificate `trainingId=organizationId` backfill strategy | documents-credentials | `[PD]` | Re-keying issued certs needs migration-safe backfill. Blocks Batch F. |
| G3 | Canonical role model vs strip TypeSpec gates | auth-rbac | `[PD]` | accredited-providers/national-dashboard 403 all or enforce nothing. **Do NOT seed more roles.** |
| Q1 (PA) | Admin tier taxonomy super/support/analyst vs super/admin/support | platform-admin | `[PD]` | Blocks RBAC on ~30 /admin handlers. Coordinate w/ auth-rbac. |
| Q8 (PA) | Is analyst read-everything or analytics-only? | platform-admin | `[PD]` | Read-side of the matrix; decide with Q1. |
| Q2 (PA) | Feature-flag enforcement: API vs FE vs both | platform-admin | `[PD]` | DB flags written, never read. |
| Q3 (PA) | Impersonation V1: identity swap vs read-only console | platform-admin | `[PD]` | Determines session-resolution blast radius. |
| Q4 (PA) | Ship support-inbox / pricing / subscription UIs in V1? | platform-admin | `[PD]` | Scopes the largest UI block. |
| Q3 (notifs) | Preference store of record: `notification_preference` vs `person_subscriptions` | notifications-email | `[PD]` | Toggles decorative; tables diverge. Recommend person-owned. |
| Q1 (notifs) | Web push in V1 or descope? | notifications-email | `[PD]` | Compose UI advertises push no web user receives. Lean: descope. |
| Q2 (notifs) | Authoritative prod email provider + bounce/complaint webhooks? | notifications-email | `[PD]`/`[NC]` | BR-55/56 auto-suppression can't fire without it. |
| DEC-COMMS-01 | Canonical delivery primitive: announcement vs message | communications | `[PD]` | Both ship full send/schedule. Recommend announcement. `[DO NOT OVERBUILD]` |
| G-06 | Advertising/vendor verification authority: platform vs association admin | marketplace-advertising | `[PD]` | Wrong trust boundary if shipped. |
| Q-PD6 | Gateway-API refund for V1, or ledger-only for pilot? | dues-payments | `[PD]` | Refunds ledger-only — no real money movement. |
| ~~Q-PD7~~ | First-invoice trigger: event consumer vs widen generator | dues-payments | ✅ **RESOLVED (Step 45)** → (a) event consumer on `membership.created`. | Closed — fix-report §D. |
| ~~Q-PD8~~ | Member self-serve "Pay Now" in V1, or emailed links? | dues-payments | ✅ **RESOLVED (Step 45)** → (a) self-serve Pay Now; emailed links = V2. | Closed — fix-report §D. |
| PD-2 | Are DMs org-scoped or cross-org? | realtime-comms | `[PD]` | Strictness of DM read-filter. |
| PD-3 | Is video calling in V1 scope at all? | realtime-comms | `[PD]` | `joinVideoCall` 404s by construction. Recommend gate behind flag. |
| PD-1 (surveys) | Shipped NPS engine vs officer-survey distribution (m18) = V1? | surveys-polls | `[PD]` | Determines if targeting/discovery/notify are V1-blocking. |
| PD-2 (surveys) | `hasRole('admin')` = platform vs org admin in survey handlers? | surveys-polls | `[PD]` | Platform admin must not deanonymize responses. |
| PD-3 (surveys) | Member-discovery: pending rows on publish vs direct query | surveys-polls | `[PD]` | Officer-published surveys never surface until decided. |
| P-5 | Tier policy for 7 ungated platform-admin mutations | cross-cutting | `[PD]` | Blanket super-gate could break support/analyst flows. |
| TC-DEC-03 | Canonical PH required-credits default: 45 vs 60 | training-credits | `[NC]` | FIX-006 makes config authoritative; seeded literal must be correct. |
| TC-DEC-04 | Should `completeCustomTraining` bulk-award present enrollees? | training-credits | `[PD]` | Adjacent op awards no credit. |
| jobs-D2 | Listing-expiry policy | jobs | `[NC]` | P3 polish only. |

### P2 / P3 — resolve opportunistically

| Module | P2/P3 decision IDs |
| --- | --- |
| billing-stripe | DEC-BILL-01..08, CONF-BILL-01/02, ENV-BILL-01 |
| dues-payments | Q-PD1/2/3/5, Q-NC2/3, sendPaymentLink, royalty, receiptPDF |
| person-profile | Q-2/3/5/6/7, G-10 |
| documents-credentials | Q4/5/6/7, Q-FIX013 |
| communications | DEC-COMMS-02/03/04/06/07 |
| marketplace-advertising | G-13, FIX-007-strict, Q-PILOT, Q-LISTING-DEFAULT, Q-OFFICER-REVIEWS-ROUTE |
| auth-rbac | DEC-IMPERSONATION, DEC-403-AUDIT, FIX-008, DEC-COMMITTEE-GUARD |
| surveys-polls | PD-4/5/6/7 |
| elections-governance | tie-handling in certify, cancelled-election vote retention (feeds FIX-004) |
| membership-lifecycle | ML-APP-NO-ACCOUNT (P2), ML-TIER-CODE-UNIQUE (P3) |
| notifications-email | Q4/Q5 |
| platform-admin | Q5/Q6/Q7 |
| training-credits | TC-DEC-05 (P2 transcript export format) |

---

## 14. Environment / Tooling Blockers

| Blocker | Label | Affected | Impact | Next Step |
| --- | --- | --- | --- | --- |
| Full Playwright UI-driven E2E fails at UI-signup `beforeAll` | `[BLOCKED BY ENVIRONMENT]` | all UI modules | Browser-level proofs flaky (training Batch E proof did run) | Stabilize signup fixture or seed-based auth |
| stripe-mock not wired into CI | `[BLOCKED BY ENVIRONMENT]` | billing-stripe, dues-payments | Gateway-path proofs can't run green in CI | Wire stripe-mock into CI compose |
| `drizzle-kit generate` exits 127 | `[BLOCKED BY ENVIRONMENT]` | all schema work | Migration generation friction (0065/0066/0068 hand-authored; migrations run on boot) | Repair drizzle-kit invocation |
| Production email provider unconfirmed | `[BLOCKED BY ENVIRONMENT]` `[NC]` | notifications-email | Bounce/complaint webhook can't be built | Resolve Q2 → signed webhook |
| OneSignal web-push not provisioned | `[BLOCKED BY ENVIRONMENT]` `[PD]` | notifications-email | Push-channel send/verify impossible on web | Resolve Q1 (descope vs wire) |
| Live WS stack for chat E2E | `[BLOCKED BY ENVIRONMENT]` | realtime-comms | CF-3 ws:true outage can't be browser-proven | Live dev run at realtime Batch B |
| Live load/perf harness absent | `[BLOCKED BY ENVIRONMENT]` | platform-wide | No perf regression coverage | V2 |
| Pre-existing baseline red: `registerEmailJobs` interval test (30000 vs 1000) | `[NC]` | notifications-email (test only) | 1 known `bun test` failure, **not introduced by audit** | Informational; fix opportunistically |

**Known-good baselines (post Step 26/27 + membership E2/F/C, 2026-06-12):** `bun test` (api-ts) = **6030 pass / 1 fail (pre-existing, unrelated) / 4 todo**; full monorepo `tsc` = **0 errors** (5/5 workspaces); F-2 route-integrity **12/12**; Hurl = **152/155** (3 pre-existing flakies); `check:sdk-compat` **exits 1 by design** (deleteMembership/deleteMembershipApplication removed per Track B #6 + Step 26 + pre-existing path drift). Real-PG integration tests (`approvalRollback`, `trainingEnrollDedup`, `resignedAtBackfill`) GREEN against local Postgres. **Do NOT `--update` `docs/quality/SDK_BASELINE_OPS.json` until milestone Step 6.** Docker up (postgres+mailpit+minio+stripe-mock); DB migrated through **0068** + seeded.

---

## 15. Shared / Cross-Module Risks

| Risk | Affected | Evidence | Why It Matters | Handling |
| --- | --- | --- | --- | --- |
| ✅ Membership ↔ Dues seam: approval sets `pendingPayment`, generator filters `active` only | dues-payments, membership-lifecycle | `approveMembershipApplication.ts`; `core/domain-event-consumers.ts` (membership.created → mint first invoice) | join→pay→active funnel **CLOSED (Step 45)** | `[CROSS-MODULE RISK]` resolved — Q-PD7 (a) event consumer; status transition unchanged (read-only on memberships). |
| `association:admin` grant blast radius | dues, billing, marketplace, all `/association` mutations | `middleware/auth.ts` | Broadly-granted role → financial mutation surface (FIX-004 closed the position-gates) | `[SHARED DEPENDENCY]` — trace grant site (Q-NC1) |
| Notification preference split-brain | notifications, person, communication | `notification_preference` vs `person_subscriptions` | Decorative toggles; divergent vocab | `[CROSS-MODULE RISK]` — resolve Q3 (notifs) |
| `createDefaultChannels` trigger absent | realtime-comms, association:member | `default-channels.ts` (0 callers) | No org provisioned with channels | `[CROSS-MODULE RISK]` — CF-2 / PD-1 |
| Committee guard `requireCommitteeRole()` in matrix §3.28 but absent in src | auth-rbac, committee-management | grep finds only `committee_member` schema refs | Matrix documents a guard that doesn't exist | `[NC]` — committee-management audit (§9) |
| person.deleted cascade fire-and-forget, no completion guarantee | person + 9+ subscriber modules | R-4 / P-8 | Partial-deletion risk under failure | `[SHARED DEPENDENCY]` — V2 core-platform |
| Membership delete-op removal (Step 26 + Track B #6) | membership, any caller of removed ops | Step 26 grep-proof; `check:sdk-compat` intentional breaking | Ops removed from SDK; downstream callers must use terminal states | Closed — no callers existed (grep-proven); SDK baseline `--update` deferred to Step 6 |

---

## 16. V2 Deferred Items

| Item | Source | Why Deferred |
| --- | --- | --- |
| Domain-event bus retry / aggregation / delivery-guarantee layer (P-8) | cross-cutting | No repeated V1 failure justifies the abstraction yet |
| person.deleted cascade completion-guarantee rearchitecture (R-4) | schema / person-profile | High blast radius; V1 fire-and-forget acceptable for pilot |
| Membership `expelled_at` + expulsion lifecycle | membership-lifecycle / schema (R-5 rest) | Track B #4 — confirmed V2 at ratification (2026-06-13); will NOT reopen for the pilot |
| Member self-resign route/UI | membership-lifecycle | Track B #2 — officer-recorded only in V1 |
| EXPIRED state + lapse→expired job | membership-lifecycle | Track B #3 — dropped from V1 vocabulary |
| Elections WF-078 Yes/No/Abstain ballot redesign; voter-anonymization at rest | elections-governance | Approximation works; needs WF-078 semantics |
| Training full pay-and-enroll path (`registerAndPayForTraining`) | training-credits | Pending TC-DEC-01 |
| Realtime full video-call productization | realtime-comms | V1 = gate panel behind `comms_video_calls` flag |
| Professional feed ranking/moderation (BR-35) | communications | Blocked on missing m13 spec |
| Admin support-inbox / pricing / subscription UIs (if Q4 defers) | platform-admin | 3-person ops runs via API/seed today |
| BR-34 per-org minimum-tenure config | elections-governance | `[BLOCKED BY MISSING SPEC]` |

---

## 17. Do Not Build / Avoid Overengineering

| Item | Source | Reason |
| --- | --- | --- |
| Wiring BOTH announcement and message delivery primitives | communications (DEC-COMMS-01) | Doubles surface, no single source of truth |
| Centralizing `assert-record-org.ts` into shared core before ≥3 consumers (P-7) | cross-cutting | Premature platform abstraction |
| Seeding more roles to "fix" G3 | auth-rbac | Masks the production role-provisioning gap |
| New `GET /verify/:token` route invented before Q1 decision | documents-credentials | Would freeze an unstable URL contract |
| Inventing `requireCommitteeRole()` to match matrix §3.28 | auth-rbac | Fabricating a guard; confirm the real one instead |
| Re-adding membership `delete*` officer ops removed in Step 26 / Track B #6 | membership-lifecycle | Hard-delete destroys financial-linked + audit records; terminal states only |
| Full enterprise RBAC matrix / per-resource ACLs | platform-admin | Beyond V1; tier model sufficient once Q1 resolves |
| Speculative analytics warehousing / national-dashboard rearchitecture | national-dashboard | `[INFERRED]` data sources unverified |
| Broad member mega-module split now | member-mega-module | ADR-0010 chose rebuild-over-split; SPLIT-PLAN stale |
| Load/perf harness build-out | platform-wide | No V1 driver; env-blocked anyway |

---

## 18. Roadmap Decision

**`BLOCKED BY PRODUCT DECISION`**

- The **decision-free fix track is exhausted.** Every module's decision-free batches have executed (§5): membership A/B/C/E2/F, training A/B/C/D/E + Steps 26/27, jobs B, marketplace B/C/D, person C (both slices), dues settle-seam, plus the decision-free P1 batches in communications, documents, notifications, platform-admin, realtime, elections, billing. The only strictly decision-free items left are low-value tail polish (auth FIX-010, jobs-D2, platform F-2/F-4) not worth a pass ahead of the gate.
- **Track B (membership E2 ratification) is RESOLVED** — explicitly ratified by the user 2026-06-13, all five decisions as-is, no build reopened (§13). It is no longer a gate.
- **All remaining non-deferred work is product-decision-gated** (§13): the 3 standing P0s (elections G2, documents Q1, realtime PD-1), and the P1 cluster.
- **Engineering cannot safely proceed** without these decisions — starting them risks freezing wrong contracts (governance position identity, printed-URL format, channel model) that are costly to reverse once the pilot accrues data.
- No new audits required; no new `05`/`06` runs.

**Net:** halt for the user on the §13 product-decision agenda, now led by the 3 standing P0s (Track B closed). Do NOT auto-decide.

---

## 19. Recommended Immediate Next Step

```txt
HALT FOR THE USER — product decisions required. Do NOT auto-decide; do NOT start a fix or audit.

✅ Track B (Membership E2 state-machine ratification) — RESOLVED 2026-06-13.
   All five decisions (TB-1…TB-5) explicitly ratified as-is by the user; no build reopened.
   See §13 + membership-lifecycle-fix-report.md §"Step 44". No longer a gate.

Primary gate (answer first) — the 3 standing P0 product decisions
(each unblocks a gated 04 pass — §8 order):
  1. elections G2 / FIX-002  — position-identity model (governance FK vs jsonb slots)
  2. documents Q1            — card-verify token/URL contract
  3. realtime PD-1           — channel-membership model

Then the P1 cluster (§13): training TC-DEC-01/02, ~~person Q-1/Q-4~~ (DECIDED Step 46 — Q-4 shipped, G-02 → chapters-directory `04`), notifications Q3/Q2,
  platform-admin Q1/Q2/Q3, dues Q-PD6/7/8, marketplace G-06, surveys PD-1/2/3.

After decisions land, re-run docs/aha/prompts/07-consolidate-roadmap.md to re-sequence
  the now-unblocked gated 04 passes, before milestone Step 6 (SDK baseline --update + commit/PR).
```

**Next AHA action:** none automatic — **halt for the user** on the 3 standing P0 product
decisions above (Track B now closed). No decision-free `04` work remains to run. Re-run `07`
once decisions are answered.
