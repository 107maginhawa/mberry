# UI Journey Report: m12-elections-governance

**Framework:** React + TanStack Router (Vite)
**Files Scanned:** 17
**Interactive Elements Found:** 54
**Audit Date:** 2026-05-27

## Files Scanned

| # | File | Role |
|---|------|------|
| 1 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/governance/index.tsx` | Governance hub dashboard (elections summary + documents) |
| 2 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/elections/index.tsx` | Officer election list page |
| 3 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/elections/new.tsx` | Create new election page |
| 4 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/elections/$electionId.tsx` | Officer election detail page |
| 5 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/elections/$electionId/edit.tsx` | Edit election (draft only) |
| 6 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/elections/index.tsx` | Member election list page |
| 7 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/elections/$electionId/index.tsx` | Member election detail page |
| 8 | `apps/memberry/src/routes/_authenticated/org/$orgSlug/elections/$electionId/vote.tsx` | Voting ballot page |
| 9 | `apps/memberry/src/features/elections/components/election-form.tsx` | Multi-step election create/edit form (basics, positions, timeline) |
| 10 | `apps/memberry/src/features/elections/components/election-detail.tsx` | Officer election detail (status transitions, nominee management) |
| 11 | `apps/memberry/src/features/elections/components/election-list.tsx` | Officer election list with status badges and actions |
| 12 | `apps/memberry/src/features/elections/components/member-election-list.tsx` | Member election list with tab filtering (active/completed/all) |
| 13 | `apps/memberry/src/features/elections/components/member-election-detail.tsx` | Member election detail (vote CTA, results, self-nomination) |
| 14 | `apps/memberry/src/features/elections/components/voting-ballot.tsx` | Secret ballot form with confirmation dialog |
| 15 | `apps/memberry/src/features/elections/components/self-nomination-dialog.tsx` | Self-nomination confirmation dialog |
| 16 | `apps/memberry/src/features/elections/components/nominee-picker-dialog.tsx` | Officer-side nominee picker (add nominee to position) |
| 17 | `apps/memberry/src/features/elections/components/election-timeline.tsx` | Visual timeline showing election phase progression |

---

## Registry 1: Action Registry

| Module | Screen | Element | Type | Label | Handler | API Call | Role Gate | WF-NNN | Confidence |
|--------|--------|---------|------|-------|---------|----------|-----------|--------|------------|
| m12 | /governance | Active Elections CountUp | display | "Active Elections" count | useQuery(listElectionsOptions) | GET /orgs/:orgId/elections | GA (org member) | WF-076 | HIGH |
| m12 | /governance | Recent Documents CountUp | display | "Documents" count | useQuery(searchDocumentsOptions) | GET /documents?ownerId=orgId | GA (org member) | N/A | HIGH |
| m12 | /governance | Elections Link Card | Link | "Elections" | Link to /org/$orgSlug/elections | None (navigation) | GA (org member) | WF-076 | HIGH |
| m12 | /governance | Documents Link Card | Link | "Documents" | Link to /org/$orgSlug/documents | None (navigation) | GA (org member) | N/A | HIGH |
| m12 | /officer/elections | Election list | display | Election rows with status badges | useQuery(listElectionsOptions) | GET /orgs/:orgId/elections | Officer | WF-076 | HIGH |
| m12 | /officer/elections | "Create Election" Button | Link | "Create Election" | Link to /officer/elections/new | None (navigation) | Officer | WF-076 | HIGH |
| m12 | /officer/elections | Election row Link | Link | Election title | Link to /officer/elections/$electionId | None (navigation) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 1 - Title Input | input | "Election title" | react-hook-form register("title") | None (local state) | Officer (president, admin) | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 1 - Type Toggle (officer/bylaw) | button | "Officer" / "Bylaw" | setValue("type", t) | None (local state) | Officer | WF-076, WF-078 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 1 - Voting Mode Toggle | button | "Online" / "In-Person" / "Hybrid" | setValue("votingMode", m) | None (local state) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 1 - Passage Threshold Input | input | "Passage Threshold (%)" | register("passageThreshold") | None (local state) | Officer | WF-078 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 2 - "Add Position" Button | button | "Add Position" | addPosition() | None (local state) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 2 - Position Title Input | input | Position name | updatePositionTitle(id, value) | None (local state) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 2 - Remove Position Button | button | Trash icon | removePosition(id) | None (local state) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 3 - Nominations Open DateTimePicker | datetime | "Nominations Open" | setValue("nominationsOpenAt") | None (local state) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 3 - Nominations Close DateTimePicker | datetime | "Nominations Close" | setValue("nominationsCloseAt") | None (local state) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 3 - Voting Open DateTimePicker | datetime | "Voting Opens" | setValue("votingOpenAt") | None (local state) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm Step 3 - Voting Close DateTimePicker | datetime | "Voting Closes" | setValue("votingCloseAt") | None (local state) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm "Back" Button | button | "Back" | setStep(prev) | None (local state) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm "Next" Button | button | "Next" | setStep(next) | None (local state) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm "Create Election" Button | button | "Create Election" / "Save Changes" | handleSubmit -> createElectionMutation | POST /orgs/:orgId/elections | Officer (president, admin) | WF-076 | HIGH |
| m12 | /officer/elections/new | ElectionForm "Cancel" Button | button | "Cancel" | onCancel() -> navigate back | None | Officer | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | Status Badge | display | "Draft" / "Nominations Open" / etc. | Static render from election.status | None | Officer | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | "Edit" Link | Link | "Edit" (Pencil icon) | Link to /officer/elections/$electionId/edit | None (navigation) | Officer (draft only) | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | "Open Nominations" Button | button | "Open Nominations" | handleStatusAdvance("nominations_open") | openElectionNominationsMutation | Officer (president) | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | "Open Voting" Button | button | "Open Voting" | handleStatusAdvance("voting_open") | openElectionVotingMutation | Officer (president) | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | "Close Voting" Button | button | "Close Voting" | handleStatusAdvance("awaiting_confirmation") | (status transition mutation) | Officer (president) | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | "Publish Results" Button | button | "Publish Results" | handleStatusAdvance("published") | certifyElectionMutation | Officer (president) | WF-076, WF-079 | HIGH |
| m12 | /officer/elections/$electionId | Confirm "Yes, proceed" Button | button | "Yes, proceed" | handleStatusAdvance(nextStatus) | (status mutation) | Officer | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | Confirm "Cancel" Button | button | "Cancel" | setConfirmAction(null) | None | Officer | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | "Add" Nominee Button (per position) | button | "+ Add" | setNominatePositionId(positionId) | None (opens dialog) | Officer (nominations_open) | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | Remove Nominee Button | button | Trash icon | confirmRemoveNominee -> deleteCandidateMutation | DELETE /elections/:electionId/nominees/:nomineeId | Officer (nominations_open) | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | Remove Nominee Confirm "Remove" | button | "Remove" | removeNomineeMut.mutate | deleteCandidateMutation | Officer | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | Remove Nominee "Cancel" | button | "Cancel" | setConfirmRemoveNominee(null) | None | Officer | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | NomineePickerDialog search/select | dialog | Nominee picker | createCandidateMutation | POST /elections/:electionId/nominate | Officer | WF-076 | HIGH |
| m12 | /officer/elections/$electionId | Published confirmation display | display | "Results published on [date]" | Static render | None | Officer | WF-076 | HIGH |
| m12 | /officer/elections/$electionId/edit | ElectionForm (edit mode) | form | Edit election fields | handleSubmit -> updateElectionMutation | PATCH /orgs/:orgId/elections/:electionId | Officer (draft only) | WF-076 | HIGH |
| m12 | /elections | MemberElectionList Tabs | tabs | "Active" / "Completed" / "All" | setTab(filter) | None (client filter) | GA (org member) | WF-077 | HIGH |
| m12 | /elections | Election row Link | Link | Election title | Link to /elections/$electionId | None (navigation) | GA (org member) | WF-077 | HIGH |
| m12 | /elections/$electionId | "Cast Your Vote" CTA | Link | "Cast Your Vote" | Link to /elections/$electionId/vote | None (navigation) | Member (votingOpen + !hasVoted) | WF-077 | HIGH |
| m12 | /elections/$electionId | "Already voted" receipt | display | "Your vote has been recorded" | Static render from ballot query | GET /association/member/ballots?electionId= | Member | WF-077 | HIGH |
| m12 | /elections/$electionId | Self-Nominate Button (per position) | button | "Nominate Yourself" (UserPlus icon) | setSelfNominatePositionId(positionId) | None (opens dialog) | Member (nominationsOpen) | WF-076 | HIGH |
| m12 | /elections/$electionId | SelfNominationDialog "Yes, Nominate Me" | button | "Yes, Nominate Me" | handleConfirm -> createCandidateMutation | POST /elections/:electionId/nominate | Member (active) | WF-076 | HIGH |
| m12 | /elections/$electionId | SelfNominationDialog "Cancel" | button | "Cancel" | onClose() | None | Member | WF-076 | HIGH |
| m12 | /elections/$electionId | Results table (published) | display | Position winners, vote counts, turnout % | Computed from tallies in election data | GET /elections/:electionId | Member | WF-076 | HIGH |
| m12 | /elections/$electionId | Election timeline | display | Phase progression | Static render from dates | None | Member | WF-076 | HIGH |
| m12 | /elections/$electionId/vote | Ballot position radio buttons | radio | Nominee name per position | setSelections({...selections, [posId]: nomineeId}) | None (local state) | Member (votingOpen) | WF-077 | HIGH |
| m12 | /elections/$electionId/vote | "Review & Submit" Button | button | "Review & Submit" | handleSubmitClick -> setShowConfirm(true) | None (opens confirm dialog) | Member (all positions selected) | WF-077 | HIGH |
| m12 | /elections/$electionId/vote | Confirm dialog "Submit Ballot" | button | "Submit Ballot" | handleConfirmedSubmit -> castBallot per position | POST /elections/:electionId/vote (per position) | Member (votingOpen) | WF-077 | HIGH |
| m12 | /elections/$electionId/vote | Confirm dialog "Cancel" | button | "Cancel" | setShowConfirm(false) | None | Member | WF-077 | HIGH |
| m12 | /elections/$electionId/vote | "Already voted" guard | display | "You have already voted" | Static render from ballot check | GET /association/member/ballots?electionId= | Member | WF-077 | HIGH |
| m12 | /elections/$electionId/vote | "Voting not open" guard | display | "Voting is not open" | Static render from election.status | None | Member | WF-077 | HIGH |
| m12 | /elections/$electionId/vote | "View election details" link | button | "View election details" | navigate to /elections/$electionId | None (navigation) | Member | WF-077 | HIGH |
| m12 | /elections/$electionId/vote | Partial failure error | display | "Failed to cast vote for: [positions]" | setSubmitError from castBallot failures | None | Member | WF-077 | MEDIUM |

---

## Registry 2: Journey Completion Matrix

| WF-ID | Description | Steps | UI Entry | Elements Found | Handlers OK | API Verified | Completable | Severity |
|-------|-------------|-------|----------|----------------|-------------|--------------|-------------|----------|
| WF-076 | Create & Run Election | 9 | /officer/elections/new | ElectionForm (3-step wizard), status transition buttons, nominee management, publish results | YES | createElectionMutation, openElectionNominationsMutation, openElectionVotingMutation, certifyElectionMutation, createCandidateMutation, deleteCandidateMutation | PARTIAL | P1 |
| WF-077 | Member Votes | 5 | /elections/$electionId/vote | Radio ballot, confirm dialog, castBallot per position, already-voted guard | YES | castBallot (POST /elections/:electionId/vote) | COMPLETE | -- |
| WF-078 | Bylaw Ratification | 5 | /officer/elections/new (type=bylaw) | ElectionForm type toggle, passage threshold input, no nomination step for bylaws | PARTIAL | createElectionMutation (type=bylaw) | PARTIAL | P2 |
| WF-079 | Election-to-Officer Transition | 3 | /officer/elections/$electionId (publish action) | "Publish Results" button triggers certifyElectionMutation which emits ElectionPublished event | YES (trigger side) | certifyElectionMutation -> backend emits ElectionPublished | PARTIAL | P2 |

### Journey Notes

- **WF-076 PARTIAL**: Full lifecycle is implemented (draft -> nominations -> voting -> confirmation -> published) with correct status transition buttons and confirmation dialogs. However: (1) No "Cancel Election" action button exists in the UI despite the spec and API contract supporting cancellation at any non-terminal state. Officers cannot cancel an election once created. (2) The state machine uses `nominations_open` (snake_case) in the UI but the API contract spec shows `nominationsOpen` (camelCase) -- potential mismatch if backend uses camelCase. (3) The edit page is restricted to draft status only (correct per spec) but no delete button exists for draft/cancelled elections despite the API supporting DELETE. (4) BR-33 guard (min 2 candidates per position for nominationsOpen -> votingOpen) is enforced server-side but no client-side warning when positions have <2 nominees.
- **WF-077 COMPLETE**: Secret ballot flow works end-to-end. Radio selection per position, confirmation dialog showing choices, castBallot API call per position, already-voted guard, voting-not-open guard. Partial failure handling (some positions fail, others succeed) is implemented with retry messaging. Vote immutability warning shown in confirm dialog.
- **WF-078 PARTIAL**: Bylaw creation works via ElectionForm type=bylaw toggle. Passage threshold input is present. However: (1) Spec says "no nomination phase for bylaws" but the form still renders nomination date pickers for bylaw elections -- the nomination step should be skipped or hidden. (2) The positions step for bylaws shows "Add the bylaw items to be voted on" but the member voting ballot renders the same radio-per-position UI as officer elections instead of a yes/no vote per bylaw item. Bylaw voting should present approve/reject, not candidate selection. (3) No configurable threshold validation (spec [VERIFY] tag still unresolved).
- **WF-079 PARTIAL**: The "Publish Results" action triggers the correct mutation which should emit ElectionPublished domain event on the backend. The frontend has no visibility into whether M04 officer role transition actually happened. No UI feedback confirms "Officer roles have been updated." This is acceptable as a backend-only side effect, but the officer has no way to verify the transition completed.

---

## Registry 3: Element->Action Binding Map

| Element | File:Line | Handler | API Method | API Path | Backend Exists? | Confidence |
|---------|-----------|---------|------------|----------|-----------------|------------|
| Governance elections query | governance/index.tsx:24 | useQuery(listElectionsOptions) | GET | /orgs/:orgId/elections | YES | HIGH |
| Governance documents query | governance/index.tsx:28 | useQuery(searchDocumentsOptions) | GET | /documents?ownerId=orgId | YES | HIGH |
| Officer election list query | election-list.tsx:18 | useQuery(listElectionsOptions) | GET | /orgs/:orgId/elections | YES | HIGH |
| Create election | election-form.tsx:72 | createElectionMutation | POST | /orgs/:orgId/elections | YES | HIGH |
| Update election | election-form.tsx:76 | updateElectionMutation | PATCH | /orgs/:orgId/elections/:electionId | YES | HIGH |
| Get election detail | election-detail.tsx:84 | useQuery(getElectionOptions) | GET | /orgs/:orgId/elections/:electionId | YES | HIGH |
| Open nominations | election-detail.tsx:100 | openElectionNominationsMutation | PATCH | /orgs/:orgId/elections/:electionId/status | YES | HIGH |
| Open voting | election-detail.tsx:104 | openElectionVotingMutation | PATCH | /orgs/:orgId/elections/:electionId/status | YES | HIGH |
| Certify/publish results | election-detail.tsx:108 | certifyElectionMutation | PATCH | /orgs/:orgId/elections/:electionId/status | YES | HIGH |
| Delete nominee | election-detail.tsx:112 | deleteCandidateMutation | DELETE | /elections/:electionId/nominees/:nomineeId | YES | HIGH |
| Add nominee (officer) | nominee-picker-dialog.tsx:35 | createCandidateMutation | POST | /elections/:electionId/nominate | YES | HIGH |
| Self-nominate | self-nomination-dialog.tsx:34 | createCandidateMutation | POST | /elections/:electionId/nominate | YES | HIGH |
| Member election list query | member-election-list.tsx:42 | useQuery(listElectionsOptions) | GET | /orgs/:orgId/elections | YES | HIGH |
| Member election detail query | member-election-detail.tsx:68 | useQuery(getElectionOptions) | GET | /elections/:electionId | YES | HIGH |
| Member ballot check | member-election-detail.tsx:75 | useQuery (api.get) | GET | /association/member/ballots?electionId= | UNVERIFIED | MEDIUM |
| Cast ballot | voting-ballot.tsx:52 | castBallot (sdk.gen) | POST | /elections/:electionId/vote | YES | HIGH |
| Ballot history check | voting-ballot.tsx:44 | useQuery (api.get) | GET | /association/member/ballots?electionId= | UNVERIFIED | MEDIUM |
| Edit election query | $electionId/edit.tsx:34 | useQuery(getElectionOptions) | GET | /elections/:electionId | YES | HIGH |

---

## Registry 4: Role Journey Completion

| Role | Assigned Journeys | Completable | Blocked By |
|------|-------------------|-------------|------------|
| Member (active) | WF-077 (Member Votes) | COMPLETE | -- |
| Member (active) | WF-076 (Self-Nomination) | COMPLETE | Self-nomination dialog works for nominationsOpen elections |
| Member (active) | WF-078 (Bylaw Vote) | PARTIAL | Bylaw voting renders as candidate selection instead of yes/no approve/reject |
| Member (grace/lapsed/suspended) | WF-077 (Member Votes) | BLOCKED | No client-side eligibility check for BR-33 (active member requirement). Server returns error but no pre-flight check or clear error messaging about membership status. |
| Officer (president) | WF-076 (Create & Run Election) | PARTIAL | Missing cancel action. Missing delete for draft elections. No client-side min-2-candidates warning. |
| Officer (president) | WF-078 (Bylaw Ratification) | PARTIAL | Nomination dates shown for bylaws (should be hidden). Bylaw-specific voting UI not implemented. |
| Officer (president) | WF-079 (Election-to-Officer Transition) | PARTIAL | Publish triggers backend event but no UI confirmation of M04 role assignment. |
| Officer (VP, secretary, treasurer) | WF-076 (View/Manage) | PARTIAL | Permission spec says only president (2FA) and admin can create. VP/secretary/treasurer can only delete (per spec) but no delete action in UI. |
| Admin / Super | WF-076 (Full lifecycle) | PARTIAL | Same gaps as president -- no cancel, no delete. |
| User (unauthenticated) | WF-077, WF-076, WF-078 | BLOCKED | User role excluded from all election permissions. Correct per spec. |

---

## Registry 5: Dead Interaction Report

| ID | File:Line | Element | Issue | Severity |
|----|-----------|---------|-------|----------|
| J-M12-001 | election-detail.tsx (NEXT_ACTION map) | Cancel election action | **Missing cancel action**: The NEXT_ACTION map defines transitions for draft->nominationsOpen, nominationsOpen->votingOpen, votingOpen->awaitingConfirmation, awaitingConfirmation->published. No cancel action exists anywhere in the UI. The API contract (PATCH /elections/:electionId/status) supports transitioning to `cancelled` from any non-terminal state. Spec WF-076 alternate flow says "President cancels election at any non-terminal state." This entire flow is unimplemented on the frontend. | P1 |
| J-M12-002 | election-detail.tsx, election-list.tsx | Delete election action | **Missing delete action**: API contract supports DELETE /elections/:electionId for draft or cancelled elections. No delete button exists in the officer election list or detail views. Draft elections can only be edited, not deleted. | P2 |
| J-M12-003 | election-form.tsx (step=timeline) | Nomination dates for bylaw elections | **Bylaw elections show nomination dates**: When type=bylaw, the timeline step still renders nominationsOpenAt and nominationsCloseAt date pickers. Spec WF-078 step 3 says "Opens voting (no nomination phase for bylaws)." The form should conditionally hide nomination dates for bylaw type. | P2 |
| J-M12-004 | voting-ballot.tsx (radio selection) | Bylaw voting UI | **Bylaw votes use candidate radio instead of yes/no**: For bylaw elections (type=bylaw), the ballot renders the same radio-per-position nominee selection as officer elections. Bylaw voting per spec WF-078 should be yes/no per proposal, not candidate selection. | P2 |
| J-M12-005 | member-election-detail.tsx, voting-ballot.tsx | Ballot API path | **Unverified ballot check endpoint**: Both components query `GET /api/association/member/ballots?electionId=` via raw `api.get()` instead of a generated SDK function. This endpoint is not in the API_CONTRACTS.md for m12 and may not exist in the backend. If missing, the "already voted" guard and vote receipt features silently fail (returns empty array, allowing re-voting). | P1 |
| J-M12-006 | voting-ballot.tsx:52 | castBallot per-position loop | **Sequential vote submission**: Votes are cast one position at a time in a for-loop. If the network fails mid-way, some positions are voted and others are not. The partial failure handler exists but the user cannot selectively retry failed positions -- they must retry the entire ballot. Previously voted positions are tracked in `votedPositions` Set and skipped on retry, which is correct. However, the UX for partial failure is confusing: the user sees both "X positions failed" toast AND the submit error, with no clear retry button. | P2 |
| J-M12-007 | election-detail.tsx (STATUS_COLORS, STATUS_LABELS) | Snake_case vs camelCase status values | **Potential status key mismatch**: The UI uses snake_case status keys (e.g., `nominations_open`, `voting_open`, `awaiting_confirmation`). The MODULE_SPEC and API_CONTRACTS use camelCase (e.g., `nominationsOpen`, `votingOpen`, `awaitingConfirmation`). If the backend returns camelCase, all status badges, transition buttons, and conditional rendering will fail silently (unmatched keys default to empty string/null). | P1 |

---

## Registry 6: Navigation Integrity

| Link/Navigate | Source File | Target Route | Exists? | Severity |
|---------------|-------------|--------------|---------|----------|
| `to="/org/$orgSlug/elections"` | governance/index.tsx | `/org/$orgSlug/elections` (member elections list) | YES | -- |
| `to="/org/$orgSlug/documents"` | governance/index.tsx | `/org/$orgSlug/documents` | UNVERIFIED | P2 |
| `to="/org/$orgSlug/officer/elections"` | officer/elections/new.tsx (cancel) | `/org/$orgSlug/officer/elections` | YES | -- |
| `to="/org/$orgSlug/officer/elections/new"` | election-list.tsx (Create button) | `/org/$orgSlug/officer/elections/new` | YES | -- |
| `to="/org/$orgSlug/officer/elections/$electionId"` | election-list.tsx (row click) | `/org/$orgSlug/officer/elections/$electionId` | YES | -- |
| `to="/org/$orgSlug/officer/elections/$electionId/edit"` | election-detail.tsx (Edit link) | `/org/$orgSlug/officer/elections/$electionId/edit` | YES | -- |
| `to="/org/$orgSlug/officer/dashboard"` | edit.tsx (breadcrumb) | `/org/$orgSlug/officer/dashboard` | UNVERIFIED | P3 |
| `to="/org/$orgSlug/elections/$electionId"` | member-election-list.tsx (row click) | `/org/$orgSlug/elections/$electionId` | YES | -- |
| `to="/org/$orgSlug/elections/$electionId/vote"` | member-election-detail.tsx (Vote CTA) | `/org/$orgSlug/elections/$electionId/vote` | YES | -- |
| `to="/org/$orgSlug/elections/$electionId"` | voting-ballot.tsx (back link) | `/org/$orgSlug/elections/$electionId` | YES | -- |
| `to="/org/$orgSlug/elections/$electionId"` | voting-ballot.tsx (after submit) | `/org/$orgSlug/elections/$electionId` | YES | -- |

---

## Findings Summary

| ID | Severity | Registry | Finding | File |
|----|----------|----------|---------|------|
| J-M12-001 | P1 | R5 | **Missing cancel election action**: Spec WF-076 alternate flow defines "President cancels election at any non-terminal state -- all votes voided, members notified." The API supports PATCH status to `cancelled`. No cancel button exists in the UI. Officers have no way to abort a running election. | `election-detail.tsx` |
| J-M12-005 | P1 | R5 | **Unverified ballot check endpoint**: `GET /association/member/ballots?electionId=` is called via raw api.get() but is not in API_CONTRACTS.md. If the endpoint does not exist, the already-voted guard fails open (empty array = not voted), potentially allowing duplicate votes client-side (server-side M12-R1 should still block). | `member-election-detail.tsx`, `voting-ballot.tsx` |
| J-M12-007 | P1 | R5 | **Status key format mismatch risk**: UI uses snake_case (`nominations_open`, `voting_open`, `awaiting_confirmation`). Spec and API contracts use camelCase (`nominationsOpen`, `votingOpen`, `awaitingConfirmation`). If backend returns camelCase, status badges render blank, transition buttons never appear, and conditional sections break. Needs verification against actual API response format. | `election-detail.tsx`, `member-election-detail.tsx`, `member-election-list.tsx` |
| J-M12-008 | P1 | R2 | **WF-078 bylaw voting not differentiated**: Bylaw elections reuse the officer election candidate-selection ballot instead of presenting yes/no approval votes per bylaw item. Members cannot properly vote on bylaw ratification. | `voting-ballot.tsx`, `election-form.tsx` |
| J-M12-002 | P2 | R5 | **Missing delete election action**: API supports DELETE for draft/cancelled elections. No delete UI exists. Orphan draft elections cannot be cleaned up by officers. | `election-detail.tsx`, `election-list.tsx` |
| J-M12-003 | P2 | R5 | **Bylaw form shows nomination dates**: ElectionForm renders nomination date pickers for bylaw elections. Bylaws skip the nomination phase per spec WF-078. | `election-form.tsx` |
| J-M12-004 | P2 | R5 | **Bylaw ballot uses wrong UI pattern**: Bylaw votes should be yes/no per proposal, not radio candidate selection. | `voting-ballot.tsx` |
| J-M12-006 | P2 | R5 | **Sequential ballot submission with confusing partial failure UX**: Votes cast one at a time in a loop. Partial failure shows both error text and toast simultaneously with no clear retry action. | `voting-ballot.tsx` |
| J-M12-009 | P2 | R4 | **Non-active members lack pre-flight eligibility check**: BR-33 requires active membership to vote. No client-side check before navigating to ballot page. Grace/lapsed/suspended members see the ballot, attempt to vote, and get a server error. | `member-election-detail.tsx`, `voting-ballot.tsx` |
| J-M12-010 | P2 | R4 | **VP/secretary/treasurer cannot delete elections despite spec permission**: Spec grants delete permission to VP, secretary (2FA), treasurer (2FA), board-member, officer. No delete action exists in UI for any role. | `election-detail.tsx` |
| J-M12-011 | P2 | R6 | **Unverified navigation target /org/$orgSlug/documents**: Governance hub links to documents route. Route existence not confirmed in scan scope. | `governance/index.tsx` |
| J-M12-012 | P3 | R6 | **Unverified breadcrumb target /org/$orgSlug/officer/dashboard**: Edit page breadcrumb links to officer dashboard. Route likely exists but not confirmed in scan scope. | `$electionId/edit.tsx` |

---

## Architecture Notes

**Dual-view pattern**: Elections use a clean split between officer and member views. Officers access `/officer/elections/*` with full CRUD and status transition controls. Members access `/elections/*` with read-only detail, self-nomination, and voting. Both share the same SDK query hooks (`listElectionsOptions`, `getElectionOptions`) and feature components (`ElectionTimeline`).

**Status transition model**: The officer detail view implements a linear progression model via `NEXT_ACTION` map (draft -> nominations_open -> voting_open -> awaiting_confirmation -> published). Each transition requires a two-click confirmation pattern (click action button -> "Yes, proceed" / "Cancel"). This is correct for the happy path but missing the cancel-at-any-state alternate flow.

**Secret ballot integrity**: The voting-ballot component correctly: (1) checks for existing ballots before rendering, (2) guards against non-voting_open status, (3) shows a confirmation dialog before submission, (4) warns that votes cannot be changed, (5) never exposes individual vote choices (only aggregate counts in results). The castBallot SDK function is used correctly per API contract.

**Ballot check gap**: Both member-election-detail.tsx and voting-ballot.tsx use a raw `api.get('/api/association/member/ballots?electionId=')` call that is not part of the generated SDK. This is the only non-SDK API call in the module. If this endpoint does not exist or returns unexpected data, the already-voted guard fails open. Server-side M12-R1 (unique constraint on electionId+positionId+voterId) is the true safety net.

**Bylaw differentiation gap**: The module treats bylaw elections as a variant of officer elections (same form, same ballot) with only cosmetic differences (label changes). The spec requires fundamentally different UX for bylaws: no nomination phase, yes/no voting instead of candidate selection, and threshold-based pass/fail results.
