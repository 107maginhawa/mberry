# Codebase Review — Grounding Reference (2026-06-16)

Branch: `fix/audit-remediation-2026-06` · 802 files changed vs `main` (~66k insertions).
This file holds the baseline signal the module review fans out from. No findings here — see sibling cluster files.

## Baseline health (whole api-ts)

| Check | Command | Result |
|---|---|---|
| Typecheck | `bun run typecheck` (`tsc --noEmit`) | **CLEAN** — no errors |
| Lint | `eslint src --quiet` | **CLEAN** — no output |

Style/lint and type-safety are not the risk surface. Focus shifts to logic, security, cross-module contracts, and test coverage.

## Backend module inventory (src vs test file counts)

`src` = non-test `.ts`; `test` = `*.test.ts`. Counts drift — re-run per CLAUDE.md.

| Module | src | test | Note |
|---|---|---|---|
| member (association:member files) | 220 | 196 | mega-module |
| association:operations | 83 | 51 | mega-module, test ratio low |
| platformadmin | 59 | 55 | |
| communication | 50 | 48 | |
| association:member | 44 | 24 | low ratio |
| person | 39 | 35 | central PII hub |
| booking | 32 | 31 | |
| email | 24 | 19 | |
| surveys | 20 | 18 | |
| billing | 18 | 24 | well-covered |
| documents | 18 | 24 | well-covered |
| comms | 17 | 11 | low ratio |
| marketplace | 17 | 8 | **LOW** |
| events | 14 | 21 | well-covered |
| advertising | 12 | 7 | **LOW** |
| jobs | 9 | 7 | |
| notifs | 9 | 8 | |
| storage | 8 | 5 | |
| invite | 7 | 5 | |
| elections | 6 | 14 | well-covered |
| reviews | 6 | 5 | |
| **dues** | **5** | **0** | **ZERO TESTS — top gap** |
| membership | 5 | 6 | |
| audit | 4 | 4 | |
| onboarding | 4 | 1 | **LOW** |

### Test-coverage priority (write-tests targets)
1. **dues** — 0 tests, 5 src files. Invoicing/payments/funds. Highest risk.
2. **onboarding** — 1 test, 4 src.
3. **marketplace** — 8/17.
4. **advertising** — 7/12.
5. **association:member** (44 src / 24 test) and **association:operations** (83/51) — large surface, thin ratio.

## Security hot spots (grep triage)

Most `sql.raw` / `${}` / `exec` hits are in **test files** or **parameterized `sql\`\``** (Drizzle parameterizes interpolations — safe). Production spots to inspect:

- `handlers/booking/repos/timeSlot.repo.ts:86` — `sql.raw(...)` inside an array expression. **Inspect: confirm no user-controlled value reaches `sql.raw`.**
- `handlers/member/certificates/utils/certificate-numbering.ts:7,31` — `db.execute(sql\`... ${organizationId} ...\`)` — interpolation is inside tagged `sql\`\``, so parameterized/safe. `FOR UPDATE` row lock present (good for seq allocation).
- No `dangerouslySetInnerHTML` / `eval` / `child_process` in api-ts production code.

## Largest handler files (maintainability / review-density targets)
Indexed under "largest handler files top30" — top files exceed ~400 LOC; revisit for cyclomatic complexity in cluster reviews.

## Review cluster plan (parallel fan-out)

| # | Cluster | Modules |
|---|---|---|
| C1 | Identity & onboarding | person, membership, invite, onboarding |
| C2 | Association mega | association:member, association:operations, member/* |
| C3 | Money | billing, dues, platformadmin |
| C4 | Scheduling | booking, events, elections |
| C5 | Comms | communication, comms, notifs, email, surveys, reviews |
| C6 | Content & misc | documents, storage, certificates, marketplace, advertising, audit, jobs |
| C7 | Frontend | apps/memberry (UI standards, a11y, perf, responsive) |
| C8 | Cross-module | sdk-ts, API contracts, type mismatches, error propagation |

Each cluster file: `0N-<cluster>.md`. Format per goal: bullet `file:line — problem — why — fix+example`, Priority High/Med/Low, label `[Intra-Module]`/`[Cross-Module]`, top-3 critical at end.
