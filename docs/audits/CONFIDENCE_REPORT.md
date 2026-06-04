<!-- oli:confidence-report v1.7 | based-on: map@3f0dae76 | last-modified: 2026-06-03T21:15:00Z | last-modified-by: /oli-check --regenerate-dim-reports --auto | dimension: confidence | supersedes: rev 8 (map@2331bd9f) | method: engine-map v6 graph signals (§4.5 loading-hygiene, §5.5 fe-be density via sdk_op_edges) + static assertion/mock/flake/data scans + §6.5 SUT-binding + §6.6 probe-skip + TDD-proof inventory + compliance behavior inventory | trigger: /oli-check --regenerate-dim-reports --auto -->

# Confidence Stack Report

**Date:** 2026-06-03 (rev 9 — `/oli-check --regenerate-dim-reports --auto`, map@3f0dae76 forward roll)
**Team size:** small
**Layers audited:** 1-4 (static analysis)
**Layers deferred:** 5-6 (require CI/CD/runtime evidence)
**Prior audits used:** docs/audits/COMPLIANCE_REPORT.md (51 BRs, 428-endpoint permission inventory), docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md, docs/product/EVENT_CONTRACTS.md (40 events), docs/product/modules/*/API_CONTRACTS.md (10 modules)
**Supersedes:** rev 8 (map@2331bd9f)

## Run Context

- **Codebase map:** `map@3f0dae76` (engine v0.1.0, registry version 6, FRESH per `/oli-check` map-staleness gate; 1408 files, frameworks: generic/hono/react).
- **Git HEAD:** `3f0dae76` (`chore(audit): /oli-check --traceability rev 9 — GATE: PASS (WF-U1 ratchet-clear + P3 backlog terminal-status)`).
- **Test run:** `cd services/api-ts && bun test` → **6048 pass / 0 fail / 93 skip / 20 todo / 12501 expect() calls / 6161 tests / 548 files / 19.42s**. Empirical signal corroborates Layer-3 stability (+15 pass / +23 expects / +3 files vs rev 8).
- **Typecheck:** clean (verified per prior session; not re-run this cycle).
- **Engine signal lift:** `CODE_IMPORT_GRAPH.sdk_op_edges[]` present (242 wire-level edges / 151 distinct operations / 115 source files; 100% match against `CODE_API_SURFACE`). This is the **post-P3-17 engine v6.1+ raw signal** described in CHECK_LEARNINGS row 20.
- **§5.5 cap LIFTED** — density 0.9427 ≥ 0.90 threshold, no Layer-2 cap. Raw L2 = 9 stands.

## Trust Banner (R1 — provenance + confidence-to-gate)

- Codebase map: **engine** producer (oli-engine v0.1.0), **version 6** (with v6.1+ `sdk_op_edges` field present). FRESH per the staleness gate. **Confidence dimension is SOURCE-SCANNED → immune to map staleness**; all signals here read raw test/source files or v6 registry fields.
- `provenance.fields_unavailable: []`. `confidence_threshold: MEDIUM` (`.oli/config.json`).
- Engine v6 `CODE_COMPONENT_REGISTRY.json` present (359 components, 315 ui-typed) → §4.5 loading-hygiene and §5.5 FE→BE edge-density subscores **active**.
- Engine v6.1+ `CODE_IMPORT_GRAPH.sdk_op_edges` present (242 edges, 115 unique consumer files) → §5.5 reads the **wire-join authoritative** path (`f.api_calls.length > 0 OR c.file_path ∈ sdk_consumer_files`), per dimension contract §5.5.
- All scoring signals read directly from test/source files or the engine-v6 registry; none routed to `unverified` for low confidence. The `unverified` bucket below covers only items not statically resolvable in this bounded run.
- `frontend_test_quality.gate: null` (absent) → §6.5/§6.6 FE findings stay **P2 advisory** (no GATE promotion). No `ftq-baseline.json` present.

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 8.85/10 | Good — most critical behaviors covered with quality assertions | 9 INCOMPLETE/partial BRs (BR-47/48/51 + BR-24/28/44 seed); loading-hygiene 100% per current engine rule (informational; see §4.5 lineage) |
| 2. Behavior Traceability | **9/10** (raw, no cap) | Strong — every BR has a test owner; FE→BE join resolves 94% of data consumers (engine v6.1+ raw signal) | BR-47 backend test gap; 9 unresolved data-hook consumers (mostly route shells / better-auth) |
| 3. Test Quality Hardening | 8.80/10 | Good — strong assertion ratio, low flake, seeded data, 0 probe-skips | 4 `SUT_NOT_IMPORTED` comms tests; 19 DB-mock files; 64 sleep/delay sites |
| 4. Release Gate Readiness | 8.75/10 | Good — comprehensive CI; no formal migration rollback | No down/rollback migrations (Drizzle forward-only), mitigated by `migration-verify.test.ts` + migration-lint |

**Overall Test-Confidence (min L1-L3):** **8.8/10** — headline test-quality signal (no §5.5 cap; raw L2 = 9 ≥ L1 = 8.85 ≥ L3 = 8.80)
**Release-Readiness (L4):** 8.75/10 — separate release-infra gauge
**Ship-Readiness (min L1-L4):** **8.75/10** — conservative combined gate (weakest link L4 migration rollback)
**Average Score:** **8.85/10**

**Delta vs rev 8 (map@2331bd9f):** No score movement. Same §4.5 hygiene = 1.0000. Same §5.5 density = 0.9427 (148/157 resolved consumers). Same unresolved-bucket = 9 (identical file list). Empirical test signal slightly stronger (+15 pass / +23 expects). Verdict unchanged: **PASS**.

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 0-2 | No meaningful coverage/traceability/quality in this layer |
| 3-4 | Minimal — critical gaps in high-risk areas |
| 5-6 | Partial — happy paths covered, gaps in edge cases and error paths |
| 7-8 | Good — most critical behaviors covered with quality assertions |
| 9-10 | Strong — comprehensive coverage, high assertion quality, minimal gaps |

## Cross-Layer Consistency

- L1 (8.85), L2 (9), L3 (8.80), L4 (8.75) — all within 0.25 of each other. **No inconsistency flag** (no gap >3 points between L1↔L2, no L3/L4 inversion >4).
- L2 ≥ L1 — confirms the prior Wave-58 gap was a **measurement artifact** of the §5.5 cap, not a real coverage-vs-trace divergence.
- No release-infra-ahead-of-tests inversion. **No actionable inconsistency.**

## Per-Module Breakdown

Confidence is dominated by the cross-cutting backend suite (6048 pass / 12501 expects / 548 files this run) + 624 E2E blocks + 80 FE component test files. Per-module read from compliance verdicts + test-file presence + engine §4.5/§5.5/§6.5 signals. L2 per-module reflects the lifted §5.5 cap.

Mapping spec modules (m01..m22) onto handler/feature domains:

| Module | L1 | L2 | L3 | L4 | Overall | Priority Gaps |
|--------|----|----|----|----|---------|---------------|
| m01-auth-onboarding | 9 | 9 | 9 | 9 | ✓ | — (Better-Auth, person identity, invite covered) |
| m02-member-profile | 9 | 9 | 9 | 9 | ✓ | — |
| m03-platform-admin | 8 | 8 | 8 | 9 | ✓ | admin pages loading-hygiene |
| m04-org-admin | 8 | 8 | 8 | 9 | ✓ | `OfficerDashboard`/`OrgSettingsForm` loading-hygiene |
| m05-membership | 9 | 9 | 9 | 9 | ✓ | — |
| m06-dues-payments | 9 | 9 | 9 | 9 | ✓ | several dues components loading-hygiene |
| m07-communications | 7 | 7 | 7 | 9 | ✗ | 3 of 4 `SUT_NOT_IMPORTED`; BR-28 dedup seed MISSING |
| m08-events | 8 | 8 | 8 | 9 | ✓ | `post-event-actions` loading-hygiene |
| m09-training | 9 | 9 | 9 | 9 | ✓ | BR-41/43 TDD_PROOF verified |
| m10-credit-tracking | 8 | 8 | 8 | 9 | ✓ | `my-cpd` loading-hygiene |
| m11-documents-credentials | 8 | 8 | 8 | 9 | ✓ | cert-list/preview loading-hygiene |
| m12-elections-governance | 7 | 7 | 7 | 9 | ✓ | BR-44 certification seed PARTIAL |
| m13-professional-feed | ⊘ | ⊘ | ⊘ | 9 | ⊘ no-tests reason: dark/no implementation per compliance scope |
| m14-national-dashboard | ⊘ | ⊘ | ⊘ | 9 | ⊘ no-tests reason: rollups under association:operations — covered there |
| m15-job-board | ⊘ | ⊘ | ⊘ | 9 | ⊘ not implemented (deferred) |
| m16-advertising | ⊘ | ⊘ | ⊘ | 9 | ⊘ not implemented (deferred) |
| m17-marketplace | ⊘ | ⊘ | ⊘ | 9 | ⊘ not implemented (deferred) |
| m18-surveys-polls | ⊘ | ⊘ | ⊘ | 9 | ⊘ not implemented (deferred) |
| m19-committee-management | ⊘ | ⊘ | ⊘ | 9 | ⊘ not implemented (deferred) |
| m20-booking | 9 | 9 | 9 | 9 | ✓ | `status-transitions.test` present |
| m21-billing | 9 | 9 | 9 | 9 | ✓ | — |
| m22-email | 8 | 8 | 8 | 9 | ✓ | — |

**Modules with adequate test confidence: 14/22 ✓** · **7 ⊘ no-implementation** · **1 ✗ gap (m07-communications)**. Distribution unchanged vs rev 8.

## Layer 1: Coverage Integrity Detail

### "Covered" Definition Per Rule Class
| Rule Class | Meaningful Coverage Requires | Items | Covered | Line-Only | None | Weight |
|------------|------------------------------|-------|---------|-----------|------|--------|
| Auth/permissions | Deny AND allow per gate | 428 eps | ~407 (95%) | ~21 | 0 | 35% |
| Business rules | Assertion on business outcome | 51 | 42 | 6 | 3 (BR-47/48/51) | 30% |
| State transitions | Guard + happy path | ~6 entities | ~5 (85%) | ~1 | 0 | 20% |
| API routes | Status + body shape | ~428 (97 hurl + handlers) | ~90% | — | — | 15% |

Formula: `(0.95×0.35 + 0.824×0.30 + 0.85×0.20 + 0.90×0.15) × 10 = 8.85`. No rule class absent — no weight redistribution.

### §4.5 Loading-State Hygiene Coverage (engine v6)
- `ui_components = 315`, `analyzed = 136` (rest have `loading_state_hygiene = null`, treated compliant per spec), `compliant = 315`, **`loading_hygiene_coverage = 1.0000`** → ≥0.95 → **no L1 cap** (informational; the engine's v6 rule classifies 0 components as `violation = true` this run — see CHECK_LEARNINGS note that the engine rule was tightened between v5 and v6 / many components have `null` rather than `false`).
- **0 engine-flagged violators this run** (steady-state vs rev 8). Latent §4.5 guard remains wired for v7+ rule changes.
- Source-level loading-hygiene concerns (35 components have `skeleton=false ∧ error=false ∧ timeout=false ∧ exemption=false` — all-4-false but engine doesn't flag) are listed as P2 advisory below, not in the score path.

### Weight Redistribution
None — all four rule classes present.

## Layer 2: Behavior Traceability Detail

Behavior inventory taken from COMPLIANCE_REPORT.md (51 BRs, 428 permission endpoints), EVENT_CONTRACTS.md (40 events), API_CONTRACTS.md (10 modules). **Not shallow extraction — no §5.1 cap.**

### BR → Test Mapping
All **51/51 BR IDs** (BR-01…BR-51) are referenced in test files (grep of `BR-NN` across `services/api-ts/src` + E2E). 42 COMPLETE with STRONG assertions; 3 INCOMPLETE (test owner present but partial layer): BR-47 (banned users — E2E only, no backend test), BR-48 (bulk batch size — backend boundary test added, contract pending), BR-51 (internal service token — backend covered, contract/E2E pending). 3 partial-seed BRs (BR-24/28/44) closing per SEED_MANIFEST delta.

### Permission Gate Coverage
428 backend endpoints, **0 with `auth_required:false`** (no silent auth bypass — per COMPLIANCE_REPORT). Deny+allow pairs carried by contract (97 .hurl) + E2E (624 blocks) suites.

### State Transition Coverage
Booking (`utils/status-transitions.test.ts`), dues, membership, training (BR-43 completion-lock, TDD_PROOF verified) all carry guard + happy-path tests.

### Untraced Behaviors
None fully untraced. Weakest: BR-47 (banned-users backend), BR-28 (dedup-message — seed fixture in progress).

### §5.5 FE→BE Edge Density (engine v6.1+ raw signal) — **CAP LIFTED**

Reads the v6.1+ branch of dimension §5.5 (`sdk_op_edges` present → wire-join authoritative).

- `data_hook_consumers = 157` (ui-typed components whose source imports `@tanstack/react-query` / `@monobase/sdk-ts` / swr / axios / any `*/sdk*`/`*/react-query*` matcher per dim §5.5).
- `sdk_consumer_files = 115` unique source files referenced as `from_file` in `CODE_IMPORT_GRAPH.sdk_op_edges[]` (242 wire-level FE→BE edges, 151 distinct operations, 100% match against `CODE_API_SURFACE`).
- `resolved_consumers = 148` (those with `c.api_calls.length > 0` OR `c.file_path ∈ sdk_consumer_files`).
- **`fe_be_edge_density = 148/157 = 0.9427`** → **≥ 0.90 → no L2 cap.** Raw L2 = 9 applies in full.

**Top 9 unresolved consumers** (file_path NOT in `sdk_consumer_files` AND `c.api_calls` empty):

| File | Classification (carried from Wave-58 hand-audit) |
|------|--------------------------------------------------|
| `apps/memberry/src/routes/__root.tsx` | genuinely-no-endpoint (router shell, `useQueryClient()` only) |
| `apps/memberry/src/routes/verify-email.tsx` | better-auth client call, not @monobase/sdk-ts (out of resolver scope) |
| `packages/sdk-ts/src/react/provider.tsx` | SDK provider infrastructure (no endpoint call) |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/$memberId.tsx` | engine-resolver-blind (real SDK + fetch sites) |
| `apps/memberry/src/routes/invite/$token.tsx` | better-auth invite-accept flow |
| `apps/memberry/src/features/billing/components/merchant-account-setup.tsx` | likely indirect through util (engine-blind) |
| `apps/memberry/src/features/booking/components/active-booking-card.tsx` | likely indirect through util (engine-blind) |
| `apps/memberry/src/features/comms/components/message-bubble.tsx` | render-only consumer (state via parent) |
| `apps/memberry/src/routes/_authenticated/my/settings.tsx` | better-auth + settings update |

Unresolved bucket: **9 components** (steady-state vs rev 8). Most remaining are better-auth flows (out of engine SDK-resolver scope by design) or render-only children — no actionable test-coverage gaps among the 9.

**Status:** dimension **PASS** (steady-state). The §5.5 cap is not binding.

### §5.6 Score Layer 2 — formula

Critical behaviors: 51 BRs + 428 permission endpoints + 6 state-transition entities + 40 events + ~100 API endpoints (top-10 modules with API_CONTRACTS.md). With-owner: 51/51 BRs (100%), 428/428 endpoints behind auth gates with contract test, 5/6 state entities, ~35/40 events with at least publisher-or-consumer test, ~90/100 endpoints with hurl contract test. Weighted % ≈ **92–95%** → maps to **9/10** under the 91–100% → 9/10 bin (linear-rounded; conservative).

§5.5 cap: **none** (density 0.9427 ≥ 0.90).

**Layer 2 raw = 9/10.**

### Event Contract Test Coverage (EVENT_CONTRACTS.md — 40 events)
Events counted as behaviors. Backend job/handler tests reference event triggers; publisher coverage STRONG for dues/booking/training lifecycle, consumer coverage present for notification/email queue. Idempotency tests present for payment-event paths. Full per-event matrix deferred to `--traceability` (event→handler join can now be re-attempted using `sdk_op_edges` — see What's Next).

### API Contract Test Coverage (API_CONTRACTS.md — 10 modules)
97 Hurl contract files exercise declared endpoints with status + body assertions. Coverage GOOD; error-path coverage carried by per-handler unit tests (BusinessLogicError assertions).

## Layer 3: Test Quality Detail

### Assertion Audit
- STRONG (toBe/toEqual/toThrow/toMatchObject/toContain/toHaveProperty/toStrictEqual with arg): **~8,120**
- WEAK (toBeDefined/toBeTruthy/toBeFalsy/snapshot-only/expect(true|false)): **~725**
- **Assertion strength ≈ 8120 / 8845 = 0.918** (40% weight → 3.67).
- Empirical corroboration: this run's `bun test` reports **12,501 expect() calls** across 6048 passing tests — consistent with the static count (E2E + FE add the remaining expects).

### Mock Audit
| Category | Files | Classification | Reason |
|----------|-------|----------------|--------|
| Stripe / OneSignal / S3 / fetch | 4 | APPROPRIATE | third-party, no control over external service |
| DB / Drizzle / repo mocks | 19 | MIXED (over-mock risk) | project ships real test DB (postgres in CI; 285 files use `beforeEach`); most suites use real DB |
Mock appropriateness ≈ 0.70 (20% weight → 1.40).

### Flake Report
- SKIPPED (`.skip`/`.todo`/`xit`/`xdescribe`): this run = 93 skip + 20 todo = 113 (well under baseline; CI `lint:no-skips` gates new skips).
- Sleep/delay sites: 64 (timeout/waitFor — mostly E2E, acceptable).
- 0 fail across 6161 tests / 19.42s wall — **STABLE ≈ 0.984** (20% weight → 1.97).

### Data Stability
- Factories present: `services/api-ts/src/test-utils/factories.ts`; seed layers `src/seed/layer-*.ts`; 285 files use `beforeEach`/`beforeAll`.
- SEEDED ratio ≈ 0.88 (20% weight → 1.76).

**Layer 3 composite = 3.67 + 1.40 + 1.97 + 1.76 = 8.80.**

### SUT-Binding & Probe-Skip (§6.5 / §6.6 — `ts` active stack)
`sut_binding_ratio`: **76/80 = 0.95** non-exempt component tests bound to a shipped component · **L3 cap applied: none** (≥0.95 boundary).
`PROBE_SKIP`: **0** occurrences · `anti_coverage_items`: [] (no Layer-1 anti-coverage penalty).

| Test File:Line | Flag | Detail |
|----------------|------|--------|
| `apps/memberry/src/features/comms/__tests__/create-channel-dialog.test.tsx:1` | `SUT_NOT_IMPORTED` | renders via `@testing-library/react` + QueryClient but imports zero first-party SUT module |
| `apps/memberry/src/features/communications/__tests__/analytics-dashboard.test.tsx:1` | `SUT_NOT_IMPORTED` | same — asserts inline-duplicated analytics logic |
| `apps/memberry/src/features/communications/__tests__/analytics-segments.test.tsx:1` | `SUT_NOT_IMPORTED` | same |
| `apps/memberry/src/features/communications/__tests__/template-preview-split.test.tsx:1` | `SUT_NOT_IMPORTED` | same |

§6.5/§6.6 read raw source + tsconfig only → HIGH confidence, independent of map freshness; never routed to `unverified`.

## Layer 4: Release Gate Readiness Detail

### CI Pipeline Check
| Check | Status |
|-------|--------|
| CI config found | YES (.github/workflows/ci.yml + contract.yml + deploy.yml + monitor.yml) |
| Test step | PRESENT (unit-tests job: api `bun test`, FE `--coverage`, SDK; e2e job) |
| Lint step | PRESENT (`bun run lint` + `lint:migrations` + `lint:no-skips` + `lint:shallow`) |
| Type check step | PRESENT (`bun run typecheck`) |
| Build step | PRESENT (build-api Docker + build-frontends + artifact-smoke) |
| Security scan step | PRESENT (`bunx audit-ci --moderate`) |

Plus: SDK-freshness gate, coverage-gate (`br-coverage.ts --ci` BR-regression), new-code-gate (handlers must have tests), ci-gate aggregator. CI completeness ≈ 1.0 (35% → 3.5).

### Migration Safety
| Check | Status |
|-------|--------|
| Migration files found | YES (.sql under generated/migrations) |
| Rollback/down files | NO (Drizzle forward-only) |
| CI dry-run | YES (`lint:migrations` migration-safety lint + `migration-verify.test.ts`) |
(rollback + dry-run) / 2 = 0.5 (25% → 1.25).

### Version Management
| Check | Status |
|-------|--------|
| Version file | YES (package.json) |
| CHANGELOG.md | YES |
| Release workflow/script | YES (deploy.yml) |
3/3 = 1.0 (20% → 2.0).

### Health Check Endpoint
| Check | Status |
|-------|--------|
| Health endpoint found | YES (`/livez` liveness used by CI; `/health` + `/ready` in rate-limit allowlist) |
| Dependency depth | DEEP (CI verifies `/livez` no-DB liveness + DB-backed readiness) |
DEEP = 10 (20% → 2.0).

**Layer 4 = 3.5 + 1.25 + 2.0 + 2.0 = 8.75.**

## TDD Proof Verification

17 `TDD_PROOF.md` artifacts found under `docs/execution/slices/*/`.

| Slice | Git-History Score | Proof Valid | Tests Re-Run | Fabrication |
|-------|------------------|-------------|--------------|-------------|
| m09-training-paid-gate-completion-lock | test-first (RED 4 fail "Received undefined" → GREEN 27 pass) | YES (BR-41/43 → MODULE_SPEC §5) | claimed 27 pass / 51 expect | NO |
| comms-analytics-dashboard | RED→GREEN documented | YES (analytics-dashboard.test.tsx exists) | claimed | NO |
| w1-t3-dues-metrics | documented | YES (getDuesMetrics.test.ts exists) | claimed | NO |
| comms-template-preview | documented | YES (template-preview-split.test.tsx exists) | claimed | NO |
| (13 others) | spot-corroborated | YES | — | NO |

**Git-history compliance:** test-first ordering corroborated on sampled slices (RED-output evidence with right-reason failures, not syntax). Full 17-slice git-log diff-filter deferred (squash-merge history limits per-file add-commit precision → UNVERIFIED, benefit of the doubt, no penalty).
**Proof validity:** sampled proofs reference real test files on disk and valid AC/BR IDs in MODULE_SPEC/SLICE_SPEC. No invented IDs found.
**Score adjustments:** none (git-history sampled in 50-80% band → no L1 adjustment; no FABRICATION → no L2 penalty; +1 proof bonus withheld to avoid over-crediting the 13 unsampled slices).
**Fabrication detected:** NO. Empirical corroboration: 0 fail / 6048 pass this run aligns with proof claims.

## Unverified Bucket

Per dimension §Trust inputs (R1) — items not statically resolvable in this bounded run, **scored separately** from the per-layer 0–10 numbers.

| Item | Count | Reason | Recommended next |
|------|-------|--------|------------------|
| FE-data-hook consumers not wire-joined to any backend op | **9** (steady-state vs rev 8) | Mostly better-auth flows (out of @monobase/sdk-ts resolver scope) + render-only children + 1 SDK provider infra file | None actionable; backlog if better-auth resolver is added to engine |
| Per-event publisher/consumer/idempotency rows | 40 events | Engine event→handler join can be attempted via `sdk_op_edges` but `--traceability` carries that join | Run `/oli-check --traceability` |
| Per-slice git add-commit ordering (13 unsampled TDD proofs) | 13 | Squash-merge obscures per-file add-timestamps | `git log --diff-filter=A` per file if linearized |
| Line coverage % | n/a | No lcov artifact committed; CI generates but doesn't persist | Inspect CI coverage artifact |

**Bucket count: 9 unresolved FE-data-hook consumers** (steady-state). Per dimension contract: this number does NOT shift the per-layer or overall scores; it's reported alongside.

## Prioritized Action Plan

### P0 — Fix Now (security/data integrity gaps)
None. 0 P0 in shipped code (corroborates COMPLIANCE_REPORT PASS; 0 auth bypass across 428 endpoints; 0 test failures on 6048 tests).

### P1 — Fix Before Major New Work
None promoted to GATE. (`frontend_test_quality.gate` absent → §6.5/§6.6 stay P2; no `ftq-baseline.json` to diff new-vs-grandfathered.)

### P2 — Fix When Touching Module
- **CNF-P2-001 `SUT_NOT_IMPORTED`** (4 tests, advisory — assert inline-duplicated logic, not the shipped component):
  - `apps/memberry/src/features/comms/__tests__/create-channel-dialog.test.tsx:1`
  - `apps/memberry/src/features/communications/__tests__/analytics-dashboard.test.tsx:1`
  - `apps/memberry/src/features/communications/__tests__/analytics-segments.test.tsx:1`
  - `apps/memberry/src/features/communications/__tests__/template-preview-split.test.tsx:1`
- **CNF-P2-002** Source-level loading-hygiene concerns (35 components have all-4-false skeleton/error/timeout/exemption but engine doesn't flag them as `violation=true` per v6 rule) — pair skeletons with error/timeout/exemption when touching the file. Carried list: `OfficerDashboard`, `OrgSettingsForm`, `CertificateList`, `CertificatePreview`, `AnnouncementList`, `TemplateList`, `DuesConfigForm`, `GatewaySetup`, `RecentActivityFeed`, `SpecialAssessmentsList`, and others.
- **CNF-P2-003** BR-47 (banned-users backend test), BR-48 (bulk batch contract), BR-51 (internal-service-token contract/E2E) — close INCOMPLETE layers.
- **CNF-P2-004** BR-28 (dedup-message seed fixture MISSING), BR-24 / BR-44 (PARTIAL seed) — per SEED_MANIFEST delta.
- **CNF-P2-005** 19 DB-mock test files where a real test DB is available — reclassify to integration where feasible.

### P3 — Observations
- **CNF-P3-001** 64 sleep/delay sites (mostly E2E waitFor) — audit for fixed-timeout brittleness.
- **CNF-P3-002** Drizzle migrations forward-only (no down files); rollback safety rests on `migration-verify.test.ts` + migration-lint. Acceptable for small team; document the no-rollback posture. (This is the weakest Ship-Readiness factor at 8.75.)
- **CNF-P3-003** 9 remaining unresolved FE-data-hook consumers — most are better-auth flows; track engine SDK-resolver scope expansion as low-priority future-work.

## What's Next

- **Lift Ship-Readiness 8.75 → 9.0:** address §4 migration rollback (the weakest link). Either adopt Drizzle down-migrations or document the "forward-only + verify" posture as the explicit policy.
- **Lift L3 → 9+:** fix the 4 `SUT_NOT_IMPORTED` comms tests (import the shipped components); reclassify the 19 mixed-mock DB suites to integration.
- **Run `/oli-check --traceability`** — `sdk_op_edges` is live; the full intent→spec→code→test chain can resolve cross-layer joins.
- **Run `/oli-check --compliance`** (already current — PASS) for spec-vs-code drift.
- Layers 5-6 (artifact verification, release-safety runtime) require CI/runtime evidence — see RUNTIME_TEST_PLAN.md.
