# MODULE_SPEC: member/governance

Sub-domain #2 of 9 in the `association:member` mega-module rebuild (Step 6 R2).

## 1. Purpose

Owns the association governance surface: who holds elected positions, who
runs for them, how elections are conducted, and how votes are recorded.
Five concerns split across one TypeSpec file:

- **Positions** — the elected-role catalog (President, Treasurer, …) and
  their term length, level (national / regional / chapter), and status.
- **Officer Terms** — assignments of a person to a position for a
  specific date range, with status tracking (upcoming / active / completed
  / resigned / removed).
- **Elections** — the state machine that runs a governance vote: draft →
  nominationsOpen → votingOpen → awaitingConfirmation → published, with
  cancellable side branches.
- **Candidates** — nominees for a position in an election, including
  bio + platform + the nominee's own accept/decline state.
- **Ballots** — recorded votes (or proxy votes); immutable post-cast.

## 2. Bounded Context

In scope:
- The five TypeSpec interfaces wired in `main.tsp` under `@tag("Member/Governance")`:
  `PositionManagement`, `OfficerTermManagement`, `ElectionManagement`,
  `CandidateManagement`, `BallotManagement`.
- All routes under `/association/member/{positions,officer-terms,elections,
  candidates,ballots}` — 26 operationIds total.
- The shared `governance.repo` + `governance.schema` (tables `positions`,
  `officer_terms`, `elections`, `candidates`, `ballots`).

Out of scope:
- `transitionOfficerTerm` (hand-wired at `POST /association/member/org/:organizationId/officers/:termId/transition`) —
  belongs to R5 officers sub-domain when migrated. Stays in
  `handlers/association:member/` for now.
- `listOfficerTermsSummary` — operationId defined in `credits.tsp`, not
  `governance.tsp`. Belongs to R6 credits.
- The m12 legacy `handlers/elections/` module (castVote, createNominee,
  updateNomineeStatus, updateElectionStatus) — entirely hand-wired,
  separate schema, separate sub-domain. Not part of governance.
- 7 orphan interfaces inside `governance.tsp` with zero wired routes —
  `CommitteeManagement`, `CommitteeSeatManagement`, `CommitteeMeetingManagement`,
  `MotionManagement`, `MeetingMinutesManagement`, `BoardMeetingManagement`,
  `BoardResolutionManagement`. Left in the .tsp for forward planning;
  not part of R2.

Adjacent modules and the seams between them:

| Adjacent module | Seam |
|---|---|
| `person` | Subscribes to `person.deleted` and clears this person's officer terms (status=removed) via `core/domain-event-consumers.ts`. |
| `member/chapters` | Reads chapter id to scope chapter-level positions. |
| `dues` | Reads officer state to authorize payment-link send + receipt download. |
| `association:operations` | Reads officer state for event ownership + accredited-provider checks. |
| `handlers/elections/` (m12) | `createCandidate` writes to `electionNominees` via `ElectionsRepository` — cross-module read+write seam. Preserve the import; the m12 elections schema is the source of truth for raw nominee tracking. |
| `core/auth/officer-checks` | Imports `OfficerTermRepository` for `requireOfficerTerm` and `requirePosition` checks invoked by handlers in this module and many others. |

## 3. Handler Inventory

All handlers live at `services/api-ts/src/handlers/member/governance/`.

| Handler file | Verb | Auth required | Audit action | Notes |
|---|---|---|---|---|
| createPosition.ts | POST /association/member/positions | `association:admin` + `requirePosition(President)` | `create position` | Officer-only via inline check (parity with R1; not yet expressed as `x-require-position` extension). |
| getPosition.ts | GET /association/member/positions/{positionId} | `association:admin`, `association:member` | — | Read. |
| listPositions.ts | GET /association/member/positions | `association:admin`, `association:member` | — | Pagination + filters. |
| updatePosition.ts | PATCH /association/member/positions/{positionId} | `association:admin` | `update position` | PATCH semantics. |
| deletePosition.ts | DELETE /association/member/positions/{positionId} | `association:admin` | `delete position` | 409 if active officer terms reference it. |
| createOfficerTerm.ts | POST /association/member/officer-terms | `association:admin` + `requirePosition(President)` | `create officer-term` | Emits `officer.assigned`. |
| getOfficerTerm.ts | GET /association/member/officer-terms/{termId} | `association:admin`, `association:member` | — | Read. |
| listOfficerTerms.ts | GET /association/member/officer-terms | `association:admin`, `association:member` | — | Filters: `organizationId`, `personId`, `status`. |
| updateOfficerTerm.ts | PATCH /association/member/officer-terms/{termId} | `association:admin` + `requirePosition(President)` | `update officer-term` | Status transitions guarded by repo. |
| deleteOfficerTerm.ts | DELETE /association/member/officer-terms/{termId} | `association:admin` + `requirePosition(President)` | `delete officer-term` | Emits `officer.removed`. |
| createElection.ts | POST /association/member/elections | `association:admin` + `requirePosition(President)` | `create election` | Defaults `status=draft`. Emits `election.created`. |
| getElection.ts | GET /association/member/elections/{electionId} | `association:admin`, `association:member` | — | Read. |
| listElections.ts | GET /association/member/elections | `association:admin`, `association:member` | — | Filters: `organizationId`, `status`, `type`. |
| updateElection.ts | PATCH /association/member/elections/{electionId} | `association:admin` + `requireOfficerTerm` | `update election` | 409 if past `nominationsOpen` for most fields. |
| deleteElection.ts | DELETE /association/member/elections/{electionId} | `association:admin` + `requireOfficerTerm` | `delete election` | 409 if not `draft` or `cancelled`. |
| openElectionNominations.ts | POST .../{electionId}/open-nominations | `association:admin` + `requireOfficerTerm` | `update election` | `draft → nominationsOpen`. |
| openElectionVoting.ts | POST .../{electionId}/open-voting | `association:admin` + `requireOfficerTerm` | `update election` | `nominationsOpen → votingOpen`. Emits `election.status.changed`. |
| certifyElection.ts | POST .../{electionId}/certify | `association:admin` | `update election` | `votingOpen → published`. Triggers officer term creation downstream via consumer. |
| createCandidate.ts | POST /association/member/candidates | `association:admin`, `association:member` | `create election-nominee` | Cross-module: also writes `electionNominees` via `ElectionsRepository`. |
| getCandidate.ts | GET /association/member/candidates/{candidateId} | `association:admin`, `association:member` | — | Read. |
| listCandidates.ts | GET /association/member/candidates | `association:admin`, `association:member` | — | Filters: `electionId`, `positionId`. |
| updateCandidate.ts | PATCH /association/member/candidates/{candidateId} | `association:admin` + `requireOfficerTerm` | `update election-nominee` | Bio/platform edits. |
| deleteCandidate.ts | DELETE /association/member/candidates/{candidateId} | `association:admin` + `requireOfficerTerm` | `delete election-nominee` | 409 if any ballots cast for them. |
| updateCandidateStatus.ts | POST .../{candidateId}/status | `association:admin`, `association:member` | `update election-nominee` | Nominee self-action: accepted / declined. |
| castBallot.ts | POST /association/member/ballots | `association:admin`, `association:member` | `create ballot` | Immutable. Enforces 1-ballot-per-position-per-voter. |
| listBallots.ts | GET /association/member/ballots | `association:admin`, `association:member` | — | Officer-aggregate view; voter-self filter when called by member tier. |

26 handlers · 16 mutating ops carry `x-audit` · 11 still call `requireOfficerTerm`
or `requirePosition` inline (preserved at parity floor — migration to
`x-require-officer` / `x-require-position` extensions is a follow-up).

## 4. TypeSpec source

`specs/api/src/association/member/governance.tsp` — 26 operationIds across
5 wired interfaces (12 interfaces defined total; 7 orphan, out of scope —
see §2).

Routed via `specs/api/src/main.tsp` under `@tag("Member/Governance")` on
all 5 interfaces (R2 retag — was `@tag("Association:Member")`).

## 5. Database schema

- `services/api-ts/src/handlers/association:member/repos/governance.schema.ts`
- `services/api-ts/src/handlers/association:member/repos/governance.repo.ts`

Schema stays under `association:member/repos/` on purpose: 30+ inbound
importers (`core/auth/officer-checks`, `core/domain-event-consumers`,
`core/schema-registry`, `core/ports`, seed layers 2/5/7, plus
`handlers/dues`, `handlers/person`, `handlers/invite`,
`handlers/association:operations`, middleware, several test files) depend
on this exact path. Moving the schema would force a cascade rewrite for
zero behavioral gain.

Tables:
- `positions` — (id, organizationId, title, level, termLengthMonths, maxConsecutiveTerms?, description?, responsibilities[], status)
- `officer_terms` — (id, positionId, personId, organizationId, startDate, endDate?, status, appointedBy?)
- `elections` — (id, organizationId, title, type, votingMode, status, positions[], nominations/voting open/close windows, passageThreshold?)
- `candidates` — (id, electionId, positionId, personId, nominatedBy, bio?, platform?, status)
- `ballots` — (id, electionId, positionId, candidateId, voterId, isProxy, proxyFor?, castAt)

Cross-module: `createCandidate` also writes `electionNominees` via
`ElectionsRepository` (m12 elections schema). Preserve the dual write
until R4 elections migration consolidates the two.

## 6. Cross-module dependencies

Emits domain events:
- `officer.assigned` (createOfficerTerm) → notification consumer.
- `officer.removed` (deleteOfficerTerm) → notification consumer.
- `officer.transitioned` (transitionOfficerTerm — hand-wired, out-of-scope) →
  notification + downstream cleanup.
- `election.created` (createElection) → bulk-notify active members.
- `election.status.changed` (openElectionVoting) → bulk-notify voters.

Consumes events:
- `person.deleted` → consumer ends the person's active officer terms.
  Cascade lives in `core/domain-event-consumers.ts`; this module owns
  no consumer code.

Calls into other modules:
- `createCandidate` writes to `electionNominees` via
  `@/handlers/elections/repos/elections.repo` — cross-module write to the
  m12 elections store. Required for legacy parity; will dissolve at R4.
- `election-role-enforcement.test.ts` (test only) reads
  `electionNominees` and `ElectionsRepository` for fixture setup.

## 7. Test coverage status

- **Unit tests**: 8 files moved colocated to
  `services/api-ts/src/handlers/member/governance/`:
  - `castBallot.test.ts`
  - `certifyElection.test.ts`
  - `createCandidate.test.ts`
  - `createOfficerTerm.test.ts`
  - `election-role-enforcement.test.ts` (sweep — covers all mutation
    handlers for officer-only enforcement)
  - `governance.test.ts` (cross-cutting position/election integration)
  - `openElectionVoting.test.ts`
  - `updateOfficerTerm.test.ts`

  Not every handler has a dedicated test file — coverage rides on
  `election-role-enforcement.test.ts` (authorization sweep) and
  `governance.test.ts` (integration). Per-handler unit suites for
  positions/list ops are a follow-up.

- **Contract scenarios**: 6 Hurl files in
  `specs/api/tests/contract/member/governance/`:
  - `position-crud.hurl` (create → get → list → update → delete → 404)
  - `officer-term-lifecycle.hurl` (position precondition → term create
    → get → list → update → delete)
  - `election-lifecycle.hurl` (draft → nominationsOpen → votingOpen →
    published; plus disposable election delete teardown)
  - `candidate-crud.hurl` (election in nominationsOpen → candidate
    create → get → list → patch → status=accepted → delete)
  - `ballot-cast.hurl` (full setup → castBallot → listBallots)
  - `governance-rbac.hurl` (401 unauth + 403 non-officer edges)

- **E2E**: deferred to broader governance UI work. Admin-tier endpoints
  surfaced through `apps/admin`; member-tier endpoints surfaced through
  `apps/memberry` (election participation flows).

## 8. Hand-wired routes (if any)

None within R2 scope. The two governance-adjacent hand-wired handlers
remain at `handlers/association:member/` and are out of R2 scope:

- `transitionOfficerTerm.ts` — `POST /association/member/org/:organizationId/officers/:termId/transition`.
  Complex governance flow per CLAUDE.md §"Deferred Work".
- `listOfficerTermsSummary.ts` — `GET /officer-terms/:organizationId`.
  Belongs to credits sub-domain (R6) per `credits.tsp`.

## 9. Known gotchas

- **Schema path asymmetry**: handlers live at `handlers/member/governance/`
  but schema lives at `handlers/association:member/repos/`. 30+ importers
  depend on the old path — do not move the schema during R3-R9 without
  first refactoring `core/domain-event-consumers.ts`,
  `core/auth/officer-checks.ts`, `core/schema-registry.ts`, and the seed
  layers.
- **Cross-module electionNominees write**: `createCandidate` writes
  `electionNominees` via `ElectionsRepository`. This is a legacy
  parity write. Removing it before R4 elections migration breaks
  m12 tally compatibility.
- **State machine guards live in the repo**: `ElectionsRepository`
  enforces draft → nominationsOpen → votingOpen → published. Handler-side
  pre-checks are not sufficient — the repo guards re-entry.
- **`certifyElection` is a one-way trigger**: emits
  `election.status.changed` which fans out officer term creation via the
  consumer. Repeat-call protection lives in the repo, not the handler.
- **`castBallot` enforces 1-ballot-per-(voter, position)** at the repo
  layer with a unique constraint. Handler-level dedupe is a courtesy
  check; the constraint is the source of truth.
- **`requirePosition(President)` checks are inline** (not yet TypeSpec
  extensions). On 2FA-required positions (President, Treasurer, Secretary)
  production also requires step-up auth via `core/auth/officer-checks`.
- **`election-role-enforcement.test.ts` is the authorization sweep**.
  When adding a new mutation handler, append a test case there as well —
  it is the cross-handler safety net.

## 10. AI extension checklist

To add a new endpoint to this module:

1. Add the operation to `specs/api/src/association/member/governance.tsp`
   with `@operationId(...)`, the appropriate verb, `@useAuth(bearerAuth)`,
   and the right `@extension("x-security-required-roles", ...)`. Add
   `@extension("x-audit", #{ action, resourceType })` for any mutation.
   Prefer `@extension("x-require-position", #["President", ...])` or
   `@extension("x-require-officer", true)` over inline checks — the
   inline calls in this module are parity-preserved, not the target shape.
2. Wire the interface in `specs/api/src/main.tsp` under
   `@tag("Member/Governance")`.
3. `cd specs/api && bun run build` — regenerates OpenAPI.
4. `cd services/api-ts && bun run generate` — emits handler stub at
   `services/api-ts/src/handlers/member/governance/`.
5. Implement the handler using `PositionRepository` / `OfficerTermRepository`
   etc. from `@/handlers/association:member/repos/governance.repo`. For
   cross-module election state use
   `@/handlers/elections/repos/elections.repo` until R4 dissolves the
   legacy split.
6. Add unit tests in `member/governance/*.test.ts`. Append a row to
   `election-role-enforcement.test.ts` if the handler is a mutation.
7. Add at least one contract scenario in
   `specs/api/tests/contract/member/governance/`.
8. Run: `bun run check:sdk-compat` — must show 0 op drift after baseline
   is unfrozen (post-Step-6 close).

Forbidden:
- Editing `services/api-ts/src/generated/**` (audit / route registry / validators).
- Hand-wiring routes in `services/api-ts/src/app.ts` for governance
  operations (except the two pre-existing carve-outs noted in §8).
- Moving `repos/governance.schema.ts` without first updating the 30+
  inbound importers — see §5 and §9.
- Changing event names or payload shapes for `officer.*` or `election.*`
  events without touching `core/domain-event-consumers.ts` in the same
  commit.
