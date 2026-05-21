<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M12 Elections & Governance -- Component Specifications

## Table of Contents
1. [ElectionCard](#electioncard)
2. [ElectionStatusBadge](#electionstatusbadge)
3. [ElectionHeader](#electionheader)
4. [NomineeList](#nomineelist)
5. [NomineeRow](#nomineerow)
6. [BallotPositionGroup](#ballotpositiongroup)
7. [BallotBylawVote](#ballotbylawvote)
8. [PositionResultCard](#positionresultcard)
9. [BylawResultCard](#bylawresultcard)
10. [ElectionStatusControls](#electionstatuscontrols)
11. [InPersonVoteForm](#inpersonvoteform)
12. [VoteTurnoutSummary](#voteturnoutsummary)

---

## ElectionCard

**Purpose:** Renders a single election as a row/card in the elections list.
**Used in:** Elections List screen

### TypeScript Props

```typescript
interface ElectionCardProps {
  election: {
    id: string;
    title: string;
    type: "officer" | "bylaw";
    status: ElectionStatus;
    votingMode: "online" | "inPerson" | "hybrid";
    nominationStartDate: string;
    nominationEndDate: string;
    votingStartDate: string;
    votingEndDate: string;
    positionCount: number;
  };
  onView: (id: string) => void;
}

type ElectionStatus =
  | "draft"
  | "nominationsOpen"
  | "votingOpen"
  | "awaitingConfirmation"
  | "published"
  | "cancelled";
```

### WAI-ARIA Pattern

- **Implementation:** `<article aria-label="Election: {title}">` or `<tr>` in table context

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter | Navigate to election detail |

### Render Contract

- Type badge: "Officer Election" (indigo) or "Bylaw Vote" (purple)
- Status badge (see ElectionStatusBadge)
- Voting mode badge: online (blue), inPerson (amber), hybrid (teal)
- Date range: shows the relevant phase dates based on current status
- Position count for officer elections

### Events

| Event | Payload | When |
|-------|---------|------|
| onView | `(id: string)` | Row/card clicked |

---

## ElectionStatusBadge

**Purpose:** Consistent status badge for the election lifecycle.
**Used in:** ElectionCard, ElectionHeader

### TypeScript Props

```typescript
interface ElectionStatusBadgeProps {
  status: ElectionStatus;
  size?: "sm" | "md";
}
```

### WAI-ARIA Pattern

- **Implementation:** `<span role="status" aria-label="Election status: {formatted status}">`

### Render Contract

| Status | Label | Color | Icon |
|--------|-------|-------|------|
| draft | Draft | gray | pencil |
| nominationsOpen | Nominations Open | blue | users-plus |
| votingOpen | Voting Open | green | vote |
| awaitingConfirmation | Awaiting Confirmation | amber | clock |
| published | Results Published | indigo | trophy |
| cancelled | Cancelled | red | x-circle |

---

## ElectionHeader

**Purpose:** Header section of the election detail page with key metadata.
**Used in:** Election Detail screen

### TypeScript Props

```typescript
interface ElectionHeaderProps {
  election: {
    id: string;
    title: string;
    type: "officer" | "bylaw";
    status: ElectionStatus;
    votingMode: "online" | "inPerson" | "hybrid";
    nominationStartDate: string;
    nominationEndDate: string;
    votingStartDate: string;
    votingEndDate: string;
    positions: { id: string; title: string }[];
    description?: string; // bylaw proposal text
  };
  canVote: boolean;
  hasVoted: boolean;
}
```

### WAI-ARIA Pattern

- **Implementation:** `<header aria-label="Election: {title}">`

### Render Contract

- Title as `<h1>`
- Type + status + voting mode badges in a row
- Date timeline showing nomination and voting periods
- Positions list (officer) or proposal summary (bylaw)
- Vote CTA if canVote && !hasVoted && status=votingOpen
- "You have voted" indicator if hasVoted

---

## NomineeList

**Purpose:** List of nominees grouped by position.
**Used in:** Election Detail screen

### TypeScript Props

```typescript
interface NomineeListProps {
  positions: {
    id: string;
    title: string;
    nominees: Nominee[];
  }[];
  currentPersonId: string;
  electionStatus: ElectionStatus;
  onNominate: (positionId: string) => void;
  onAccept: (nomineeId: string) => void;
  onDecline: (nomineeId: string) => void;
}

interface Nominee {
  id: string;
  personId: string;
  personName: string;
  status: "nominated" | "accepted" | "declined" | "elected";
  nominatedByName: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** List with grouped sections
- **Implementation:** `<section aria-label="Nominees for {position}">` per position, `<ul>` of nominees

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move between nominate/accept/decline buttons |
| Enter / Space | Activate button |

### Render Contract

- Grouped by position with `<h2>` headings
- Each nominee: name, status badge, nominated by
- Own nominations: Accept/Decline buttons (if status=nominated)
- Nominate button per position (if nominationsOpen, member is active)
- Declined nominees: dimmed, strikethrough
- Elected nominees: highlighted with trophy icon (results phase)
- BR-33 warning: if < 2 accepted candidates for a position, show amber warning

### Events

| Event | Payload | When |
|-------|---------|------|
| onNominate | `(positionId)` | Nominate button clicked |
| onAccept | `(nomineeId)` | Accept clicked |
| onDecline | `(nomineeId)` | Decline clicked |

---

## NomineeRow

**Purpose:** Single nominee entry within a position group.
**Used in:** NomineeList

### TypeScript Props

```typescript
interface NomineeRowProps {
  nominee: Nominee;
  isOwnNomination: boolean;
  canActOnNomination: boolean; // nominationsOpen + status=nominated
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
}
```

### WAI-ARIA Pattern

- **Implementation:** `<li aria-label="{name} - {status}">` with action buttons

### Render Contract

- Name (bold if accepted)
- Status badge: nominated (blue), accepted (green), declined (gray), elected (gold)
- "Nominated by {name}" subtitle
- Own nomination + nominated status: Accept (green) and Decline (red) buttons
- Elected: trophy icon + "Elected" badge

---

## BallotPositionGroup

**Purpose:** Radio group for selecting a candidate for one position on the ballot.
**Used in:** Vote Ballot screen (officer elections)

### TypeScript Props

```typescript
interface BallotPositionGroupProps {
  position: {
    id: string;
    title: string;
  };
  candidates: {
    nomineeId: string;
    personName: string;
  }[];
  selectedNomineeId: string | null;
  onChange: (positionId: string, nomineeId: string) => void;
  disabled: boolean;
}
```

### WAI-ARIA Pattern

- **Pattern:** Radio Group
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/radio/
- **Implementation:** `<fieldset><legend>{position title}</legend>` with `role="radiogroup"`, each candidate is `<input type="radio">`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Arrow Up/Down | Navigate between candidates |
| Space | Select focused candidate |
| Tab | Move to next position group |

### Render Contract

- Position title as `<legend>`
- Candidate list as radio buttons with name labels
- Selected candidate: filled radio + blue highlight
- Unselected: empty radio
- Disabled (submitting): all radios disabled

### Events

| Event | Payload | When |
|-------|---------|------|
| onChange | `(positionId, nomineeId)` | Candidate selected |

---

## BallotBylawVote

**Purpose:** Yes/No radio group for bylaw proposals.
**Used in:** Vote Ballot screen (bylaw elections)

### TypeScript Props

```typescript
interface BallotBylawVoteProps {
  proposal: string;
  selectedVote: "yes" | "no" | null;
  onChange: (vote: "yes" | "no") => void;
  disabled: boolean;
}
```

### WAI-ARIA Pattern

- **Pattern:** Radio Group
- **Implementation:** `<fieldset><legend>Vote on this proposal</legend>` with `role="radiogroup"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Arrow Up/Down | Toggle yes/no |
| Space | Select focused option |

### Render Contract

- Proposal text displayed as `<article>` above the vote options
- "Yes" and "No" as large radio cards
- Selected: filled, colored (green for yes, red for no)

---

## PositionResultCard

**Purpose:** Displays vote results for a single officer position.
**Used in:** Election Results screen

### TypeScript Props

```typescript
interface PositionResultCardProps {
  position: {
    id: string;
    title: string;
  };
  results: {
    nomineeId: string;
    personName: string;
    voteCount: number;
    percentage: number;
    isWinner: boolean;
  }[];
  totalVotes: number;
  isTie: boolean;
}
```

### WAI-ARIA Pattern

- **Implementation:** `<section aria-label="Results for {position}">`, winner announced via `aria-live="polite"`

### Keyboard Spec

Not interactive (read-only).

### Render Contract

- Position title as `<h2>`
- Bar chart per candidate: name, vote count, percentage bar
- Winner: highlighted row with "Elected" badge and trophy icon
- Tie: both candidates highlighted with "Tie -- Runoff Required" label
- Total votes shown below
- Sorted by vote count descending

---

## BylawResultCard

**Purpose:** Displays vote results for a bylaw proposal.
**Used in:** Election Results screen

### TypeScript Props

```typescript
interface BylawResultCardProps {
  proposal: string;
  yesVotes: number;
  noVotes: number;
  totalVotes: number;
  yesPercentage: number;
  noPercentage: number;
  result: "approved" | "rejected";
}
```

### WAI-ARIA Pattern

- **Implementation:** `<section aria-label="Bylaw vote result">`

### Render Contract

- Proposal text summary
- Yes/No bars with vote counts and percentages
- Result badge: "Approved" (green) or "Rejected" (red)
- Approval threshold note (simple majority)

---

## ElectionStatusControls

**Purpose:** Officer controls for advancing the election through its lifecycle.
**Used in:** Election Detail screen (president/admin only)

### TypeScript Props

```typescript
interface ElectionStatusControlsProps {
  currentStatus: ElectionStatus;
  canTransition: boolean;
  nextStatus: ElectionStatus | null;
  positionsReady: boolean; // all positions have >= 2 accepted candidates
  insufficientPositions: string[]; // position names with < 2 candidates
  onTransition: (newStatus: ElectionStatus) => void;
  onCancel: () => void;
  onDelete: () => void;
  isTransitioning: boolean;
}
```

### WAI-ARIA Pattern

- **Implementation:** `<div role="group" aria-label="Election controls">`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move between control buttons |
| Enter / Space | Activate button |

### Render Contract

| Current Status | Next Action | Button Label | Condition |
|----------------|-------------|--------------|-----------|
| draft | Open nominations | "Open Nominations" | -- |
| nominationsOpen | Open voting | "Open Voting" | positionsReady (BR-33) |
| votingOpen | Close voting | "Close Voting" | -- |
| awaitingConfirmation | Publish results | "Publish Results" | -- |
| published | (terminal) | No actions | -- |
| cancelled | (terminal) | No actions | -- |

- Cancel button: available for all non-terminal statuses
- Delete button: available for draft only
- BR-33 guard: if !positionsReady, "Open Voting" disabled with tooltip listing insufficient positions
- All transitions show confirmation dialog

### Events

| Event | Payload | When |
|-------|---------|------|
| onTransition | `(newStatus)` | Transition button clicked + confirmed |
| onCancel | -- | Cancel button clicked + confirmed |
| onDelete | -- | Delete button clicked + confirmed |

---

## InPersonVoteForm

**Purpose:** Officer form for recording in-person votes with witness attestation (hybrid elections).
**Used in:** Election Detail screen (officer, hybrid elections)

### TypeScript Props

```typescript
interface InPersonVoteFormProps {
  electionId: string;
  positions: { id: string; title: string; candidates: { nomineeId: string; name: string }[] }[];
  electionType: "officer" | "bylaw";
  onSubmit: (values: InPersonVoteValues) => Promise<void>;
  isSubmitting: boolean;
}

interface InPersonVoteValues {
  voterId: string;
  votes: { positionId: string; nomineeId: string }[] | { vote: "yes" | "no" };
  witnessPersonId: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** Form
- **Implementation:** `<form aria-label="Record in-person vote">`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move between fields |
| Enter | Submit |

### Render Contract

- Voter search/select (active members only)
- Ballot selections (same as online ballot, but entered by officer)
- Witness select (second officer, M12-010)
- Submit: "Record In-Person Vote"
- Idempotency key auto-generated

### Validation

| Field | Rule | Error |
|-------|------|-------|
| voterId | required, active member | "Select a voter" |
| votes | all positions selected | "Select a candidate for all positions" |
| witnessPersonId | required, officer, different from current user | "A witness officer is required" |

---

## VoteTurnoutSummary

**Purpose:** Summary statistics for election participation.
**Used in:** Election Results screen

### TypeScript Props

```typescript
interface VoteTurnoutSummaryProps {
  totalEligibleVoters: number;
  totalVotesCast: number;
  turnoutPercentage: number;
  votingMode: "online" | "inPerson" | "hybrid";
  onlineVotes?: number;
  inPersonVotes?: number;
}
```

### WAI-ARIA Pattern

- **Implementation:** `<section aria-label="Voter turnout">`

### Render Contract

- Donut chart or progress ring showing turnout percentage
- "{totalVotesCast} of {totalEligibleVoters} members voted ({turnoutPercentage}%)"
- Hybrid elections: breakdown of online vs in-person vote counts
- Low turnout (< 25%): amber indicator
