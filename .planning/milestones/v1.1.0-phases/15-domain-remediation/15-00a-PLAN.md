---
phase: 15-domain-remediation
plan: "00a"
type: tdd
wave: 0.5
depends_on: []
files_modified:
  - apps/memberry/src/features/dues/components/dues-config-form.tsx
autonomous: true
requirements:
  - CODEX-P1-1
must_haves:
  truths:
    - "Form submits annualAmount (not defaultAmount) to PATCH endpoint"
    - "Saved config values persist after page reload"
  artifacts:
    - path: "apps/memberry/src/features/dues/components/dues-config-form.tsx"
      provides: "Dues config form with corrected PATCH payload mapping"
---

<objective>
Fix silent data loss in dues config form. The form sends fields the PATCH API strips (defaultAmount, currency, billingFrequency, dueDate*, reminderSchedules). Only annualAmount, gracePeriodDays, fundAllocations, effectiveDate, and status are accepted by UpdateDuesConfigBody validator. Edits appear to save but silently disappear on reload.

Map form fields to match the PATCH API's accepted fields: `defaultAmount` -> `annualAmount`, drop unsupported fields from the submission payload.
</objective>

<context>
@.planning/phases/15-domain-remediation/15-CONTEXT.md
@.planning/phases/15-domain-remediation/15-PATTERNS.md

The bug is at `dues-config-form.tsx:187` where the form's `onSubmit` constructs a payload using form field names that don't match the API's `UpdateDuesConfigBody` validator. The API silently strips unknown fields and returns 200, so the user sees a success toast but data reverts on reload.

Key files:
- `apps/memberry/src/features/dues/components/dues-config-form.tsx` - Form component with mismatched field names
- `services/api-ts/src/handlers/dues/getDuesConfig.ts` - Backend PATCH handler with UpdateDuesConfigBody validator
</context>

<tasks>
1. **RED**: Write a test (or extend existing) that asserts the form submission payload contains `annualAmount` (not `defaultAmount`) and excludes stripped fields (currency, billingFrequency, dueDate*, reminderSchedules).
2. **GREEN**: Update the `onSubmit` handler in `dues-config-form.tsx` to map `defaultAmount` -> `annualAmount` and only include fields accepted by `UpdateDuesConfigBody`: annualAmount, gracePeriodDays, fundAllocations, effectiveDate, status.
3. **VERIFY**: Confirm the mutation call sends the correct payload shape. Saved values must persist after page reload.
</tasks>
