# MODULE_SPEC: member/duesspecialassessments

Third sub-domain of the mega-module decomposition's post-R4 phase,
cut over directly after member/credits. Largest single cutover to
date — 14 TypeSpec interfaces (across two namespaces + two
@tag groups), ~50 generated operations, ~85 file ops. Single-namespace
retag for the in-scope tag set (`Member/DuesSpecialAssessments`),
zero hand-wired duplicates remaining at completion (3 killed: the
2 payment-token endpoints + 1 receipt-download were generator
duplicates exposed once the additional `@tag("Dues")` interfaces
were folded in at Cr.2).

## 1. Purpose

Owns the dues + special-assessments financial surface of an
association: per-org dues config, invoice generation, payment
recording (including officer manual record + member self-submit
proof + officer confirm/reject), refund flow, dunning template +
event lifecycle, aging-bucket reporting, gateway connection test,
treasurer dashboard + per-member summary, and one-time special
assessment lifecycle with apply-to-targets + collection metrics.
Fourteen TypeSpec interfaces, ~50 generated operations, plus 1
hand-wired pre-auth route (Stripe webhook by design).

- **Dues Config + Funds** — `createDuesConfig`, `getDuesConfig`,
  `listDuesConfigs`, `updateDuesConfig`, `deleteDuesConfig`,
  `upsertDuesFunds`, `listDuesFunds`.
- **Invoice Lifecycle** — `createDuesInvoice`, `listDuesInvoices`,
  `getDuesInvoice`, `updateDuesInvoice`, `deleteDuesInvoice`,
  `markDuesInvoicePaid`, `generateDuesInvoicesForOrg`.
- **Payment + Proof** — `recordDuesPayment`, `listDuesPayments`,
  `getDuesPayment`, `submitPaymentProof`, `listPendingProofs`,
  `confirmPaymentProof`, `rejectPaymentProof`, `refundDuesPayment`.
- **Aging + Reporting** — `getAgingBucket`, `recalculateAgingBucket`,
  `generateDuesReport`, `getDuesFinancialDashboard`.
- **Gateway** — `getDuesGatewayConfig`, `upsertDuesGatewayConfig`,
  `disconnectDuesGateway`, `testDuesGatewayConnection`.
- **Dunning** — `createDunningTemplate`, `getDunningTemplate`,
  `listDunningTemplates`, `updateDunningTemplate`,
  `deleteDunningTemplate`, `listDunningEvents`, `runDunning`.
- **Special Assessments** — `createSpecialAssessment`,
  `listSpecialAssessments`, `getSpecialAssessmentCollection`,
  `updateSpecialAssessment`, `deleteSpecialAssessment`,
  `applySpecialAssessment`.
- **Treasurer / Dashboard / Member-facing** —
  `getDuesDashboard`, `getDuesMetrics`, `getDuesMemberSummary`.
- **One-tap payment** — `sendPaymentLink` (officer mints),
  `validatePaymentToken` (public), `checkoutPaymentToken` (public),
  `downloadReceipt` (member-facing HTML receipt).

Plus, by design hand-wired (kept, relocated, NOT in scope-set
above):
- **Stripe webhook** (`POST /webhooks/stripe`) —
  `stripeWebhookHandler` (handlers/dues/stripeWebhook.ts moved
  to new path). Pre-auth by design (Stripe sends unauthenticated
  POSTs); signature verification runs BEFORE body parsing, which
  doesn't compose with the standard zod-validator chain. The
  `billing.tsp` namespace declares a duplicate generated route
  `handleStripeWebhook` under `@tag("Billing")` — pre-existing
  cross-domain tech debt, separate from this cutover.

## 2. Bounded Context

In scope (cut over by `c74084e7`):
- The 9 TypeSpec interfaces wired in `main.tsp:302-340` under
  `@tag("Member/DuesSpecialAssessments")` (8 from
  `Association.Member.Dues.*`, 1 from
  `Association.Member.SpecialAssessments.*`):
  - `AssocDuesConfigManagement`
  - `AssocDuesInvoiceManagement`
  - `AssocAgingBucketService`
  - `AssocDunningManagement`
  - `AssocDuesPaymentManagement`
  - `AssocDuesPaymentProofManagement`
  - `AssocDuesGatewayManagement`
  - `AssocDuesReportingService`
  - `AssocSpecialAssessmentManagement`
- The 5 TypeSpec interfaces wired in `main.tsp:664-677` under
  `@tag("Member/DuesSpecialAssessments")` (all from
  `DuesCustomModule.*`):
  - `DuesCustomManagement` (`getDuesDashboard`)
  - `DuesMetricsManagement` (`getDuesMetrics`, `getDuesMemberSummary`)
  - `PaymentTokenEndpoints` (`validatePaymentToken`,
    `checkoutPaymentToken`)
  - `PaymentLinkManagement` (`sendPaymentLink`)
  - `ReceiptEndpoints` (`downloadReceipt`)
- ~50 generated routes (one per operation).
- 1 hand-wired Stripe webhook route at `app.ts:391` (relocated;
  still registered, import path rewritten).
- 5 untyped helper handlers used by colocated tests only
  (`generatePaymentLink`, `generatePaymentReceipt`,
  `handlePaymentWebhook`, `initiateOnlinePayment`,
  `validatePaymentLink`) — moved alongside their tests.
- 3 jobs (`reminderProcessor`, `webhookRetryProcessor`,
  `processStripePayment`) — moved; their canonical registrar
  (`registerDuesJobs` at `association:member/jobs/index.ts`)
  stays at the OLD path with rewritten imports (the registrar
  also wires non-dues credit/compliance jobs — splitting it would
  break those).
- 1 util (`utils/payment-token.ts`, HMAC-based) — moved.

Out of scope (intentionally untouched):
- `repos/dues.{schema}.ts` + `repos/dues-payments.{repo,schema}.ts`
  + `repos/payment-token.{repo,schema}.ts` — canonical at
  `handlers/dues/repos/` per the existing `app.ts:482-486`
  HANDLER CONSOLIDATION STATUS comment; stay there.
- `repos/dunning.{repo,schema}.ts` + `repos/special-assessments.{repo,schema}.ts`
  + `repos/dues-payment-status-history.schema.ts` — canonical at
  `handlers/association:member/repos/`; stay there.
- 3 re-export shims at `handlers/association:member/repos/dues.*`
  + `dues-payments.*` (3-LOC aliases) — kept for seed-import
  backwards-compat; deletable in a future cleanup wave when
  seed-layer imports rewrite to canonical.
- 7 shared utils at `handlers/association:member/utils/`
  (`dunning-escalation`, `membership-lifecycle`, `paymongo.adapter`,
  `receipt-number`, `status-transitions`, `settle-payment`,
  `payment-token`) — shared with membership/credentials/governance
  domains. Imports rewritten to absolute `@/handlers/association:member/utils/`.
- `statusRecomputeCron.ts` at `association:member/jobs/` — BR-01
  membership safety net, not dues. Stays for membership cutover.
- `billing.tsp` interface owning `POST /webhooks/stripe` under
  `@tag("Billing")` — pre-existing cross-domain TypeSpec
  duplicate; orthogonal to this cutover.

Adjacent modules and the seams between them:

| Adjacent module | Seam |
| --- | --- |
| `core/domain-event-consumers.ts` | 3 dues hooks: `dues.payment.recorded` (updates `membership.duesExpiryDate`), `dues.payment.refunded` (sends notification), `dues.invoice.generated` (sends notification). Consumers import REPOS at OLD paths (lines 43, 46) — zero rewrite required at Cr.6. |
| `association:member/jobs/index.ts` | `registerDuesJobs` stays at OLD path. After Cr.7 split, it imports `processDuesReminders`, `processWebhookRetry`, `createProcessPayment` from `@/handlers/member/duesspecialassessments/jobs/`. The non-dues `registerStatusRecomputeJob` + credit/compliance/cert delayed-job registrations stay in the same file (single registrar consumed by `app.ts:43`). |
| `seed/layer-{4,5,6,7}-*.ts` | Seed paths import `duesInvoices`, `duesPayments`, `duesFunds`, `duesOrgConfigs`, `duesFundAllocations`, `duesReminderSchedules`, `duesGatewayConfigs`, `duesPaymentStatusHistory` from the unchanged schema at OLD path (via `association:member/repos/` shims). Zero rewrite at Cr.6. |
| `handlers/person/*` | Person handlers do not import dues handlers (clean module boundary). |
| `handlers/billing/*` | Billing's Stripe Connect flow is orthogonal. Pre-existing duplicate `/webhooks/stripe` generated route under `@tag("Billing")` is dead code post-cutover (hand-wired registration at `app.ts:391` wins per Hono first-wins). |
| `core/audit/audit-action` | Per-route audit middleware via `@extension("x-audit", ...)`. `downloadReceipt` declares an audit extension. Officer-side write operations rely on TypeSpec-injected audit middleware. |

## 3. Files (post-cutover, baseline `c74084e7`)

`services/api-ts/src/handlers/member/duesspecialassessments/`:

| Category | Count | Notes |
| --- | --- | --- |
| Generated handlers | 50 | Routed via main.tsp:302-340 (45) + main.tsp:664-677 (5: `getDuesDashboard`, `getDuesMetrics`, `getDuesMemberSummary`, `validatePaymentToken`, `checkoutPaymentToken`, `downloadReceipt`, `sendPaymentLink`). Includes the freshly-generated `listPendingProofs.ts` (no pre-cutover counterpart). |
| Untyped helpers (test-only consumers) | 5 | `generatePaymentLink`, `generatePaymentReceipt`, `handlePaymentWebhook`, `initiateOnlinePayment`, `validatePaymentLink`. Marked test-helper; not registered. |
| Hand-wired (Stripe webhook) | 1 | `stripeWebhook.ts` — pre-auth. Imports `./jobs/webhookRetryProcessor` + `./jobs/processStripePayment` (now siblings). |
| Tests | 32 | 25 from `association:member/` + 7 from `handlers/dues/`. Includes themed suites (`dues.test.ts`, `dues-config.test.ts`, `dues-config-handlers.test.ts`, `dues-mutation-auth.test.ts`, `dunning.test.ts`, `dunning-escalation.test.ts`, `stripeWebhook.test.ts`, `stripeWebhook.integration.test.ts`) and per-handler `*.test.ts`. |
| `jobs/` | 3 | `reminderProcessor.ts` + `webhookRetryProcessor.ts` (the LIVE versions previously at `association:member/jobs/`; identical 242-LOC dead duplicates at `handlers/dues/jobs/` were deleted). `processStripePayment.ts` from `handlers/dues/jobs/`. |
| `utils/` | 1 | `payment-token.ts` (HMAC-based token, used by sendPaymentLink + validatePaymentToken + checkoutPaymentToken). |

Schema/repo files at OLD canonical paths (unchanged):

| File | Path |
| --- | --- |
| `dues.schema.ts` | `handlers/dues/repos/` |
| `dues-payments.{repo,schema}.ts` | `handlers/dues/repos/` |
| `payment-token.{repo,schema}.ts` | `handlers/dues/repos/` |
| `dunning.{repo,schema}.ts` | `handlers/association:member/repos/` |
| `special-assessments.{repo,schema}.ts` | `handlers/association:member/repos/` |
| `dues-payment-status-history.schema.ts` | `handlers/association:member/repos/` |
| `dues.{repo,schema}.ts`, `dues-payments.{repo,schema}.ts` (re-export shims) | `handlers/association:member/repos/` |

## 4. Contract test layout

Pre-existing dues contract suite (10 files at
`specs/api/tests/contract/`) untouched:
- `assoc-dues-configs-flow.hurl`, `assoc-dues-gateway-flow.hurl`,
  `assoc-dues-invoices-flow.hurl`, `assoc-dues-payments-flow.hurl`,
  `assoc-dues-reporting-flow.hurl`, `assoc-dunning-flow.hurl`,
  `assoc-aging-buckets-flow.hurl`, `dues-dashboard-flow.hurl`,
  `dues-extended-flow.hurl`, `dues-flow.hurl`.

Three new contract scenarios at
`specs/api/tests/contract/member/dues-special-assessments/`:

| File | Operation IDs covered | Notes |
| --- | --- | --- |
| `special-assessments-create-apply.hurl` | `createSpecialAssessment`, `applySpecialAssessment`, `getSpecialAssessmentCollection` | Officer creates one-time SA → applies to self → fetches collection metrics. Per-`{{suffix}}` SA name. Note: `applySpecialAssessment` handler returns `{message, invoicesCreated, skipped}` — drift from TypeSpec's declared `ApplySpecialAssessmentResult { assessment, invoicesGenerated }`. Test asserts handler reality; drift documented under §7 follow-ups. |
| `payment-token-validate.hurl` | `validatePaymentToken` | Public path; probes invalid-token branch. Per-`{{suffix}}` token. |
| `dues-stripe-webhook.hurl` | hand-wired `POST /webhooks/stripe` | Synthetic Stripe signature must fail verification → 400. Asserts route is registered + accepts documented signature shape (`t=<ts>,v1=<hex>`) + enforces signature verification. Success-path coverage lives in `stripeWebhook.integration.test.ts`. |

Contract suite total: 141 files (was 138 at baseline) → 100%
pass at `c74084e7`-derived post-tag commit.

## 5. Decisions resolved during the cutover

| Decision | Outcome |
| --- | --- |
| Tag fusion (dues + special-assessments) | Single `@tag("Member/DuesSpecialAssessments")`. Single git tag `member-dues-cutover`. |
| Initial scope missed 5 `@tag("Dues")` interfaces | Discovered at Cr.2 regen (only 43 of expected 50 stubs emitted). Retagged in-place; second regen emitted the remaining 7 stubs. SCOPE doc § 11 amendment noted. |
| Hand-wired payment-token + receipt routes | KILLED at Cr.6. Initial SCOPE classified them as holdouts; turned out they ARE in TypeSpec (`PaymentTokenEndpoints`, `ReceiptEndpoints` under the missed `@tag("Dues")` group). 3 hand-wired registrations deleted at `app.ts:393, 394, 499`; generated routes serve the paths with correct auth semantics. |
| Hand-wired Stripe webhook | STAYS hand-wired (pre-auth by design). billing.tsp owns a TypeSpec duplicate (`handleStripeWebhook` under `@tag("Billing")`) — pre-existing tech debt; hand-wired registration at `app.ts:391` wins per Hono first-wins. |
| Schemas + repos relocation | STAY at OLD canonical paths (`handlers/dues/repos/` + `handlers/association:member/repos/`). Cert + credits precedent. Cross-handler imports rewritten to absolute `@/handlers/.../repos/` paths. |
| Job duplicates at `handlers/dues/jobs/` | KILLED 3 dead files (identical 242-LOC `reminderProcessor.ts` + `webhookRetryProcessor.ts` + dead registrar `index.ts`). Live registrar at `association:member/jobs/index.ts` rewritten to import from new path. |
| `autoInvoiceGenerator.ts` at `handlers/dues/jobs/` | DELETED — fully dead code (only referenced from dead `dues/jobs/index.ts`). |
| `statusRecomputeCron.ts` at `association:member/jobs/` | STAYS — membership domain (BR-01 safety net), not dues. Membership cutover handles it. |
| Two distinct `payment-token.ts` utils | Both kept. `handlers/dues/utils/payment-token.ts` (HMAC token) moved with the main payment flow. `handlers/association:member/utils/payment-token.ts` (legacy invoice/orgId encoder) stays — used only by legacy untyped helpers `generatePaymentLink` + `validatePaymentLink` whose imports were rewired explicitly. |
| `dues-config.test.ts` collision | Renamed `handlers/dues/dues-config.test.ts` → `dues-config-handlers.test.ts` at new path; `handlers/association:member/dues-config.test.ts` kept its name (different BR-02 schema-validation surface). |

## 6. Gates posture at cutover commit `c74084e7`

| Gate | Floor | Result |
| --- | --- | --- |
| typecheck | 5/5 | 5/5 ✓ |
| unit | ≥ 5797 pass + 1 pre-existing env-flake | 5797 / 5911 ✓ (delta from 5918 baseline = 7 deleted dead-duplicate test files at `handlers/dues/jobs/utils/`) |
| contract | ≥ 138 / 138 | 141 / 141 ✓ (3 new scenarios added) |
| SDK drift | 0 / 454 | 0 / 454 ✓ |
| observability | ≥ 94 % | 94 % ✓ (marginal — 257/274 full-coverage) |
| contract coverage | ≥ 82 % | 83 % ✓ |

## 7. Open follow-ups

| Item | Notes |
| --- | --- |
| `applySpecialAssessment` handler/spec drift | Handler returns `{message, invoicesCreated, skipped}`; TypeSpec declares `ApplySpecialAssessmentResult { assessment, invoicesGenerated }`. Hurl scenario asserts handler reality. Pick a winning shape and either fix handler or amend TypeSpec — separate ticket. |
| Hand-wired Stripe webhook vs billing.tsp `handleStripeWebhook` | Cross-domain TypeSpec duplicate. Dues hand-wired wins (Hono first-wins). Decide whether to drop the billing.tsp interface or retire the hand-wired holdout (would require lifting signature verification into a TypeSpec middleware extension). |
| 3 re-export shims at `association:member/repos/dues.*` + `dues-payments.*` | Deletable cleanup wave when seed imports rewrite to `@/handlers/dues/repos/` canonical paths. |
| Hybrid utils at `association:member/utils/` | 7 shared utils stay coupled across membership/credits/dues/governance. Tech debt for future per-domain util split. |
| Contract coverage of `Member/DuesSpecialAssessments` | 32% covered (16/50 ops). Highest opportunity for future Hurl additions: dues-config CRUD, gateway-test, dunning template lifecycle, payment refund + reject flows. |
| `Association:Member` legacy tag coverage at 8% | Remaining 37 uncovered ops belong to the unmigrated membership / credentials / governance domains — handled by their respective cutovers. |
| Observability margin (94 % floor met by 0 %) | 17 partial-coverage handlers at risk of dragging score below floor in future churn. Triage. |
