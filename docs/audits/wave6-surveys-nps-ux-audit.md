# Memberry Surveys & NPS Module UI/UX Research and Upgrade Audit

**Module:** Wave 6 — Surveys & NPS
**Date:** 2026-05-24
**Status:** Audit Complete
**Scope:** Dual-app (Admin + Members) UI/UX analysis with best-in-class pattern benchmarking

---

## 1. Executive Summary

The Surveys & NPS module is **substantially built** — 10 API handlers, TypeSpec definition, 2 database tables, Typeform-style response flow, NPS modal, 6 question types, and 11 test files. This is far ahead of a typical Wave 6 greenfield. However, the audit reveals **3 P0 issues** (anonymous response privacy, per-device NPS dismiss, no officer preview), **7 P1 gaps** (sidebar nav, admin app, export, cloning, fatigue throttling, offline resilience, targeting), and **6 P2 items** that block production readiness.

### Biggest Findings

1. **Anonymous surveys are not truly anonymous** — `responderId` is stored even when `anonymous=true` in settings. This is a privacy compliance blocker for healthcare associations (P0).
2. **Officers cannot preview surveys** — No "take as member" preview mode exists. Every inspiration app (Typeform, SurveyMonkey, Tally, Google Forms) has this. Officers publish blind (P0).
3. **NPS modal dismiss is per-device** — localStorage-based dismissal means members see the NPS prompt again on a different device. Should be server-side via `survey_response.status='dismissed'` (P0).
4. **No sidebar navigation** — Surveys exist as routes but are unreachable from the main nav. Members and officers cannot discover the feature (P1).
5. **No CSV/PDF export** — Every competitor exports responses. Memberry has analytics computation but no download capability (P1).
6. **Survey fatigue throttling not implemented** — Design doc specifies max 2/week but no enforcement exists. Associations that over-survey will tank engagement (P1).

### Highest-Impact Upgrades

| Upgrade | Impact | Effort |
|---------|--------|--------|
| Fix anonymous response privacy | Compliance unblock | Low |
| Add sidebar navigation | Feature discoverability | Low |
| Officer survey preview | Publishing confidence | Medium |
| CSV/PDF export | Officer utility | Medium |
| Survey fatigue throttling | Member retention | Medium |
| Poll-specific UI | Quick engagement tool | Medium |

---

## 2. Selected Inspiration Apps

| App | Role | Why Selected | Patterns to Extract |
|-----|------|-------------|---------------------|
| **Typeform** | Member response flow | Gold standard one-question-at-a-time UX. 3.5x higher completion rates. Inherently mobile-optimized. | Full-viewport single question, Enter to advance, progress bar, smooth transitions, keyboard nav |
| **Tally.so** | Survey builder (officer) | Fastest time-to-first-form. Notion-like "/" command. Zero learning curve for non-technical users like volunteer officers. | Lightweight structured builder, drag reorder, generous question types free, quick publish |
| **SurveyMonkey** | Templates + analytics | Largest template library by use case (including healthcare). AI-assisted question generation. Cross-tabulation analytics. | Template library by context (post-event, satisfaction, CPD), auto-charts per question, CSV/PDF export |
| **Delighted** | NPS collection | Purpose-built NPS tool. 2-screen flow (score + comment). Autopilot throttling prevents survey fatigue. Channel-performance tracking. | 2-screen NPS, configurable throttle window, promoter/passive/detractor auto-categorization, trend charts |
| **Google Forms** | Baseline familiarity | Officers already use this (per design doc). Auto-generated summary charts. Export to Sheets. Real-time collaborative editing. | Auto-summary charts per question, structured CSV export, simple sharing model |
| **Hotjar Surveys** | In-app contextual prompts | Contextual widget pattern — ask while user is in the experience. Trigger by page/action/behavior. | In-app widget positioning, action-based triggers, micro-survey format (1-3 questions) |
| **Slack Polls** | Quick inline polls | One-tap voting inside communication flow. Instant visible results. No navigation away from context. | Inline poll in announcements, emoji-style voting, instant results display |

### Role-Specific References

| Concern | Primary Inspiration | Secondary |
|---------|-------------------|-----------|
| Survey builder (officer) | Tally | Google Forms |
| Member response flow | Typeform | — |
| Poll UX | Slack Polls | Tally |
| NPS modal | Delighted | Hotjar |
| Analytics/reporting | SurveyMonkey | Delighted |
| Templates | SurveyMonkey | Tally |
| In-app prompts | Hotjar | Delighted |

---

## 3. Pattern Catalog

| # | Pattern | Source Inspiration | Problem Solved | Memberry Application | Priority |
|---|---------|-------------------|----------------|---------------------|----------|
| 1 | One-question-at-a-time flow | Typeform | Cognitive overload, low completion rates | `SurveyFlow` component — already implemented with Framer Motion slide animations | Exists |
| 2 | 2-screen NPS (score + comment) | Delighted | NPS collection simplicity | `NpsModal` — already implemented as Formbricks-style slide-in | Exists |
| 3 | Structured question list builder | Tally | Fast survey creation for non-technical officers | `SurveyBuilder` with @dnd-kit/sortable — already implemented | Exists |
| 4 | Survey preview mode | Typeform, SurveyMonkey, Tally | Officers publish blind without seeing member experience | New: "Preview as Member" button on builder, opens SurveyFlow in read-only mode | P0 |
| 5 | Anonymous response guarantee | Delighted | Privacy compliance for healthcare associations | Fix: strip responderId from storage when anonymous=true, not just UI | P0 |
| 6 | Server-side dismiss tracking | Delighted | Per-device dismiss causes NPS re-prompting across devices | Migrate localStorage dismiss to survey_response.status='dismissed' | P0 |
| 7 | Sidebar survey section | All apps | Feature discoverability | Add "Surveys" section to officer-sidebar.tsx and member-sidebar.tsx | P1 |
| 8 | Response export (CSV/PDF) | SurveyMonkey, Google Forms | Officers need data for reports and accreditation | New endpoint: GET /surveys/{id}/responses/export?format=csv|pdf | P1 |
| 9 | Survey cloning | SurveyMonkey, Tally | Officers repeat similar surveys quarterly | New: "Duplicate" action on survey list, creates draft copy | P1 |
| 10 | Survey fatigue throttling | Delighted | Over-surveying tanks member engagement | pg-boss trigger checks: max 2 surveys/member/week, configurable window | P1 |
| 11 | Template library | SurveyMonkey | Blank page paralysis for first-time creators | Pre-built templates: post-event, post-training, membership satisfaction, NPS, chapter pulse | P2 |
| 12 | Quick inline polls | Slack Polls | Fast engagement without full survey overhead | Poll-specific UI: single question, instant results, embeddable in announcements | P2 |
| 13 | Auto-summary charts | Google Forms, SurveyMonkey | Manual analysis burden on volunteer officers | Per-question chart generation in SurveyResults (pie for choice, bar for rating, gauge for NPS) | P2 |
| 14 | Reminder notifications | Delighted | Low response rates for email-distributed surveys | pg-boss `survey.responseReminder` job — 24hr before deadline | P2 |
| 15 | Contextual in-app triggers | Hotjar | Surveys disconnected from member activity moments | Post-event/training triggers via pg-boss, show survey inline after check-in | P2 |
| 16 | NPS trend dashboard | Delighted | Officers cannot track satisfaction over time | Cross-survey NPS aggregation, time-series chart on officer dashboard | P3 |
| 17 | Conditional logic / skip | Typeform, SurveyMonkey | Static question flow, no branching | Schema future-proof: add `skipLogic` field to question JSONB structure | P3 |
| 18 | Structured audience targeting | SurveyMonkey | Freeform string targeting is unusable | Replace string with structured schema: { tiers, committees, chapters, eventAttendees } | P1 |
| 19 | Offline draft persistence | Tally | Answers lost on connectivity drop | IndexedDB or localStorage draft with auto-resume on reconnection | P1 |
| 20 | NPS a11y labels | Delighted | Screen readers announce "button 0" with no context | Add aria-label="0 - Not at all likely" through "10 - Extremely likely" | P2 |

---

## 4. Current Memberry UI Audit

### Component Inventory

| Area | Current State | Status |
|------|--------------|--------|
| **Survey CRUD handlers** | 10 handlers: create, update, publish, close, delete, get, list, submitResponse, listResponses, getAnalytics | Complete |
| **TypeSpec definition** | `specs/api/src/modules/surveys.tsp` — 6 question types, 4 survey types, 4 statuses, 3 response statuses | Complete |
| **Database schema** | 2 tables: `surveys` (JSONB questions/settings/analytics), `survey_responses` (JSONB answers) | Complete |
| **SurveyBuilder** | `survey-builder.tsx` (435L) — structured question list, type picker, drag reorder | Complete |
| **SurveyFlow** | `survey-flow.tsx` — Typeform-style one-question-per-screen, Framer Motion slides | Complete |
| **SurveyResults** | `survey-results.tsx` (415L) — analytics display, response viewer with pagination | Complete |
| **SurveyList** | `survey-list.tsx` (290L) — list with publish/close/delete actions | Complete |
| **NPS Modal** | `nps-modal.tsx` — Formbricks-style slide-in, 0-10 score + comment | Complete |
| **NPS Provider** | `nps-provider.tsx` + `use-pending-nps.ts` — global NPS prompting context | Complete |
| **NPS Gauge** | `nps-gauge.tsx` — score visualization component | Complete |
| **Question Renderers** | 5 files: nps, rating, choice, text, yes-no | Complete |
| **Question Editor** | `question-editor.tsx` — question CRUD interface | Complete |
| **Officer Routes** | `/org/$orgSlug/officer/surveys/{index,new,$surveyId}` (3 routes) | Complete |
| **Member Routes** | `/my/surveys/{index,$surveyId}` (2 routes) | Complete |
| **pg-boss Jobs** | `survey.expirePending` cron (daily 4 AM) — marks stale pending as skipped | Partial (1/3 jobs) |
| **Tests** | 11 test files across handlers and communication modules | Complete |
| **Sidebar Navigation** | NOT linked in officer or member sidebar | Missing |
| **Admin App** | Zero survey files in `apps/admin/` | Missing |
| **Poll UI** | Data model supports polls (`isPoll` flag in tests), no dedicated UI | Missing |
| **Survey Preview** | No "take as member" preview for officers | Missing |
| **Export** | No CSV/PDF download capability | Missing |
| **Templates** | No pre-built survey templates | Missing |
| **Cloning** | No survey duplication action | Missing |

### Dual-App Perspective

| Workflow / Screen | Admin App Experience | Members App Experience | Shared Data / State | Gaps | Recommendation |
|-------------------|---------------------|----------------------|--------------------|----|----------------|
| Survey creation | Not present — should see org-wide surveys, moderate content | Officer creates via SurveyBuilder | `surveys` table (orgId scoping) | Admin has no survey view | P2: Add read-only survey list + analytics to admin |
| Survey response | N/A (admins don't respond) | Member sees SurveyFlow or NPS modal | `survey_responses` table | None | — |
| Response analytics | Should see cross-org NPS benchmarks | Officer sees per-survey analytics | `analyticsSnapshot` JSONB | Admin lacks cross-org view | P3: Admin cross-org NPS dashboard |
| Survey moderation | Should flag/remove inappropriate surveys | N/A | `surveys.status` | No moderation workflow | P3: Admin moderation queue |
| Survey distribution | Should see distribution stats org-wide | Officer triggers distribution | Communications module | No admin distribution view | P2: Admin distribution monitoring |
| NPS prompt | N/A | Member receives slide-in modal | `survey_responses` (pending status) | Per-device dismiss issue | P0: Server-side dismiss |
| Survey sidebar | Should have "Surveys" in admin nav | Should have "Surveys" in member + officer nav | N/A | Missing from all navs | P1: Add to all three sidebars |

### Strengths

1. **Solid API foundation** — 10 handlers with proper RBAC, pagination, and duplicate prevention
2. **TypeSpec-first** — full API contract with 6 question types and structured models
3. **Typeform-style flow** — SurveyFlow with Framer Motion is the right UX choice
4. **NPS modal pattern** — Formbricks-style slide-in is industry best practice
5. **Pre-computed analytics** — JSONB snapshot avoids expensive real-time aggregation
6. **11 test files** — good coverage including anonymous survey edge cases (BR-40)

### Reviews Module Overlap Analysis

| Aspect | Reviews Module | Surveys Module | Overlap | Recommendation |
|--------|---------------|---------------|---------|----------------|
| NPS scoring | `npsScore` (0-10) on `review` table | NPS question type in `questions` JSONB | Both capture NPS | Keep separate — Reviews is per-context (booking/event), Surveys is structured multi-question |
| Schema | Single `review` table, 4 columns + JSONB-free | 2 tables, JSONB questions/answers/settings | Minimal | No merge — different data models |
| Handlers | 4 (CRUD, no update) | 10 (full lifecycle + analytics) | None | Keep sibling relationship |
| Frontend | No dedicated UI (NPS lives in Surveys) | Full component suite | NPS components shared | NPS components stay in surveys/ feature directory |
| TypeSpec | `reviews.tsp` (4 endpoints) | `surveys.tsp` (10 endpoints) | None | Keep separate namespaces |
| **Verdict** | Reviews = lightweight post-context NPS. Surveys = structured feedback collection. | | | **Keep as siblings.** Do NOT merge. Design doc correctly specifies NPS auto-triggers write to BOTH tables for backward compat. |

---

## 5. ASCII Wireframes

### 5.1 Admin Survey Dashboard (Admin App)

```
+----------------------------------------------------------+
| ADMIN > Surveys                           [Export All v]  |
+----------------------------------------------------------+
|                                                           |
|  +-- Org-Wide Stats --------------------------------+    |
|  |  [Total Surveys]  [Active]  [Avg NPS]  [Resp Rate]|   |
|  |     47              12       7.2/10      38%       |   |
|  +--------------------------------------------------+    |
|                                                           |
|  Filter: [All Orgs v] [All Types v] [All Status v]       |
|                                                           |
|  +--------------------------------------------------+    |
|  | Survey Name      | Org        | Type  | Status  |    |
|  |                   |            |       | Resp    |    |
|  +--------------------------------------------------+    |
|  | Q2 Satisfaction   | PDA NCR    | NPS   | Active  |    |
|  |                   |            |       | 142/300 |    |
|  +--------------------------------------------------+    |
|  | Post-Seminar FB   | PDA VII    | Custom| Closed  |    |
|  |                   |            |       | 87/120  |    |
|  +--------------------------------------------------+    |
|  | Chapter Health    | PDA III    | Poll  | Draft   |    |
|  |                   |            |       | 0/0     |    |
|  +--------------------------------------------------+    |
|                                                           |
|  [< Prev]  Page 1 of 3  [Next >]                        |
+----------------------------------------------------------+
```

### 5.2 Survey Creation / Builder Flow (Officer — Memberry App)

```
+----------------------------------------------------------+
| OFFICER > Surveys > New Survey                            |
+----------------------------------------------------------+
|                                                           |
|  Survey Title: [Post-Event Feedback Survey          ]     |
|  Description:  [Help us improve future events       ]     |
|  Type: [Custom v]  Anonymous: [ ] No                      |
|                                                           |
|  +-- Questions ----------------------------------+        |
|  |                                                |        |
|  |  [::] 1. How would you rate this event?       |        |
|  |       Type: [Rating v]  Required: [x]         |        |
|  |       Scale: 1-5 stars                        |        |
|  |                                    [Edit][Del]|        |
|  |                                                |        |
|  |  [::] 2. Would you attend again?              |        |
|  |       Type: [Yes/No v]  Required: [x]         |        |
|  |                                    [Edit][Del]|        |
|  |                                                |        |
|  |  [::] 3. What could we improve?               |        |
|  |       Type: [Text v]   Required: [ ]          |        |
|  |       Max: 1000 chars                         |        |
|  |                                    [Edit][Del]|        |
|  |                                                |        |
|  |  [+ Add Question]                              |        |
|  +------------------------------------------------+       |
|                                                           |
|  +-- Settings -----------------------------------+        |
|  |  Deadline: [2026-06-15]  Target: [All Members v]|      |
|  |  Reminder: [x] 24hr before deadline             |      |
|  +------------------------------------------------+       |
|                                                           |
|  [Save Draft]  [Preview as Member]  [Publish]             |
+----------------------------------------------------------+
```

### 5.3 Survey Preview Mode (Officer — NEW)

```
+----------------------------------------------------------+
|  PREVIEW MODE — This is how members will see your survey  |
|  [Exit Preview]                              [Publish Now]|
+----------------------------------------------------------+
|                                                           |
|          Post-Event Feedback Survey                       |
|          Help us improve future events                    |
|                                                           |
|  +--------------------------------------------------+    |
|  |                                                    |   |
|  |    Question 1 of 3                                 |   |
|  |    ============================================    |   |
|  |                                                    |   |
|  |    How would you rate this event?                  |   |
|  |                                                    |   |
|  |    [ * ] [ * ] [ * ] [ * ] [ * ]                   |   |
|  |      1     2     3     4     5                     |   |
|  |                                                    |   |
|  |    [Required]                                      |   |
|  |                                                    |   |
|  |                              [Next ->]             |   |
|  |                                                    |   |
|  +--------------------------------------------------+    |
|                                                           |
|  --- Progress: [====------] 1/3 ---                      |
+----------------------------------------------------------+
```

### 5.4 Member Typeform-Style Survey Response Flow

```
+----------------------------------------------------------+
|  Post-Event Feedback Survey              Question 2 of 3  |
+----------------------------------------------------------+
|                                                           |
|                                                           |
|                                                           |
|           Would you attend again?                         |
|                                                           |
|                                                           |
|      +-------------------+  +-------------------+         |
|      |                   |  |                   |         |
|      |     Yes           |  |      No           |         |
|      |                   |  |                   |         |
|      +-------------------+  +-------------------+         |
|                                                           |
|                                                           |
|                                                           |
|  [<- Back]                            [Next ->]           |
|                                                           |
|  [=============================-------] 67%              |
|                                                           |
|  Press Enter to continue                                  |
+----------------------------------------------------------+
```

### 5.5 Quick Poll Flow (Member — NEW)

```
+----------------------------------------------------------+
| ANNOUNCEMENTS > PDA NCR Chapter                           |
+----------------------------------------------------------+
|                                                           |
|  +-- Announcement Card ---------------------------+       |
|  |  Next Chapter Meeting Date                      |      |
|  |  Posted by Dr. Santos, President                |      |
|  |                                                  |     |
|  |  When should we hold the Q3 chapter meeting?     |     |
|  |                                                  |     |
|  |  ( ) June 14, Saturday        [12 votes]         |     |
|  |  (*) June 21, Saturday        [23 votes] <--you  |     |
|  |  ( ) June 28, Saturday        [8 votes]          |     |
|  |                                                  |     |
|  |  43 total votes | Closes Jun 7                   |     |
|  |  [You voted: June 21]                            |     |
|  +--------------------------------------------------+    |
|                                                           |
|  +-- Next Announcement ---------------------------+       |
|  |  ...                                            |      |
+----------------------------------------------------------+
```

### 5.6 NPS Modal Flow (Member — Bottom-Right Slide-In)

```
+----------------------------------------------------------+
|  /my/dashboard                                            |
|                                                           |
|  +-- Member Dashboard ---------------------------+        |
|  |  Welcome back, Dr. Cruz                        |       |
|  |  ...dashboard content...                       |       |
|  |                                                |       |
|  |                                                |       |
|  |                     +----------------------+   |       |
|  |                     | How likely are you   |   |       |
|  |                     | to recommend PDA NCR |   |       |
|  |                     | to a colleague?      |   |       |
|  |                     |                      |   |       |
|  |                     | 0 1 2 3 4 5 6 7 8 9 10  |       |
|  |                     | [Not        ] [Extremely]|       |
|  |                     |  likely        likely |   |       |
|  |                     |                      |   |       |
|  |                     | (comment appears     |   |       |
|  |                     |  after score select) |   |       |
|  |                     |                      |   |       |
|  |                     | [Submit] [Not now]   |   |       |
|  |                     +----------------------+   |       |
|  +------------------------------------------------+       |
+----------------------------------------------------------+
```

### 5.7 Survey Response Analytics Dashboard (Officer)

```
+----------------------------------------------------------+
| OFFICER > Surveys > Post-Event Feedback      [Export CSV] |
+----------------------------------------------------------+
|                                                           |
|  Status: ACTIVE | Created: May 20 | Deadline: Jun 15     |
|  [Close Survey]  [Duplicate]  [Send Reminder]             |
|                                                           |
|  +-- Overview Stats -----------------------------+        |
|  |  [Responses]  [Completion]  [Avg Rating]  [NPS] |      |
|  |     142/300      89%          4.2/5      +42    |      |
|  +--------------------------------------------------+    |
|                                                           |
|  +-- Q1: How would you rate this event? ---------+        |
|  |  Type: Rating (1-5)                            |       |
|  |  *     |##                          2%         |       |
|  |  **    |####                        5%         |       |
|  |  ***   |############               18%         |       |
|  |  ****  |##########################  38%        |       |
|  |  ***** |########################    37%        |       |
|  |  Avg: 4.2                                      |       |
|  +------------------------------------------------+       |
|                                                           |
|  +-- Q2: Would you attend again? ----------------+        |
|  |  Type: Yes/No                                  |       |
|  |  Yes: [============================] 91%       |       |
|  |  No:  [===]                           9%       |       |
|  +------------------------------------------------+       |
|                                                           |
|  +-- Q3: What could we improve? (Text) ----------+        |
|  |  142 responses | [View All Responses]          |       |
|  |  Common themes: "parking", "longer Q&A",       |       |
|  |                 "more hands-on", "food"         |       |
|  +------------------------------------------------+       |
|                                                           |
|  +-- Individual Responses (if not anonymous) -----+       |
|  | Respondent    | Q1  | Q2  | Q3        | Date   |      |
|  | Dr. Cruz      | 5*  | Yes | "Great!"  | May 21 |      |
|  | Dr. Reyes     | 4*  | Yes | "More..." | May 22 |      |
|  | [Anonymous]   | 3*  | No  | "Parking" | May 22 |      |
|  +------------------------------------------------+       |
|  [< Prev]  Page 1 of 8  [Next >]                        |
+----------------------------------------------------------+
```

### 5.8 Individual Response Detail View (Officer)

```
+----------------------------------------------------------+
| OFFICER > Surveys > Post-Event FB > Response #47          |
+----------------------------------------------------------+
|                                                           |
|  Respondent: Dr. Maria Cruz                               |
|  Submitted: May 21, 2026 at 3:42 PM                      |
|  Context: PDA NCR Annual Seminar (Event #E-2026-014)      |
|                                                           |
|  +-- Responses ----------------------------------+        |
|  |                                                |       |
|  |  Q1. How would you rate this event?            |       |
|  |  [*****] 5/5                                   |       |
|  |                                                |       |
|  |  Q2. Would you attend again?                   |       |
|  |  Yes                                           |       |
|  |                                                |       |
|  |  Q3. What could we improve?                    |       |
|  |  "The seminar was excellent! Would love more   |       |
|  |   hands-on workshops next time. The Q&A        |       |
|  |   session was too short."                      |       |
|  |                                                |       |
|  +------------------------------------------------+       |
|                                                           |
|  +-- Member Context ------------------------------+       |
|  |  Membership: Active | Tier: Regular | Since 2022|      |
|  |  Chapter: PDA NCR | Events attended: 12         |      |
|  |  Previous survey responses: 3                   |      |
|  +------------------------------------------------+       |
|                                                           |
|  [< Previous Response]  [Next Response >]                 |
+----------------------------------------------------------+
```

### 5.9 Survey Templates Page (Officer — NEW)

```
+----------------------------------------------------------+
| OFFICER > Surveys > Templates                             |
+----------------------------------------------------------+
|                                                           |
|  Start from a template or [Create Blank Survey]           |
|                                                           |
|  +-- Post-Event Feedback ------+  +-- NPS Survey ------+ |
|  |  [Event Icon]               |  |  [NPS Icon]        | |
|  |  3 questions                |  |  1 question        | |
|  |  Rating + Yes/No + Text     |  |  NPS 0-10 + Comment| |
|  |  Best for: after events,    |  |  Best for: member  | |
|  |  seminars, workshops        |  |  satisfaction check | |
|  |  [Use Template]             |  |  [Use Template]    | |
|  +-----------------------------+  +--------------------+ |
|                                                           |
|  +-- Post-Training Eval ------+  +-- Chapter Pulse ----+ |
|  |  [Training Icon]           |  |  [Pulse Icon]       | |
|  |  5 questions                |  |  4 questions        | |
|  |  Rating + Multi + Text x3   |  |  NPS + Choice x2   | |
|  |  Best for: CPD/CE programs, |  |  + Text             | |
|  |  training effectiveness     |  |  Best for: quarterly| |
|  |  [Use Template]             |  |  chapter check-in   | |
|  +-----------------------------+  +--------------------+ |
|                                                           |
|  +-- Membership Satisfaction --+  +-- Quick Poll ------+ |
|  |  [Members Icon]             |  |  [Poll Icon]       | |
|  |  6 questions                |  |  1 question        | |
|  |  NPS + Rating x2 + Choice   |  |  Single choice     | |
|  |  + Text x2                  |  |  Best for: quick   | |
|  |  Best for: annual member    |  |  decisions, date   | |
|  |  satisfaction survey        |  |  picks, preferences| |
|  |  [Use Template]             |  |  [Use Template]    | |
|  +-----------------------------+  +--------------------+ |
+----------------------------------------------------------+
```

### 5.10 Mobile Survey Response View

```
+------------------------------+
| < Back          2 of 3       |
+------------------------------+
|                              |
|                              |
|  Would you attend            |
|  again?                      |
|                              |
|                              |
|  +------------------------+  |
|  |                        |  |
|  |        Yes             |  |
|  |                        |  |
|  +------------------------+  |
|                              |
|  +------------------------+  |
|  |                        |  |
|  |        No              |  |
|  |                        |  |
|  +------------------------+  |
|                              |
|                              |
|  [========================]  |
|           67%                |
|                              |
|  [Next ->]                   |
+------------------------------+
```

### 5.11 Mobile NPS Modal

```
+------------------------------+
|                              |
|  (page content behind)       |
|                              |
+==============================+
| How likely are you to        |
| recommend PDA NCR to a       |
| colleague?                   |
|                              |
| [0][1][2][3][4][5]          |
| [6][7][8][9][10]            |
|  Not likely    Extremely     |
|                              |
| [Any additional feedback?  ] |
| [                          ] |
|                              |
| [Submit]        [Not now]    |
+------------------------------+
```

---

## 6. Recommended Sidebar / Information Architecture

### Officer Sidebar (Memberry App)

```
MANAGEMENT
  Dashboard
  Members
  Dues & Payments
  Events
  Training & CPD
  Communications
  Governance

FEEDBACK                    <-- NEW SECTION
  Surveys                   <-- Survey list + create
  Polls                     <-- Quick polls (subset)
  NPS & Satisfaction        <-- NPS dashboard + trends
  Reviews                   <-- Existing reviews module

SETTINGS
  Organization
  ...
```

### Member Sidebar (Memberry App)

```
MY ASSOCIATION
  Dashboard
  My Membership
  My Dues
  Events
  Training & Credits
  Messages

MY FEEDBACK                 <-- NEW SECTION
  My Surveys                <-- Pending + completed
  My Reviews                <-- Existing (if any)

SETTINGS
  Profile
  ...
```

### Admin Sidebar (Admin App)

```
PLATFORM
  Dashboard
  Organizations
  ...

ENGAGEMENT                  <-- NEW SECTION
  Surveys (All Orgs)        <-- Cross-org survey analytics
  NPS Benchmarks            <-- Cross-org NPS comparison
  Survey Moderation         <-- Flag/remove queue

SETTINGS
  ...
```

### Should Reviews Merge Under Feedback?

**Recommendation: Group under "Feedback" section but keep as separate nav items.**

Rationale:
- Reviews and Surveys serve different purposes (per-context rating vs. structured multi-question feedback)
- Different schemas, handlers, and TypeSpec namespaces
- Grouping under "Feedback" provides discoverability without data model coupling
- If usage data later shows Reviews is rarely used standalone, it can be promoted into Surveys as a "quick review" type

---

## 7. Cross-Module Flow Map

### Primary Flow: Event → Survey → Analytics → Action

```
Events Module                  Surveys Module                    Analytics
+-----------+                  +----------------+                +-----------+
| Event     |  check-in        | pg-boss:       |  response     | Analytics |
| Check-in  | ----30min----->  | postEventNps   | ----------->  | Snapshot  |
| Handler   |  delay           | Creates pending |               | Updated   |
+-----------+                  | survey_response |               +-----------+
                               +----------------+                     |
                                     |                                |
                               OneSignal Push                    Officer Views
                                     |                           Dashboard
                                     v
                               +----------------+
                               | Member Device  |
                               | NPS Modal or   |
                               | SurveyFlow     |
                               +----------------+
```

### Cross-Module Trigger Map

| Trigger Source | Survey Type | Trigger Event | pg-boss Job | Delivery Channel |
|---------------|------------|---------------|-------------|-----------------|
| Events | Post-event NPS | `event.checkIn.confirmed` | `survey.postEventNps` (30min delay) | Push + In-app modal |
| Training | Post-training eval | `training.session.completed` | `survey.postTrainingEval` (NEW) | Push + In-app flow |
| Training (CPD) | CPD satisfaction | `certificate.issued` | `survey.postCpdFeedback` (NEW) | Email + In-app |
| Membership | Onboarding NPS | `membership.approved` (30 days) | `survey.onboardingNps` (NEW) | Push + In-app modal |
| Membership | Annual satisfaction | Cron: yearly anniversary | `survey.annualSatisfaction` (NEW) | Email |
| Communications | Officer-created poll | `survey.published` (manual) | `survey.scheduledDistribution` | Email + Push |
| Governance | Bylaw feedback | `survey.published` (manual) | `survey.scheduledDistribution` | Email |

### Reviews ↔ Surveys ↔ Analytics Integration

```
Reviews Module                  Surveys Module
+-------------+                 +------------------+
| review      |    NPS auto-    | survey           |
| table       | <-- triggers    | table            |
| (4 handlers)|    write to     | (10 handlers)    |
|             |    both tables  |                  |
+------+------+                 +--------+---------+
       |                                 |
       +------------ shared ----------- +
                        |
               Feedback Analytics
               (Future unified view)
               +-------------------+
               | NPS trends        |
               | Satisfaction KPIs |
               | Response rates    |
               | Per-event/training|
               +-------------------+
```

### Notification Channel Mapping

| Survey Type | Email | Push (OneSignal) | In-App Modal | In-App Page |
|------------|-------|-----------------|-------------|-------------|
| NPS prompt | No | Yes | Yes (NpsModal) | No |
| Post-event feedback | Yes (24hr reminder) | Yes (initial) | No | Yes (SurveyFlow) |
| Post-training eval | Yes (with cert link) | Yes | No | Yes (SurveyFlow) |
| Annual satisfaction | Yes (primary) | Yes (reminder) | No | Yes (SurveyFlow) |
| Quick poll | No | No | No | Yes (inline in announcements) |
| Officer-distributed | Yes (primary) | Yes | No | Yes (SurveyFlow) |

### CPD/CE Feedback Linkage

```
Training Module                 Surveys Module           Certificates
+---------------+               +----------------+       +------------+
| Training      |  completion   | Post-Training  |       | Certificate|
| Session       | ----------->  | Eval Survey    |       | Issuance   |
| Completion    |               | (auto-trigger) |       |            |
+---------------+               +--------+-------+       +-----+------+
                                         |                      |
                                    contextId = trainingSessionId
                                         |                      |
                                    Survey completion does NOT   |
                                    gate certificate issuance    |
                                    (v1 — optional feedback)     |
                                         |                      |
                                    Future v2: configurable      |
                                    "require feedback before     |
                                    cert download" toggle        |
```

---

## 8. Gap Analysis

| # | Gap | Admin Impact | Member Impact | Shared State Affected | Recommended Fix | Priority | Complexity |
|---|-----|-------------|--------------|----------------------|----------------|----------|-----------|
| 1 | Anonymous response stores responderId | Officers promise anonymity they can't guarantee | Members' identity exposed despite anonymous setting | `survey_responses.responderId` | Strip responderId (store null) when `survey.settings.anonymous=true`. Validate in submitSurveyResponse handler. | P0 | Low |
| 2 | NPS modal dismiss is per-device (localStorage) | N/A | Member re-prompted on different device despite dismissing | `survey_responses.status`, localStorage | Add `status='dismissed'` server-side. NPS provider checks server state first, falls back to localStorage. | P0 | Low |
| 3 | No survey preview for officers | Officers publish surveys without seeing member experience | Members receive broken/confusing surveys | N/A | "Preview as Member" button opens SurveyFlow in read-only mode with sample data. | P0 | Medium |
| 4 | No sidebar navigation | Admin cannot find surveys | Members/officers cannot discover surveys feature | N/A | Add "Feedback" section to officer, member, and admin sidebars with Surveys, Polls, NPS, Reviews items. | P1 | Low |
| 5 | No CSV/PDF export | Cannot generate reports for board/accreditation | N/A | `survey_responses` data | New endpoint: `GET /surveys/{id}/export?format=csv\|pdf`. CSV: one row per response. PDF: summary + charts. | P1 | Medium |
| 6 | No survey cloning | N/A (admin doesn't create) | N/A | `surveys` table | "Duplicate" action on survey list. Creates new draft with same questions/settings, new title suffix "(Copy)". | P1 | Low |
| 7 | No survey fatigue throttling | Officers don't know they're over-surveying | Members get NPS-bombarded, abandon all surveys | `survey_responses` count per member | pg-boss trigger checks: count pending+completed in trailing 7 days. Skip if >= 2. Configurable per org. | P1 | Medium |
| 8 | No offline/partial-completion resilience | N/A | Answers lost on connectivity drop (common at healthcare events) | N/A (client-side) | IndexedDB draft auto-save per question. Resume on reconnection. Show "Draft saved" indicator. | P1 | Medium |
| 9 | No structured audience targeting | Officers can't filter who receives surveys | Members receive irrelevant surveys | `survey.settings.targetAudience` (currently freeform string) | Replace with structured schema: `{ tiers: string[], chapters: string[], committees: string[], eventAttendees: UUID[] }`. | P1 | Medium |
| 10 | No poll-specific UI | N/A | Polls exist in data model but no dedicated UX | `surveys` table (type='poll') | Poll card component: single question, radio options, instant results display, embeddable in announcements. | P2 | Medium |
| 11 | No survey templates | Officers start from blank every time | N/A | N/A | 6 pre-built templates: post-event, post-training, NPS, membership satisfaction, chapter pulse, quick poll. | P2 | Low |
| 12 | No reminder pg-boss jobs | Officers cannot nudge non-responders | Members forget about pending surveys | `survey_responses` (pending status) | `survey.responseReminder` pg-boss job: fires 24hr before deadline for pending responses. OneSignal push. | P2 | Medium |
| 13 | No distribution targeting in TypeSpec | Cannot target specific member segments via API | N/A | TypeSpec definition | Add `targetAudience` structured model to `surveys.tsp`. Generate validators. | P2 | Low |
| 14 | No CPD/CE feedback linkage | Training officers can't measure program effectiveness | Members provide disconnected feedback | `survey_responses.contextId` → training session | New pg-boss trigger: `survey.postTrainingEval` on `training.session.completed`. Link contextId to training session. | P2 | Medium |
| 15 | NPS buttons lack a11y labels | N/A | Screen reader users cannot understand NPS scale | N/A (frontend only) | Add `aria-label="0 - Not at all likely"` through `aria-label="10 - Extremely likely"` to NPS buttons. | P2 | Low |
| 16 | No admin app survey view | Platform admins cannot monitor survey activity or moderate | N/A | `surveys` table (cross-org) | Read-only survey list + analytics dashboard in `apps/admin/`. Cross-org NPS benchmarks. | P2 | High |
| 17 | No conditional logic | Officers cannot build branching surveys | Members answer irrelevant follow-up questions | `questions` JSONB structure | Future-proof: add optional `skipLogic: { condition, targetQuestionId }` to question schema. Implement renderer in SurveyFlow. | P3 | High |
| 18 | No real-time poll results | N/A | Voters don't see live tally | `analyticsSnapshot` JSONB | WebSocket subscription for poll results. Or: simple refresh-on-vote pattern (cheaper). | P3 | High |
| 19 | No cross-event NPS trends | Officers see per-survey NPS but no longitudinal trends | N/A | `analyticsSnapshot` across surveys | New analytics endpoint: aggregate NPS by event/training/time. Render trend chart. | P3 | Medium |
| 20 | No data retention/deletion policy | Healthcare associations may violate data governance | Members cannot request response deletion | `survey_responses` lifecycle | Add `retentionDays` to survey settings. pg-boss cron purges expired responses. Member deletion endpoint. | P3 | Medium |
| 21 | No accreditation-format exports | Training officers cannot submit satisfaction data to accreditors | N/A | Analytics data | Export template matching ACCME/PRC format requirements. Structured CSV with required fields. | P3 | Medium |

---

## 9. Phased Upgrade Plan

### Phase 1: Privacy Fixes + Discoverability (P0 + Critical P1)

**Goal:** Fix compliance blockers and make surveys findable.

| Task | What Changes | Why It Matters | Files Affected | Priority | Complexity |
|------|-------------|---------------|----------------|----------|-----------|
| Fix anonymous response privacy | Strip responderId in submitSurveyResponse when anonymous=true | Healthcare data compliance blocker | `services/api-ts/src/handlers/surveys/submitSurveyResponse.ts`, `survey.repo.ts` | P0 | Low |
| Server-side NPS dismiss | Add 'dismissed' status to survey_response, check in NPS provider | Members re-prompted across devices | `survey.schema.ts`, `nps-provider.tsx`, `use-pending-nps.ts`, `surveys.tsp` | P0 | Low |
| Officer survey preview | "Preview as Member" button opens SurveyFlow in read-only | Officers publish blind | `survey-builder.tsx`, new `survey-preview.tsx` route | P0 | Medium |
| Sidebar navigation | Add Feedback section with Surveys, Reviews to all sidebars | Feature is unreachable | `officer-sidebar.tsx`, `member-sidebar.tsx`, `position-nav.ts` | P1 | Low |
| NPS a11y labels | Add descriptive aria-labels to 0-10 buttons | Screen reader accessibility | `question-renderers/nps-question.tsx` | P2 | Low |

**Tests to update:** `br-40.survey-anonymity.test.ts`, `nps-modal` tests, sidebar navigation E2E stubs

### Phase 2: Officer Productivity (P1)

**Goal:** Give officers the tools they need to create, distribute, and analyze surveys efficiently.

| Task | What Changes | Why It Matters | Files Affected | Priority | Complexity |
|------|-------------|---------------|----------------|----------|-----------|
| CSV/PDF export | New export endpoint + download button in SurveyResults | Officers need data for board reports and accreditation | New: `exportSurveyResponses.ts`, `surveys.tsp` update, `survey-results.tsx` button | P1 | Medium |
| Survey cloning | "Duplicate" action on survey list | Officers repeat similar surveys quarterly | `survey.repo.ts`, `survey-list.tsx`, new handler or repo method | P1 | Low |
| Survey fatigue throttling | pg-boss trigger checks member survey count before creating | Over-surveying tanks member engagement | `jobs/index.ts`, `survey.repo.ts` (count query) | P1 | Medium |
| Structured audience targeting | Replace freeform targetAudience with structured schema | Officers can't meaningfully target surveys | `survey.schema.ts`, `surveys.tsp`, `survey-builder.tsx` settings section | P1 | Medium |
| Survey templates | 6 pre-built templates selectable on creation | Blank page paralysis for officers | New: `survey-templates.tsx`, template data file | P2 | Low |

**Tests to update:** Export handler tests, cloning tests, throttling tests, targeting validation tests

### Phase 3: Member Experience + Automation (P2)

**Goal:** Make survey-taking delightful and automate distribution.

| Task | What Changes | Why It Matters | Files Affected | Priority | Complexity |
|------|-------------|---------------|----------------|----------|-----------|
| Offline draft persistence | IndexedDB auto-save per question in SurveyFlow | Answers lost on connectivity drop at events | `survey-flow.tsx`, new `useSurveyDraft` hook | P1 | Medium |
| Poll-specific UI | Poll card with single question, instant results | Quick engagement without full survey overhead | New: `poll-card.tsx`, `poll-results.tsx` | P2 | Medium |
| Reminder pg-boss jobs | `survey.responseReminder` fires 24hr before deadline | Low response rates for distributed surveys | `jobs/index.ts`, notification integration | P2 | Medium |
| Post-training trigger | `survey.postTrainingEval` pg-boss job on training completion | CPD/CE feedback disconnected from training | New job in `jobs/index.ts`, training module hook | P2 | Medium |
| Auto-summary charts | Per-question charts in SurveyResults (pie, bar, gauge) | Manual analysis burden on volunteer officers | `survey-results.tsx`, new chart components | P2 | Medium |

**Tests to update:** Draft persistence tests, poll UI tests, reminder job tests, training trigger tests

### Phase 4: Analytics + Cross-Module Intelligence (P3)

**Goal:** Turn survey data into actionable insights across the platform.

| Task | What Changes | Why It Matters | Files Affected | Priority | Complexity |
|------|-------------|---------------|----------------|----------|-----------|
| Cross-event NPS trends | Aggregate NPS across surveys by event/training/time | Officers need longitudinal satisfaction data | New analytics endpoint, trend chart component | P3 | Medium |
| Admin app survey dashboard | Read-only survey list + cross-org analytics in admin | Platform admins need visibility | New files in `apps/admin/` | P2 | High |
| Conditional logic (schema prep) | Add `skipLogic` field to question JSONB schema | Future-proof for branching surveys | `survey.schema.ts`, `surveys.tsp` schema update | P3 | Low (schema only) |
| Data retention policy | `retentionDays` setting + purge cron + member deletion | Healthcare data governance compliance | `survey.schema.ts`, new pg-boss job, new endpoint | P3 | Medium |
| Accreditation exports | Export templates matching ACCME/PRC formats | Training officers need these for compliance | Export endpoint extension | P3 | Medium |
| Real-time poll results | Refresh-on-vote pattern (not WebSocket) | Voters want to see live tally | `poll-card.tsx` auto-refresh, analytics update | P3 | Low |

**Tests to update:** Analytics endpoint tests, admin dashboard tests, retention tests

---

## 10. Implementation Notes for AI Coding Agent

### Execution Order

1. **Start with Phase 1 P0 fixes** — these are compliance blockers
2. Within each phase, implement backend (handler/TypeSpec/schema) before frontend
3. Follow existing handler patterns exactly — see `services/api-ts/src/handlers/person/createPerson.ts` as reference
4. Use `/oli-gate-execution` skill for compliance gates during implementation

### Existing Components to Reuse

| Component | Path | Reuse For |
|-----------|------|----------|
| GlassCard | `apps/memberry/src/components/motion/glass-card.tsx` | Survey cards, template cards, analytics cards |
| DataTable | `apps/memberry/src/components/patterns/data-table.tsx` | Response list table with mobile card fallback |
| EmptyState | `apps/memberry/src/components/patterns/empty-state.tsx` | "No surveys yet", "No responses yet" states |
| ErrorState | `apps/memberry/src/components/patterns/error-state.tsx` | Failed to load surveys/responses |
| SkeletonLoader | `apps/memberry/src/components/patterns/skeleton-loader.tsx` | TableSkeleton while responses load |
| StatCard | `apps/memberry/src/components/patterns/stat-card.tsx` | Response count, completion rate, NPS score |
| CountUp | `apps/memberry/src/components/motion/count-up.tsx` | Animated stats on analytics dashboard |
| StaggerGrid | `apps/memberry/src/components/motion/stagger-grid.tsx` | Template cards, analytics cards stagger-in |
| PageHeader | `apps/memberry/src/components/patterns/page-header.tsx` | "Surveys" title + "Create Survey" action |
| FormField | `apps/memberry/src/components/patterns/form-field.tsx` | Survey builder form fields with Zod validation |
| ConfirmDialog | `apps/memberry/src/components/patterns/confirm-dialog.tsx` | "Delete survey?" destructive confirmation |
| OrgProvider | `apps/memberry/src/providers/OrgProvider.tsx` | Role/permission checks (isOfficer) |

### New Components Needed

| Component | Purpose | Phase |
|-----------|---------|-------|
| `survey-preview.tsx` | Read-only SurveyFlow for officer preview | Phase 1 |
| `poll-card.tsx` | Inline poll with instant results | Phase 3 |
| `poll-results.tsx` | Poll results visualization | Phase 3 |
| `survey-templates.tsx` | Template selection page | Phase 2 |
| `useSurveyDraft` hook | IndexedDB draft auto-save for offline resilience | Phase 3 |
| `nps-trend-chart.tsx` | Cross-survey NPS time-series chart | Phase 4 |
| `export-button.tsx` | CSV/PDF download trigger | Phase 2 |

### How to Avoid Overbuilding

- **No custom survey builder framework** — use structured form with question type picker, not a Notion-style block editor
- **No WebSocket for poll results** — use refresh-on-vote pattern (poll analyticsSnapshot with 5s interval)
- **No full conditional logic engine** — add `skipLogic` field to schema only, implement renderer later
- **No AI-powered analysis** — auto-summary charts are sufficient for v1
- **No custom charting library** — use simple CSS bar charts + the existing NPS gauge component

### Backend Requirements Not Yet Implemented

Mark these clearly when encountered during implementation:

| Requirement | Handler/Job | Status | Notes |
|------------|------------|--------|-------|
| `survey.responseReminder` pg-boss job | `jobs/index.ts` | NOT IMPLEMENTED | Schema has reminderSchedule field, no job |
| `survey.scheduledDistribution` pg-boss job | `jobs/index.ts` | NOT IMPLEMENTED | Referenced in design doc, not in code |
| `survey.postTrainingEval` pg-boss job | `jobs/index.ts` | NOT IMPLEMENTED | New trigger for training module |
| `survey.onboardingNps` pg-boss job | `jobs/index.ts` | NOT IMPLEMENTED | New trigger for membership module |
| Export endpoint | New handler | NOT IMPLEMENTED | GET /surveys/{id}/export |
| Survey clone endpoint | New handler or repo method | NOT IMPLEMENTED | Duplicate survey as draft |
| `dismissed` response status | `survey.schema.ts` | NOT IMPLEMENTED | Currently only pending/completed/skipped |
| Structured targetAudience | `survey.schema.ts`, `surveys.tsp` | NOT IMPLEMENTED | Currently freeform string |
| Fatigue throttle check | `survey.repo.ts` | NOT IMPLEMENTED | Count check before creating pending response |

### How to Separate Survey Creation from Member Response

- **Survey creation** = officer-only, lives at `/org/$orgSlug/officer/surveys/` routes
- **Survey response** = member-facing, lives at `/my/surveys/$surveyId` route (SurveyFlow) or NPS modal (no route)
- **Never mix these UX paths** — different users, different mental models
- **Shared components**: question renderers (read-only for response, editable for builder)

### How to Prevent Survey Fatigue

1. **Server-side throttle**: pg-boss trigger checks `survey_response` count for member in trailing 7 days before creating pending response. Skip if >= threshold (default 2/week, configurable per org).
2. **Client-side guard**: NPS provider checks server for pending surveys, shows at most 1 modal per page load.
3. **Officer education**: Show "X members at survey limit" count when publishing, so officers know the reach.
4. **Configurable per org**: Admin can set `maxSurveysPerMemberPerWeek` in org settings.

### Test File Mapping Per Phase

**Phase 1:**
- Update: `br-40.survey-anonymity.test.ts` (anonymous responderId = null)
- Update: NPS modal component tests (server-side dismiss)
- New: survey preview route test
- Update: sidebar navigation E2E

**Phase 2:**
- New: `exportSurveyResponses.test.ts`
- New: `cloneSurvey.test.ts`
- Update: `surveys-polls.test.ts` (throttling behavior)
- New: targeting validation tests

**Phase 3:**
- New: poll-card component tests
- New: reminder job tests
- New: training trigger tests
- New: offline draft hook tests

**Phase 4:**
- New: analytics aggregation endpoint tests
- New: admin dashboard E2E
- New: data retention cron tests

---

## 11. Mobile Responsiveness Analysis

### Current Mobile State

| Component | Mobile Behavior | Assessment |
|-----------|----------------|-----------|
| SurveyFlow | Typeform-style is inherently mobile-optimized — full viewport single question | Good |
| NPS Modal | `w-[360px] max-w-[calc(100vw-2rem)]` — responsive | Good |
| SurveyBuilder | No mobile-specific layout found | Needs audit |
| SurveyResults | DataTable with mobile card fallback | Good (if using DataTable) |
| SurveyList | Unknown — needs responsive card layout | Needs audit |

### Mobile-Specific Recommendations

1. **NPS modal bottom-sheet on mobile** — current bottom-right positioning works on desktop but on mobile (<640px), use full-width bottom sheet pattern. The `max-w-[calc(100vw-2rem)]` gets close but should be a bottom-anchored sheet.

2. **Survey builder is officer-only** — officers typically use desktop/tablet, so mobile builder optimization is lower priority. But the question list should still be scrollable and touch-friendly for tablet use.

3. **Poll cards in announcements** — polls embedded in announcement cards must be tap-friendly. Radio buttons need minimum 44px touch targets (Apple HIG).

4. **Progress bar on mobile** — SurveyFlow progress bar should be at the top (fixed) on mobile, not bottom. Members need to see progress without scrolling.

5. **Keyboard handling** — "Enter to advance" pattern from Typeform doesn't work well on mobile keyboards. Use explicit "Next" button as primary on mobile, keep Enter for desktop.

### Breakpoint Strategy

```
< 640px (sm)  : Full-width survey flow, bottom-sheet NPS, stacked buttons
640-768px (md): Survey flow with margins, bottom-right NPS modal
768-1024px (lg): Side-by-side layout for builder, standard modals
> 1024px (xl)  : Full desktop layout with sidebars
```

---

## 12. Data Privacy & Healthcare Compliance Notes

### Anonymous Response Guarantees

**Current issue (P0):** The `survey_responses` table stores `responderId` even when the survey has `settings.anonymous = true`. This means:
- Database admins can identify anonymous respondents
- A data breach would expose "anonymous" feedback linked to identities
- This violates the principle of data minimization (GDPR Art. 5(1)(c))

**Fix:** When `survey.settings.anonymous === true`:
1. `submitSurveyResponse` handler MUST set `responderId = null`
2. Duplicate prevention changes: use a hash of `(surveyId, personId)` stored in a separate `survey_response_dedup` table, not on the response itself
3. The `survey_response` row should be unlinkable to any person

### Data Retention

Healthcare associations should configure:
- **Default retention:** 3 years (aligns with typical accreditation cycles)
- **Anonymous survey data:** Aggregate only after retention period (delete individual responses, keep analyticsSnapshot)
- **Member deletion requests:** DELETE endpoint that removes all survey_responses for a personId, recalculates affected analyticsSnapshots

### Member Rights

| Right | Implementation | Status |
|-------|---------------|--------|
| Right to access | `GET /my/surveys` shows submitted responses | Exists |
| Right to deletion | Delete all my survey responses | NOT IMPLEMENTED |
| Right to anonymity | Anonymous surveys must not store identity | BROKEN (P0) |
| Right to know | Show "This survey is anonymous/identified" before first question | NOT IMPLEMENTED |

### Accreditation Compliance

Philippine healthcare associations report to:
- **PRC (Professional Regulation Commission)** — CPD credit tracking
- **Specialty boards** — training program evaluation

Survey data supports accreditation by:
1. Post-training evaluation surveys (linked via contextId to training session)
2. Satisfaction metrics exportable in structured format
3. Response rates demonstrating engagement

**Not in scope for v1:** Formal accreditation report templates. These are P3 and require consultation with specific accreditation bodies.

### Survey Consent

Before first question, members should see:
- Whether the survey is anonymous or identified
- How long responses will be retained
- Who can see their responses (officers, admins)
- That submission is voluntary

This consent disclosure is **not currently implemented** and should be added in Phase 1 alongside the anonymity fix.

---

*End of audit. Generated 2026-05-24. Next step: Execute Phase 1 (P0 fixes + discoverability) using `/oli-gate-execution` for compliance.*
