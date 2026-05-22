# Vote / Cast Ballot

- **Route:** `/org/[id]/elections/[id]/vote`
- **Module:** M12 Elections & Governance
- **Access:** Active members only (eligibility checked in real-time at the moment of ballot submission per BR-33; Grace/Lapsed members can see election info but cannot vote)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allow an eligible Active member to review candidates for each position and cast a secret ballot in their org's election or bylaw ratification vote.

## Layout

### Desktop
Centered single-column content area (max-width 640px). Election header at the top (election title, org name, voting period countdown). Below it: all positions and their candidate cards stacked vertically in order. Selections persist as the member scrolls through positions. A review and submit section appears below the last position. No sidebar during the voting flow — the layout is focused and distraction-free.

### Mobile
Full-screen single-column layout. The election header collapses to a compact strip (title + countdown timer) that stays visible as a top bar while scrolling through the ballot. All positions visible on a single scroll (no pagination between positions) — the member scrolls through the entire ballot and submits at the bottom. If the ballot is very long (many positions), the mobile layout maintains the same single-page approach; positions are clearly separated by divider lines and position titles.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Election Header | Sticky header strip | Election title. "Voting closes in X days / X hours" countdown. Org name with org logo. |
| Position Block | Section | One section per position being elected. Section heading: position title (e.g., "President", "Secretary"). Candidate count ("3 candidates"). |
| Candidate Card | Selectable card | Member photo (if provided; initials placeholder if not). Candidate full name. Optional position statement (max 500 characters; collapsed by default with "Read statement" expand link). Radio button / selection indicator. Card highlights (border changes) when selected. |
| Selection Indicator | Visual | Unselected: outlined card with empty radio circle. Selected: solid border in org accent color, filled radio circle, checkmark icon in corner. |
| Position Progress | Inline status | Below the position heading: "Not selected yet" (gray) or "[Candidate Name] selected" (green) as the member makes their choice. |
| Bylaw Document Link | Link (bylaw votes only) | "Read the proposed bylaws (PDF)" — opens the bylaw PDF in a new tab. Appears above the Yes/No/Abstain options for bylaw ratification votes. |
| Bylaw Vote Options | Radio group (bylaw votes only) | Three large radio buttons: "Yes — I approve," "No — I do not approve," "Abstain." Displayed instead of candidate cards for bylaw ratification elections. Passage threshold shown: "Requires [X]% yes votes to pass." |
| Review Selections Panel | Summary block | Appears below the last position. Lists each position with the selected candidate. Any unselected positions shown with an amber "Not yet selected" label. Member must select a candidate (or explicitly abstain on a position if abstention is allowed) before the Submit button activates. |
| Submit Vote Button | Primary button | Disabled until all required positions have a selection. Label: "Submit Vote." On tap: confirmation dialog before final submission. |
| Confirmation Dialog | Modal | "Review your selections: [list of position + candidate name]. Submit your vote? This cannot be undone." Two buttons: "Submit" (primary) and "Go Back" (secondary). |
| Post-Submission Confirmation | Full-screen state | "Your vote has been recorded." Checkmark icon. Timestamp. "Results will be published after the President confirms." Link back to election overview page. |
| Already Voted State | Full-screen state | "You have already voted in this election." Checkmark icon with timestamp of vote submission. No ballot shown. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton: election header, 2–3 candidate card placeholders per position. |
| Ballot — ready | Active member, voting is open, member has not voted | Full ballot rendered. Submit button disabled until all positions selected. |
| Ballot — selections in progress | Member selecting candidates | As each position is filled, the position progress label updates to the selected candidate's name. Review panel updates in real-time. Submit button unlocks when all required positions are filled. |
| Confirmation dialog | Member taps Submit | Modal overlay with summary of all selections. "Go Back" returns to ballot (selections preserved). "Submit" fires the vote. |
| Submitting | Member confirms in dialog | Submit button shows a spinner. Dialog remains open. Form inputs disabled to prevent double-tap. |
| Submitted | Vote recorded | Full-screen confirmation: "Your vote has been recorded." with timestamp. No ballot UI remains. |
| Already voted | Member returns to this URL after having voted | "You have already voted in this election." Timestamp shown. No ballot. |
| Voting closed | Voting period has ended | "Voting has closed. Results will be published soon." No ballot. Link to election results page. |
| Voting not yet open | Member accesses this URL before voting period starts | "Voting opens on [date]. Come back then to cast your ballot." Countdown to voting open. |
| Ineligible — Grace | Member is in Grace status when they access the ballot | Ballot is not rendered. Message: "You are not eligible to vote in this election. Only Active members may vote." Yellow banner: "Your dues have expired. Renew to participate in future elections." "Renew Dues" link to M06. |
| Ineligible — Lapsed / Suspended | Member has lapsed or suspended status | Ballot is not rendered. Message: "You are not eligible to vote in this election. Only Active members may vote." No dues renewal prompt for Suspended (reason is not dues). |
| Ineligible — Pending | Pending member (not yet approved) | Same "not eligible" state. |
| Error — submission failed | Network error during vote submission | "Unable to submit your vote. Please try again." Selections preserved. Retry available. |
| Error — page load | API failure | "Unable to load the ballot. Try again." Retry button. |

## Interactions

- **Selection:** Tapping a candidate card selects it and deselects any previously selected candidate for that position. Only one selection per position (per M12 capability 12.4). The card animates a brief highlight on selection.
- **Read statement:** Tapping "Read statement" expands the candidate statement inline (accordion, not a modal). A "Collapse" link closes it. This avoids navigation away from the ballot while reading candidates' statements.
- **Review before submit:** The review panel at the bottom of the ballot is always visible (not a separate step on desktop). Members can see their selections building up as they scroll through positions. On mobile, the review panel is below the last position and requires a scroll to reach.
- **Submit confirmation:** The confirmation dialog is mandatory — no single-tap submission. This prevents accidental votes. The dialog shows all position + candidate pairs so the member can verify before confirming. "Go Back" closes the dialog and returns focus to the ballot with all selections preserved.
- **Anonymization:** The submission sends only vote choices (position ID + candidate ID) and the voter's identity to a separate Voter Record. The Vote entity does not store the voter's member ID — only the Voter Record does. This separation ensures the system can prevent double-voting without linking a specific member to their specific ballot choices.
- **Hybrid elections (double-vote prevention):** If the election is configured as hybrid (online + in-person), the member who voted online sees the "already voted" state if they later attempt to access the ballot URL again. An officer recording in-person votes also cannot record a vote for this member (the officer's in-person recording interface shows "already voted online" for this member).
- **Bylaw ratification ballot:** The UI is simpler — instead of candidate cards and positions, there is a single group of three options (Yes / No / Abstain). The bylaw PDF download link is prominent above the options. The passage threshold (e.g., "Requires 67% yes votes") is displayed so members know what they are voting for.
- **Back navigation during voting:** If a member navigates away mid-ballot (back button, tab switch), their in-progress selections are NOT saved. When they return to the ballot URL, the ballot is blank. A browser "Are you sure?" leave-page confirmation is shown if the member has made any selections (standard `beforeunload` event). This is intentional — partial votes should not persist, as they could indicate a confused or coerced voter.
