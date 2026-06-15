# Plan — Postgres-backed Repository Test Harness (DEFERRED)

Status: **not implemented** — design only. Owner task: "Postgres-backed repo test harness".

## Problem

Repository classes (`src/handlers/*/repos/*.repo.ts`) are tested only indirectly:
handler tests `stubRepo(...)` the repo prototype, so the repos' own SQL/Drizzle
logic never executes. This leaves the data layer effectively uncovered:

| Repo | Line cov | Risk |
|---|---|---|
| `dues/repos/payment-token.repo.ts` | ~10% | payment tokens |
| `surveys/repos/survey.repo.ts` | ~2% | — |
| `platformadmin/repos/dashboard.repo.ts` | ~3% | admin metrics |
| `comms/repos/chatRoomMember.repo.ts` | ~3% | — |
| `association:operations/repos/committee.repo.ts` | ~3% | — |
| `association:member/repos/special-assessments.repo.ts` | ~3% | money |

The `stubRepo` convention cannot cover these — they need a real database. Postgres
is reachable at `:5432` and migrations exist (`src/generated/migrations/`), but no
test currently connects to it.

## Design

1. **`getTestDb()` helper** (`src/test-utils/test-db.ts`)
   - Connect to a dedicated test database (`DATABASE_URL_TEST` or a derived name).
   - Run migrations once per process (guard with a module-level promise).
   - Return a Drizzle `NodePgDatabase`.

2. **Per-test isolation** — pick one:
   - **(preferred) transaction rollback**: wrap each test in `BEGIN; … ROLLBACK;`
     via a transaction-scoped db handle. Fast, no cross-test bleed.
   - **schema-per-worker**: `CREATE SCHEMA test_<worker>; SET search_path`. Needed
     only if a repo opens its own transactions (rollback-in-rollback won't nest).

3. **Fixtures** — seed minimal parent rows (org, person, membership) via the
   existing factories' shapes, inserted through the real db, not mocked.

4. **Gating** — these tests must NOT run in the default `bun test` unit pass if the
   DB is unavailable (CI without Postgres). Options: a `*.db.test.ts` suffix plus a
   preload that skips them when `DATABASE_URL_TEST` is unset, mirroring the existing
   e2e-skip preload pattern in `test-setup-root.ts`.

## Scope (first slice)

Start with the money repos: `dues/repos/payment-token.repo.ts` and
`dues/repos/dues-payments.repo.ts` (receipt-sequence atomicity at
`getNextReceiptSequence`, status-transition history in `updatePaymentStatus`).
These have the highest risk and concrete, assertable behavior.

## Why deferred

Building DB-test infra (isolation, migration bootstrap, CI gating) is a separate
infrastructure effort from the audit remediation. The unit-test convention in this
repo is mock-based by design; introducing a DB layer is a deliberate expansion to
scope and review on its own.

## Effort estimate

~1–2 days: harness + isolation (0.5d), CI gating + skip wiring (0.5d), first repo
test suites (0.5–1d).
