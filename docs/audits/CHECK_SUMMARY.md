---
oli-version: "1.0"
based-on:
  - docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md
last-modified: 2026-05-30
last-modified-by: oli-check --discovery
prior-run: 2026-05-30 (--confidence + --traceability, archived in git history)
---

# Check Summary

## Run Context
- **Invocation:** `/oli-check --discovery`
- **Source commit:** `9c473e1fd7ce5d6c1986070f966eb37b6e9bcd2e` (2026-05-30)
- **Detected state:** specs present (22 module specs, DOMAIN_MODEL, MODULE_MAP, ROLE_PERMISSION_MATRIX, API_CONVENTIONS, EVENT_CONTRACTS, STATE_MACHINES, etc.); fresh codebase map at `docs/audits/codebase-map/CODE_*.json`; prior cycle-3 audit archived at `EXISTING_CODEBASE_ADOPTION_AUDIT.cycle_3.md`.
- **Dimensions selected:** Discovery (one single-dimension flag → exactly that ran)
- **Dimensions skipped this run:** consistency, compliance, confidence, traceability, enforcement, journeys, runtime (not selected)
- **Sequencing:** Discovery consumed `CODE_*.json` for structural data, re-derived current findings, and compared against the cycle-3 baseline.

## Dimension Results

| Dimension | Verdict | Report | Key findings |
|-----------|---------|--------|--------------|
| Discovery | PASS (health 8.2/10, +0.8 vs cycle 3) | `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` | 0 P0; 2 P1 (state-guard wiring incomplete on 7 machines, 9 phantom FE endpoints); 5 P2 (N+1, unbounded queries, schema-registry inversion, core/ports gap, CSRF); 8 P3. Cycle-3 P1s mostly resolved: `as any` 274→1 in association handler, status naming `terminated`→`removed` aligned, core→handler inversions 20→13, domain events 3→65 typed, state-machine framework built (5/12 wired). |

### Discovery details

- **Modules:** 25 backend handlers + 2 frontend apps + 2 shared packages.
- **API surface:** 428 endpoints (83K-line OpenAPI), 21 intentional unauthed, 9 phantom FE-calls (new P1).
- **Tests:** 486 handler tests + 127 E2E + 97 memberry component + 12 admin component + 99 Hurl contract + 5 SDK.
- **State machines:** 11 transition maps defined, 5 wired into handlers (dues-payments, marketplace orders, training, officer terms, elections). Remaining unwired: membership, booking, invoice, training-enrollment, marketplace vendor/listing, email queue.
- **Domain events:** 65 typed (cycle 3: 3).
- **Type cast density:** 30 handler `as any` total (cycle 3: ~290); 1 in association:member (cycle 3: 274) — and that 1 is a comment fragment, not an actual cast.
- **Core → handler inversions:** 9 (8 schema re-exports in `core/schema-registry.ts`, 1 governance.repo in `core/domain-event-consumers.ts`) + 4 middleware → handler. Cycle 3: 20.
- **Security:** OWASP Top 10 clean; only A04 CSRF gap (SameSite-only) remains.
- **Observability:** Pino structured logs, X-Request-ID, /livez + /readyz health checks, Prometheus counters; OpenTelemetry tracing absent (P3).

## Severity Counts

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 2 |
| P2 | 5 |
| P3 | 8 |

## Top P0/P1 Findings (this run)

| ID | Module | Severity | Description |
|---|---|---|---|
| IC-01 | sdk/handlers | P1 | 9 phantom frontend endpoints — FE issues calls without matching BE route (silent 404 risk). |
| IC-02 | association:member, membership | P1 | `MEMBERSHIP_VALID_TRANSITIONS` defined and tested but not called by any handler — membership status mutators still bypass the guard. |
| IC-03 | booking | P1 (part of guard cluster) | `BOOKING_VALID_TRANSITIONS` defined but not wired into update handlers. |
| IC-04 | dues | P1 (part of guard cluster) | `INVOICE_VALID_TRANSITIONS` defined but not wired into invoice mutators. |

## Overall
**PASS (health 8.2/10).** No P0 issues. P1 findings have a known surgical fix list (wire 7 transition guards; reconcile 9 phantom endpoints — ~2.5 days). Health score moved +0.8 vs cycle 3 (7.4 → 8.2). Foundation strong enough to enter Phase 4 (Adopt Standards) in parallel with finishing the cycle-3 stabilization plan.

## What's Next

**P1 — Do Now (~2.5 days):**
- Wire `isValidMembershipTransition` into `handlers/membership/updateMember.ts` and `handlers/association:member/terminateMembership.ts`.
- Wire `isValidBookingTransition` into booking-status mutators.
- Wire `isValidInvoiceTransition` into invoice-status mutators.
- Wire remaining guards (training enrollment, marketplace vendor/listing, email queue).
- Reconcile 9 phantom FE endpoints (implement, remove, or redirect each).

**P2 — Do Next:**
- Batch 3 known N+1 sites (communication × 2, certificates × 1).
- Add `.limit()` + cursor pagination to ~70 unbounded `findMany` calls.
- Decide schema-registry strategy in ARCHITECTURE.md (promote schemas to core/ vs formalize the registry hub pattern).
- Extract `core/ports/` for middleware → handler repo dependencies.

**Recommended next dimensions:** `/oli-check --compliance` (to quantify API contract drift now that `--discovery` confirmed the spec set is comprehensive), then `/oli-check --enforcement` (per-module baseline ratchet). After the 7 guard call-sites land, re-run `--discovery` to confirm IC-02 / IC-03 / IC-04 close.

## Linked Reports

- Current audit: `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md`
- Cycle-3 baseline: `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.cycle_3.md`
- Codebase map: `docs/audits/codebase-map/CODE_*.{json,md}` (regen'd 2026-05-29)
- Prior `/oli-check` (`--confidence + --traceability`, 2026-05-30): see git history of this file.
