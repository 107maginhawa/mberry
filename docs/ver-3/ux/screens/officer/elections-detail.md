# Election Detail

- **Route:** `/org/[id]/officer/elections/[id]`
- **Module:** M12 Elections & Governance
- **Access:** President, Secretary (management actions); all officers (view)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Central control screen for a single election — shows current status and timeline, surfaces the right action for the current phase (Open Nominations, Open Voting, Publish Results), and displays the nominee/candidate list and, once voting closes, the compiled vote tallies.

## Layout

### Desktop
Sidebar with Elections active. Main content has a header section with the election title, status badge, and the current phase action button (right-aligned). Below the header: two-column layout. Left column (70%): timeline summary, nominee/candidate list, vote tallies (when applicable). Right column (30%): election meta panel (dates, voting mode, type, positions).

### Mobile
Single-column scrollable page. Status badge and phase action button are in a sticky banner at the top (below the app header). Timeline, candidate list, and results follow in vertical sections.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Status badge | Colored badge | Draft / Nominations Open / Nominations Closed / Voting Open / Awaiting Confirmation / Published. |
| Phase action button | Primary button | Context-sensitive. See phase action table below. |
| Timeline summary | Info block | Nomination period (start–end), voting period (start–end), and days remaining/elapsed for each. Countdown timer shown when active. |
| Positions list | Section | Each position listed with its seat count. Nominees listed under each position. |
| Nominee/candidate card | Card within position | Nominee name, nomination type (self / nominated by), consent status (pending / accepted / declined), candidate statement (expandable), photo (if provided). |
| Add Nominee button | Secondary button | Visible in Nominations Open state. Officers can nominate any active member to any position. Triggers consent request flow. |
| Vote tallies section | Results table | Visible to officers after voting closes. Per position: candidate name and vote count. Winner highlighted. Turnout stats: eligible voters, votes cast, turnout %. |
| Publish Results button | Destructive primary button | Visible in Awaiting Confirmation state. Opens confirmation dialog. After publish, results become immutable. |
| Audit trail accordion | Collapsible section | Full log of all election events: creation, nominations, consent responses, vote timestamps (anonymized), result compilation, publication. |
| Post-publish transition prompt | Informational card | After results are published for an Officer Election, a prompt appears: "Update officer roles based on election results?" Link to /org/[id]/officer/officers. |

### Phase Action Button Spec

| Election Status | Button Label | Action |
|----------------|--------------|--------|
| Draft | Open Nominations | Sets status to Nominations Open. Sends M07 announcement to all Active members. |
| Nominations Open | (No button — nomination period is running) | Period closes automatically on nomination end date. |
| Nominations Closed | Open Voting | Sets status to Voting Open. Sends M07 announcement to all Active members. |
| Voting Open | (No button — voting period is running) | Period closes automatically on voting end date. |
| Awaiting Confirmation | Publish Results | Opens confirmation dialog. |
| Published | (No actions — results are immutable) | Read-only view. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for header, meta panel, and nominee sections. |
| Draft | Election just created | Only officers see it. "Open Nominations" button visible. No nominees yet. Empty state for nominees: "No nominations yet. Open nominations to begin accepting candidates." |
| Nominations Open | Officer opened nominations | Nominee list populates as members self-nominate or are nominated. Consent status shown per nominee. Countdown to nomination close visible. |
| Nominations Closed | Nomination end date reached | Nomination form disabled. Candidate list finalized. "Open Voting" button appears. Nominees with declined or expired-without-response consent are removed from the candidate list. |
| Voting Open | Officer opened voting | Ballot available to Active members on the member-facing route. Officer view shows turnout counter updating in near-real time. Countdown to voting close visible. |
| Awaiting Confirmation | Voting end date reached | Vote tallies shown to officers. "Publish Results" button appears. Members see: "Awaiting confirmation. Results will be published shortly." |
| Published | President published results | Full results visible to all eligible viewers. Status badge is purple. All management actions removed. Audit trail accessible. Post-publish transition prompt shown if officer election. |
| Error — Open Nominations | No positions configured | Error toast: "Cannot open nominations. No positions have been configured." Returns to Draft state. |
| Confirmation dialog — Publish | President clicks Publish Results | Modal: "Publish election results? Once published, results are permanent and cannot be changed. If there is a dispute, a new election must be created." Two buttons: "Publish Results" (primary, destructive) and "Cancel." |

## Interactions

- "Open Nominations" triggers an M07 announcement immediately. The button is disabled for 5 seconds after clicking to prevent double-submissions.
- Officers can add nominees during the nomination window even if the officer was not the nominator. When an officer nominates a member, a consent request is sent to that member via M07. The nomination is marked "Pending Consent" until the member accepts or declines. If the member does not respond by the nomination close date, the nomination is automatically withdrawn.
- Self-nominations have consent_status = accepted immediately and no consent request is sent.
- For in-person or hybrid voting, the officer view shows an "Record In-Person Votes" button during the Voting Open phase that leads to a dedicated data-entry interface for marking attendance and recording votes by position.
- In Awaiting Confirmation, the vote tallies table is shown to officers only. It includes: each position, each candidate, their vote count, and percentage of total votes. The table highlights the leading candidate per position in bold. For tied results, both candidates are highlighted and a note reads: "Tie. President must resolve per bylaws before publishing."
- "Publish Results" confirmation must be explicitly completed by the President (not Secretary). If the Secretary attempts to publish, the button is disabled with a tooltip: "Only the President can publish election results."
- After publication (Published state), the entire page is read-only. No edits, deletions, or additions are possible. This is enforced at both the UI and API layers per M12-R1.
- For bylaw ratification elections: the vote tallies section shows Yes / No / Abstain counts, the configured passage threshold, and a pass/fail indicator. "Ratified" shown in green if threshold is met; "Not Ratified" shown in red if threshold is not met.
