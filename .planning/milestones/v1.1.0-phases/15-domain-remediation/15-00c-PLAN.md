---
phase: 15-domain-remediation
plan: "00c"
type: tdd
wave: 0.5
depends_on: []
files_modified:
  - services/api-ts/src/handlers/association:member/createMembership.ts
  - services/api-ts/src/handlers/association:member/createMembership.test.ts
autonomous: true
requirements:
  - CODEX-P1-3
must_haves:
  truths:
    - "Membership creation with tier from different org returns 400/403"
    - "Membership creation with same-org tier succeeds"
  artifacts:
    - path: "services/api-ts/src/handlers/association:member/createMembership.test.ts"
      provides: "Cross-org tier validation tests"
    - path: "services/api-ts/src/handlers/association:member/createMembership.ts"
      provides: "Handler with org-scoped tier validation"
---

<objective>
Fix cross-org tenant isolation breach in createMembership. The handler at `createMembership.ts:35` checks `tierRepo.findOneById(body.tierId)` to verify the tier exists globally, but does NOT verify `tier.organizationId === orgId`. Any authenticated user can reference another org's tier when creating a membership, breaking tenant isolation.

Add org-scoped tier validation: after finding the tier, assert it belongs to the target org.
</objective>

<context>
@.planning/phases/15-domain-remediation/15-CONTEXT.md
@.planning/phases/15-domain-remediation/15-PATTERNS.md

This is a P1 security issue. The `createMembership` handler accepts a `tierId` in the request body and looks it up by ID alone. Since tier IDs are UUIDs and not scoped to the org in the query, a malicious user who knows (or guesses) a tier ID from another org can assign that tier to a membership in their own org.

Key files:
- `services/api-ts/src/handlers/association:member/createMembership.ts` - Handler with unscoped tier lookup
- `services/api-ts/src/handlers/association:member/repos/membership.schema.ts` - Schema definitions
</context>

<tasks>
1. **RED**: Write tests in `createMembership.test.ts`:
   - Test that creating a membership with a tier from a different org returns 400 or 403 with error code `TIER_ORG_MISMATCH`.
   - Test that creating a membership with a same-org tier succeeds (200/201).
2. **GREEN**: In `createMembership.ts`, after the `tierRepo.findOneById(body.tierId)` call (~line 35):
   - Add: `if (tier.organizationId !== orgId) throw new BusinessLogicError('Tier does not belong to this organization', 'TIER_ORG_MISMATCH');`
   - Ensure `BusinessLogicError` is imported from the appropriate error utilities.
3. **VERIFY**: Run `bun test createMembership` to confirm both test cases pass. Cross-org tier reference is rejected; same-org tier reference succeeds.
</tasks>
