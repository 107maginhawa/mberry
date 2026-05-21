# Module Specification: Surveys & Polls (M18)

---
oli_version: "Phase B -- Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Collect member feedback, conduct organizational data gathering, and run quick polls within organizations. Supports both anonymous and identified surveys with multiple question types, distribution controls, deadline enforcement, and results analytics with export.

### Users
- Officer (create/manage surveys, view results), Member (respond to surveys/polls)

### Related Modules
- M04 (Org Admin -- survey creation authority), M05 (Membership -- respondent targeting/eligibility), M07 (Communications -- survey distribution notifications)

### In Scope
- Survey creation with anonymous/identified mode selection
- Question types: multiple choice, rating scale, free text, checkbox
- Distribution targeting: all members, by category, manual selection
- Response collection with deadline enforcement and optional re-edit
- Results dashboard with per-question aggregation and CSV export
- Quick polls: single-question inline results
- Anonymity guarantee (BR-40): no respondent-to-response mapping for anonymous surveys

### Out of Scope
- Complex branching logic, conditional question display
- External survey distribution (outside org members)
- NPS system (handled by M04 reviews module)
- Survey templates marketplace

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| **Association** | Top-level tenant organization. Scoped by `association_id`. |
| **Organization** | Operational unit within an association. Scoped by `organization_id`. |
| **Member** | A healthcare professional using the platform. Can belong to multiple organizations. |
| **Officer** | A member assigned an administrative role within an organization: President, Treasurer, or Secretary. |
| **Active** | Dues are current. Full access to org features. |
| **Survey** | Multi-question feedback form distributed to members. Can be anonymous or identified (see DOMAIN_GLOSSARY: Survey & Poll Terms). |
| **Poll** | Single-question quick vote with inline results (see DOMAIN_GLOSSARY: Survey & Poll Terms). |
| **Anonymous Survey** | Survey where individual responses cannot be linked to members by any user (see DOMAIN_GLOSSARY: Survey & Poll Terms). |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-100: Create Survey | Officer | Compose questions, set deadline, publish | P0 |
| WF-101: Respond to Survey | Member | Fill out and submit responses | P0 |
| WF-102: Survey Results | Officer | Aggregated analytics per question type | P0 |
| WF-103: Quick Poll | Officer/Member | Single-question poll with instant results | P1 |

## 4. Workflow Details

### WF-100: Create Survey
**Actor:** Officer (president, secretary, or officer role)
**Preconditions:** User has officer role in the organization
**Steps:**
1. Officer opens `/org/[id]/officer/surveys/new`.
2. Configures: title, type (anonymous/identified), description.
3. Adds questions: multiple choice, rating scale (1-5/1-10), free text, checkbox. Reorder/remove supported.
4. Sets distribution: all members, by membership category, or manual member selection.
5. Sets deadline (required) and optional reminder schedule.
6. Publishes survey. Members notified via M07 (Communications).
**Alternate Flows:** Save as draft without publishing. Edit draft before publishing.
**Exception Flows:** No questions added -- validation error. No deadline set -- validation error.
**Postconditions:** Survey record with status `active`. Domain event `SurveyPublished` emitted. Eligible members notified.

### WF-101: Respond to Survey
**Actor:** Active member targeted by the survey
**Preconditions:** Member is active, survey is active and not past deadline
**Steps:**
1. Member receives notification with survey link.
2. Opens `/my/surveys/[id]`.
3. Fills out all required questions.
4. Submits response. Confirmation shown.
5. If re-edit enabled and before deadline, member can modify response.
**Alternate Flows:** Member saves partial response as draft (if supported).
**Exception Flows:** Survey closed mid-response -- submission rejected with "Survey has closed."
**Postconditions:** SurveyResponse record created. For anonymous: `respondentId` is null.

### WF-102: Survey Results
**Actor:** Officer (own org only)
**Preconditions:** Survey exists with at least one response
**Steps:**
1. Officer opens `/org/[id]/officer/surveys/[id]/results`.
2. Views aggregated results per question (charts: bar/pie for MC, average for rating, word cloud for text).
3. For identified surveys: can view individual responses (officers only, not platform admin).
4. Exports results as CSV.
**Postconditions:** None (read-only).

### WF-103: Quick Poll
**Actor:** Officer (creates), Member (votes)
**Preconditions:** Officer role for creation; active member for voting
**Steps:**
1. Officer creates single-question poll with options.
2. Members vote on the poll.
3. After voting, member sees current results inline.
**Postconditions:** Poll response recorded. Results updated in real-time.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-40 | IF survey is anonymous THEN response-to-member mapping is impossible for all users including platform admin | Anonymity | No `respondentId` stored; cryptographic guarantee |
| M18-R1 | IF survey deadline passed THEN no more responses accepted | Deadline | Enforce cutoff; reject late submissions with error |
| M18-R2 | IF identified survey THEN only org officers can view individual responses | Privacy | Platform admin cannot see individual response-to-member mappings |
| M18-R3 | IF member already responded THEN allow edit until deadline (unless re-edit disabled per survey config) | Re-submission | Per-survey configuration |
| M18-R4 | IF poll THEN show results inline after member votes | Polls | Instant results display |
| M18-R5 | IF survey active THEN only targeted members can respond | Distribution | Non-targeted members cannot see/access the survey |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Create/manage surveys | president, secretary, officer | member, staff | GA+HG |
| Publish survey | president, secretary, officer | member, staff | GA+HG |
| Respond to survey | Active members (targeted) | non-members, Grace, Lapsed | GA |
| View aggregated results | Officers (own org) | member | GA+OA |
| View individual responses (identified) | Officers (own org) | member, platform admin | GA+OA |
| Export results | Officers (own org) | member, platform admin | GA+OA |
| Create poll | president, secretary, officer | member, staff | GA+HG |

## 7. Data Requirements

### Entity: Survey

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | uuid |
| title | Yes | Survey title | varchar(300) |
| description | No | Survey description | text |
| type | Yes | anonymous/identified | Enum: `anonymous`, `identified` |
| status | Yes | Current status | Enum: `draft`, `active`, `closed` (default: draft) |
| deadline | Yes | Response cutoff datetime | timestamp |
| questions | Yes | Question definitions | JSONB array of question objects |
| distribution | Yes | Target audience config | JSONB: `{type: 'all' | 'category' | 'manual', filter?: ...}` |
| allowReEdit | No | Allow response editing | boolean (default: true) |
| createdBy | Yes | Officer who created | uuid FK person |

### Entity: SurveyResponse

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| surveyId | Yes | Survey FK | uuid |
| respondentId | Conditional | Person FK | null for anonymous surveys (BR-40) |
| answers | Yes | Response data | JSONB keyed by question ID |
| submittedAt | Yes | Submission timestamp | timestamp |
| updatedAt | No | Last edit timestamp | timestamp |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Survey | SurveyResponse | Question (JSONB) | Anonymous surveys: no respondentId stored (BR-40). Deadline enforced on submission. |

## 8. State Transitions

### Survey Status
```txt
Draft --> Active (officer publishes; must have >= 1 question and deadline set)
Active --> Closed (deadline reached OR officer manually closes)
```
No reverse transitions. Closed surveys are immutable.

## 9. UI/UX Requirements

### Screen: Survey List (/org/[id]/officer/surveys)
**Purpose:** Survey management dashboard
**Users:** Officers
**Components:** Survey table (title, type badge, status, response count, deadline), create button, inline actions (edit draft, close active, view results)
**States:** Loading (skeleton table), Empty ("No surveys yet. Create your first survey."), Success (survey list), UnexpectedError (generic retry)

### Screen: Survey Builder (/org/[id]/officer/surveys/new)
**Purpose:** Create/edit survey
**Users:** Officers
**Components:** Title input, type selector (anonymous/identified), question builder (add/reorder/remove), distribution selector, deadline picker, reminders toggle, publish button
**States:** Loading, Success (form), ValidationError (inline per field), UnexpectedError

### Screen: Survey Results (/org/[id]/officer/surveys/[id]/results)
**Purpose:** View aggregated results
**Users:** Officers
**Components:** Response count summary, per-question charts (bar for MC, pie for checkbox, average/distribution for rating, text list for free text), CSV export button, individual response viewer (identified only)
**States:** Loading, Empty ("No responses yet."), Success (charts), UnexpectedError

### Screen: Member Survey Response (/my/surveys/[id])
**Purpose:** Fill out and submit survey response
**Users:** Active members (targeted)
**Components:** Survey title/description, question list with appropriate inputs per type, submit button, edit button (if re-edit enabled and before deadline)
**States:** Loading, Success (form), Submitted ("Thank you for your response."), Closed ("Survey has closed."), AlreadyResponded (show response with edit option or "Already responded"), PermissionError

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/surveys | Create survey | Survey data (title, type, questions, distribution, deadline) | surveyId | 403, 400 |
| PUT /org/:id/surveys/:id | Update draft survey | Updated fields | Updated survey | 403, 400, 409 (not draft) |
| POST /org/:id/surveys/:id/publish | Publish survey | -- | Updated survey | 403, 400 (no questions/deadline) |
| POST /org/:id/surveys/:id/close | Close survey manually | -- | Updated survey | 403 |
| GET /org/:id/surveys/:id/results | Get aggregated results | -- | Aggregated results per question | 403 |
| GET /org/:id/surveys/:id/results/export | Export CSV | -- | CSV file | 403 |
| POST /my/surveys/:id/respond | Submit response | answers (JSONB) | responseId | 400, 409 (closed/already responded) |
| PUT /my/surveys/:id/respond | Edit response | answers (JSONB) | Updated response | 400, 409 (closed/re-edit disabled) |
| GET /my/surveys | List pending surveys for member | page? | Paginated survey list | -- |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| SurveyPublished | Survey goes active | surveyId, orgId, type, distribution | M07 (notification to targeted members) |
| SurveyClosed | Survey deadline reached or manually closed | surveyId, responseCount | -- |
| SurveyResponseSubmitted | Member submits response | surveyId, anonymous (boolean) | -- |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipStatusChanged | M05 | Check respondent eligibility | Prevent response if no longer active |

## 11. Acceptance Criteria

### AC-M18-001: Anonymous Survey Privacy
Given an anonymous survey, when any user (including platform admin) views responses, then no response can be linked to a specific member (respondentId is null in storage).

### AC-M18-002: Deadline Enforcement
Given a survey with a deadline of 2026-06-01T00:00:00Z, when a member submits a response at 2026-06-01T00:00:01Z, then the submission is rejected with "Survey has closed."

### AC-M18-003: Officer-Only Individual Responses
Given an identified survey, when a platform admin requests individual responses, then access is denied (only org officers can view).

### AC-M18-004: Response Re-Edit
Given a survey with re-edit enabled, when a member who already responded submits again before the deadline, then the previous response is updated.

### AC-M18-005: Aggregated Results Display
Given a published survey, when the officer views results, then aggregated data is shown per question type (counts for MC, average for rating, text list for free text).

### AC-M18-006: Instant Poll Results
Given a quick poll, when a member votes, then results are displayed inline immediately after submission.

## 12. Test Expectations

- **Survey CRUD:** create draft, edit draft, publish (requires questions + deadline), close
- **Question types:** MC (single/multi), rating scale, free text, checkbox -- all store and aggregate correctly
- **Response lifecycle:** submit, re-edit (when enabled), deadline enforcement, duplicate prevention
- **Anonymity (BR-40):** verify no respondentId stored for anonymous surveys at DB level
- **Results aggregation:** correct counts, averages, percentages per question type
- **Distribution targeting:** all members, by category, manual selection
- **Polls:** create, vote, inline results after voting
- **Access control:** officers create/view results, members respond only, platform admin blocked from individual identified responses
- **Export:** CSV contains correct aggregated data

## 13. Edge Cases

- Anonymous survey with 1 respondent: results still shown (no minimum threshold). [VERIFY -- privacy concern with n=1]
- Survey closed mid-response: submission rejected with "Survey has closed."
- Member responds twice (re-edit disabled): second submission blocked with "You have already responded."
- Survey with 0 responses at deadline: results page shows "No responses received."
- Member's membership lapses after survey published but before deadline: response blocked.
- Officer edits questions on a draft that already has a saved version: overwrites previous draft.

## 14. Dependencies

### Internal Dependencies
- M04 (Org Admin -- officer authority for survey creation)
- M05 (Membership -- respondent eligibility, category-based targeting)
- M07 (Communications -- survey distribution notifications)

### External Dependencies
- None

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Deadline passed | Reject submission (409) | "Survey has closed." |
| Already responded (re-edit disabled) | Block submission (409) | "You have already responded to this survey." |
| Survey not found | 404 | "Survey not found." |
| Not targeted for survey | 403 | "You are not eligible for this survey." |
| Publish without questions | 400 | "Survey must have at least one question." |
| Publish without deadline | 400 | "Survey must have a deadline." |

## 16. Performance Expectations

- **Data volume:** 20-50 surveys per org per year, 50-500 responses per survey
- **Concurrent users:** 100+ simultaneous respondents during large org surveys
- **Response times:** Results aggregation < 2s for surveys with 500 responses
- **Caching:** Aggregated results cacheable (invalidate on new response); survey list cacheable (5min TTL)

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| survey.published | INFO | Survey goes active | surveyId, orgId, type | No |
| survey.response.submitted | INFO | Response received | surveyId, anonymous (boolean) | No |
| survey.closed | INFO | Deadline reached or manual close | surveyId, responseCount | No |
| survey.results.exported | INFO | CSV export triggered | surveyId, officerId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| survey_responses_total | counter | type (anonymous/identified) | Total response count |
| survey_completion_rate | gauge | surveyId | Responses / eligible members |
| surveys_active_total | gauge | orgId | Active surveys per org |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| surveys_enabled | release | false | Gates entire surveys module | -- |
| surveys_polls | release | false | Quick poll feature | -- |
| surveys_csv_export | release | true | CSV export in results | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M18-S1 | Survey CRUD | Create, edit, publish, close surveys | M04 | P0 |
| M18-S2 | Question Types | MC, rating, text, checkbox input/storage | M18-S1 | P0 |
| M18-S3 | Response Collection | Member submits/edits responses with deadline enforcement | M18-S1, M05 | P0 |
| M18-S4 | Results Dashboard | Aggregated analytics per question + CSV export | M18-S3 | P0 |
| M18-S5 | Anonymous Surveys | No-respondent-ID storage, BR-40 enforcement | M18-S3 | P0 |
| M18-S6 | Quick Polls | Single-question inline results | M18-S1 | P1 |
| M18-S7 | Distribution Targeting | Category/manual member selection | M18-S1, M05 | P1 |

## 20. AI Instructions

When implementing this module:
1. **No DOMAIN_MODEL tables exist yet** -- schema must be created from scratch at `services/api-ts/src/handlers/surveys/repos/survey.schema.ts`.
2. TypeSpec first: define endpoints in `specs/api/src/modules/surveys.tsp`.
3. Anonymous survey implementation: the `respondentId` column must be nullable. For anonymous surveys, store null -- do not store and then mask. This is the BR-40 guarantee.
4. Questions stored as JSONB array on the survey record. Each question has: `id` (uuid), `type` (enum), `label` (text), `options` (array, for MC/checkbox), `required` (boolean).
5. Response answers stored as JSONB keyed by question ID.
6. Results aggregation: compute on-read from SurveyResponse records. Cache with invalidation on new response.
7. Distribution targeting: store target config on survey; filter eligible members at notification time via M05 membership queries.
8. Follow Router -> Validators -> Handlers -> Repositories pattern per ARCHITECTURE.md.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | |
| 2. Domain Terms | COMPLETE | Survey, Poll, Anonymous Survey referenced from DOMAIN_GLOSSARY: Survey & Poll Terms |
| 3. Workflows | COMPLETE | From WORKFLOW_MAP |
| 4. Workflow Details | COMPLETE | |
| 5. Business Rules | COMPLETE | BR-40 from upstream; M18-R1 through R5 module-specific |
| 6. Permissions | PARTIAL | No ROLE_PERMISSION_MATRIX section for M18 |
| 7. Data Requirements | PARTIAL | No DOMAIN_MODEL tables |
| 7b. Aggregate Boundaries | COMPLETE | |
| 8. State Transitions | COMPLETE | |
| 9. UI/UX Requirements | COMPLETE | Full state coverage |
| 10. API Expectations | COMPLETE | Expanded from v1.0 |
| 10b. Domain Events | COMPLETE | |
| 11. Acceptance Criteria | COMPLETE | Given/When/Then format |
| 12. Test Expectations | COMPLETE | |
| 13. Edge Cases | COMPLETE | |
| 14. Dependencies | COMPLETE | From MODULE_MAP |
| 15. Error Handling | COMPLETE | |
| 16. Performance | COMPLETE | |
| 17. Observability | COMPLETE | |
| 18. Feature Flags | COMPLETE | |
| 19. Vertical Slice Plan | COMPLETE | Added M18-S7 |
| 20. AI Instructions | COMPLETE | |
| 21. Section Completeness | COMPLETE | |
| 22. Downstream Impact | COMPLETE | |

## 22. Downstream Impact

- **DOMAIN_MODEL.md**: Needs `survey` and `survey_response` table definitions added (currently absent)
- **DOMAIN_GLOSSARY.md**: Needs `Survey`, `Poll`, `Anonymous Survey`, `Identified Survey` term definitions
- **ROLE_PERMISSION_MATRIX.md**: Needs section 3.x for Surveys & Polls module
- **M07 (Communications)**: Must support survey distribution notifications (consumed event)
- **API_CONTRACTS.md**: Survey endpoints not yet defined -- will need TypeSpec definitions
