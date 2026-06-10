# Architecture Decision Records

| ID | Title | Status | Date |
|---|---|---|---|
| [ADR-0001](./0001-typespec-first-api-contracts.md) | TypeSpec-first API contracts | Accepted | 2026-06-06 |
| [ADR-0002](./0002-hand-wired-route-allowlist.md) | Hand-wired route allowlist | Accepted | 2026-06-06 |
| [ADR-0003](./0003-drizzle-orm-over-prisma.md) | Drizzle ORM over Prisma | Accepted | 2026-06-06 |
| [ADR-0004](./0004-bun-over-nodejs.md) | Bun over Node.js | Accepted | 2026-06-06 |
| [ADR-0005](./0005-person-module-as-pii-safeguard.md) | Person module as PII safeguard | Accepted | 2026-06-06 |
| [ADR-0006](./0006-domain-event-bus-for-cross-module-cascades.md) | Domain event bus for cross-module cascades | Accepted | 2026-06-06 |
| [ADR-0007](./0007-audit-officer-position-via-typespec-extension.md) | Audit + officer/position checks via TypeSpec @extension | Accepted | 2026-06-06 |
| [ADR-0008](./0008-superpowers-workflow-replaces-gsd.md) | Superpowers workflow replaces GSD | Accepted | 2026-06-06 |
| [ADR-0009](./0009-oli-preservation-alongside-superpowers.md) | OLI preservation alongside superpowers | Accepted | 2026-06-06 |
| [ADR-0010](./0010-mega-module-rebuild-over-split.md) | Mega-module rebuild over split | Accepted | 2026-06-06 |

## Process for new ADRs

1. Copy `docs/architecture/adr/0000-template.md`.
2. Increment the number (next: `0011-...`).
3. Set status to `Proposed` until merged.
4. Update this index after merge.

ADRs are immutable once accepted. To reverse or supersede a decision, write a new ADR referencing the old one.

## TBD gaps

ADRs with known rationale gaps (original decision predates documentation):

| ADR | Gap |
|---|---|
| ADR-0003 | Original Drizzle-vs-Prisma comparison not documented — ADR records current-state rationale. |
| ADR-0004 | Original Bun-vs-Node.js comparison not documented — ADR records observable properties and inferred rationale. |
