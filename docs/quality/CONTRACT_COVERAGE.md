# Contract Coverage Baseline — Wave 4

Date: 2026-06-06T00:00:00Z
Branch: feature/codebase-hardening

## Totals

| Metric | Value |
|---|---|
| OpenAPI endpoints | 454 |
| Hurl files | 99 |
| Covered endpoints | 144 |
| Uncovered endpoints | 310 |
| **Coverage** | **32%** |
| Target (end of Wave 4 plan) | 60% |
| Gap | 128 endpoints (~87 new scenarios needed) |

## Coverage by tag (top 10 uncovered)

| Tag | Uncovered | Total | Coverage % |
|---|---|---|---|
| Association:Member | 152 | 169 | 10% |
| Association:Operations | 46 | 60 | 23% |
| Communication | 22 | 33 | 33% |
| Surveys | 16 | 16 | 0% |
| Documents | 15 | 15 | 0% |
| Marketplace | 9 | 9 | 0% |
| PlatformAdmin | 7 | 28 | 75% |
| Advertising | 7 | 7 | 0% |
| Jobs | 7 | 7 | 0% |
| Dues | 6 | 7 | 14% |

## Top 3 modules to scaffold (this wave)

Ranked by: 0% coverage + business criticality + manageable endpoint count.

1. **Surveys** — 16 endpoints uncovered (0% coverage). Member-facing feature, complete lifecycle gap.
2. **Documents** — 15 endpoints uncovered (0% coverage). High-value PII-adjacent storage.
3. **Marketplace** — 9 endpoints uncovered (0% coverage). Revenue-critical vendor module.

This wave scaffolds Surveys (8 scenarios). Documents + Marketplace handed off.

## Remaining work

See `docs/quality/CONTRACT_COVERAGE_HANDOFF.md` for the per-tag plan.

## Re-run

```bash
bun run scripts/contract-coverage-gap.ts
```
