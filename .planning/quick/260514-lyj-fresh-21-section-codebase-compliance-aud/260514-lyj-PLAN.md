---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md
  - docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT_2026-05-13.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Old audit archived as EXISTING_CODEBASE_ADOPTION_AUDIT_2026-05-13.md"
    - "New audit has all 21 sections populated with fresh metrics"
    - "Health score computed from 12 dimensions with evidence citations"
    - "DDD classification table present for all major entities"
    - "BR-test traceability table with STRONG/WEAK/NONE assertion quality"
    - "No stale numbers carried from old audit — all counts re-gathered"
    - "Debunked false positives from old audit not re-reported"
  artifacts:
    - path: "docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md"
      provides: "Fresh 21-section compliance audit report"
    - path: "docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT_2026-05-13.md"
      provides: "Archived previous audit for reference"
  key_links: []
---

<objective>
Fresh 21-section codebase compliance audit replacing stale May 13 report.

Purpose: Current-state assessment after v1.2.0 milestone completion (31/31 requirements). All metrics gathered live from filesystem — no stale carryover.
Output: `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` (replaced), old archived.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md
@CLAUDE.md
@CONTRIBUTING.md
@VERTICAL_TDD.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Archive old audit + collect all metrics via ctx_batch_execute</name>
  <files>docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT_2026-05-13.md</files>
  <action>
1. Read `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` and copy it to `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT_2026-05-13.md` via Bash `cp`.

2. Extract the "Corrections from Verification" section from the old audit — these are debunked false positives that MUST NOT be re-reported in the new audit (e.g., "36 unprotected routes" was incorrect, "11 tables missing organizationId" was incorrect).

3. Run a SINGLE ctx_batch_execute call with ALL metric-gathering commands. Use descriptive labels for each:

**Counts:**
- "handler-module-dirs": `ls -1d services/api-ts/src/handlers/*/`
- "handler-files-per-module": `for d in services/api-ts/src/handlers/*/; do echo "$(basename $d): $(find $d -name '*.ts' ! -name '*.test.ts' ! -name '*.spec.ts' ! -path '*/node_modules/*' | wc -l)"; done`
- "test-files-per-module": `for d in services/api-ts/src/handlers/*/; do echo "$(basename $d): $(find $d -name '*.test.ts' -o -name '*.spec.ts' | wc -l)"; done`
- "schema-tables": `grep -r 'pgTable' services/api-ts/src/handlers/*/repos/*.schema.ts 2>/dev/null | wc -l`
- "schema-enums": `grep -r 'pgEnum' services/api-ts/src/handlers/*/repos/*.schema.ts 2>/dev/null | wc -l`
- "typespec-modules": `ls -1 specs/api/src/modules/*.tsp 2>/dev/null`
- "openapi-endpoint-count": `grep -c '"/' specs/api/dist/openapi/openapi.json 2>/dev/null || echo 'parse manually'`
- "hurl-test-count": `find specs/api/tests/contract -name '*.hurl' | wc -l`
- "migration-count": `ls -1 services/api-ts/src/generated/migrations/*.sql 2>/dev/null | wc -l`
- "e2e-test-files": `find apps -name '*.spec.ts' -path '*/e2e/*' -o -name '*.spec.ts' -path '*/__tests__/*' 2>/dev/null | wc -l`
- "frontend-routes-memberry": `find apps/memberry/src/routes -name '*.tsx' 2>/dev/null | wc -l`
- "frontend-routes-admin": `find apps/admin/src/routes -name '*.tsx' 2>/dev/null | wc -l`
- "frontend-routes-account": `find apps/account/src/routes -name '*.tsx' 2>/dev/null | wc -l`

**Auth + Permissions:**
- "app-ts-middleware-stack": `cat services/api-ts/src/app.ts`
- "middleware-files": `ls -la services/api-ts/src/middleware/`
- "auth-middleware-content": `cat services/api-ts/src/middleware/*.ts`
- "officer-auth-usage": `grep -rn 'requirePosition\|requireOfficerTerm\|requireOrgRole\|officerAuth\|platformAdminAuth' services/api-ts/src/handlers/ --include='*.ts' -l`
- "unprotected-route-check": `grep -n 'app\.\(get\|post\|put\|patch\|delete\)' services/api-ts/src/app.ts`
- "role-definitions": `cat services/api-ts/src/types/auth.ts 2>/dev/null`
- "org-auth-hierarchy": `cat services/api-ts/src/utils/org-auth.ts 2>/dev/null`

**Business Rules + DDD:**
- "business-rules-file": `cat docs/ver-3/business/business-rules.md 2>/dev/null || echo 'not found'`
- "br-registry": `cat .claude/skills/br-extract/br-registry.json 2>/dev/null | head -200`
- "schema-relations": `grep -rn 'references\|foreignKey\|cascade' services/api-ts/src/handlers/*/repos/*.schema.ts 2>/dev/null | head -100`
- "status-enums": `grep -rn 'Enum\|Status' services/api-ts/src/handlers/*/repos/*.schema.ts 2>/dev/null | grep -i 'enum\|status'`
- "cross-module-imports": `grep -rn "from '.*handlers/" services/api-ts/src/handlers/ --include='*.ts' | grep -v node_modules | head -80`

**API Surface:**
- "error-patterns": `grep -rn 'HTTPException\|throw new\|status: 4\|status: 5' services/api-ts/src/handlers/ --include='*.ts' -l | head -30`
- "pagination-patterns": `grep -rn 'offset\|limit\|page\|cursor' services/api-ts/src/handlers/ --include='*.ts' -l | head -30`
- "response-shape-check": `grep -rn 'c\.json\|return c' services/api-ts/src/handlers/ --include='*.ts' | head -50`

**Frontend + UI:**
- "admin-fetch-usage": `grep -rn "fetch(" apps/admin/src/ --include='*.ts' --include='*.tsx' | head -30`
- "sdk-usage-admin": `grep -rn '@monobase/sdk' apps/admin/src/ --include='*.ts' --include='*.tsx' | head -20`
- "mock-data-check": `grep -rn 'mock\|dummy\|placeholder\|TODO\|FIXME\|hardcoded' apps/memberry/src/ apps/admin/src/ --include='*.tsx' --include='*.ts' -l 2>/dev/null | head -30`
- "component-test-count": `find apps -name '*.test.tsx' -o -name '*.test.ts' | grep -v node_modules | grep -v e2e | wc -l`

**State Machines:**
- "status-transition-handlers": `grep -rn 'status.*=\|setStatus\|updateStatus\|transition' services/api-ts/src/handlers/ --include='*.ts' | head -60`

4. Also run a second ctx_batch_execute for deeper investigation:
- "br-test-mapping": For each BR-NN found in business-rules.md, grep test files for that BR identifier: `grep -rn 'BR-' services/api-ts/src/handlers/ --include='*.test.ts' | head -100`
- "e2e-spec-list": `find apps -name '*.spec.ts' -path '*/e2e/*' 2>/dev/null`
- "typespec-vs-handwired": `grep -n 'app\.\(get\|post\|put\|patch\|delete\)' services/api-ts/src/app.ts | grep -v 'generated\|openapi'`
- "domain-glossary-existing": `cat docs/DOMAIN_GLOSSARY.md 2>/dev/null | head -100`
- "all-schema-files": `find services/api-ts/src/handlers -name '*.schema.ts' | sort`
  </action>
  <verify>
    <automated>test -f docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT_2026-05-13.md && echo "Archive exists"</automated>
  </verify>
  <done>Old audit archived. All metrics indexed in context-mode for report writing. Debunked false positives extracted and noted.</done>
</task>

<task type="auto">
  <name>Task 2: Write fresh 21-section audit report</name>
  <files>docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md</files>
  <action>
Using ALL metrics collected in Task 1 (retrieved via ctx_search as needed), write the complete 21-section audit report to `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` using the Write tool.

**Section order and requirements:**

**Section 1: Executive Summary** (write LAST, after all evidence gathered)
- Overall health score (from Section 20)
- Top 3 strengths, top 3 gaps
- Recommended next action

**Section 2: Project Overview**
- Fresh counts: tables, enums, endpoints, handlers, tests, migrations
- v1.2.0 milestone status (31/31 complete)
- Tech stack summary

**Section 3: Project Structure**
- Monorepo layout with file counts per workspace
- App descriptions (account, admin, memberry)

**Section 4: Module Map**
- All handler modules with handler count, test count, TypeSpec coverage
- Dependency matrix showing cross-module imports
- Which modules import from which other modules

**Section 5: Domain Glossary with DDD Classification**
- Table with columns: Term | Definition | DDD Type (Aggregate Root / Entity / Value Object / Domain Event) | Bounded Context
- Identify aggregate roots from cascade/child patterns in schemas
- Name domain events from status transitions (past tense: MembershipApproved, DuesPaymentReceived)
- Map bounded context candidates
- Flag missing anti-corruption layers between contexts

**Section 6: Permission Summary**
- Role matrix: which roles access which modules
- List of unprotected routes (if any remain)
- Auth middleware coverage per handler directory
- Officer position requirements per module

**Section 7: Business Rules Summary**
- Count and classify each BR by type: explicit / technical / UI-only / inferred / uncertain
- Confidence level per rule (HIGH/MEDIUM/LOW)
- Coverage status (tested/untested)

**Section 8: API Surface Summary**
- Endpoint count per module
- Consistency findings: pagination patterns, error shapes, response formats
- TypeSpec coverage percentage
- Hand-wired vs generated route ratio

**Section 9: State Machines**
- All status enums with valid transitions
- Which transitions have guard logic in handlers
- Missing transition guards (status changes without validation)

**Section 10: UI/Screens Summary**
- Route count per app (memberry, admin, account)
- Prototype vs production status per screen
- Mock data contamination findings
- SDK usage vs raw fetch in admin app

**Section 11: Test Coverage Summary**
- Per-module breakdown table: module | unit tests | integration tests | e2e tests | contract tests
- BR-test traceability table: BR-NN | Test File | Assertion Quality (STRONG/WEAK/NONE) | Notes
  - STRONG: Tests specific behavior with assertions on return values/DB state
  - WEAK: Tests exist but only check status codes or basic shape
  - NONE: No test covers this business rule
- 9 interaction states audit per key screen: loading | empty | success | validation-error | permission-error | unexpected-error | conflict | confirmation | disabled
- Assertion quality breakdown by category (rules, permissions, APIs, states, validation, UI, interactions, accessibility)

**Section 12: Repository Guardrails Review**
- Pre-commit hooks, linting, type checking enforcement
- CI/CD pipeline coverage
- Generated file protection

**Section 13: PRD/Spec Coverage Review**
- MASTER_PRD.md requirements vs implemented features
- Spec coverage gaps

**Section 14: Standards Gap Matrix**
- Table: Gap ID | Description | Priority (P0/P1/P2/P3) | Affected Modules | Recommended Fix
- P0 = security/data-loss risk
- P1 = correctness/reliability
- P2 = consistency/maintainability
- P3 = nice-to-have

**Section 15: Inconsistency Report**
- Cross-reference findings: naming (orgId vs organizationId), error patterns, response shapes
- TypeSpec vs handler mismatches

**Section 16: Risk Assessment**
- P0/P1/P2/P3 risks with likelihood and impact
- Mitigation status

**Section 17: Stabilization Plan**
- Ordered list of fixes by priority
- Estimated effort per fix

**Section 18: Standards Adoption Plan**
- Which standards to adopt first
- Migration path for existing code

**Section 19: Recommended First 3 Vertical Slices**
- Three modules best suited for full vertical standardization
- Why each was chosen

**Section 20: Health Score**
- 12 dimensions, each scored 1-10 with evidence:
  1. Terminology consistency
  2. Permission coverage
  3. Business rule clarity
  4. API consistency
  5. State machine safety
  6. Error handling uniformity
  7. Backend test coverage
  8. Frontend test coverage
  9. PRD/spec coverage
  10. UI prototype readiness
  11. Architecture alignment
  12. Domain model clarity
- Composite score = average of all 12

**Section 21: Final Recommendations**
- Top 5 actions ordered by impact
- Routing: which workflow to run next (audit-compliance, vertical-slice-plan, or confidence-stack)

**CRITICAL RULES:**
- Every number must come from Task 1 metrics — NO guessing, NO carrying stale numbers
- Do NOT re-report debunked false positives from old audit's "Corrections from Verification" section
- Reference old audit's P0/P1 resolution history as a changelog appendix at the end
- Use evidence citations: "X files found via `grep pattern`" style
- If a metric cannot be determined from collected data, mark as "REQUIRES MANUAL VERIFICATION" — do not fabricate

Write the complete report as a single Write tool call to `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md`.
  </action>
  <verify>
    <automated>grep -c '^## ' docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md | xargs -I{} test {} -ge 21 && echo "21+ sections present" || echo "Missing sections"</automated>
  </verify>
  <done>
- All 21 sections populated with fresh metrics from Task 1
- Health score computed from 12 dimensions with evidence
- DDD classification table present
- BR-test traceability table with assertion quality ratings
- No debunked false positives re-reported
- P0/P1 resolution history preserved as appendix
  </done>
</task>

</tasks>

<verification>
1. `test -f docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT_2026-05-13.md` — old audit archived
2. `grep -c '^## ' docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` — 21+ section headers
3. `grep -c 'DDD\|Aggregate Root\|Bounded Context' docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` — DDD analysis present
4. `grep -c 'STRONG\|WEAK\|NONE' docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` — assertion quality ratings present
5. `grep -c 'Health Score\|/10' docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` — health scores present
</verification>

<success_criteria>
- Fresh 21-section audit at docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md
- Old audit archived with date suffix
- All metrics gathered live (no stale carryover)
- 12-dimension health score with evidence
- DDD classification for all major entities
- BR-test traceability with STRONG/WEAK/NONE quality
- Debunked false positives not re-reported
</success_criteria>

<output>
This is a quick task — no SUMMARY file needed.
Report verification: count section headers, check for DDD/BR tables, verify health score dimensions.
</output>
