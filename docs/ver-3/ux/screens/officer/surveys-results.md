# Survey Results

- **Route:** `/org/[id]/officer/surveys/[id]/results`
- **Module:** M18 Surveys & Polls
- **Access:** President, Officers
- **Phase:** 3
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Presents aggregated survey or poll results to officers — charts and summaries per question, free-text response lists, and export options — so officers can analyze member feedback and act on it.

## Layout

### Desktop
Sidebar with Surveys active. Main content: header bar with survey title, status badge, response stats, and Export CSV button. Below: one result block per question, each showing the appropriate visualization for its question type. For identified surveys, a secondary "Individual Responses" tab appears alongside the default "Aggregated" tab.

### Mobile
Single-column scroll. Response stats in a compact bar at the top. Question result blocks stack vertically. Export button in the top-right or accessible via a three-dot menu.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Response stats bar | Summary block | Shows: total responses, response rate (responses / distribution target count, as percentage), survey status (Active or Closed), and deadline (if applicable). |
| Question result block — Multiple Choice | Bar chart or horizontal bar chart | Each option shown as a bar with label, count, and percentage. Multi-select questions show counts per option (total may exceed response count). |
| Question result block — Rating Scale | Mean score display + histogram | Shows the average rating prominently. Below: a histogram of response distribution across the scale. Min/max labels shown. |
| Question result block — Free Text | Scrollable list of text responses | Each response shown as a quoted text block. For anonymous surveys, no attribution. For identified surveys, name shown next to the response (in the Individual Responses tab only). |
| Question result block — Ranking | Ranked order table | Shows each item with its average rank position and a score bar. |
| Individual Responses tab | Secondary tab | Identified surveys only. Shows each respondent's name and their full set of answers as a row. Authorized officers only. |
| Export Aggregate CSV button | Secondary button | Downloads aggregate results for all questions. Includes question text, option labels, counts, percentages, and averages. |
| Export Individual CSV button | Secondary button | Identified surveys only. Downloads per-respondent response data. Visible to authorized officers only. |
| Close Survey button | Destructive button | Active surveys only. Closes the survey so no further responses are accepted. Confirmation dialog required. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton result blocks with shimmer. |
| No responses yet | Survey published but zero responses received | Summary bar shows "0 responses (0%)." Each question result block shows: "No responses yet. Share the survey link or remind members to respond." |
| Active with responses | Survey is live and has responses | Result blocks show live data. Response count increments in near-real time (refreshed every 60 seconds or on page focus). Close Survey button visible. |
| Closed survey | Survey closed by deadline or officer | Status badge shows Closed. No response input accepted. Results are final. Close Survey button removed. |
| Anonymous survey | Survey was created as Anonymous | Individual Responses tab is not shown. Free text results display with no attribution. Export Individual CSV is not available. |
| Identified survey | Survey was created as Identified | Individual Responses tab is shown. Free text results in Aggregated tab show no attribution. Individual Responses tab shows per-respondent data. Export Individual CSV is available. |
| Export in progress | Officer clicks Export CSV | Button shows spinner. Disabled until download begins. |
| Close confirmation | Officer clicks Close Survey | Dialog: "Close this survey? Members will no longer be able to respond. This cannot be undone." Confirm / Cancel. |
| Survey closed (by officer action) | Officer confirms close | Status updates to Closed. Toast: "Survey closed. No further responses will be accepted." |

## Interactions

- The response rate percentage uses the distribution target count as the denominator. If the survey was sent to "Active members only" (e.g., 120 members), the rate is responses / 120. If sent to "All members," the denominator is the full org membership count.
- For multiple choice questions with "Allow multiple selections" enabled, the total percentage across options may exceed 100%. A note below the chart reads: "Members could select multiple options. Percentages may exceed 100%."
- Rating scale blocks show the mean rating at the top in a large numeric display (e.g., "4.2 / 5") with the distribution histogram below so officers can see skew and outliers.
- Free text responses in the Aggregated tab are listed in submission order (oldest first). A search input at the top of the free text block allows full-text search across responses — useful for large response sets.
- Individual Responses tab (identified surveys): shows a data grid where each row is a respondent (name, email) and each column is a question. Supports sorting by name and filtering by any answer. This data is only available to authorized officers per BR-40 — platform admin cannot access this view.
- Aggregate CSV export format: one row per question per option, with columns: Question Number, Question Text, Question Type, Option/Value, Response Count, Percentage, Average (for rating scales). For free text, each response is a separate row.
- Poll results (when this route is accessed for a poll): a single question result block is shown, same as the multiple choice visualization. Real-time result updates every 30 seconds if the poll is still active.
- Reminder button: if the survey is active and has a deadline, an additional "Send Reminder Now" button is shown in the header. Clicking it sends an M07 notification immediately to all members in the distribution target who have not yet responded. Confirmation dialog: "Send a reminder to X members who haven't responded yet?" Confirm / Cancel.
