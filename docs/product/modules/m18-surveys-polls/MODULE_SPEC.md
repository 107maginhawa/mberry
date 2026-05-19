# Module Specification: Surveys & Polls (M18)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Collect member feedback, conduct data gathering, and run quick polls within organizations. Supports both anonymous and identified surveys with multiple question types, distribution controls, and results analytics.

### Users
- Officer, Member

### Related Modules
- M04 (Org Admin), M05 (Membership — respondent targeting), M07 (Communications — distribution)

### In Scope
- Survey creation (anonymous/identified), question types (multiple choice, rating, text, checkbox)
- Distribution (all members, category filter, manual selection)
- Response management, deadline and reminders
- Results dashboard with aggregated analytics, export (CSV)
- Quick polls (single-question, inline results)

### Out of Scope
- Complex branching logic, external survey distribution, NPS system (M04 reviews)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Survey | Multi-question feedback form distributed to members. Can be anonymous or identified. |
| Poll | Single-question quick vote with inline results. |
| Anonymous Survey | Survey where individual responses cannot be linked to members by any user. |
| Identified Survey | Survey where officers can view individual member responses. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Create Survey | Officer | Design and distribute survey | P0 |
| Respond to Survey | Member | Fill out and submit responses | P0 |
| View Results | Officer | Aggregated results dashboard | P0 |
| Create Poll | Officer | Single-question quick poll | P1 |

## 4. Workflow Details

### Workflow: Create Survey

Actor: Officer
Steps:
1. Opens /org/[id]/officer/surveys/new.
2. Configures: title, type (anonymous/identified), questions (add/reorder/remove).
3. Question types: multiple choice, rating scale, free text, checkbox.
4. Sets distribution: all members, by category, manual selection.
5. Sets deadline, optional reminders.
6. Publishes. Members notified via M07.

### Workflow: Respond to Survey

Actor: Member
Steps:
1. Receives notification with survey link.
2. Opens /my/surveys/[id].
3. Fills out questions.
4. Submits response. "Thank you" confirmation.
5. For polls: sees results after voting (if configured).

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-40 | IF survey anonymous THEN response-to-member mapping impossible for all users including platform admin | Anonymity | Cryptographic guarantee [INFERRED] |
| M18-R1 | IF survey closed THEN no more responses accepted | Deadline | Enforce cutoff |
| M18-R2 | IF identified survey THEN only org officers can view individual responses | Privacy | Platform admin cannot see individual responses |
| M18-R3 | IF member already responded THEN allow edit until deadline (unless configured otherwise) | Re-submission | Per-survey config |
| M18-R4 | IF poll THEN show results after member votes | Polls | Inline results display |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Create/manage surveys | Officers | member | GA+HG |
| Respond to survey | Active members | non-members | GA |
| View results | Officers (own org) | member, platform admin (individual identified) | GA+OA |

## 7. Data Requirements

### Entity: Survey

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | — |
| title | Yes | Survey title | — |
| type | Yes | anonymous/identified | Enum |
| status | Yes | draft/active/closed | Enum |
| deadline | No | Response cutoff | — |
| questions | Yes | Question list | JSONB array |

### Entity: SurveyResponse

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| surveyId | Yes | Survey FK | — |
| respondentId | Conditional | Person FK (null for anonymous) | Null if anonymous |
| answers | Yes | Response data | JSONB |
| submittedAt | Yes | Submission time | — |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Survey | SurveyResponse | Question | Anonymous surveys: no respondentId stored. |

## 8. State Transitions

### Survey Status
```txt
Draft → Active (published) → Closed (deadline or manual)
```

## 9. UI / UX Requirements

### Screen: Survey List (/org/[id]/officer/surveys)
Purpose: Survey management
Components: Survey list (status, response count, deadline), create button, inline actions (edit, close)

### Screen: Survey Results (/org/[id]/officer/surveys/[id]/results)
Purpose: Aggregated results
Components: Charts (bar, pie per question), response summary, export CSV

### Screen: Member Response (/my/surveys/[id])
Purpose: Fill out survey
Components: Question list, answer inputs per type, submit button, poll results (if applicable)

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/surveys | Create survey | Survey data | surveyId | 403 |
| GET /org/:id/surveys/:id/results | Get results | — | Aggregated results | 403 |
| POST /my/surveys/:id/respond | Submit response | answers | responseId | 400, 409 deadline passed |
| GET /my/surveys | My pending surveys | — | Survey list | — |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| SurveyPublished | Survey goes active | surveyId, orgId | M07 (notification) |
| SurveyClosed | Survey deadline passed | surveyId | — |

### Consumed Events

None.

## 11. Acceptance Criteria

### AC-M18-001: Anonymity Guarantee
Anonymous survey responses cannot be linked to members by any user, including platform admin.

### AC-M18-002: Deadline Enforcement
No responses accepted after survey deadline.

### AC-M18-003: Results Privacy
Platform admin cannot access individual response-to-member mappings for identified surveys.

## 12. Test Expectations

Required tests:
- Survey CRUD: create, publish, close, question types
- Response: submission, re-edit, deadline enforcement
- Anonymity: no respondentId stored for anonymous surveys
- Results: correct aggregation per question type
- Polls: inline results after voting
- Access: only org officers can view results

## 13. Edge Cases

- Anonymous survey with 1 respondent: results still shown (no minimum [VERIFY]).
- Survey closed mid-response: submission rejected with "Survey has closed."
- Member responds twice: second submission updates first (if re-edit enabled).
- Survey with 0 responses at deadline: results page shows "No responses."

## 14. Dependencies

### Internal Dependencies
- M04 (Org Admin), M05 (Membership), M07 (Communications — distribution)

### External Dependencies
- None

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Deadline passed | Reject submission | "Survey has closed." |
| Already responded (no re-edit) | Block | "You have already responded." |

## 16. Performance Expectations

- Expected data volume: 20+ surveys per org per year, 200+ responses per survey
- Acceptable response times: Results aggregation < 2s

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| survey.published | INFO | Survey goes active | surveyId, orgId, type | No |
| survey.response.submitted | INFO | Response received | surveyId, anonymous | No (no PII) |
| survey.closed | INFO | Deadline reached | surveyId, responseCount | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| survey_responses_total | counter | type | Response count |
| survey_completion_rate | gauge | surveyId | Responses / eligible |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| surveys_enabled | release | false | Gates surveys module | — |
| surveys_polls | release | false | Quick poll feature | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M18-S1 | Survey CRUD | Create, publish, close surveys | M04 | P0 |
| M18-S2 | Question Types | MC, rating, text, checkbox | M18-S1 | P0 |
| M18-S3 | Response Collection | Member submits responses | M18-S1, M05 | P0 |
| M18-S4 | Results Dashboard | Aggregated analytics + export | M18-S3 | P0 |
| M18-S5 | Anonymous Surveys | No-respondent-ID storage | M18-S3 | P0 |
| M18-S6 | Quick Polls | Single-question inline results | M18-S1 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
