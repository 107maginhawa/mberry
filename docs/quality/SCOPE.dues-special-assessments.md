# Dues + Special-Assessments — Scope (decomposition step 3)

**Date:** 2026-06-07
**Branch baseline:** `feature/member-rebuild` @ `5c2d0eb6` (post-credits cutover + § 7 close-out)
**Sub-domain:** dues + special-assessments (fused, per `REMAINING_SCOPE.md` §5.3)
**Target tag:** `Member/DuesSpecialAssessments`
**Tag-on-completion:** `member-dues-cutover` (special-assessments folded under same tag — keeps tag namespace tidy)
**Classification:** FULL migration, single-namespace retag, **biggest cutover to date** — 9 interfaces, ~52 handlers, 4 hand-wired holdouts (relocate not kill), zero hand-wired duplicates. Schemas + repos stay at OLD canonical path (`handlers/dues/repos/` + `handlers/association:member/repos/`).

---

## §1 — Why this isn't a vanilla R-pattern

The R-series (chapters → directory) and credits cutover both used per-interface retag with cross-namespace wrinkles. Dues differs on four axes:

1. **Single-namespace, biggest surface.** All 9 interfaces source from one TypeSpec namespace pair (`Association.Member.Dues.*` + `Association.Member.SpecialAssessments.*`), both files under `specs/api/src/association/member/`. No cross-namespace fold-ins (unlike credits, which pulled 6 from `Operations.Training`). The retag is per-interface but scoped to a narrow main.tsp window (lines 302–340).

2. **Hand-wired holdouts ride along — and there are FOUR of them.** Credits had 2 (`getCreditTranscript` + `Pdf`); dues has 4 by-design hand-wired routes that must move with their handlers:
   - `downloadReceipt` (Cycle-8, post-auth) — `app.ts:96, 498-499`
   - `stripeWebhookHandler` (by-design pre-auth, RFC-required) — `app.ts:100, 397`
   - `validatePaymentToken` (public payment token, pre-auth) — `app.ts:113, 393`
   - `checkoutPaymentToken` (public payment token, pre-auth) — `app.ts:114, 394`
   None duplicates a generated route. All STAY hand-wired; only their import paths rewrite.

3. **Two repo dirs, both canonical.** Per the existing `app.ts:482-486` `HANDLER CONSOLIDATION STATUS` comment, schemas live in two places already:
   - `handlers/dues/repos/dues.schema.ts` + `dues-payments.schema.ts` + `payment-token.schema.ts` — canonical "dues/" namespace, predates the member rebuild
   - `handlers/association:member/repos/dunning.{repo,schema}.ts` + `special-assessments.{repo,schema}.ts` + `dues-payment-status-history.schema.ts` — canonical association-side
   - `handlers/association:member/repos/dues.{repo,schema}.ts` + `dues-payments.{repo,schema}.ts` — 3-LOC re-export shims pointing at `handlers/dues/repos/` (3 shim files exist for backwards-compat with seed imports)

   **Decision (per credits §10.B precedent):** leave ALL schemas + repos at their OLD path. The two repo dirs (`handlers/dues/repos/` and `handlers/association:member/repos/`) both stay. Handlers cross-import via current paths. The 3 shim files stay too (harmless re-exports; future cleanup wave can collapse them). This minimizes seed/test ripple and matches the cert+credits precedent.

4. **Infrastructure dep: stripe-mock.** Unlike cert (MinIO) and credits (nothing), dues requires `docker compose up -d stripe-mock` (port 12111) for any payment-related Hurl scenarios that exercise the Stripe webhook or gateway connection path. Pre-flight confirms env + container.

The good news: **no hand-wired duplicates** (cert had cert-verify, credits had void-event — dues has none), **no shim-at-destination** (just the 3 existing shims at `association:member/repos/` which stay), **no cross-namespace retag risk** (single tsp source per interface). The bad news: bigger surface, more hand-wired holdouts to relocate, stripe-mock infra dep.

---

## §2 — TypeSpec interfaces (9, source: 2 files)

### §2.A `Association.Member.Dues.*` (8 interfaces)

Source: `specs/api/src/association/member/dues.tsp`. Wrapped in `main.tsp:302-332`:

```tsp
// main.tsp:302-332 — to be retagged
@tag("Association:Member")
@route("/association/member/dues-configs")
interface AssocDuesConfigManagement extends Association.Member.Dues.DuesConfigManagement {}

@tag("Association:Member")
@route("/association/member/dues-invoices")
interface AssocDuesInvoiceManagement extends Association.Member.Dues.DuesInvoiceManagement {}

@tag("Association:Member")
@route("/association/member/aging-buckets")
interface AssocAgingBucketService extends Association.Member.Dues.AgingBucketService {}

@tag("Association:Member")
@route("/association/member/dunning")
interface AssocDunningManagement extends Association.Member.Dues.DunningManagement {}

@tag("Association:Member")
@route("/association/member/dues-payments")
interface AssocDuesPaymentManagement extends Association.Member.Dues.DuesPaymentManagement {}

@tag("Association:Member")
@route("/association/member/dues-payments")
interface AssocDuesPaymentProofManagement extends Association.Member.Dues.DuesPaymentProofManagement {}

@tag("Association:Member")
@route("/association/member/dues-gateway")
interface AssocDuesGatewayManagement extends Association.Member.Dues.DuesGatewayManagement {}

@tag("Association:Member")
@route("/association/member/dues-reporting")
interface AssocDuesReportingService extends Association.Member.Dues.DuesReportingService {}
```

### §2.B `Association.Member.SpecialAssessments.*` (1 interface)

Source: `specs/api/src/association/member/special-assessments.tsp`. Wrapped in `main.tsp:338-340`:

```tsp
@tag("Association:Member")
@route("/association/member/special-assessments")
interface AssocSpecialAssessmentManagement extends Association.Member.SpecialAssessments.SpecialAssessmentManagement {}
```

Generated route count: ~34 across these 9 interfaces (verified at Cr.1 pre-flight).

Retag plan (per-interface): all 9 `@tag("Association:Member")` → `@tag("Member/DuesSpecialAssessments")`. Sibling interfaces in the same main.tsp window (credits at 281-296 already retagged; chapters at 346-360 use `Member/Chapters`; governance at 366+ uses `Member/Governance`) stay untouched. Per-interface edits, NOT bulk find/replace.

### §2.C OUT OF SCOPE (don't touch in this cutover)

| Interface / handler | Tag | Reason for exclusion |
| --- | --- | --- |
| Any `Person.*` self-pay surface (if present) | `Person` | Person-namespaced; stays in Person domain decomposition. Verify at §5.E. |
| `billing/` module (Stripe Connect, payouts) | `Billing` | Separate domain (platform billing), not dues. |
| `handlers/membership/repos/dues.repo.ts` (legacy, **already removed** per app.ts:484 comment) | n/a | Deleted in Wave 4; zero consumers confirmed. |

---

## §3 — Hand-wired holdouts (`services/api-ts/src/app.ts`)

### §3.A Stay hand-wired but relocate imports (4)

| Line | Handler | Current import path | Post-cutover path | Reason |
| --- | --- | --- | --- | --- |
| `app.ts:96` + `498-499` | `downloadReceipt` | `@/handlers/dues/downloadReceipt` | `@/handlers/member/dues-special-assessments/downloadReceipt` | Cycle-8 hand-wired; receipt PDF download, not in TypeSpec. |
| `app.ts:100` + `397` | `stripeWebhookHandler` | `@/handlers/dues/stripeWebhook` | `@/handlers/member/dues-special-assessments/stripeWebhook` | Pre-auth by design; Stripe signature verification + webhook retry log. |
| `app.ts:113` + `393` | `validatePaymentToken` | `@/handlers/dues/validatePaymentToken` | `@/handlers/member/dues-special-assessments/validatePaymentToken` | Public one-tap payment token validation (pre-auth). |
| `app.ts:114` + `394` | `checkoutPaymentToken` | `@/handlers/dues/checkoutPaymentToken` | `@/handlers/member/dues-special-assessments/checkoutPaymentToken` | Public one-tap payment token checkout (pre-auth). |

All 4 stay hand-wired (by-design middleware ordering); only imports rewrite. Pre-flight (§5.B) confirms no @extension migration is desirable (e.g. Stripe webhook signature check can't be expressed as TypeSpec middleware).

### §3.B Untouched (NOT part of dues domain)

| Line | Handler | Reason |
| --- | --- | --- |
| `app.ts:98, 503` | `downloadDocument` | Documents domain (oli-J-ORG-001), not dues. |
| `app.ts:417-422` `ASSOCIATION_PUBLIC_PATHS` | n/a | Public path list for credentials/ethics/directory — no dues entries. |

---

## §4 — Decisions baked in (no further checkpoint needed for these)

### §4.1 Single-tag fusion: dues + special-assessments share `Member/DuesSpecialAssessments`

**Decision:** all 9 interfaces (8 dues + 1 SA) carry `@tag("Member/DuesSpecialAssessments")`. Tag name `member-dues-cutover` for git tag (SA fold-in implicit per `REMAINING_SCOPE.md` §5.3).

**Why:**
- Special-assessments is one interface (`AssocSpecialAssessmentManagement`) over ~8 handlers.
- Schema cross-coupling: `special_assessment_target.invoice_id` FKs `dues_invoice`; `special_assessment.fund_id` FKs `dues_fund`. Splitting tags would create false-domain separation.
- `REMAINING_SCOPE.md` §5.3 + §1.E both call for fusion.

### §4.2 Schemas + repos STAY at OLD path (credits §10.B precedent)

**Decision:** all schema + repo files remain where they are.

| Current path | Status | Reason |
| --- | --- | --- |
| `handlers/dues/repos/dues.schema.ts` | STAY (canonical) | Single-domain, heavy seed-layer consumer. |
| `handlers/dues/repos/dues-payments.schema.ts` | STAY (canonical) | Single-domain, consumed by seed + tests. |
| `handlers/dues/repos/payment-token.schema.ts` | STAY (canonical) | Unique to dues, no overlap. |
| `handlers/association:member/repos/dunning.{repo,schema}.ts` | STAY (canonical) | Single-domain (dunning templates + events). |
| `handlers/association:member/repos/special-assessments.{repo,schema}.ts` | STAY (canonical) | Single-domain (cross-FKs to dues_invoice/dues_fund). |
| `handlers/association:member/repos/dues-payment-status-history.schema.ts` | STAY (canonical) | Single-domain audit trail. |
| `handlers/association:member/repos/dues.{schema,repo}.ts` (3-LOC re-export shims) | STAY (shim) | Harmless re-exports of `handlers/dues/repos/`; deletable in future cleanup wave when seed imports rewrite to canonical. |
| `handlers/association:member/repos/dues-payments.{schema,repo}.ts` (re-export shims) | STAY (shim) | Same — backwards-compat shim. |

**Why:**
- Cert + credits precedent: moving schemas with handlers thrashes seed/test imports unnecessarily.
- Three of the eight schema files are already in a dedicated `handlers/dues/repos/` namespace — moving them again creates a third location.
- Cross-FK coupling between dues_invoice ↔ special_assessment_target ↔ dunning_event makes a single move target dangerous.
- Handlers cross-import via current paths after relocation — no functional change.

### §4.3 Handler structure: subdirectories under new path

**Decision:** group ~52 handlers under `handlers/member/dues-special-assessments/` with these subdirs:

```
handlers/member/dues-special-assessments/
├── *.ts                    (~32 dues + payment + receipt + dunning + aging handlers)
├── stripeWebhook.ts        (hand-wired)
├── validatePaymentToken.ts (hand-wired)
├── checkoutPaymentToken.ts (hand-wired)
├── downloadReceipt.ts      (hand-wired)
├── special-assessments/    (~6 SA handlers — sub-subdir for clarity)
│   ├── createSpecialAssessment.ts
│   ├── listSpecialAssessments.ts
│   ├── getSpecialAssessmentCollection.ts
│   ├── updateSpecialAssessment.ts
│   ├── deleteSpecialAssessment.ts
│   └── applySpecialAssessment.ts
└── utils/                  (payment-token, settle-payment utilities)
    ├── payment-token.ts
    └── settle-payment.ts
```

Subdir choice for `special-assessments/` mirrors how schemas are split. Pre-flight (§5.C) confirms file count + boundary.

### §4.4 Zero hand-wired duplicates

**Decision:** no kill action needed. Cert had `cert-verify`, credits had `void-event` — dues has clean separation between generated routes (`registerOpenAPIRoutes` at `app.ts:464`) and hand-wired holdouts (lines 391-499). Pre-flight (§5.A) confirms.

### §4.5 Stripe webhook stays hand-wired

**Decision:** do NOT migrate `stripeWebhookHandler` to a TypeSpec route with @extension middleware.

**Why:**
- Webhook signature verification (Stripe `webhook_secret`) runs BEFORE body parsing, which doesn't compose with the standard zod-validator chain.
- `webhook_retry_log` idempotency check is handler-internal.
- Pre-auth by design (Stripe sends unauthenticated POSTs).
- Same status as `email/unsubscribe` (RFC 8058) — public-pre-auth holdouts intentional.

---

## §5 — Pre-flight verifications needed (5 items)

### §5.A Route-order check (zero hand-wired duplicates expected)

```sh
# Confirm no app.ts registration shadows a generated route path.
grep -nE "app\\.(get|post|put|patch|delete)\\('/association/member/(dues|aging|dunning|special-assessments|invoices|payments)" services/api-ts/src/app.ts services/api-ts/src/generated/openapi/routes.ts | head -40
```

Expected: hits only in `routes.ts` (generated). Zero hand-wired duplicates of any `/association/member/*` dues path. If a duplicate surfaces, §4.4 amends to add a kill step.

### §5.B Stripe-mock + env probe

```sh
# Confirm stripe-mock container can boot
docker compose up -d stripe-mock 2>&1 | tail -5
docker ps | grep stripe-mock

# Confirm env-var consumers
grep -rn 'STRIPE_MOCK_URL\\|STRIPE_SECRET\\|STRIPE_WEBHOOK_SECRET' services/api-ts/src/ --include='*.ts' | head -20
```

Expected: container healthy on port 12111. Env consumers concentrated in `handlers/dues/stripeWebhook.ts`, gateway-test handlers, and `core/config.ts`. Document any missing env var.

### §5.C Handler file count + boundary check

```sh
# Total file count under association:member/ matching dues/payment/invoice/assessment/dunning/aging/gateway
find services/api-ts/src/handlers/association:member -maxdepth 2 -type f -name '*.ts' -not -name '*.test.ts' \\
  | xargs grep -lE '^(import|export).*(dues|invoice|payment|assessment|dunning|aging|gateway)' 2>/dev/null \\
  | wc -l

# Also probe handlers/dues/ subdir
ls services/api-ts/src/handlers/dues/ 2>/dev/null
```

Expected: ~52 files at `association:member/` + a handful at `handlers/dues/` (the 4 hand-wired holdouts). Confirm exact list for Cr.3 restore.

### §5.D UUID column gotchas

```sh
# Probe all uuid() columns vs varchar() PK/FK columns in dues + SA schemas
grep -nE "uuid\\(|varchar\\(|unique\\(|uniqueIndex" \\
  services/api-ts/src/handlers/dues/repos/dues.schema.ts \\
  services/api-ts/src/handlers/dues/repos/dues-payments.schema.ts \\
  services/api-ts/src/handlers/dues/repos/payment-token.schema.ts \\
  services/api-ts/src/handlers/association:member/repos/special-assessments.schema.ts \\
  services/api-ts/src/handlers/association:member/repos/dunning.schema.ts \\
  services/api-ts/src/handlers/association:member/repos/dues-payment-status-history.schema.ts \\
  2>/dev/null | head -80
```

**Known gotchas to document** (from inventory):
- `dues_payment.invoice_id` is `varchar`, NOT `uuid()` — legacy from dues_invoice using varchar PKs. Hurl scenarios use real invoice numbers, not random UUIDs.
- `dues_payment.receipt_number` has unique constraint `dues_payment_receipt_unique` — Hurl per-suffix randomization.
- `webhook_retry_log.idempotency_key` (VARCHAR 255) is unique — Stripe webhook event-ID. Hurl scenarios that POST `/webhooks/stripe` need fresh event IDs per run.
- `aging_bucket`, `dues_invoice`, `dunning_event`, `dunning_template` have all-varchar PKs (legacy pre-uuid). FK refs to `persons.id` (uuid) need careful Hurl seeding.
- `special_assessment_target` has composite index on `(assessment_id, person_id)` — NOT unique, but conflict on re-runs creates stale targets. Use fresh assessment per `{{suffix}}`.

### §5.E `Person.*` self-pay surface scan

```sh
# Confirm no Person.* operation under dues namespace that would need OUT-OF-SCOPE handling
grep -rn 'extends Association.Member.Dues\\|extends Association.Member.SpecialAssessments' \\
  specs/api/src/ --include='*.tsp' | grep -v 'main.tsp' | head
```

Expected: zero. All 9 extend wrappers live in `main.tsp:302-340`. Person handlers may consume `dues.repo` for self-views but expose no TypeSpec route under the dues namespace.

---

## §6 — Execution sequence

10 atomic steps. typecheck after each. Commit after each.

### Step Cr.1 — Pre-flight verifications (§5.A through §5.E)

Findings appended to §10. Commit: `docs(member-dues): SCOPE §10 — Cr.1 pre-flight findings`.

### Step Cr.2 — Retag main.tsp (per-interface) + regenerate

```sh
# Edit specs/api/src/main.tsp lines 302-340:
#   9 @tag("Association:Member") annotations → @tag("Member/DuesSpecialAssessments")
#   per-interface, NOT bulk find/replace
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate
```

Verify no sibling interface (credits 281-296, chapters 346-360, governance 366+) retagged.

### Step Cr.3 — Restore canonical handler files at new path

```sh
mkdir -p services/api-ts/src/handlers/member/dues-special-assessments/{special-assessments,utils}

# Generated handlers from association:member/ → restore at new path
# (exact list compiled at Cr.1 §5.C; baseline source is 5c2d0eb6)
# ~32 dues/payment/invoice handlers + 8 SA handlers + 2 utils + ~8 dunning/aging handlers
git show 5c2d0eb6:services/api-ts/src/handlers/association:member/<file>.ts \
  > services/api-ts/src/handlers/member/dues-special-assessments/<file>.ts

# Hand-wired holdouts from handlers/dues/ → restore at new path
for f in stripeWebhook validatePaymentToken checkoutPaymentToken downloadReceipt; do
  git show 5c2d0eb6:services/api-ts/src/handlers/dues/$f.ts \
    > services/api-ts/src/handlers/member/dues-special-assessments/$f.ts
done
```

### Step Cr.4 — Move utils + service helpers

```sh
git mv services/api-ts/src/handlers/dues/utils/payment-token.ts \
       services/api-ts/src/handlers/member/dues-special-assessments/utils/
git mv services/api-ts/src/handlers/dues/utils/settle-payment.ts \
       services/api-ts/src/handlers/member/dues-special-assessments/utils/
# Tests for these utils, if standalone, move with them
```

Schema + repo files NOT moved (per §4.2).

### Step Cr.5 — Delete moved originals

```sh
# Delete the ~52 handler files at old paths (NOT repos/, NOT schema files)
# Compiled list from Cr.1 §5.C
for f in <list-from-section-5C>; do
  git rm services/api-ts/src/handlers/association:member/$f.ts
  git rm services/api-ts/src/handlers/association:member/$f.test.ts 2>/dev/null || true
done
for f in stripeWebhook validatePaymentToken checkoutPaymentToken downloadReceipt; do
  git rm services/api-ts/src/handlers/dues/$f.ts
done
```

### Step Cr.6 — Rewrite cross-module imports

Hot spots:
- `services/api-ts/src/app.ts:96, 100, 113, 114` — hand-wired import paths → `@/handlers/member/dues-special-assessments/...`
- `services/api-ts/src/generated/openapi/registry.ts` — auto-regenerated by Cr.2 (no manual edit)
- Cross-module: `core/domain-event-consumers.ts`, `core/jobs/`, `seed/layer-*.ts`, `test-utils/`, person/, billing/ — grep all imports of dues handlers (NOT repos — those stay)

Verify with:
```sh
grep -rn '@/handlers/(association:member|dues)/(stripeWebhook|validatePaymentToken|checkoutPaymentToken|downloadReceipt|<all-dues-handler-names>)' \
  services/api-ts/src/ --include='*.ts'
```
Expected: zero hits after Cr.5 + Cr.6. `repos/dues*` / `repos/dunning*` / `repos/special-assessments*` import paths intentionally stay (per §4.2).

### Step Cr.7 — No-op (no hand-wired duplicates per §4.4)

Cr.7 reserved per cert/credits template numbering. If §5.A surfaces an unexpected duplicate, kill here.

### Step Cr.8 — typecheck gate

```sh
bun run --filter '*' typecheck
```
Must be 5/5.

### Step Cr.9 — Hurl scenarios

Current baseline: 10 contract files (per Explore §7):
- `assoc-dues-configs-flow.hurl`, `assoc-dues-gateway-flow.hurl`, `assoc-dues-invoices-flow.hurl`,
- `assoc-dues-payments-flow.hurl`, `assoc-dues-reporting-flow.hurl`, `assoc-dunning-flow.hurl`,
- `assoc-aging-buckets-flow.hurl`, `dues-dashboard-flow.hurl`, `dues-extended-flow.hurl`, `dues-flow.hurl`

Extend with **≥ 3 new files** under `specs/api/tests/contract/member/dues-special-assessments/`:

1. `special-assessments-create-apply.hurl` — officer creates SA → applies to target persons → SA appears in their invoices. Idempotency: fresh assessment per `{{suffix}}`.
2. `payment-token-validate-checkout.hurl` — generate one-tap link → validate token (public) → checkout token (public) → payment recorded. Idempotency: fresh token per `{{suffix}}`.
3. `dues-stripe-webhook.hurl` — POST `/webhooks/stripe` with valid signature + idempotency key → `webhook_retry_log` entry created → payment status updated. Requires stripe-mock running.

Optional 4th + 5th: `dues-gateway-test-connection.hurl`, `dues-payment-proof-confirm.hurl`.

**Prereqs (carry-forward):**
- CSRF + Origin auto-injected; do not double-add.
- Seed officer `test@memberry.ph` = President.
- `docker compose up -d stripe-mock` before running Stripe scenarios.
- `invoice_id` is varchar — use real seeded invoice numbers, not `{{newUuid}}`.
- `receipt_number` unique — randomize per `{{suffix}}`.
- `webhook_retry_log.idempotency_key` unique — fresh Stripe event-id per run.

### Step Cr.10 — `MODULE_SPEC.member.dues-special-assessments.md` + gates + tag

Mirror credits MODULE_SPEC 7-section layout. Run all gates:

```sh
bun run --filter '*' typecheck                          # 5/5
cd services/api-ts && bun test                          # ≥ post-credits baseline (5918+)
API_URL=http://localhost:7213 bun run scripts/run-contract-tests.ts  # ≥ 138 + new dues
bun run scripts/check-sdk-compat.ts                     # 0 drift / 454 ops
bun run scripts/audit-observability.ts                  # ≥ 94 %
bun run scripts/contract-coverage-gap.ts                # ≥ 82 %
git tag -a member-dues-cutover -m "Dues + special-assessments sub-domain cut over to handlers/member/dues-special-assessments/"
```

Tag at cutover-observability-refresh commit (cert + credits convention). Post-tag hygiene commits (supplemental hurl, MODULE_SPEC close-out) untagged.

---

## §7 — Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Bulk @tag find/replace catches sibling chapters/governance interfaces | high if attempted, low with per-interface edits | §6 Cr.2 mandates per-interface edits; pre-step diff review before regen. |
| Stripe-mock not running → webhook hurl scenarios 500 | high without prep, zero with docker-compose | §5.B + Cr.9 prereq line both call out `docker compose up -d stripe-mock`. |
| Seed-layer breakage on schema path changes | n/a — schemas stay at OLD path | §4.2 + §10.B (deferred) confirm no seed-import rewrite needed. |
| `invoice_id` varchar mismatch on Hurl scenarios using `{{newUuid}}` | medium — silent FK miss returns 404 not 500 | §5.D + Cr.9 prereqs call out varchar + real seeded invoice numbers. |
| `webhook_retry_log` unique-idempotency hit on Hurl re-run | medium | Per-`{{suffix}}` Stripe event-id; documented in Cr.9. |
| `dues_payment_receipt_unique` constraint hit | medium | Per-`{{suffix}}` receipt-number randomization. |
| Stripe webhook handler self-imports cross-domain (`handlers/dues/` → `handlers/billing/`?) | low — needs Cr.1 verification | §5.B grep + Cr.6 grep should surface any orphan cross-module imports. |
| 4 hand-wired holdouts compile but break at runtime due to missed import rewrite | medium | §6 Cr.6 grep verification + smoke-test webhook + payment-token routes before final typecheck. |
| domain-event-consumers.ts hooks for `person.deleted` cascade dues cleanup | medium — silent runtime failure | Cr.1 §5.E + Cr.6 grep both probe `core/domain-event-consumers.ts`; restore + path-rewrite mechanical. |
| Payment-token cross-imports between hand-wired holdout + `utils/payment-token.ts` | low | Both move together in Cr.4; utils path stays sibling. |
| Larger surface (~52 handlers) → typecheck runs longer + more error sites at intermediate commits | medium | Atomic cutover (Cr.2-Cr.7 bundled) minimizes intermediate breakage. |

---

## §8 — Gates (post-credits floor, raised by credits cutover)

| Gate | Floor |
| --- | --- |
| typecheck | 5/5 |
| unit | ≥ 5918 pass, 1 pre-existing env-flake accepted (post-credits baseline) |
| contract | ≥ 138 / 138 + new dues-SA scenarios (credits cutover lifted floor to 138) |
| SDK drift | 0 / 454 |
| observability | ≥ 94 % |
| contract coverage | ≥ 82 % |

---

## §9 — Awaiting checkpoint

Three explicit user sign-offs before Step Cr.1 begins:

1. **Scope** — 9 interfaces as listed in §2.A + §2.B. Out-of-scope per §2.C confirmed. Person.*, billing/, deleted `membership/repos/dues.repo.ts` stay untouched.

2. **Decisions** — §4.1 (single tag `Member/DuesSpecialAssessments`), §4.2 (schemas + repos STAY at OLD canonical paths in `handlers/dues/repos/` + `handlers/association:member/repos/`; 3 shim files left in place), §4.3 (handler subdir structure with `special-assessments/` sub-subdir + `utils/`), §4.4 (no kill step expected; Cr.7 no-op), §4.5 (Stripe webhook stays hand-wired pre-auth). Any objection or amendment?

3. **Sequence** — §6's 10-step atomic execution with per-step typecheck + commit. Tag `member-dues-cutover` only on the cutover atomic; post-tag hygiene commits stay untagged (cert + credits pattern).

---

## §10 — Cr.1 pre-flight findings (resolved)

### §10.A — Route order (zero hand-wired duplicates of generated routes)

Hand-wired registrations in `app.ts`:
- `app.ts:393` `GET /pay/:token/validate` → `validatePaymentToken`
- `app.ts:394` `POST /pay/:token/checkout` → `checkoutPaymentToken`
- `app.ts:397` `POST /webhooks/stripe` → `stripeWebhookHandler`
- `app.ts:499` `GET /org/:organizationId/payments/:paymentId/receipt` → `downloadReceipt`

Generated `/association/member/*` dues routes in `routes.ts`:
- aging-buckets (2), dues-configs (5), dues-gateway (4), dues-invoices (7), dues-member-summary/metrics (2), dues-payments (8), dues-reporting (4), dunning (7), special-assessments (≥ 1) — total ≥ 40 routes across the 9 interfaces.

**Verdict:** zero hand-wired duplicates of any `/association/member/*` generated path. §4.4 (no kill step) holds. The 4 hand-wired holdouts have no generated equivalent — §3.A relocation is the only action.

### §10.B — Stripe-mock + env

- `docker-compose.yml` declares `stripe-mock` service, image `stripe/stripe-mock:latest`, container `memberry-stripe-mock`, port `12111` (env-overridable via `STRIPE_MOCK_PORT`).
- `core/config.ts:187-188` declares `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` as optional env vars.
- `handlers/dues/` contains 19 .ts files: 4 hand-wired holdouts (stripeWebhook, validate/checkoutPaymentToken, downloadReceipt), 4 dashboard/metrics/summary handlers (`getDuesDashboard`, `getDuesMemberSummary`, `getDuesMetrics`, `sendPaymentLink`), 5 jobs (`autoInvoiceGenerator`, `index`, `processStripePayment`, `reminderProcessor`, `webhookRetryProcessor`), 1 util (`payment-token.ts`), 5 schema/repo files (`dues.schema`, `dues-payments.{schema,repo}`, `payment-token.{schema,repo}`).

**Verdict:** stripe-mock infra confirmed. Cr.9 prereq `docker compose up -d stripe-mock` documented.

### §10.C — Handler file inventory (corrected; initial Explore probe was wrong)

The Cr.1 Explore probe's grep-on-imports filter returned 0 for Bucket A — direct `ls` confirms the actual numbers:

**Bucket A — `handlers/association:member/` top-level (47 source + 25 test files):**

47 source handlers covering: createDuesConfig, createDuesInvoice, createDunningTemplate, createSpecialAssessment, deleteDuesConfig, deleteDuesInvoice, deleteDunningTemplate, deleteSpecialAssessment, disconnectDuesGateway, applySpecialAssessment, confirmPaymentProof, generateDuesInvoicesForOrg, generateDuesReport, generatePaymentLink, generatePaymentReceipt, getAgingBucket, getDuesConfig, getDuesFinancialDashboard, getDuesGatewayConfig, getDuesInvoice, getDuesPayment, getDunningTemplate, getSpecialAssessmentCollection, handlePaymentWebhook, initiateOnlinePayment, listDuesConfigs, listDuesFunds, listDuesInvoices, listDuesPayments, listDunningEvents, listDunningTemplates, listSpecialAssessments, markDuesInvoicePaid, recalculateAgingBucket, recordDuesPayment, refundDuesPayment, rejectPaymentProof, runDunning, submitPaymentProof, testDuesGatewayConnection, updateDuesConfig, updateDuesInvoice, updateDunningTemplate, updateSpecialAssessment, upsertDuesFunds, upsertDuesGatewayConfig, validatePaymentLink.

Plus 25 colocated test files (mix of per-handler `*.test.ts` and themed suites: `dues.test.ts`, `dues-config.test.ts`, `dues-mutation-auth.test.ts`, `dunning.test.ts`, `dunning-escalation.test.ts`).

**Bucket B — `handlers/dues/` (19 files, mix of move + dedupe):**

| File | Status | Action |
| --- | --- | --- |
| `stripeWebhook.ts` | hand-wired live | MOVE |
| `validatePaymentToken.ts` | hand-wired live | MOVE |
| `checkoutPaymentToken.ts` | hand-wired live | MOVE |
| `downloadReceipt.ts` | hand-wired live | MOVE |
| `getDuesDashboard.ts`, `getDuesMemberSummary.ts`, `getDuesMetrics.ts`, `sendPaymentLink.ts` | generated-route live | MOVE |
| `utils/payment-token.ts` | live | MOVE |
| `jobs/autoInvoiceGenerator.ts` | live (registered via `association:member/jobs/index.ts:13` indirectly? — verify at Cr.2) | MOVE |
| `jobs/processStripePayment.ts` | live (imported by `stripeWebhook.ts:12` AND `association:member/jobs/index.ts:13`) | MOVE |
| `jobs/reminderProcessor.ts` | **DEAD DUPLICATE** of `association:member/jobs/reminderProcessor.ts` (identical 242 LOC) | DELETE |
| `jobs/webhookRetryProcessor.ts` | **DEAD DUPLICATE** of `association:member/jobs/webhookRetryProcessor.ts` (identical) | DELETE |
| `jobs/index.ts` | **DEAD** (not loaded — live registrar is `association:member/jobs/index.ts` per `app.ts:43`) | DELETE |
| `repos/dues.schema.ts`, `repos/dues-payments.{repo,schema}.ts`, `repos/payment-token.{repo,schema}.ts` | canonical schema/repo | STAY (per §4.2) |

**Bucket C — `handlers/association:member/jobs/` (mixed dues + membership):**

| File | Domain | Action |
| --- | --- | --- |
| `reminderProcessor.ts` (live, registered via `app.ts:43 → registerDuesJobs`) | dues | MOVE |
| `webhookRetryProcessor.ts` (live) | dues | MOVE |
| `index.ts` (exports `registerDuesJobs` + `registerStatusRecomputeJob`) | mixed | SPLIT — extract `registerDuesJobs` to new path; keep `registerStatusRecomputeJob` exporter at old path (membership decomposition handles it). |
| `statusRecomputeCron.ts` | **membership** (BR-01 safety net per file header) | STAY |
| Other jobs files (`creditIssue`, `complianceThreshold`, `directoryAutoPopulate`) | non-dues | STAY |

**Bucket D — colocated tests:** 25 test files at `association:member/` top level matching dues patterns; move with their handlers.

**Total cutover surface:** ~47 source handlers + 25 tests at `association:member/` (move) + 8 source handlers + utilities at `handlers/dues/` (move) + 2 source jobs at `association:member/jobs/` (move) + 3 dead duplicate files at `handlers/dues/jobs/` (delete) = ~85 file operations.

### §10.D — UUID + unique-constraint catalog (top-5 Hurl gotchas)

Confirmed from schema reads:

| Table | PK type | Unique constraints | Hurl gotcha |
| --- | --- | --- | --- |
| `dues_org_config` | uuid | `dues_config_org_unique(organization_id)` | One config per org. |
| `dues_payment` | uuid (PK) + **invoice_id varchar(255)** (FK) | `dues_payment_receipt_unique(receipt_number)` | **#1**: receipt_number is global-unique — per-`{{suffix}}` randomization required. |
| `dues_gateway_config` | uuid | `dues_gateway_org_unique(organization_id)` | One gateway per org. |
| `payment_token` | uuid | unique on `token_hash` (HMAC-SHA256) | **#2**: single-use tokens — fresh per scenario. |
| `webhook_retry_log` | uuid | `webhook_retry_idempotency_unique(idempotency_key)` (varchar 255) | **#3**: Stripe event-id global-unique — fresh per Hurl run. |
| `special_assessment` | uuid | — (cascade delete via `fund_id` FK to `dues_fund`) | **#4**: deleting a `dues_fund` cascades. |
| `aging_bucket` | **varchar + date composite PK** | — | **#5**: NOT uuid; SELECT requires exact PK shape + date casts. |
| `dunning_template` | uuid (PK) + **organization_id varchar(255)** | — | **#5b**: varchar org FK; Hurl needs raw org-id strings, not `{{newUuid}}` org binds. |
| `dunning_event` | uuid (PK) + **membership_id, person_id, template_id all varchar(255)** | — | **#5c**: heavy varchar FK surface. |

**Top-5 Hurl gotchas (for Cr.9 authoring):**
1. `dues_payment.receipt_number` global-unique — per-`{{suffix}}` randomization.
2. `payment_token.token_hash` single-use unique — fresh token per scenario.
3. `webhook_retry_log.idempotency_key` unique — fresh Stripe event-id per Hurl run.
4. `special_assessment.fund_id` cascade — don't delete shared fund mid-scenario.
5. Composite-varchar PKs on aging_bucket + dunning_* — use seeded values, not `{{newUuid}}`.

### §10.E — Person.* + domain-event-consumers cross-imports

**Person.* TypeSpec surface:** zero `extends Association.Member.Dues.*` / `extends Association.Member.SpecialAssessments.*` in `person*.tsp` files. §2.C confirmed.

**`core/domain-event-consumers.ts`:**
- Line 43: imports `dunningEvents` from `@/handlers/association:member/repos/dunning.schema` (REPO — stays per §4.2)
- Line 46: imports `duesPayments` from `@/handlers/association:member/repos/dues-payments.schema` (REPO shim — stays per §4.2; shim re-exports from `handlers/dues/repos/`)
- Line 76: `domainEvents.on('dues.payment.recorded', ...)` → updates `membership.duesExpiryDate`
- Line 116: `domainEvents.on('dues.payment.refunded', ...)` → sends refund notification
- Line 141: `domainEvents.on('dues.invoice.generated', ...)` → sends invoice notification

All three hooks consume REPOS at old paths — no handler imports — **zero path-rewrite required** in `domain-event-consumers.ts`.

**`person/` handlers:** zero imports of dues handlers (clean boundary).

**`seed/` imports of dues HANDLERS (not repos):** zero hits in the cross-handler grep. (Seed-layer repo imports stay per §4.2.)

**Cr.6 import-rewrite scope (corrected):**
- `app.ts:43` — `registerDuesJobs` from `@/handlers/association:member/jobs` → `@/handlers/member/dues-special-assessments/jobs`
- `app.ts:96, 100, 113-114` — 4 hand-wired imports rewrite (already in §3.A)
- `services/api-ts/src/generated/openapi/registry.ts` — auto-regenerated at Cr.2
- One internal cross-import inside the moved set: `generateDuesInvoicesForOrg.ts:11` imports `./jobs/reminderProcessor` — both move together, stays as relative `./`.

**Total external rewrite cost: 5 import lines in app.ts + registry auto-regen. Very small.**

### Final verdict

| Question | Answer | Notes |
| --- | --- | --- |
| Cr.2 retag safe? | **YES** | Per-interface edits on main.tsp:302-340 only. Sibling tags (credits 281-296, chapters 346-360, governance 366+) untouched. |
| Cr.3 restore file list complete? | **YES** | 47 + 25 + 8 + 2 = ~82 files in scope; 3 dead duplicates to delete (not restore). |
| Cr.6 rewrite scope manageable? | **YES** | 5 import-line edits in app.ts; zero in seed/, domain-events, person/. |
| Cr.9 hurl gotchas documented? | **YES** | 5 documented (receipt unique, token hash, Stripe idempotency, fund cascade, varchar composite PKs). |
| Any §4 decisions need amendment? | **YES — minor** | §4.3 handler structure amends to include `jobs/` subdir; new §4.6 added for dead-duplicate kills. |

**Blockers: 0. Amendments below.**

---

## §11 — Net §4/§6 amendments (post-Cr.1)

### §11.A New §4.6 — Dead-duplicate kill list (added)

Three files at `handlers/dues/jobs/` are dead duplicates (identical to live counterparts at `handlers/association:member/jobs/`):

1. `handlers/dues/jobs/reminderProcessor.ts` (242 LOC, identical to `association:member/jobs/reminderProcessor.ts`)
2. `handlers/dues/jobs/webhookRetryProcessor.ts` (identical to `association:member/jobs/webhookRetryProcessor.ts`)
3. `handlers/dues/jobs/index.ts` (dead registrar — live registrar is `association:member/jobs/index.ts` per `app.ts:43`)

**Decision:** delete all three at Cr.5 (cutover atomic). Move the LIVE counterparts (at `association:member/jobs/`) to new path. No functional change (Hono job scheduler dedupes by job-id anyway).

### §11.B Amend §4.3 — handler subdir structure

Add `jobs/` subdir to the new path:

```
handlers/member/dues-special-assessments/
├── *.ts                           (47 dues + payment + receipt + dunning + aging handlers)
├── stripeWebhook.ts               (hand-wired)
├── validatePaymentToken.ts        (hand-wired)
├── checkoutPaymentToken.ts        (hand-wired)
├── downloadReceipt.ts             (hand-wired)
├── getDuesDashboard.ts            (from handlers/dues/)
├── getDuesMemberSummary.ts        (from handlers/dues/)
├── getDuesMetrics.ts              (from handlers/dues/)
├── sendPaymentLink.ts             (from handlers/dues/)
├── jobs/
│   ├── index.ts                   (registerDuesJobs only; statusRecomputeCron stays at OLD path)
│   ├── reminderProcessor.ts       (from association:member/jobs/, NOT the duplicate at handlers/dues/jobs/)
│   ├── webhookRetryProcessor.ts   (from association:member/jobs/)
│   ├── autoInvoiceGenerator.ts    (from handlers/dues/jobs/)
│   └── processStripePayment.ts    (from handlers/dues/jobs/)
└── utils/
    └── payment-token.ts
```

(SA handlers do NOT subdirectory under `special-assessments/` after pre-flight — only 6 files, sibling layout reads cleaner. Amend §4.3 to drop the SA sub-subdir.)

### §11.C Amend §6 Cr.3 + Cr.4 + Cr.5

**Cr.3 (restore at new path) — concrete file list:**
- 47 source handlers + 25 tests from `handlers/association:member/` (matching dues domain — full list in §10.C Bucket A)
- 4 hand-wired + 4 dashboard handlers + 1 util from `handlers/dues/`
- 2 live jobs from `handlers/association:member/jobs/` (`reminderProcessor.ts`, `webhookRetryProcessor.ts`) — NOT their dead duplicates at `handlers/dues/jobs/`
- 2 dues-only jobs from `handlers/dues/jobs/` (`autoInvoiceGenerator.ts`, `processStripePayment.ts`)
- Split `handlers/association:member/jobs/index.ts`: extract `registerDuesJobs` to new path; rewrite OLD index to export only `registerStatusRecomputeJob`

**Cr.4 — `git mv` utils + tests:**
- `handlers/dues/utils/payment-token.ts` → new path
- Move colocated `*.test.ts` files alongside their handlers (preserve git history)

**Cr.5 — delete originals + dead duplicates:**
- ~47 source + 25 tests at `handlers/association:member/` (after Cr.3 copies to new path)
- 4 hand-wired + 4 dashboard at `handlers/dues/` (after Cr.3 copies)
- 2 dues jobs at `handlers/dues/jobs/` (`autoInvoiceGenerator`, `processStripePayment`)
- 2 dead duplicates: `handlers/dues/jobs/reminderProcessor.ts`, `handlers/dues/jobs/webhookRetryProcessor.ts`
- 1 dead registrar: `handlers/dues/jobs/index.ts`
- 2 live jobs at `handlers/association:member/jobs/` (after Cr.3 copies)
- DO NOT delete `handlers/association:member/jobs/statusRecomputeCron.ts` (membership domain)

### §11.D Amend §6 Cr.6 — import-rewrite grep updated

```sh
grep -rn '@/handlers/\(association:member\|dues\)/\(stripeWebhook\|validatePaymentToken\|checkoutPaymentToken\|downloadReceipt\|getDuesDashboard\|getDuesMemberSummary\|getDuesMetrics\|sendPaymentLink\|jobs/\(reminderProcessor\|webhookRetryProcessor\|autoInvoiceGenerator\|processStripePayment\|index\)\|<full-handler-list-from-§10C>\)' services/api-ts/src/ --include='*.ts'
```

Plus the specific `app.ts:43` rewrite (registerDuesJobs path).

Expected post-Cr.6: zero hits. `repos/` paths, `domain-event-consumers.ts:43,46`, and `statusRecomputeCron` import path intentionally untouched.

### §11.E Cr.7 reserved (no-op for dues — but used for jobs/index split)

Cr.7 numbering retained per template. Action: split `association:member/jobs/index.ts` — leave `registerStatusRecomputeJob` exporter at OLD path, move `registerDuesJobs` exporter to new path. (This can also be done inside the Cr.2-Cr.7 atomic.)

### §11.F Stripe-mock prereq locked

Cr.9 must `docker compose up -d stripe-mock` BEFORE running Hurl scenarios that hit `/webhooks/stripe`. Document in scenario header.

---

**Cr.1 closed. Cr.2 (per-interface main.tsp retag + regen) is next.**

On user confirmation of §9 checkpoint (scope + decisions + sequence) AND §10/§11 findings: proceed to Step Cr.2.
