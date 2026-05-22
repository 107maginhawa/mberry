# Module 12: Elections & Governance

**Version:** 3.0
**Updated:** 2026-04-21
**Phase:** 2 -- Professional Identity Platform
**Monetization Tier:** Add-on
**Status:** Draft

---

## 1. Overview

### Purpose

Elections & Governance provides structured, auditable processes for officer elections, term tracking, succession planning, and bylaw ratification. It replaces informal election processes (Viber polls, hand-raising at meetings, unrecorded voice votes) with a system that produces verifiable results and a permanent governance record.

### Why This Module Exists

Officer elections are the single highest-stakes governance event in a chapter's lifecycle. The outcome determines who controls the organization's finances, membership, and communications for the next term. Today, elections are conducted informally -- a show of hands at a general assembly, or a Viber poll that disappears after the chat scrolls. There is no audit trail, no formal nomination record, and no way for absent members to participate. Disputes about election legitimacy are common and unresolvable because no evidence exists.

### Dependencies

| Module | Relationship |
|--------|-------------|
| **M05: Membership** | Voting eligibility derived from membership status (Active members only). Member roster provides the electorate. |
| **M07: Communications** | Election announcements, nomination calls, voting reminders, and result notifications delivered through the communications module. |
| **M04: Organization Admin** | Officer role assignments updated post-election. Officer transition workflow triggered by election results. |

---

## 2. Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 12.1 | Create election | Officer creates a new election with: title, description, election type (officer election or bylaw ratification), nomination period (start/end dates), voting period (start/end dates), voting mode (online-only, in-person-only, hybrid). | President, Secretary | P1 |
| 12.2 | Nomination period | During the open nomination window, eligible members can nominate themselves or nominate another member (with that member's consent). Only Active members can nominate or stand as candidates. System sends consent request to nominated members who did not self-nominate. | Member (Active) | P1 |
| 12.3 | Candidate profiles | Each candidate can add a brief statement (max 500 characters) and optional photo. Visible to all org members during the voting period. | Member (Candidate) | P2 |
| 12.4 | Online voting (in-app ballot) | During the voting window, eligible members see a ballot screen listing candidates per position. Member selects one candidate per position and submits. Vote is recorded and anonymized -- the system stores that the member voted (preventing double-voting) but does not associate the vote with the member's identity in the results. | Member (Active) | P1 |
| 12.5 | In-person voting | For elections conducted at physical meetings: officer marks member attendance at the event, then records each member's vote per position via a dedicated officer interface. Attendance verification prevents proxy voting. | President, Secretary | P1 |
| 12.6 | Hybrid voting | Election configured for both online and in-person voting. Members who vote online cannot vote again in person (system prevents double-voting across modes). | Member (Active), Officer | P2 |
| 12.7 | Voting eligibility enforcement | Only members with Active status at the time of voting can cast a ballot. Grace and Lapsed members can view election details and results but cannot vote. Suspended and Pending members cannot view or participate. | System | P0 |
| 12.8 | Result compilation | Platform tallies votes automatically. Results are held in a "pending confirmation" state until the President explicitly confirms and publishes. No automatic publication. | System, President | P1 |
| 12.9 | Result publication | President reviews compiled results and clicks "Publish Results." Results become visible to all org members. Published results are immutable -- they cannot be edited after publication. | President | P1 |
| 12.10 | Term management | Officer terms are tracked with start date, end date, and position. System shows a timeline view of all officer terms (current and historical). Upcoming term expirations surface as smart action cards on the org dashboard. | President, Secretary | P1 |
| 12.11 | Succession planning view | Dashboard showing: current officers with term end dates, upcoming vacancies, historical officer roster. Exportable to PDF for governance records. | President | P2 |
| 12.12 | Bylaw ratification | Officer uploads a bylaw document (PDF, max 10MB), creates a ratification vote with a voting period. Members vote Yes/No/Abstain. Threshold for passage is configurable (default: simple majority of votes cast). Result recorded and attached to the document permanently. | President, Secretary | P2 |
| 12.13 | Election audit trail | All election actions are logged: creation, nominations, consent responses, votes cast (anonymized), result compilation, publication. Audit trail is immutable and accessible to officers. | Officer, Platform Admin | P1 |

---

## 3. User Journeys

### Journey 12A: Officer Creates and Runs an Election

**Persona:** Dr. Lim (Chapter President)
**Trigger:** Annual officer election is due in 6 weeks.

1. Dr. Lim navigates to `/org/[id]/officer/elections` and sees the elections list (empty or with past elections).
2. Clicks "New Election" -- redirected to `/org/[id]/officer/elections/new`.
3. Fills in: title ("2026 Officer Election"), type (Officer Election), positions to elect (President, Vice President, Secretary, Treasurer, Auditor), nomination period (April 21 -- May 5), voting period (May 10 -- May 17), voting mode (Hybrid).
4. Clicks "Create Election." System creates the election in Draft status.
5. Dr. Lim reviews the details on `/org/[id]/officer/elections/[id]` and clicks "Open Nominations."
6. System sends an announcement to all Active members via M07: "Nominations are now open for the 2026 Officer Election. Nominate yourself or a colleague."
7. During the nomination period, members submit nominations. Dr. Lim monitors incoming nominations on the election detail page.
8. Nomination period closes automatically on May 5. Dr. Lim reviews the candidate list.
9. Dr. Lim clicks "Open Voting." System sends voting announcement to all Active members.
10. Voting runs May 10--17. Members vote online; at the May 15 general assembly, Dr. Lim records in-person votes.
11. Voting period closes. Dr. Lim views compiled results on the Results tab within `/org/[id]/officer/elections/[id]` (election detail screen).
12. Dr. Lim confirms the results and clicks "Publish Results." All org members can now view results on the same screen.
13. System prompts Dr. Lim to initiate officer transition (links to M04 officer transition workflow).

### Journey 12B: Member Votes Online

**Persona:** Dr. Garcia (Active Member)
**Trigger:** Receives notification that voting is open.

1. Dr. Garcia opens the app and sees a notification: "Voting is open for the 2026 Officer Election."
2. Taps the notification -- navigates to `/org/[id]/elections/[id]/vote`.
3. Sees the ballot: list of positions, each with candidate names and optional statements.
4. Selects one candidate per position.
5. Reviews selections on a confirmation screen.
6. Taps "Submit Vote." System confirms: "Your vote has been recorded. Results will be published after the President confirms."
7. Dr. Garcia cannot vote again -- the ballot screen now shows "You have already voted" with a checkmark.

### Journey 12C: Bylaw Ratification

**Persona:** Dr. Lim (Chapter President)
**Trigger:** Chapter has drafted updated bylaws that require member approval.

1. Dr. Lim navigates to `/org/[id]/officer/settings/org` (org settings screen, Bylaws section).
2. Clicks "New Bylaw Vote."
3. Uploads the bylaw PDF, enters title ("Updated Chapter Bylaws 2026"), sets voting period (May 1--15), sets passage threshold (two-thirds majority).
4. Clicks "Create." System creates the ratification vote and notifies all Active members.
5. Members open the bylaw document, read it, and vote Yes/No/Abstain on `/org/[id]/elections/[id]/vote`.
6. Voting period closes. Dr. Lim reviews results: 78 Yes, 12 No, 5 Abstain. Two-thirds threshold met.
7. Dr. Lim publishes the result. The bylaw document is marked "Ratified" with the vote tally and date.

---

## 4. Business Rules

### BR-33: Election Integrity (Voting Eligibility)

- **Rule:** Only members with Active status at the moment they attempt to cast a ballot may vote. Status must be computed in real-time per BR-01 (not cached). Members in Grace status can view election details and published results but must not be presented with a ballot. Members in Lapsed, Suspended, or Pending status must not see election details except published results (Lapsed and Grace only).
- **Category:** Access / Constraint
- **Why this matters:** Elections determine organizational leadership. Allowing ineligible members to vote undermines legitimacy. Computing eligibility in real-time prevents edge cases where a member's status changes during the voting period (e.g., dues expire mid-election).
- **Examples:**
  1. Dr. Santos is Active on May 10 (voting opens). She votes. On May 12, her dues expire and she enters Grace. Her vote remains valid -- eligibility is checked at the time of voting, not retroactively revoked.
  2. Dr. Cruz is in Grace status when voting opens. She navigates to the election page and sees candidate information and "Results will be published after voting closes" but no ballot. A banner reads: "Your dues have expired. Renew to participate in future elections."
  3. Dr. Reyes is Lapsed. She can see published results on the Election Detail screen (`/org/[id]/officer/elections/[id]`) after the President publishes, but cannot access the election during the voting period.
- **Impact if wrong:** Election results are challenged as illegitimate. Members who should not vote dilute valid votes. Legal exposure if bylaws specify Active-only voting.
- **Approval:** [ ] Stakeholder sign-off

### BR-34: Nomination Eligibility

- **Rule:** Candidates must be Active members of the org for at least 90 days at the time of nomination. Grace and Lapsed members are not eligible to stand as candidates. The 90-day count is based on the member's `joined_at` date in the org, not the platform registration date.
- **Category:** Access / Constraint
- **Relevance to this module:** Enforced at the time a nomination is submitted. If a member attempts to self-nominate or is nominated by another and does not meet the 90-day requirement, the nomination is rejected with an explanation.

### M12-R1: Result Finality

- **Rule:** Once the President clicks "Publish Results," the election results become immutable. No votes can be added, removed, or modified after publication. The result record (vote tallies per candidate per position) must be permanently stored and associated with the election. If a dispute arises post-publication, the resolution path is to create a new election -- not to modify the published result.
- **Category:** Constraint
- **Why this matters:** Finality is the foundation of governance legitimacy. If results can be quietly edited after publication, the entire election system loses credibility. Associations need to point to a result and say "this is the official record."
- **Examples:**
  1. Dr. Lim publishes results for the 2026 election. A member claims they were unable to vote due to a technical issue. Dr. Lim cannot modify the published results. The resolution is to document the complaint and, if the chapter's bylaws require it, hold a new election.
  2. Platform admin receives a support request to "add 3 more votes to Candidate X." The system does not support this operation. The audit trail records the support request and the denial.
  3. A chapter's bylaws require a minimum voter turnout (e.g., 25% of Active members). The system displays turnout percentage alongside results. If turnout is below the bylaw threshold, the President can choose not to publish and instead schedule a new election.
- **Impact if wrong:** Election disputes become intractable. Officers challenge each other's legitimacy. Trust in the platform as a governance tool collapses.
- **Approval:** [ ] Stakeholder sign-off

---

## 5. UX Specification

### Screen Inventory

| Screen | Route | Persona | Device |
|--------|-------|---------|--------|
| Elections List | `/org/[id]/officer/elections` | Officer, Member | Both |
| Create Election | `/org/[id]/officer/elections/new` | President, Secretary | Desktop primary |
| Election Detail | `/org/[id]/officer/elections/[id]` | Officer, Member | Both |
| Vote (Ballot) | `/org/[id]/elections/[id]/vote` | Member (Active) | Both |
| Election Results | `/org/[id]/officer/elections/[id]` (Results tab/section within Election Detail — not a separate page) | Officer, Member | Both |
| Officer Terms | `/org/[id]/officer/elections` | Officer | Desktop primary |
| Bylaws | `/org/[id]/officer/settings/org` | Officer, Member | Both |

### Screen Details

#### Elections List (`/org/[id]/officer/elections`)

**Layout:** Card list, sorted by date descending (most recent first).

**Content per card:**
- Election title
- Status badge: Draft | Nominations Open | Voting Open | Awaiting Confirmation | Published
- Date range (nomination period or voting period, depending on current phase)
- Voter turnout (if voting has started): "42 of 120 members voted (35%)"

**Actions:**
- Officer: "New Election" button (top right)
- Member: tap card to view details

**Empty state:** "No elections yet. When your organization holds an election, it will appear here."

#### Create Election (`/org/[id]/officer/elections/new`)

**Layout:** Multi-step form.

**Step 1 -- Basics:**
- Title (text, required, max 100 characters)
- Description (textarea, optional, max 1000 characters)
- Type: Officer Election | Bylaw Ratification (radio)

**Step 2 -- Positions (Officer Election only):**
- Add positions to elect (e.g., President, Vice President, Secretary, Treasurer, Auditor)
- Each position: title (text), number of seats (default 1)

**Step 3 -- Timeline:**
- Nomination period: start date, end date (date pickers)
- Voting period: start date, end date (must be after nomination end)
- Validation: nomination period must not overlap with voting period

**Step 4 -- Voting Mode:**
- Online only | In-person only | Hybrid (radio)
- For bylaw ratification: passage threshold (percentage, default 50%, configurable)

**Step 5 -- Review:**
- Summary of all entered data
- "Create Election" button (creates in Draft status)

#### Vote / Ballot (`/org/[id]/elections/[id]/vote`)

**Layout:** Full-screen ballot view, one position at a time (mobile) or all positions visible (desktop).

**Per position:**
- Position title
- List of candidates with: name, photo (if provided), statement (expandable)
- Radio button per candidate (single selection)

**Bottom:**
- "Review Selections" button
- Confirmation screen showing all selections with "Submit Vote" and "Go Back" buttons

**Post-submission:**
- Confirmation message: "Your vote has been recorded."
- Cannot revisit the ballot -- shows "You have already voted" with a timestamp

**Ineligible state (Grace/Lapsed):**
- Ballot is not rendered
- Message: "You are not eligible to vote in this election. Only Active members may vote."
- If Grace: additional line "Renew your dues to participate in future elections." with link to dues payment

#### Election Results (Results tab/section within `/org/[id]/officer/elections/[id]`)

> **Note:** Results are shown as a tab or section within the Election Detail screen (`/org/[id]/officer/elections/[id]`), not on a separate page. There is no standalone `/org/[id]/officer/elections/[id]/results` route.

**Before publication:**
- Officer view: table showing vote tallies per candidate per position. "Publish Results" button.
- Member view: "Results have not been published yet. Check back after the voting period closes."

**After publication:**
- All users see: position-by-position results with candidate names and vote counts
- Winner highlighted per position
- Turnout statistics: total eligible voters, total votes cast, turnout percentage
- Bylaw ratification: Yes/No/Abstain counts, threshold, pass/fail indicator

#### Officer Terms (`/org/[id]/officer/elections`)

**Layout:** Timeline view (desktop). Each row is a position, each block is a term.

**Content:**
- Current officers: name, position, term start, term end, days remaining
- Historical officers: same fields, grayed out
- Upcoming vacancies highlighted in amber

**Actions:**
- "Export to PDF" button
- Click on a current officer links to their member profile

#### Bylaws (`/org/[id]/officer/settings/org`)

**Layout:** Document list.

**Content per row:**
- Document title
- Status: Pending Vote | Ratified | Rejected
- Vote date range
- Result summary (if voted): "78 Yes / 12 No / 5 Abstain -- Ratified"

**Actions:**
- Officer: "New Bylaw Vote" button
- Download PDF link per document
- Click to view vote details

### States

| State | Trigger | UI Behavior |
|-------|---------|-------------|
| **Draft** | Election created, not yet opened | Only officers see it. "Open Nominations" button visible. |
| **Nominations Open** | Officer clicks "Open Nominations" | Members see election card. Nomination form available to Active members. Countdown to nomination close. |
| **Nominations Closed** | Nomination end date reached | Nomination form disabled. Candidate list finalized. "Open Voting" button visible to officer. |
| **Voting Open** | Officer clicks "Open Voting" | Ballot available to Active members. Countdown to voting close. |
| **Voting Closed** | Voting end date reached | Ballot disabled. Results visible to officers only. "Publish Results" button visible. |
| **Awaiting Confirmation** | Voting closed, results not yet published | Officers see results table. Members see "Awaiting confirmation." |
| **Published** | President clicks "Publish Results" | Results visible to all eligible viewers. Results are immutable. |

---

## 6. Acceptance Criteria Patterns

- Only Active members (per BR-01 real-time computation) can submit nominations or cast votes.
- A member who votes online cannot vote again in person (hybrid mode deduplication).
- Nomination consent: if Member A nominates Member B, Member B receives a consent request. The nomination is not finalized until Member B accepts. If Member B declines or does not respond by the nomination close date, the nomination is withdrawn.
- Published results cannot be modified by any user, including Platform Admin.
- Election audit trail captures: election creation, nomination submissions, consent responses, vote timestamps (anonymized), result compilation, publication event.
- Bylaw ratification threshold is configurable per vote (simple majority, two-thirds, three-quarters, or custom percentage).
- Voting period cannot overlap with nomination period.
- Grace and Lapsed members can view published results but cannot vote.
- Election announcements (nomination open, voting open, results published) are sent via M07 Communications.

---

## 7. Data Entities

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| **Election** | `id`, `org_id`, `title`, `description`, `type` (officer/bylaw), `voting_mode` (online/in-person/hybrid), `nomination_start`, `nomination_end`, `voting_start`, `voting_end`, `status`, `passage_threshold` (bylaw only), `created_by`, `published_by`, `published_at`, `created_at`, `updated_at` | Core election record. Status is a state machine: draft -> nominations_open -> nominations_closed -> voting_open -> voting_closed -> awaiting_confirmation -> published. |
| **Election Position** | `id`, `election_id`, `title`, `seats`, `sort_order` | Positions being elected (e.g., President, Treasurer). Only for officer elections. |
| **Nomination** | `id`, `election_id`, `position_id`, `nominee_member_id`, `nominator_member_id`, `consent_status` (pending/accepted/declined), `statement`, `consented_at`, `created_at` | Self-nominations have `nominator = nominee` and `consent_status = accepted` immediately. |
| **Vote** | `id`, `election_id`, `position_id`, `candidate_member_id`, `voting_mode` (online/in-person), `created_at` | Anonymized: no `voter_member_id` field. |
| **Voter Record** | `id`, `election_id`, `member_id`, `voted_at`, `voting_mode` | Tracks that a member voted (prevents double-voting) without linking to their choices. Separate from Vote entity. |
| **Election Result** | `id`, `election_id`, `position_id`, `candidate_member_id`, `vote_count`, `is_winner`, `published_at` | Populated when results are compiled. Immutable after publication. |
| **Officer Term** | `id`, `org_id`, `member_id`, `position_title`, `term_start`, `term_end`, `election_id` (nullable), `created_at`, `updated_at` | Historical record of all officer terms. `election_id` links to the election that produced this term (null for manually assigned officers). |
| **Bylaw Document** | `id`, `org_id`, `election_id`, `title`, `file_url`, `file_size_bytes`, `status` (pending/ratified/rejected), `passage_threshold`, `created_by`, `created_at` | Links a PDF document to a ratification election. |

---

*Module 12: Elections & Governance -- Memberry v3*
