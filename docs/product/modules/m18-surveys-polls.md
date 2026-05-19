# Module 18: Surveys & Polls

- **Phase:** 3
- **Monetization:** Add-on
- **Dependencies:** M05 (Membership), M07 (Communications)

---

## Overview

Surveys and Polls allow association officers to gather structured feedback from their members. Surveys support multiple question types and detailed analysis. Polls are lightweight single-question instruments with real-time results. Anonymity is the default and is protected at the platform level.

---

## Key Specifications

### Survey Types

| Type | Description |
|------|-------------|
| Anonymous (default) | Responses cannot be linked to individual members. This is the default for all surveys. |
| Identified (opt-in) | Association officers can enable identified responses. Members are informed before responding that their identity will be attached. Must be explicitly opted in per survey. |

**BR-40:** Platform admin cannot deanonymize individual responses regardless of survey type. Even for identified surveys, the platform admin role does not have access to link responses to members -- only the association's authorized officers can view identified responses.

### Question Types

| Type | Description |
|------|-------------|
| Multiple choice | Single-select or multi-select from predefined options |
| Rating scale | Numeric scale (e.g., 1-5 or 1-10) with optional labels |
| Free text | Open-ended text response with configurable max length |
| Ranking | Order a list of items by preference |

### Distribution

- **All org members:** Send to every member in the association regardless of status.
- **Active members only:** Send only to members with Active status.
- **Specific categories:** Target by member category (e.g., specialty, chapter, membership tier) as configured by the association.

Distribution is handled through M07 (Communications). Members receive a notification with a link to respond.

### Response Management

- **Deadline:** Each survey has a configurable response deadline. After the deadline, the survey closes and no further responses are accepted.
- **Reminders:** Automated reminders sent via M07 Communications to members who have not yet responded. Reminder schedule is configurable (e.g., 3 days before deadline, 1 day before deadline).
- **One response per member:** Each member can submit one response per survey. They can edit their response before the deadline if the survey allows it.

### Results & Export

- Results are aggregated and displayed to authorized officers.
- Charts and summaries for multiple choice and rating scale questions.
- Free text responses listed (anonymized if anonymous survey).
- Export aggregate results to CSV. Export includes question text, response counts, percentages, and averages where applicable.
- Individual response-level export is available only for identified surveys and only to authorized officers.

### Polls

- Quick single-question format. Supports multiple choice only.
- Real-time results visible to respondents after they vote (configurable: show results immediately or after poll closes).
- Same distribution options as surveys.
- No deadline required (can be open-ended or time-limited).

---

## Business Rules

| Rule | Description |
|------|-------------|
| BR-40 | Survey anonymity. Anonymous surveys cannot be deanonymized by any user including platform admin. Platform admin cannot access individual response-to-member mappings even for identified surveys -- only the association's authorized officers can. |

---

## Screens

| Route | Description |
|-------|-------------|
| `/org/[id]/officer/surveys` | Survey and poll list for the association. Shows active, draft, and closed surveys. Officers can create, edit, or close surveys. Survey management actions (edit, close, delete) are performed inline on this list page. |
| `/org/[id]/officer/surveys/new` | Create a new survey or poll. Configure type (anonymous/identified), add questions, set distribution, set deadline and reminders. |
| `/org/[id]/officer/surveys/[id]/results` | Dedicated results dashboard — this is the primary detail view for a survey. Aggregated charts, response summaries, export to CSV. For identified surveys, option to view individual responses. (Note: a standalone survey management/detail page is not in scope — management actions are inline on the surveys list, and the results page serves as the dedicated detail view.) |
| `/my/surveys/[id]` | Member response page. Displays the survey questions. Member submits or edits their response. Shows poll results after voting (if configured). |
