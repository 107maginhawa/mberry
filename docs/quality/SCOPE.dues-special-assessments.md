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

## §10 — Cr.1 pre-flight findings (pending)

To be appended after §5.A–§5.E run during Cr.1.

---

## §11 — Net §4/§6 amendments (post-Cr.1)

To be appended after Cr.1 findings resolve.

On confirmation: proceed to Step Cr.1 (pre-flight §5.A through §5.E).
