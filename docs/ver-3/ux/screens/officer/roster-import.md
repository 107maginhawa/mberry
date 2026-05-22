# Bulk CSV Import

- **Route:** `/org/[id]/officer/roster/import`
- **Module:** M05 Membership
- **Access:** Secretary
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Lets a Secretary upload a CSV file to bulk-add members, with row-level validation preview and match-confidence results before committing the import.

## Layout

### Desktop
Desktop-only screen. Not accessible on mobile devices. Sidebar navigation visible. Main content area is a full-width stepped wizard: a step indicator at the top (Upload → Preview → Confirm → Results) and the active step content below. Each step occupies the full main content width. Navigation between steps uses "Next" / "Back" buttons at the bottom of each step.

### Mobile
Desktop-only screen. Not accessible on mobile devices.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Step indicator | Progress stepper | Four labeled steps: 1 Upload, 2 Preview, 3 Confirm, 4 Results. Current step highlighted; completed steps marked with a check. |
| Download Template button | Secondary button (Step 1) | Downloads a pre-formatted CSV with headers: name, email, license_number, category, phone. Includes one example data row with formatting hints. |
| File upload area | Drag-and-drop zone (Step 1) | Accepts .csv files only. Drag-and-drop or click to browse. Shows selected filename once chosen. "Upload and Validate" primary button triggers server-side row validation. |
| Summary bar | Stats strip (Step 2) | Shows: "N total rows | X valid (new) | Y already-linked | Z invalid" after validation completes. |
| Valid Rows tab | Data table (Step 2) | Shows rows that will be imported as new members: name, email, license number, category. |
| Already-Linked tab | Data table (Step 2) | Members whose email or license number matched an existing platform account. Columns: name, email, match method (Email / License #), match confidence indication. Officer must review this count before proceeding (per M5-R11). |
| Invalid Rows tab | Data table (Step 2) | Row number, field name, error message per invalid row. "Download Invalid Rows CSV" button to export failed rows for offline correction and re-upload. |
| Confirm step | Summary + action (Step 3) | Text: "Import X new members and link Y existing members?" Cancel returns to Step 1. "Confirm Import" primary button starts processing. Navigation away during import shows a warning dialog: "Import in progress. Leaving will not cancel it." |
| Progress bar | Indeterminate/determinate bar (Step 4) | Shows import processing. Animates until complete. |
| Completion report | Result summary (Step 4) | "X imported. Y linked. Z skipped." "View Roster" button links to `/org/[id]/officer/roster`. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Validation running after upload | Spinner on "Upload and Validate" button; file upload area disabled |
| Error: invalid file type | Non-CSV uploaded | Inline error: "Invalid file format. Please upload a CSV file." Step 1 remains active. |
| Error: all rows invalid | Validation returns 0 valid rows | "0 valid rows found. Please review errors and correct your CSV." Download Invalid Rows button shown. Confirm step disabled. |
| Error: ambiguous match | Email matches member A, license matches member B | Ambiguous-match rows appear in the Invalid Rows tab with error: "Conflicting match — email matches [Name A], license matches [Name B]. Resolve manually." |
| Preview populated | Validation completes with ≥1 valid row | Step 2 active; summary bar shows counts; tabs populated |
| Processing | Confirm Import clicked | Progress bar visible; navigation warned; cannot re-trigger import |
| Complete | Import finishes | Completion report shown; "View Roster" button active |
| Success: partial | Some rows imported, some invalid | Completion report differentiates: imported, linked, skipped with reason |

## Interactions

- Step 1 (Upload): Clicking "Download Template" immediately downloads the pre-formatted CSV with headers and one example row — no dialog or confirmation. File upload accepts .csv only; dropping a non-CSV file or selecting one via the browser dialog shows inline error "Invalid file format. Please upload a CSV file." immediately (before hitting the server). Clicking "Upload and Validate" with a valid file disables the upload area and shows a spinner on the button while server-side parsing runs.
- Step 2 (Preview): The three tabs (Valid Rows, Already-Linked, Invalid Rows) are independently scrollable. Switching between tabs does not lose the active tab's scroll position. "Download Invalid Rows CSV" in the Invalid Rows tab triggers an immediate download of only the failed rows — officer can correct them offline and re-upload in a new session. Hovering an Already-Linked row shows a tooltip: "Matched by [email / license number]." Officer must acknowledge the already-linked count before proceeding — the "Next" button is enabled as long as there is at least one valid or already-linked row to process.
- Step 3 (Confirm): Displays the final tally — "Import X new members and link Y existing members?" Cancel returns to Step 1 and resets the file upload area (but does not delete the validation results until a new file is chosen). Clicking "Confirm Import" disables the button immediately to prevent double-submission and starts the import job.
- During import (Step 4): A progress bar animates. If the officer attempts to close the tab or navigate away, the browser shows a warning dialog: "Import in progress. Leaving will not cancel it." The import continues server-side; the officer can return to the roster to see the results.
- On completion (Step 4): The summary shows three distinct counts — imported, linked, skipped — with no conflation. "View Roster" navigates to `/org/[id]/officer/roster` with a filter pre-applied to show only members added or linked in this import session (filter label: "Recently imported").
- Back button between steps (1→2→3) returns to the previous step without losing data. Back from Step 3 to Step 2 re-displays the validation preview without re-uploading.
- Ambiguous-match rows (email matches member A, license matches member B) appear in the Invalid Rows tab with the specific conflict message and are excluded from the import. Officer must resolve these manually after import using the Add Member flow.
