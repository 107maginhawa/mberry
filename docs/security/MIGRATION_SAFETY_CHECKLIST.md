# Migration Safety Checklist

Every PR that touches `*.schema.ts` files or adds migrations under
`services/api-ts/src/generated/migrations/` MUST reference this checklist
in the PR description. Paste the checklist block and check each item.

---

## Pre-merge checklist

- [ ] **Expand-contract (P0 guard):** No destructive DDL (`DROP TABLE`, `DROP SCHEMA`, `TRUNCATE`, `DELETE FROM` without WHERE) in the same release as code depending on the old shape. Split across two releases.
- [ ] **Expand-contract (P1 guard):** Destructive column operations (`DROP COLUMN`, `RENAME COLUMN/TABLE`, `ALTER COLUMN TYPE`) are deferred to a follow-on release after all code references have been removed.
- [ ] **NOT NULL with defaults:** New NOT NULL columns include a `DEFAULT` clause, OR a documented backfill migration ran in a prior release. Verify via `pg_stats` or row count before applying SET NOT NULL.
- [ ] **CONCURRENTLY for indexes:** `CREATE INDEX` and `CREATE UNIQUE INDEX` use `CONCURRENTLY` for tables with > 10k rows in production. Note: Drizzle ORM does NOT emit CONCURRENTLY by default — override with a raw SQL migration for large-table indexes.
- [ ] **Migration split:** Pure schema DDL and pure data DML (`INSERT`/`UPDATE` backfills) live in separate migration files.
- [ ] **Long-running runbook:** Operations expected to take > 5 s have a runbook entry. Batch UPDATE/DELETE > 10k rows chunked with explicit transaction boundaries (e.g., `WHERE id > $cursor LIMIT 1000`).
- [ ] **Realistic test:** Migration ran against a snapshot with realistic row counts (≥ 10k rows in affected tables). Empty-DB migration tests do not catch lock or constraint failures.
- [ ] **Rollback path documented:** Either a reverse migration exists in the PR, or "no-op rollback, data flush" is explicitly acknowledged in the PR description.
- [ ] **Lock budget declared:** For tables with > 100k rows, every lock-acquiring statement (`ALTER TABLE`, `CREATE INDEX` non-concurrent) is listed in the PR description with estimated duration.
- [ ] **Acknowledgment tag:** Files with known-reviewed risks carry `-- migration-safety: reviewed` on the relevant line so the CI scanner downgrades severity rather than blocking.

---

## Severity definitions

| Level | Meaning |
|-------|---------|
| **P0** | Destructive without expand-contract — immediate data-loss risk. CI blocks merge. |
| **P1** | Locking / null-handling risk — will fail or stall on non-empty tables. |
| **P2** | Performance / hygiene — won't fail but may degrade or make rollback harder. |
| **P3** | Informational — review recommended, no action required. |

---

## CI gates

**Current (migration-safety.ts):** `bun scripts/migration-safety.ts` runs on every PR that
touches migration files. Exits 1 on P0 patterns in *new* migrations (vs `main`).

**Wave 7 target:** PRs touching `*.schema.ts` or `generated/migrations/*` must include
the phrase `MIGRATION_SAFETY_CHECKLIST` in the PR body (text-presence gate). Also expand
CI to flag P1s on new migrations.

---

## Re-audit (full history scan)

```bash
bun scripts/audit-migrations.ts
# writes docs/security/migrations-audit.json
```

---

## Baseline audit findings — 2026-06-06

Scanned **62 migration files** across `services/api-ts/src/generated/migrations/`.

### Summary

| Severity | Count | Top pattern |
|----------|-------|-------------|
| P0 | **0** | — (clean) |
| P1 | 152 | DROP COLUMN (52), ADD COLUMN NOT NULL no DEFAULT (43), RENAME (42) |
| P2 | 502 | CREATE INDEX not CONCURRENTLY (453), mixed schema+data (16) |
| P3 | 0 | — |

**Total: 654 findings across 62 files.**

> P0 count = 0. No destructive DROP TABLE / TRUNCATE / DELETE-without-WHERE in any migration. Good baseline.

### P1 findings breakdown

| Pattern | Count | Risk |
|---------|-------|------|
| DROP COLUMN | 52 | Data loss if column had values; breaks ORM |
| ADD COLUMN NOT NULL (no DEFAULT) | 43 | Fails on non-empty tables |
| RENAME COLUMN/TABLE | 42 | Breaks running code referencing old name |
| DROP CONSTRAINT | 12 | Weakens referential integrity |
| SET NOT NULL (ALTER COLUMN) | 3 | Fails if existing NULLs present |

**These are historical migrations already applied to production.** Remediation is forward-only:
- Do NOT edit generated migration files.
- For any future migration matching these patterns, apply the checklist items above.
- For the 3 SET NOT NULL findings — verify they were preceded by backfill migrations (e.g., `0040_slug_backfill` → `0041_slug_not_null` is correct expand-contract).

### P2 findings breakdown

| Pattern | Count | Risk |
|---------|-------|------|
| CREATE INDEX not CONCURRENTLY | 453 | ACCESS EXCLUSIVE lock during index build |
| mixed schema+data | 16 | Harder rollback; partial-failure risk |
| DROP INDEX | 33 | Query performance regression |

> **Note on CREATE INDEX:** Drizzle ORM emits non-CONCURRENTLY indexes by default. The 453 findings are all historical. For future large-table indexes, override with raw SQL using `CONCURRENTLY`. For new tables (empty at migration time), the lock is instantaneous — no action needed.

### Known-good expand-contract pairs (P1 false positive examples)

These P1 patterns are correctly sequenced across migration pairs:

| Backfill migration | Constraint migration | Pattern |
|--------------------|---------------------|---------|
| `0040_slug_backfill.sql` | `0041_slug_not_null.sql` | SET NOT NULL after backfill |

If you identify more correctly-sequenced pairs, tag the constraint migration with `-- migration-safety: reviewed` to suppress future P1 flags.

---

## Remediation queue (forward-only)

> Do NOT edit generated migrations. All remediation is via NEW migrations or code changes.

| Issue | Action | Priority |
|-------|--------|----------|
| Future DROP COLUMN | Always use expand-contract (two releases) | P1 gate |
| Future ADD COLUMN NOT NULL | Include DEFAULT or precede with backfill migration | P1 gate |
| Future large-table indexes | Use CREATE INDEX CONCURRENTLY in raw SQL override | P2 gate |
| Future RENAME | Expand-contract: dual-write → code cutover → drop | P1 gate |

Full machine-readable findings: `docs/security/migrations-audit.json`
