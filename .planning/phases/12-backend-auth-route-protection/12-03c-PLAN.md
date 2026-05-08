---
phase: 12-backend-auth-route-protection
plan: "03c"
type: execute
wave: 3
depends_on: ["12-03"]
files_modified:
  - services/api-ts/src/handlers/association:member/createElection.ts
  - services/api-ts/src/handlers/association:member/createDuesConfig.ts
  - services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts
  - services/api-ts/src/handlers/association:member/recordDuesPayment.ts
  - services/api-ts/src/handlers/association:member/refundDuesPayment.ts
  - services/api-ts/src/handlers/association:member/createMembership.ts
  - services/api-ts/src/handlers/association:member/updateMembership.ts
  - services/api-ts/src/handlers/association:member/createOfficerTerm.ts
  - services/api-ts/src/handlers/association:member/updateOrganizationProfile.ts
  - services/api-ts/src/handlers/association:member/approveMembershipApplication.ts
  - services/api-ts/src/handlers/association:member/denyMembershipApplication.ts
  - services/api-ts/src/handlers/association:member/createPosition.ts
  - services/api-ts/src/handlers/association:member/addRosterMember.ts
  - services/api-ts/src/handlers/association:member/importRosterMembers.ts
autonomous: true
requirements:
  - D-06
  - D-07
  - D-09
must_haves:
  truths:
    - "Member gets 403 on all association:member mutation handlers"
    - "Officer gets 200 on all association:member mutation handlers"
    - "GET/list handlers remain accessible to members"
  artifacts:
    - path: "services/api-ts/src/handlers/association:member/createElection.ts"
      provides: "Officer-protected election creation"
      contains: "requireOfficerTerm"
    - path: "services/api-ts/src/handlers/association:member/createDuesConfig.ts"
      provides: "Officer-protected dues config creation"
      contains: "requireOfficerTerm"
  key_links:
    - from: "handlers/association:member/*.ts"
      to: "requireOfficerTerm"
      via: "handler-level guard call"
      pattern: "requireOfficerTerm"
---

<objective>
GREEN phase (part 3): Add requireOfficerTerm guard to all association:member mutation handlers that require officer access.

Purpose: Close the authorization gap on generated membership, dues, election, and governance mutation routes. Uses the `requireOfficerTerm` utility created in Plan 03.

Output: All officer-only association:member mutation handlers check officer status. Plan 02 RED tests pass GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/12-backend-auth-route-protection/12-RESEARCH.md
@.planning/phases/12-backend-auth-route-protection/12-03-SUMMARY.md

<interfaces>
From services/api-ts/src/utils/officer-check.ts (created in Plan 03):
```typescript
export async function requireOfficerTerm(ctx: BaseContext): Promise<Response | null>
// Returns null if allowed, Response(403) if denied
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add requireOfficerTerm to dues and membership mutation handlers</name>
  <files>
    services/api-ts/src/handlers/association:member/createDuesConfig.ts
    services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts
    services/api-ts/src/handlers/association:member/recordDuesPayment.ts
    services/api-ts/src/handlers/association:member/refundDuesPayment.ts
    services/api-ts/src/handlers/association:member/createMembership.ts
    services/api-ts/src/handlers/association:member/updateMembership.ts
    services/api-ts/src/handlers/association:member/approveMembershipApplication.ts
    services/api-ts/src/handlers/association:member/denyMembershipApplication.ts
  </files>
  <read_first>
    - services/api-ts/src/handlers/association:member/createDuesConfig.ts (handler signature)
    - services/api-ts/src/handlers/association:member/createMembership.ts (handler signature)
  </read_first>
  <action>
For each of the 8 handler files, add the `requireOfficerTerm` guard at the TOP of the function body:

```typescript
import { requireOfficerTerm } from '@/utils/officer-check';

export async function createDuesConfig(ctx: BaseContext) {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;
  
  // ... existing handler logic unchanged
}
```

Apply to: createDuesConfig, generateDuesInvoicesForOrg, recordDuesPayment, refundDuesPayment, createMembership, updateMembership, approveMembershipApplication, denyMembershipApplication.

Per D-07: do NOT add to GET/list handlers (listDuesConfigs, listMemberships, getDuesInvoice, getMembership, etc.).
Per D-09: do NOT refactor existing `requireOrgRole()` calls.
  </action>
  <verify>
    <automated>cd /Users/elad-mini/Desktop/memberry && grep -l 'requireOfficerTerm' services/api-ts/src/handlers/association:member/createDuesConfig.ts services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts services/api-ts/src/handlers/association:member/recordDuesPayment.ts services/api-ts/src/handlers/association:member/refundDuesPayment.ts services/api-ts/src/handlers/association:member/createMembership.ts services/api-ts/src/handlers/association:member/updateMembership.ts services/api-ts/src/handlers/association:member/approveMembershipApplication.ts services/api-ts/src/handlers/association:member/denyMembershipApplication.ts | wc -l</automated>
  </verify>
  <done>All 8 dues and membership mutation handlers have requireOfficerTerm guard.</done>
</task>

<task type="auto">
  <name>Task 2: Add requireOfficerTerm to election, governance, and roster mutation handlers</name>
  <files>
    services/api-ts/src/handlers/association:member/createElection.ts
    services/api-ts/src/handlers/association:member/createOfficerTerm.ts
    services/api-ts/src/handlers/association:member/createPosition.ts
    services/api-ts/src/handlers/association:member/updateOrganizationProfile.ts
    services/api-ts/src/handlers/association:member/addRosterMember.ts
    services/api-ts/src/handlers/association:member/importRosterMembers.ts
  </files>
  <action>
Same pattern as Task 1. For each of the 6 handler files, add `requireOfficerTerm` guard:

```typescript
import { requireOfficerTerm } from '@/utils/officer-check';

export async function createElection(ctx: BaseContext) {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;
  
  // ... existing handler logic unchanged
}
```

Apply to: createElection, createOfficerTerm, createPosition, updateOrganizationProfile, addRosterMember, importRosterMembers.

After this task, run Plan 02's tests to confirm GREEN:
  </action>
  <verify>
    <automated>cd /Users/elad-mini/Desktop/memberry/services/api-ts && curl -sf http://localhost:7213/health > /dev/null && bun test src/tests/route-protection-association.test.ts 2>&1 | tail -20 || echo "PREREQUISITE: API server must be running. Start with: cd services/api-ts && bun dev"</automated>
  </verify>
  <done>All 14 association:member mutation handlers have requireOfficerTerm guard. Plan 02 tests (route-protection-association) pass GREEN. Members get 403, officers get 200.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> API (generated /association/member/* mutations) | Handler-level requireOfficerTerm check |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12-11 | Elevation of Privilege | /association/member dues handlers | mitigate | requireOfficerTerm() queries officer_term at handler level |
| T-12-12 | Elevation of Privilege | /association/member election/governance handlers | mitigate | requireOfficerTerm() queries officer_term at handler level |
| T-12-13 | Elevation of Privilege | /association/member roster handlers | mitigate | requireOfficerTerm() queries officer_term at handler level |
</threat_model>

<verification>
- `grep -rl 'requireOfficerTerm' services/api-ts/src/handlers/association:member/ | wc -l` >= 14
- Plan 02 tests pass GREEN (all mutation routes return 403 for member)
- No GET/list handlers contain `requireOfficerTerm`
</verification>

<success_criteria>
- 14 association:member mutation handlers protected by requireOfficerTerm
- Plan 02 RED tests now pass GREEN
- GET/list handlers remain unprotected (member-accessible per D-07)
- No existing requireOrgRole calls modified (per D-09)
</success_criteria>

<output>
After completion, create `.planning/phases/12-backend-auth-route-protection/12-03c-SUMMARY.md`
</output>
