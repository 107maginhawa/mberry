---
slice: w1-t8-special-assessments
phase: wave1-financial
priority: P3
agent_skills: [oli-execution-gate]
---

# T8: Special Assessments CRUD

## Goal
One-time charges as first-class concept alongside dues. Officers create assessments, apply to members, track collection.

## Acceptance Criteria

- **AC-T8-001**: `specialAssessments` table created with: id, organizationId, name, description, amount, currency, dueDate, fundId (nullable FK), appliesTo (enum: all/selected), status (enum: draft/active/closed), createdBy, createdAt, updatedAt
- **AC-T8-002**: `specialAssessmentTargets` table created with: id, assessmentId (FK), personId (FK), invoiceId (nullable FK to duesInvoices), status (enum: pending/paid)
- **AC-T8-003**: `POST /association/member/special-assessments` creates assessment (officer auth required)
- **AC-T8-004**: `GET /association/member/special-assessments/{orgId}` lists assessments with collection summary
- **AC-T8-005**: `PUT /association/member/special-assessments/{id}` updates assessment (draft status only)
- **AC-T8-006**: `DELETE /association/member/special-assessments/{id}` soft-deletes assessment (draft status only)
- **AC-T8-007**: `POST /association/member/special-assessments/{id}/apply` generates duesInvoices for all targeted members
- **AC-T8-008**: `GET /association/member/special-assessments/{id}/collection` returns collection metrics (total, paid, pending counts + amounts)
- **AC-T8-009**: Apply is idempotent — re-applying does not create duplicate invoices for members who already have one

## Business Rules

- **BR-T8-001**: IF assessment status is "active" or "closed" THEN update/delete returns 409 Conflict
- **BR-T8-002**: IF appliesTo is "all" THEN apply generates invoices for all active members in org
- **BR-T8-003**: IF appliesTo is "selected" THEN apply generates invoices only for members in specialAssessmentTargets
- **BR-T8-004**: IF member already has invoice for this assessment THEN apply skips that member (idempotent)
- **BR-T8-005**: IF assessment has fundId THEN generated invoices inherit fund allocation

## Files in Scope
- `services/api-ts/src/handlers/association:member/repos/special-assessments.schema.ts` — NEW
- `services/api-ts/src/handlers/association:member/repos/special-assessments.repo.ts` — NEW
- `services/api-ts/src/handlers/association:member/createSpecialAssessment.ts` — NEW
- `services/api-ts/src/handlers/association:member/listSpecialAssessments.ts` — NEW
- `services/api-ts/src/handlers/association:member/updateSpecialAssessment.ts` — NEW
- `services/api-ts/src/handlers/association:member/deleteSpecialAssessment.ts` — NEW
- `services/api-ts/src/handlers/association:member/applySpecialAssessment.ts` — NEW
- `services/api-ts/src/handlers/association:member/getSpecialAssessmentCollection.ts` — NEW
- Frontend: officer CRUD form + collection page
- Tests for each handler

## Out of Scope
- Training/event fee integration
- Unified cross-module "My Finances" page
- Recurring assessments
