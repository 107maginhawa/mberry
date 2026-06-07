# R0 Parity Baseline — association:member Mega-Module Rebuild

**Captured**: 2026-06-07
**Branch**: `feature/codebase-hardening`
**HEAD (pre-tag)**: `fd8c171b` (Step 5 close — observability full-field 0% → 94%)
**Pending tag**: `pre-rebuild-member` (applied after R0.5)

## Pre-flight reconciliation (R0.1)

TypeSpec ↔ schema mismatch resolved by **deleting four orphan TypeSpec files**
that produced zero routes and had zero handler/SDK consumer references:

| File deleted | Reason |
|---|---|
| `specs/api/src/association/member/awards.tsp` | Defined 26 `@route` decorators but main.tsp never `extends` the Awards namespace — produced 0 operationIds in `openapi.json` |
| `specs/api/src/association/member/certification.tsp` | Same — 24 `@route` decorators, namespace not extended, 0 ops |
| `specs/api/src/association/member/ethics.tsp` | Same — 18 `@route` decorators, namespace not extended, 0 ops |
| `specs/api/src/association/member/fundraising.tsp` | Same — 34 `@route` decorators, namespace not extended, 0 ops |

Side effect: stale orphan-domain types (`AwardProgram`, `EthicsComplaint`,
`FundraisingCampaignType`, `DisciplinaryAction*` etc.) in
`packages/sdk-ts/src/generated/types.gen.ts` will be removed on next SDK
regeneration. Apps/handler grep showed **zero application-code imports** of
these types — safe to drop.

**Kept (no action):**

- `certificates.tsp` — 4 active routes wired to handlers (`bulkIssueCertificates`,
  `getCertificate`, `listMyCertificates`, `verifyCertificatePublic`). Schema lives
  in `credentials.schema.ts` — naming-only mismatch, not a structural one.
- 5 schema-only files (`dues-payments`, `dues-payment-status-history`, `dunning`,
  `institutional-membership`, `status-history`) — tables referenced inside
  `dues.tsp` / `membership.tsp`. Naming mismatch only.
- `handlers/association:member/createDisciplinaryAction.ts` + its M4-R4 test
  block in `officer-admin.test.ts` — handler is **tested business logic** for
  immutable-disciplinary-action with mandatory-reason invariant. Currently
  unrouted at the HTTP layer (orphan); will be added to `governance.tsp`
  during R2 (governance cutover).

## Registry rebuild (R0.2)

- `cd specs/api && bun run build` — exit 0 (821 pre-existing deprecation warnings)
- `cd services/api-ts && bun run generate` — exit 0
  - Validators regenerated
  - Routes regenerated
  - 0 new handler stubs, 454 existing handlers skipped (unchanged)
  - WebSocket registry regenerated

**Post-rebuild OpenAPI baseline:**

- Total operationIds: **454** (unchanged from pre-deletion — confirms orphans contributed nothing)
- Total schemas: **905**
- Orphan-domain schemas: **0** (cleaned)

## Parity baseline (R0.3)

### Typecheck

`bun run --filter '*' typecheck` — **exit 0 across all 5 workspaces**

- @monobase/ui
- admin
- @monobase/sdk-ts
- @monobase/api-ts
- memberry

### Unit tests (api-ts)

`cd services/api-ts && bun test`

| Bucket | Count |
|---|---|
| pass | **5918** |
| skip | 93 |
| todo | 20 |
| **fail** | **1** |
| **total** | **6032** |
| expect() calls | 12231 |
| duration | 19.23s |

**Pre-existing failure (not net-new from R0 changes):**
- `registerEmailJobs > registers email.processor as interval job` — already on
  scorecard open-defects list; carried as-is.

### Contract tests (Hurl)

`bun run scripts/run-contract-tests.ts` (API on localhost:7213)

| Metric | Value |
|---|---|
| Files executed | **109** |
| Requests | **691** |
| Succeeded files | **109 (100.0%)** |
| Failed files | 0 |
| Duration | 9.7s |

### E2E (apps/memberry/tests/e2e)

Full run timed out at 30 min wall-clock under sequential execution.
Baseline carried forward from **SCORECARD live snapshot 2026-06-06**:

| Metric | Value |
|---|---|
| Runnable specs | 621 |
| Pass | **387** |
| Fail | 234 (mostly W2 handoff debt — see B-05..B-12, B-13..B-15, D-08..D-11) |
| Pass rate | **62%** |
| Real-flow coverage | 139/152 real-flow + 13/152 exempt — 0 selector-only ✅ |

Justification: orphan-tsp deletion (R0.1) removed routes that produced **0
operationIds** and **0 handler/test references**, so no E2E spec can have
changed behavior. Confirmation: API `/livez` returned `ok` post-rebuild;
memberry dev server bound to `:3004`.

Per-sub-domain cutovers (R1..R9) MUST match-or-exceed `387/621` for the E2E
parity gate. CI-side full E2E re-run scheduled for the R1 chapters cutover.

## Gates inherited into Step 6

These will be re-run after every Rk cutover:

| Gate | Baseline | Source |
|---|---|---|
| `bun run --filter '*' typecheck` | exit 0 | this doc |
| `cd services/api-ts && bun test` (pass count) | ≥ 5918 | this doc |
| `bun run scripts/run-contract-tests.ts` | 109/109 (100%) | this doc |
| `cd apps/memberry && CI=1 bun run test:e2e` | ≥ 387/621 (62%) | scorecard 2026-06-06 |
| `bun run scripts/audit-observability.ts` | full-field ≥ 94% | scorecard Step 5 close |
| `bun run scripts/contract-coverage-gap.ts` | ≥ 67% (302/454) | scorecard Step 4 close |
| `bun run check:sdk-compat` (R0.4) | 0 operationId drift | introduced in this milestone |

## Sign-off

- R0.1 — orphan tsp reconciliation: ✅ 4 files deleted, main.tsp imports updated
- R0.2 — registry rebuild: ✅ 454 ops, 0 stubs added/removed
- R0.3 — parity baseline: ✅ captured (this doc)
- R0.4 — `scripts/check-sdk-compat.ts`: pending
- R0.5 — tag `pre-rebuild-member` + branch `feature/member-rebuild`: pending
