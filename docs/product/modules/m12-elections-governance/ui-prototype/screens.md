<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M12 Elections & Governance -- Screen Specifications

## Table of Contents
1. [Elections List](#screen-elections-list)
2. [Election Detail](#screen-election-detail)
3. [Vote Ballot](#screen-vote-ballot)
4. [Election Results](#screen-election-results)

---

## Screen: Elections List

**Route:** `/org/[id]/elections`
**Purpose:** List all elections for the organization with status filters
**Workflow:** WF-076 (Create & Run Election)

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Elections" |
| `navigation` | `<nav>` | "Election filters" |
| `main` | `<main>` | "Election list" |

### Focus Management

- Page load: focus on `<h1>` "Elections"
- After creating election: focus on new election in list, toast "Election created"
- After filter change: focus stays on filter, list updates

### Fields Displayed

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| title | string | election.title | Election name |
| type | badge | election.type | officer / bylaw |
| status | badge | election.status | draft, nominationsOpen, votingOpen, awaitingConfirmation, published, cancelled |
| votingMode | badge | election.votingMode | online / inPerson / hybrid |
| nominationStart | date | election.nominationStartDate | -- |
| nominationEnd | date | election.nominationEndDate | -- |
| votingStart | date | election.votingStartDate | -- |
| votingEnd | date | election.votingEndDate | -- |
| positionCount | number | election.positions.length | Positions being elected |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Create Election | `<button>` | `aria-label="Create new election"` | Officer (president) | Opens create dialog / page |
| View Election | `<a>` on row | `aria-label="View election: {title}"` | Always | Navigate to detail |
| Filter by status | `<select>` | `aria-label="Filter by status"` | Always | Query param |
| Filter by type | `<select>` | `aria-label="Filter by election type"` | Always | Query param |

### Role-Variant Matrix

| Element | Member | Officer | President | Admin | Super |
|---------|--------|---------|-----------|-------|-------|
| Election list (read) | visible (published/voting/results only) | visible (all) | visible (all) | visible | visible |
| Create button | hidden | hidden | visible | visible | visible |
| Draft elections | hidden | visible | visible | visible | visible |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Table with all columns |
| 768-1023px | Table with collapsed date columns |
| < 768px | Card list: title, type badge, status badge, key dates |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton table rows | Initial fetch |
| Empty | "No elections yet." + Create CTA (president) or "No elections scheduled." (member) | 0 elections |
| Success | Election table with status badges | Has elections |
| Refreshing | Subtle spinner | Background refetch |
| Error | Alert "Unable to load elections." + retry | API error |
| PermissionError | Members see filtered list (no draft/cancelled); officers see all | Role-based filtering |
| FilteredEmpty | "No elections match your filters." + clear filters | Filters active, 0 results |
| Mutating | Create button spinner (if inline create) | POST in flight |
| Offline | Banner + cached data | navigator.onLine === false |

### Permissions

- Read: GA -- all org members (members see only non-draft)
- Create: president, admin, super (officer hierarchy level 0-1)
- Delete: president (draft only)

### Edge Cases

- Multiple concurrent elections: all shown, sorted by status priority then date
- Election with no positions yet: shows "0 positions" with warning indicator

---

## Screen: Election Detail

**Route:** `/org/[id]/elections/[id]`
**Purpose:** View election details, nominees, manage election lifecycle, view results
**Workflow:** WF-076 (Create & Run Election), WF-077 (Member Votes)

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Election: {title}" |
| `main` | `<main>` | "Election details" |
| `region` | `<section>` | "Nominees" |
| `region` | `<section>` | "Voting" or "Results" |

### Focus Management

- Page load: focus on `<h1>` with election title
- After nominating: toast "Nomination submitted", focus on nominee list
- After accepting/declining nomination: focus stays on action row
- After status transition: live region announces new status

### Fields Displayed

**Election Header:**

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| title | string | election.title | -- |
| type | badge | election.type | officer / bylaw |
| status | badge | election.status | Full status enum |
| votingMode | badge | election.votingMode | online / inPerson / hybrid |
| nominationDates | date range | election.nominationStartDate - nominationEndDate | -- |
| votingDates | date range | election.votingStartDate - votingEndDate | -- |
| positions | list | election.positions[] | Name of each position being elected |

**Nominee List (per position, officer elections):**

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| nomineeName | string | person.name | -- |
| nomineeStatus | badge | nominee.status | nominated / accepted / declined / elected |
| nominatedBy | string | person.name | Who nominated them |

**Bylaw Elections:**

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| description | string | election.description | Bylaw proposal text |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Nominate | `<button>` | `aria-label="Nominate for {position}"` | nominationsOpen, active member | `POST .../elections/:id/nominate` |
| Accept Nomination | `<button>` | `aria-label="Accept your nomination for {position}"` | Own nomination, status=nominated | `PATCH .../elections/:id/nominees/:id` |
| Decline Nomination | `<button>` | `aria-label="Decline your nomination for {position}"` | Own nomination, status=nominated | `PATCH .../elections/:id/nominees/:id` |
| Open Nominations | `<button>` | `aria-label="Open nominations"` | President, status=draft | `PATCH .../elections/:id/status` |
| Open Voting | `<button>` | `aria-label="Open voting"` | President, status=nominationsOpen | `PATCH .../elections/:id/status` |
| Close Voting | `<button>` | `aria-label="Close voting"` | President, status=votingOpen | `PATCH .../elections/:id/status` |
| Publish Results | `<button>` | `aria-label="Publish election results"` | President, status=awaitingConfirmation | `PATCH .../elections/:id/status` |
| Cancel Election | `<button>` | `aria-label="Cancel this election"` | President, non-terminal status | `PATCH .../elections/:id/status` |
| Vote | `<a>` | `aria-label="Cast your vote"` | votingOpen, active member, not yet voted | Navigate to ballot |
| Delete | `<button>` | `aria-label="Delete this election"` | President, status=draft | `DELETE .../elections/:id` |

### Role-Variant Matrix

| Element | Member | Officer | President | Admin | Super |
|---------|--------|---------|-----------|-------|-------|
| Election header | visible | visible | visible | visible | visible |
| Nominee list | visible | visible | visible | visible | visible |
| Nominate button | visible (self-nominate) | visible (nominate others) | visible | visible | visible |
| Accept/Decline | own nominations only | own nominations only | own nominations | -- | -- |
| Status transition buttons | hidden | hidden | visible | visible | visible |
| Cancel election | hidden | hidden | visible (2FA) | visible | visible |
| Vote button | visible | visible | visible | -- | -- |
| Delete | hidden | hidden | visible (draft only) | visible | visible |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Header left, nominee list right, admin controls in sidebar |
| 768-1023px | Stacked: header, nominees, controls |
| < 768px | Single column, collapsible sections |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton header + nominee list | Initial fetch |
| Empty (no nominees) | "No nominations yet." + nominate CTA | nominationsOpen, 0 nominees |
| Success (nominations) | Nominee list per position, accept/decline for own | nominationsOpen |
| Success (voting) | Vote CTA prominent, nominee list read-only | votingOpen |
| Success (results) | Results shown (see Election Results screen) | published |
| Error | Alert "Unable to load election." + retry | API error |
| PermissionError | Member cannot see draft; officer actions hidden for members | Role-based |
| Mutating | Button spinner for status transitions, nominations | API call in flight |
| ConfirmAction | Dialog for status transitions and cancellation | Destructive action |

### Validation

- Nominate: must be active member in org
- Open Voting guard: >= 2 accepted candidates per position (BR-33 at nominationsOpen -> votingOpen transition)
- Positions with < 2 candidates: flagged with warning before voting can open

### Permissions

- Read: GA (members see non-draft only)
- Nominate: active members during nominationsOpen
- Status transitions: president (2FA for cancel), admin, super
- Vote: active members during votingOpen

### Edge Cases

- Self-nomination: member can nominate themselves
- Nominee declines: row shows "Declined" badge, not counted for BR-33 guard
- < 2 candidates when officer tries to open voting: error dialog listing under-staffed positions
- Hybrid election: shows both online vote CTA and in-person entry section (officers)

---

## Screen: Vote Ballot

**Route:** `/org/[id]/elections/[id]/vote`
**Purpose:** Cast secret ballot for officer positions or bylaw votes
**Workflow:** WF-077 (Member Votes)

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Cast Your Vote" |
| `main` | `<main>` | "Ballot" |
| `form` | `<form>` | "Election ballot" |

### Focus Management

- Page load: focus on `<h1>` "Cast Your Vote"
- After selecting candidate: focus advances to next position
- After submission: navigate to results/confirmation, toast "Your vote has been recorded."

### Fields (Officer Election)

Per position:

| Field | Type | Notes | ARIA |
|-------|------|-------|------|
| position name | heading | Section heading per position | `<h2>` |
| candidate radio group | radio group | One selection per position | `role="radiogroup" aria-label="Select candidate for {position}"` |
| candidate option | radio | Name + brief bio if available | `aria-label="{name} for {position}"` |

### Fields (Bylaw Election)

| Field | Type | Notes | ARIA |
|-------|------|-------|------|
| proposal text | read-only | Full bylaw text | `<article>` |
| vote radio group | radio | yes / no | `role="radiogroup" aria-label="Vote on bylaw proposal"` |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Submit Ballot | `<button type="submit">` | `aria-label="Submit your ballot"` | All positions have selection | `POST .../elections/:id/vote` |
| Cancel | `<a>` | `aria-label="Cancel and return to election"` | Always | Navigate back |

**Hybrid In-Person Entry (Officer only):**

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Record In-Person Vote | `<button>` | `aria-label="Record in-person vote"` | Officer, hybrid election | `POST .../elections/:id/vote/in-person` |

### Role-Variant Matrix

| Element | Member | Officer | President |
|---------|--------|---------|-----------|
| Ballot form | visible | visible | visible |
| Submit vote | enabled | enabled | enabled |
| In-person entry section | hidden | visible (hybrid only) | visible (hybrid only) |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 768px | Centered ballot card (max-width 640px), positions stacked |
| < 768px | Full-width, sticky submit button at bottom |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton ballot | Fetching election and nominees |
| Empty | N/A (if no candidates, ballot not accessible) | -- |
| Success | Ballot with radio groups per position | Data loaded, not yet voted |
| AlreadyVoted | "You have already cast your vote." + link to results | Voter already voted |
| Error | Alert "Unable to load ballot." + retry | API error |
| PermissionError | "Voting is not open." or "You are not an active member." | Not eligible |
| ValidationError | "Please select a candidate for all positions." | Submit without all selections |
| Mutating | Submit button spinner, "Submitting your vote...", form disabled | POST in flight |
| ConfirmAction | Dialog: "Submit your ballot? This cannot be changed." with summary | Submit clicked |

### Validation

- Officer election: one selection required per position
- Bylaw election: one selection required (yes/no)
- M12-R1: one vote per voter per position (server-enforced)
- M12-011: only active members can vote (server-enforced)

### Permissions

- Auth: GA -- active org members only
- Must not have already voted (M12-004)
- Election must be in votingOpen status (M12-003)

### Edge Cases

- Member navigates to ballot after voting: sees AlreadyVoted state, not the ballot
- Voting period ends while filling ballot: submit returns M12-003, redirect to election detail
- Hybrid election: officer in-person entry requires witnessPersonId (M12-010)
- Secret ballot: no record of who voted for whom is shown to anyone

---

## Screen: Election Results

**Route:** `/org/[id]/elections/[id]/results`
**Purpose:** Display election outcomes after results are published
**Workflow:** WF-076 (Create & Run Election) -- results phase

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Election Results: {title}" |
| `main` | `<main>` | "Results" |
| `region` per position | `<section>` | "Results for {position}" |

### Focus Management

- Page load: focus on `<h1>`
- Results announced via `aria-live="polite"` region

### Fields Displayed

**Per Position (Officer Election):**

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| positionName | heading | position.title | -- |
| candidate results | list | computed | Name + vote count + percentage |
| winner | highlighted | highest votes | "Elected" badge |
| totalVotes | number | sum of votes for position | -- |

**Bylaw Election:**

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| proposal | text | election.description | -- |
| yesVotes | number | computed | Count + percentage |
| noVotes | number | computed | Count + percentage |
| result | badge | computed | "Approved" or "Rejected" |
| totalVotes | number | sum | -- |

**Summary:**

| Field | Type | Source |
|-------|------|--------|
| totalEligibleVoters | number | active member count |
| totalVotesCast | number | unique voters |
| turnoutPercentage | number | computed |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| None (read-only results) | -- | -- | -- | -- |
| Back to Elections | `<a>` | `aria-label="Back to elections list"` | Always | Navigate |

### Role-Variant Matrix

All roles see the same results view once status=published. Members cannot see results before publication.

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Position results in 2-column grid, summary sidebar |
| 768-1023px | Single column positions, summary above |
| < 768px | Single column, stacked position cards |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton results cards | Initial fetch |
| Empty | N/A (results always have data if election exists) | -- |
| Success | Results with vote counts, percentages, winner highlights | Published election |
| Refreshing | N/A (results are final) | -- |
| Error | Alert "Unable to load results." + retry | API error |
| PermissionError | "Results are not yet published." redirect to election detail | Accessed before published |
| NotPublished | Redirect to election detail | Status != published |
| AwaitingConfirmation | "Results are being reviewed. Check back soon." (officers see preview) | Status = awaitingConfirmation |
| Offline | Cached results if previously loaded, otherwise error | navigator.onLine === false |

### Permissions

- Members: view only when status=published
- Officers: can preview during awaitingConfirmation
- Results are final and immutable once published

### Edge Cases

- Tie: both candidates shown with equal votes, "Tie -- runoff required" label
- Zero turnout: "No votes were cast." message
- Bylaw: simple majority determines approval/rejection
- Officer transition: ElectionPublished event triggers M04 officer term update
