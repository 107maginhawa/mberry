# Business Rule Driven Testing

## Context

Memberry's Phase 0 foundation (80+ commits, 207K lines) was built horizontally: all backends first, then frontends, then tests retrofitted. This violates VERTICAL_TDD.md's test-first discipline. The result: 1267 passing API tests and 350 frontend tests that confirm code behavior but don't verify business rules. No traceability from test to business rule. No way to answer "is BR-08 tested?" without reading every test file.

The PRD defines 40 tagged business rules (BR-01 through BR-40) across 19 modules. A /ship review found 47.5% fully tested, 45% partially tested, 7.5% untested. Critical gaps in money handling, state machines, tenant isolation, and multi-org scenarios.

**Goal:** Make business rules the source of truth for all tests. Every BR gets verified at backend and frontend layers. Machine-auditable coverage. Strict BR-first TDD for all new modules.

---

## Design: BR Registry + Tagged Tests (Approach C)

### 1. BR Registry

A machine-readable file mapping every business rule to its expected test locations.

**Location:** `docs/ver-3/business/br-registry.json`

```json
{
  "version": "1.0",
  "rules": [
    {
      "id": "BR-05",
      "title": "Fund Allocation",
      "phase": 1,
      "modules": ["M06"],
      "priority": "P0",
      "layers": {
        "backend": { "required": true, "paths": ["handlers/dues/"] },
        "contract": { "required": true, "paths": ["tests/contract/dues-flow.hurl"] },
        "e2e": { "required": false, "paths": ["tests/e2e/journeys/dues-lifecycle.spec.ts"] }
      }
    }
  ]
}
```

- All 40 BRs pre-populated with phase, modules, priority (P0/P1/P2/P3)
- `layers.required` distinguishes mandatory vs nice-to-have per layer
- Updated when BRs change in PRD or tests are added/moved
- Single source of truth for coverage status

### 2. Test Tagging Convention

Tests reference their BR using `[BR-##]` in describe/test names.

**In existing handler test files (tagged):**
```typescript
describe('[BR-06] Payment Recording', () => {
  test('creates payment with receipt number and returns 201', ...);
  test('captures officer identity in recorded_by field', ...);
});
```

**Gap-fill tests added to same file:**
```typescript
describe('[BR-07] Dues Expiry Extension', () => {
  test('extends from current expiry date, not from today', ...);
  test('severely lapsed member resets to today + 1 cycle', ...);
});
```

**Cross-cutting BRs in dedicated files:**
```typescript
// handlers/dues/br-30.gateway-isolation.test.ts
describe('[BR-30] Payment Gateway Isolation', () => {
  test('org gateway credentials never leak to other orgs', ...);
  test('platform gateway and org gateway are separate namespaces', ...);
});
```

**Rules:**
- `[BR-##]` in `describe()` = all tests in block count toward that BR
- `[BR-##]` in `test()` = individual test covers that BR (for multi-BR tests like `[BR-07][BR-08]`)
- Cross-cutting BRs: dedicated file named `br-{id}.{topic}.test.ts` in primary module (determined by `primaryModule` field in registry)
- E2E specs: same convention in test names
- Contract tests (Hurl): comment header `# [BR-06] Payment Recording Flow`

### 3. Validation Script

**Location:** `scripts/br-coverage.ts`

**What it does:**
1. Reads `br-registry.json` for full BR list with phases and required layers
2. Greps all `*.test.ts`, `*.spec.ts`, `*.hurl` for `[BR-##]` patterns
3. Reports per-BR coverage status:
   - **COVERED**: tagged tests in all required layers
   - **PARTIAL**: tagged tests in some layers but not all required
   - **MISSING**: zero tagged tests found
   - **SKIPPED**: BR belongs to unbuilt phase (expected, not a failure)
4. Exit codes: `0` = all built-phase BRs covered, `1` = gaps exist

**Output format:**
```
BR Coverage Report
═══════════════════════════════════════════
BR-01  Membership Status     COVERED    backend:3 e2e:1
BR-03  Membership Transitions PARTIAL   backend:2 e2e:0 <- MISSING E2E
BR-05  Fund Allocation       COVERED    backend:4 contract:1
BR-38  Marketplace Referral  SKIPPED    (Phase 3, not built)
───────────────────────────────────────────
Total: 28/32 Phase 1 BRs covered (87.5%)
```

**Skill integration:**
- `/module-review`: runs script scoped to module BRs, blocks if gaps
- `/pre-commit`: informational warning, does not block
- `/ship`: blocks if any P0/P1 BR for built modules is MISSING

### 4. Updated VERTICAL_TDD Protocol

Insert Step 2.5 between TypeSpec codegen (Step 2) and backend tests (Step 3):

```
Step 2.5: BR Extraction
  1. Read docs/ver-3/business/business-rules.md
  2. List every BR-## that references this module
  3. For each BR, extract:
     - The rule statement (verbatim)
     - All edge cases mentioned in the BR text
     - Validation requirements and constraints
  4. Each edge case becomes a test case description
  5. These ARE your test specs for Steps 3-10
  6. Add BR-## entries to br-registry.json with expected test paths
  
  DISCIPLINE: You read the business rule to know what to test.
  You do NOT read the implementation to figure out what to test.
  Tests written from code confirm code. Tests written from rules catch bugs.
```

Update gate enforcement (Step 11) to include:
```
  - BR coverage: scripts/br-coverage.ts --module={module} exits 0
```

### 5. Retroactive Audit Process

For existing Phase 0 modules. Executed per-BR in priority order.

**Per BR audit step:**
1. Read BR text from `business-rules.md`
2. List every testable assertion (happy path + edge cases from BR text)
3. Search existing tests for coverage of each assertion
4. Covered assertions: add `[BR-##]` tag to existing test describe/test name
5. Uncovered assertions: write new test FROM BR TEXT (not from reading handler code)
6. Run new test. If it **fails** against existing code, you found a spec-implementation divergence. Fix the code.
7. Update `br-registry.json` with test paths

**Priority schedule:**

| Priority | BRs | Risk | Estimated effort |
|----------|-----|------|-----------------|
| P0 | BR-03, BR-05, BR-06, BR-07, BR-08, BR-30 | Money + state machines + security | ~3 hours CC |
| P1 | BR-01, BR-02, BR-09, BR-21, BR-22, BR-33 | Status computation + RBAC + identity + elections | ~3 hours CC |
| P2 | BR-04, BR-10-BR-20, BR-24-BR-29, BR-31-BR-32 | Important but lower blast radius | ~4 hours CC |
| P3 | BR-34 through BR-40 | Phase 2-3, test when module is built | 0 (future) |

### 6. Frontend BR Testing Strategy

Not every BR needs a frontend test. The registry's `layers.e2e.required` field controls which do.

| BR type | Frontend test approach |
|---------|----------------------|
| Computed display rules (BR-01 status, BR-02 grace) | Component unit test with `[BR-##]` tag |
| User flow rules (BR-06 payment, BR-33 voting) | E2E Playwright spec with `[BR-##]` tag |
| Validation rules (BR-05 fund percentages sum to 100%) | Form-level test |
| Cross-cutting (BR-21 multi-org) | E2E journey spec |
| Backend-only (BR-30 gateway isolation) | No frontend test needed |

### 7. File Changes Summary

| File | Action |
|------|--------|
| `docs/ver-3/business/br-registry.json` | CREATE: All 40 BRs with metadata |
| `scripts/br-coverage.ts` | CREATE: Validation script |
| `VERTICAL_TDD.md` | EDIT: Add Step 2.5 (BR Extraction), update gate check |
| `.claude/skills/module-review/SKILL.md` | EDIT: Add BR coverage gate |
| `.claude/skills/develop/SKILL.md` | EDIT: Add BR extraction step |
| `.claude/skills/pre-commit/SKILL.md` | EDIT: Add BR coverage warning |
| `services/api-ts/src/handlers/dues/*.test.ts` | EDIT: Tag existing tests + add gap tests |
| `services/api-ts/src/handlers/membership/*.test.ts` | EDIT: Tag + gaps |
| `services/api-ts/src/handlers/events/*.test.ts` | EDIT: Tag + gaps |
| `services/api-ts/src/handlers/dues/br-30.gateway-isolation.test.ts` | CREATE: Cross-cutting BR test |
| `services/api-ts/src/handlers/membership/br-21.multi-org.test.ts` | CREATE: Cross-cutting BR test |
| `apps/memberry/tests/e2e/journeys/br-03.membership-transitions.spec.ts` | CREATE: State machine E2E |
| `apps/memberry/tests/e2e/journeys/br-33.election-integrity.spec.ts` | CREATE: Voting E2E |

### 8. Verification

After implementation, verify:

```bash
# BR coverage script passes
bun run scripts/br-coverage.ts

# All existing tests still pass (nothing broken)
cd services/api-ts && bun test
cd apps/account && bun test

# New BR gap tests pass
bun test --grep "\[BR-"

# E2E specs (requires dev servers running)
cd apps/memberry && bun playwright test tests/e2e/

# Type check
cd services/api-ts && bunx tsc --noEmit
```

**Success criteria:**
- All P0 BRs show COVERED in report
- All P1 BRs show COVERED or PARTIAL (with E2E as the gap, not backend)
- Zero regression in existing 1267 + 350 test counts
- br-registry.json has all 40 BRs populated
- VERTICAL_TDD.md updated with Step 2.5
