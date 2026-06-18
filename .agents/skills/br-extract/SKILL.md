---
name: br-extract
description: Extract business rules for a module from business-rules.md, derive test specs with edge cases, and update br-registry.json. Use before writing any tests, when starting a module, or "extract BRs", "what rules apply to {module}", "derive test cases".
---

# br-extract

Parse business rules for a specific module, derive failing test case specifications, and update the BR registry. This is Step 3 of VERTICAL_TDD — the bridge between requirements and RED phase tests.

## Triggers

- Before `/handler` or `/frontend-test` (RED phase needs specs)
- "Extract BRs for {module}", "what rules apply to {module}"
- "Derive test cases", "test specs for {module}"
- Automatically dispatched by `/develop` Phase 3 before test writing

## Source Files

- **Business rules**: `docs/ver-3/business/business-rules.md`
- **BR registry**: `docs/ver-3/business/br-registry.json`
- **Coverage script**: `scripts/br-coverage.ts`

## Workflow

### Step 1: Read and Filter Business Rules

Read `docs/ver-3/business/business-rules.md`. Filter rules that apply to the target module by:
- Explicit module reference (e.g., "Members must...", "Dues payment...")
- Domain relevance (e.g., billing rules apply to dues module)
- Cross-cutting rules that affect this module (e.g., "All mutations require audit log")

For each matched rule, extract:
- **BR ID** (BR-01, BR-02, etc.)
- **Rule text** (exact statement)
- **Validation boundaries** (min/max, required fields, format constraints)
- **Error conditions** (what should fail and how)
- **Edge cases** (boundary values, null states, concurrent access, role variations)

### Step 2: Derive Test Specifications

For each BR, generate concrete test case descriptions:

```
BR-05: "Dues amount must be > 0 and < 1,000,000 PHP"

Test cases:
  Backend unit:
    - [BR-05] rejects dues with amount = 0
    - [BR-05] rejects dues with amount = -1 (negative)
    - [BR-05] rejects dues with amount = 1,000,000 (boundary)
    - [BR-05] accepts dues with amount = 0.01 (minimum valid)
    - [BR-05] accepts dues with amount = 999,999.99 (maximum valid)
  Contract:
    - [BR-05] POST /dues returns 422 when amount = 0
    - [BR-05] POST /dues returns 201 when amount = 500
  E2E:
    - [BR-05] dues form shows validation error for invalid amount
```

> **WHY edge cases matter**: Happy-path-only tests miss 80% of production bugs. Boundaries, nulls, and error conditions are where real failures live.

### Step 3: Check Existing Coverage

Run: `bun run scripts/br-coverage.ts --module={module}`

For each BR:
- If already COVERED — note it, don't regenerate (skip)
- If PARTIAL — identify which edge cases are missing
- If UNTESTED — full test spec generation needed

### Step 4: Update BR Registry

Read `docs/ver-3/business/br-registry.json`. For each new or updated BR:

```json
{
  "id": "BR-05",
  "rule": "Dues amount must be > 0 and < 1,000,000 PHP",
  "module": "dues",
  "phase": 1,
  "tests": {
    "backend": "services/api-ts/src/handlers/dues/dues.test.ts",
    "contract": "specs/api/tests/contract/dues-flow.hurl",
    "e2e": "apps/account/e2e/dues.spec.ts"
  },
  "edge_cases": [
    "zero amount",
    "negative amount",
    "upper boundary",
    "decimal precision"
  ],
  "status": "UNTESTED"
}
```

### Step 5: Output Test Spec File

Write test specifications to a temporary reference file the developer (or `/handler`) can use:

```
BR EXTRACTION: {module}
═══════════════════════

Rules found: 8
- 3 COVERED (skip)
- 2 PARTIAL (need edge cases)
- 3 UNTESTED (full spec below)

───────────────────────
NEW TEST CASES NEEDED:

Backend unit (services/api-ts/src/handlers/{module}/{module}.test.ts):
  describe('{Module} business rules', () => {
    it('[BR-05] rejects amount = 0', ...)
    it('[BR-05] rejects amount = -1', ...)
    it('[BR-05] rejects amount >= 1,000,000', ...)
    it('[BR-05] accepts amount = 0.01', ...)
    ...
  })

Contract (specs/api/tests/contract/{module}-flow.hurl):
  ### [BR-05] Reject invalid amount
  POST {{api}}/{module}
  ...
  HTTP 422

E2E (apps/account/e2e/{module}.spec.ts):
  test('[BR-05] form validates amount boundaries', ...)

───────────────────────
REGISTRY UPDATED: 3 new entries, 2 updated
```

## Rules

- NEVER invent business rules — only extract from `business-rules.md`
- ALWAYS include edge cases (boundaries, nulls, error states) — happy path alone is insufficient
- Tag every test case with `[BR-##]` for traceability
- Cross-cutting rules (audit, auth, validation) apply to ALL modules — include them
- If a rule is ambiguous, flag it for clarification rather than guessing
- Update registry atomically — don't leave it in inconsistent state
