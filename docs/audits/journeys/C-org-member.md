# Cluster C — Org member-facing

Static UI journey audit. apps/memberry (React + TanStack Router file routes, @monobase/sdk-ts TanStack Query hooks, `sonner` toasts). Read-only; nothing executed. Scope = member-facing only (`officer/**` routes excluded but noted where shared components originate there).

## Scan Manifest

| Sub-module | Routes scanned | Feature files scanned | Inventoried | Scanned |
|------------|----------------|------------------------|-------------|---------|
| directory | directory.tsx, directory/$personId.tsx | trust-card, trust-directory, directory-search, member-profile, directory-filters, lib/visibility (+2 tests) | 8 | 8 |
| dues (member) | dues.tsx | dues-status-card, dues-invoice-list, dues-status-badge, dues-gate-banner, payment-history-table, special-assessments-list, proof-upload-form, arrears-breakdown, lib/csv-export | 9 | 9 |
| elections | elections/index.tsx, $electionId/index.tsx, $electionId/vote.tsx | member-election-list, member-election-detail, voting-ballot, self-nomination-dialog, nominee-picker-dialog, election-timeline | 9 | 9 |
| documents | documents/index.tsx, documents/$documentId.tsx | document-browser, document-library | 4 | 4 |
| announcements/governance | announcements/index.tsx, announcements/$announcementId.tsx, governance/index.tsx, home.tsx, members.tsx, my-notifications.tsx | announcement-list, announcement-content, notification-preferences | 9 | 9 |
| messages | messages/index.tsx, messages/dm/index.tsx | message-composer, channel-list, dm-list, create-channel-dialog, message-reactions, chat-view (+hooks) | 8 | 8 |

Note: `officer/**` sibling routes (officer/elections, officer/documents, officer/messages, officer/communications, officer/dues, officer/finances) excluded per cluster scope. `dues-invoice-list.tsx`, `special-assessments-list.tsx`, `document-library.tsx`, `announcement-list.tsx` are officer-facing components co-located under member feature dirs — audited for completeness, scoped OFFICER.

---

## directory

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|--------|---------|------|-------|---------|-----|----------|----|----|
| directory.tsx | search input | input | (search) | setSearch | GET /association/member/directory/search | member | — | H |
| directory.tsx | filters | select x4 | specialty/chapter/dues/tier | setFilters | client filter + GET chapters | member | — | H |
| directory.tsx | Clear filters | button | Clear filters | setFilters reset | — | member | — | H |
| trust-card | card | Link | (profile) | →directory/$personId | none | member | — | H |
| $personId.tsx | Back to directory | Link | Back | →directory | none | member | — | H |
| member-profile | email | a mailto: | contactEmail | mailto | none | member | — | H |
| member-profile | website/social | a target=_blank | url | extern | none | member | — | H |

Registry 2/4/5/9: all PASS. Directory is read-only (queries only, no mutations). Errors render inline `role="alert"` branches ("Search failed" / "Unable to load directory"). No DEAD/NOOP/ORPHAN.

---

## dues (member)

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|--------|---------|------|-------|---------|-----|----------|----|----|
| dues.tsx | Export CSV | button | Export CSV | exportPaymentsCsv (client buildPaymentCsv+downloadCsv) | none | member | WF-016 | H |
| dues.tsx | retry | button (ErrorState) | Retry | refetch | re-GET invoices/payments | member | WF-016 | H |
| proof-upload-form | dropzone | div onClick | upload | file picker | — | member | WF-018 | H |
| proof-upload-form | submit | submit | Submit Payment Proof | onSubmit → POST /storage/files then submitPaymentProof | member | WF-018 | H |
| dues-gate-banner | Pay Dues Now | Link | Pay Dues Now | →/org/$slug/dues | none | member | WF-016 | H |

Registry 9: proof-upload submit interpolates `err.body.error`/`err.message` → PASS. File type/size validated client-side with specific toasts. CSV export guards empty payments.

Registry 2/4/5: PASS. Member can view standing, see arrears, submit proof, see rejection reason + resubmit. No DEAD/NOOP.

OFFICER (excluded from member counts): `dues-invoice-list.tsx` markPaid + `special-assessments-list.tsx` CRUD/apply/delete use `confirm()` + optimistic + onError toasts — all wired.

---

## elections

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|--------|---------|------|-------|---------|-----|----------|----|----|
| elections/index.tsx | election row | Link | (election) | →$electionId | listElections | member | WF-077 | H |
| $electionId/index.tsx | Cast Your Vote | Link | Cast Your Vote | →$electionId/vote (gated isVotingOpen && !hasVoted) | none | member | WF-077 | H |
| member-election-detail | Nominate Yourself | button | (opens dialog) | setSelfNominatePositionId | — | member | WF-076 | H |
| self-nomination-dialog | Yes, Nominate Me | button | confirm | createCandidate mutation | member | WF-076 | H |
| voting-ballot | candidate radios | label/input | (select) | setSelections | — | member | WF-077 | H |
| voting-ballot | Submit Ballot | button (confirm dialog) | Submit Ballot | handleConfirmedSubmit → castBallot per position (try/catch) | member | WF-077 | H |

### Registry 4 — Role Journey (elections/vote — flagged)
PASS. **Duplicate-vote guard surfaced in UI**: voting-ballot fetches `/ballots?electionId=`, computes `hasVoted = myBallots.length>0`, renders dedicated "You have already voted" block before the ballot. **Status gate surfaced**: `election.status !== 'voting_open'` renders "Voting is not open". Secret-ballot confirm dialog with "vote cannot be changed" warning.

### Registry 9
voting-ballot submit uses `castBallot` in try/catch (not useMutation) with per-position failure recovery — sets `submitError` with interpolated failed-position titles + toast → PASS. self-nomination/nominee-picker mutations interpolate `err.message` → PASS.

Registry 5: PASS. No DEAD/NOOP. (Note: backend enforces dues-gating for voting eligibility per ROLE_MATRIX; UI surfaces status/already-voted guards but does NOT pre-check dues standing on the vote CTA — see J-ELEC-001.)

---

## documents

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|--------|---------|------|-------|---------|-----|----------|----|----|
| documents/index.tsx (document-browser) | category tabs | Tabs | (filter) | setCategory | searchDocuments | member (MEMBER_ACCESS_LEVELS) | WF-072 | H |
| document-browser | doc row | Link | (doc) | →documents/$documentId | none | member | WF-072 | H |
| $documentId.tsx | Download | a href download | Download | GET /association/documents/$id/download | member (isAccessible gate) | WF-072 | H |
| $documentId.tsx | PDF preview | iframe | — | same download URL | member | WF-072 | M |

Registry 2/4/5/9: PASS. Member route uses read-only `document-browser` (queries only, `MEMBER_ACCESS_LEVELS` filter). Error branch renders "Failed to load document". Download is native anchor (no JS handler — cannot be DEAD). No mutations on member path.

OFFICER (excluded): `document-library.tsx` archive/delete/publish/create mutations all have onError toasts.

---

## announcements / governance / home / members / notifications

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|--------|---------|------|-------|---------|-----|----------|----|----|
| announcements/index.tsx | announcement card | Link | (ann) | →announcements/$announcementId | GET /communications/announcements/$org?status=sent | member | WF-046 | H |
| announcements/index.tsx | retry | ErrorState | Retry | refetch | re-GET | member | WF-046 | H |
| announcements/$announcementId.tsx | Back | button | Back | navigate(-1) | none | member | WF-046 | H |
| home.tsx | View all events | Link | View all | →events | none | member | — | H |
| home.tsx | announcement/event cards | Link | (item) | →detail | searchEvents/listAnnouncements | member | — | H |
| members.tsx | (DirectorySearch) | — | — | — | directory/search | member | — | H |
| governance/index.tsx | stat/section cards | Link | (election/doc) | →elections/documents | listElections/searchDocuments | member | WF-076 | H |
| my-notifications.tsx | channel toggles | Switch | (toggle) | handleToggle → POST person-subscriptions/bulk-update | member | WF-013 | M |

### Registry 9 — Error UX
- notification-preferences saveMutation: `onError: () => toast.error('Failed to save preference')` — generic static toast, AND does NOT roll back the optimistic local `setPrefs` flip on failure → **J-ANN-001 (P2)**: toggle visually stays in failed state; user believes pref saved.
- announcements/$announcementId: error branch static "Unable to load this announcement" (query, not mutation) → acceptable.

Registry 2/4/5: PASS. No DEAD/NOOP on member routes. `members.tsx` and `directory.tsx` both render directory (intentional dual entry, not orphan).

OFFICER (excluded): `announcement-list.tsx` links to `officer/communications/$announcementId`; `announcement-content.tsx` publish/archive/delete actions gated `showActions` (officer detail only — member view passes `showActions={false}`).

---

## messages

### Registry 1 — Action Registry

| Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|--------|---------|------|-------|---------|-----|----------|----|----|
| messages/index.tsx | channel select | button | (room) | setActiveRoomId | listChatRooms | member | WF-049 | H |
| messages/index.tsx | open DMs | Link | (dm) | →messages/dm | none | member | WF-049 | H |
| channel-list/dm-list | room item | button | onSelectRoom | setActiveRoomId | — | member | WF-049 | H |
| dm-list | new DM | button | onNewDm | callback | — | member | WF-049 | M |
| create-channel-dialog | Create | button | Create | createRoom → createChatRoom mutation | member | WF-049 | H |
| message-composer | send | submit form | (send) | handleSubmit → sendChatMessage mutation + ws.send | member | WF-049 | H |
| message-reactions | emoji | button | react/remove | onReact/onRemoveReaction | reaction API | member | WF-049 | M |

### Registry 9
- message-composer send: `onError: () => toast.error('Could not send message')` — generic static → J-MSG-001 (P2, J-ERROR-GENERIC).
- create-channel-dialog: `onError: () => toast.error('Failed to create channel')` — generic static → J-MSG-002 (P2, J-ERROR-GENERIC).

Registry 2/4/5: PASS. WebSocket reconnect surfaced (connection-status / isReconnecting). Send throttled 500ms with disabled state. No DEAD/NOOP/ORPHAN.

---

## Findings summary

| ID | Sev | Module | File:Line | Issue | Fix |
|----|-----|--------|-----------|-------|-----|
| J-ANN-001 | P2 | announcements | features/communications/components/notification-preferences.tsx (handleToggle/saveMutation) | Optimistic toggle not rolled back on save failure; onError toast generic. User sees toggle in saved-looking state after server rejects. | Revert `setPrefs` to prior value in `onError`; interpolate err message. |
| J-MSG-001 | P2 | messages | features/comms/components/message-composer.tsx (send.onError) | Generic static toast "Could not send message" — no err.code/message; failed send leaves draft cleared on success-only path (rollback ok since onSuccess clears). | Interpolate err message; keep draft if send fails. |
| J-MSG-002 | P2 | messages | features/comms/components/create-channel-dialog.tsx (createRoom.onError) | Generic static toast "Failed to create channel" — no err detail (e.g. duplicate-name conflict). | Interpolate err.code/message per ERROR_TAXONOMY. |
| J-ELEC-001 | P3 | elections | routes .../elections/$electionId/index.tsx (member-election-detail Vote CTA) | Vote CTA gated only on status + hasVoted; dues-standing eligibility (ROLE_MATRIX) enforced server-side but not surfaced pre-click — member in arrears clicks Vote, then hits backend 403. | Surface DuesGateBanner / disable CTA when standing != good. Backend already guards; UX-only. |

### Severity counts
- **P0: 0**
- **P1: 0**
- **P2: 3** (J-ANN-001, J-MSG-001, J-MSG-002)
- **P3: 1** (J-ELEC-001)

Status: COMPLETE (scanned 47 of 47 in-scope files; officer-only siblings noted but excluded from member journey counts).
