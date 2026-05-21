<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M12 Elections & Governance -- Interaction States

## 9-State Pattern

All screens in the Elections & Governance module implement these 9 interaction states consistently.

---

### 1. Loading

**Trigger:** Initial data fetch on screen mount.
**Visual:**
- Elections List: skeleton table rows
- Election Detail: skeleton header + nominee list
- Vote Ballot: skeleton ballot card
- Election Results: skeleton result cards
- `aria-busy="true"` on main container
**Duration:** < 500ms typical.

---

### 2. Empty

**Trigger:** No data available for the primary entity.
**Visual by screen:**
- Elections List: "No elections scheduled." (members) or "No elections yet." + Create CTA (president)
- Election Detail (no nominees): "No nominations yet. Be the first to nominate!" + Nominate button
- Vote Ballot: N/A (redirect if no candidates)
- Election Results: N/A (always has data if election exists)
**ARIA:** `aria-live="polite"` region.

---

### 3. Success

**Trigger:** Data loaded with content.
**Visual varies by election status:**

| Screen | Status Context | Visual |
|--------|---------------|--------|
| Detail | nominationsOpen | Active nominee list with nominate/accept/decline buttons |
| Detail | votingOpen | Read-only nominee list + prominent "Cast Your Vote" CTA |
| Detail | awaitingConfirmation | Preliminary results (officers only) + "Publish Results" button |
| Detail | published | Final results with winners highlighted |
| Detail | cancelled | "This election was cancelled." banner, read-only state |
| Ballot | votingOpen | Active ballot with radio groups |
| Results | published | Vote counts, percentages, winners, turnout |

---

### 4. Refreshing

**Trigger:** Background refetch (nominations/vote counts updating in real-time).
**Visual:**
- Subtle spinner in header
- Existing data remains visible
- Nominee list may update (new nominations during open period)
- Vote counts not shown during votingOpen (secret ballot integrity)
**ARIA:** `aria-busy="true"` only on updating region.

---

### 5. Error (UnexpectedError)

**Trigger:** API 5xx, network failure, or unexpected error.
**Visual:**
- Alert banner: "Unable to load election." / "Unable to submit vote." + retry
- Retry button
**ARIA:** `role="alert"`, focus moved to alert.
**Critical error:** Vote submission failure must clearly indicate vote was NOT recorded.

---

### 6. PermissionError

**Trigger:** Unauthorized access or ineligible action.
**Visual by context:**

| Context | Message | Action |
|---------|---------|--------|
| Member views draft election | 404 (no information leak) | Redirect to elections list |
| Non-active member tries to vote | "Only active members can vote." | Redirect to election detail |
| Already voted | "You have already cast your vote." | Show election detail/results |
| Voting closed | "Voting period has ended." | Show election detail |
| Non-president tries status change | Button hidden (not shown) | -- |

**ARIA:** Toast via `aria-live="assertive"` for redirects.

---

### 7. ValidationError

**Trigger:** Invalid form submission.
**Visual:**
- Ballot: "Please select a candidate for all positions." highlighted on unselected position groups
- Nomination: "Member already nominated for this position."
- In-person vote: inline errors per field
- `aria-invalid="true"`, `aria-errormessage`

**Module-specific validation errors:**

| Code | Context | Message |
|------|---------|---------|
| M12-003 | Voting | "Voting period is not open" |
| M12-004 | Voting | "You have already voted" |
| M12-010 | In-person | "Hybrid election requires witness attestation" |
| M12-011 | Voting | "Only active members can vote" |
| BR-33 | Open Voting | "Insufficient candidates: {positions} need at least 2 accepted nominees" |

---

### 8. Mutating

**Trigger:** POST/PATCH request in flight.
**Visual by action:**

| Action | Button Text | During | After |
|--------|-------------|--------|-------|
| Nominate | "Nominating..." | Spinner | Toast "Nomination submitted" |
| Accept nomination | "Accepting..." | Spinner | Badge changes to "Accepted" |
| Decline nomination | "Declining..." | Spinner | Badge changes to "Declined" |
| Submit ballot | "Submitting your vote..." | Full form disabled | Navigate to confirmation |
| Status transition | "Opening Nominations..." etc. | Spinner, all controls disabled | Status badge updates |
| Cancel election | "Cancelling..." | Spinner | Redirect to list |
| Record in-person | "Recording..." | Full form disabled | Toast "In-person vote recorded" |

**ARIA:** `aria-disabled="true"` on all controls, `aria-busy="true"`.
**Failure:** Re-enable controls, toast with specific error.

---

### 9. ConfirmAction

**Trigger:** Significant or irreversible actions requiring confirmation.
**Visual:** Modal dialog (Radix AlertDialog).

**Module-specific confirmations:**

| Action | Dialog Title | Body | Confirm Label |
|--------|-------------|------|---------------|
| Submit ballot | "Submit Your Vote?" | "Your ballot will be recorded. You cannot change your vote after submission." | "Submit Ballot" |
| Open nominations | "Open Nominations?" | "Members will be able to nominate candidates. Nomination period: {dates}." | "Open Nominations" |
| Open voting | "Open Voting?" | "Nominations will close. Voting period: {dates}." + candidate count per position | "Open Voting" |
| Close voting | "Close Voting?" | "No more votes will be accepted. Results will be available for your review." | "Close Voting" |
| Publish results | "Publish Results?" | "Results will be visible to all members. Officer terms will be updated." | "Publish Results" |
| Cancel election | "Cancel Election?" | "All votes will be voided. All members will be notified. This cannot be undone." | "Cancel Election" |
| Delete election | "Delete Election?" | "This draft election will be permanently removed." | "Delete" |
| Record in-person | "Record In-Person Vote?" | "Vote for {voterName}, witnessed by {witnessName}." | "Record Vote" |

**ARIA:**
- `role="alertdialog"` with `aria-modal="true"`
- Focus trapped within dialog
- Escape cancels
- Focus returns to trigger on close

---

## State Transition Diagram

```
Loading ──────► Empty (no elections / no nominees)
    │                │
    │                └──► Mutating (create / nominate) ──► Success
    │
    ├────────► Success (election loaded)
    │              │
    │              ├──► Refreshing ──► Success
    │              │
    │              ├──► Mutating (nominate, vote, transition)
    │              │         │
    │              │         ├──► Success + toast
    │              │         └──► Error toast ──► Success
    │              │
    │              ├──► ConfirmAction (vote, transitions)
    │              │         │
    │              │         ├──► Mutating
    │              │         └──► Success (cancelled dialog)
    │              │
    │              └──► ValidationError ──► Success (corrected)
    │
    ├────────► Error (API failure)
    │              │
    │              └──► Loading (retry)
    │
    └────────► PermissionError (unauthorized)
                   │
                   └──► Redirect / 404

Ballot-specific:
Loading ──► Success (ballot) ──► ConfirmAction ──► Mutating ──► Navigate(results)
Loading ──► AlreadyVoted (redirect to detail)
Loading ──► PermissionError (not eligible)
```

---

## Election Lifecycle State Mapping

The election entity status maps to screen states:

| Election Status | Elections List | Election Detail | Vote Ballot | Results |
|----------------|----------------|-----------------|-------------|---------|
| draft | Visible to officers | Editable, status controls | N/A | N/A |
| nominationsOpen | Visible to all | Nominee list active, nominate buttons | N/A | N/A |
| votingOpen | "Voting Open" badge | Vote CTA, read-only nominees | Active ballot | N/A |
| awaitingConfirmation | "Awaiting" badge | Officer preview of results | N/A | Officer preview |
| published | "Published" badge | Results shown | AlreadyVoted redirect | Full results |
| cancelled | Hidden from members | "Cancelled" banner | N/A | N/A |

---

## Cross-Module State Dependencies

| Event | Source | Effect on M12 Screens |
|-------|--------|-----------------------|
| `ElectionPublished` | M12 (self) | Triggers M04 officer term transitions |
| `MembershipStatusChanged` | M04 | May affect voter eligibility (M12-011) |
