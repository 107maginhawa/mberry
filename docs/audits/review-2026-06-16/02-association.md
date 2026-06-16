# C2 — Association Mega Modules Review (2026-06-16)

Scope: `services/api-ts/src/handlers/association:member/` (44 src), `association:operations/` (83 src), `member/` (195 src — memberships, governance, credits/CPD, certificates, credentials).

Method: grep risk-pattern → targeted Read. Did not read every file. Drizzle `sql`` `` interpolation treated as parameterized/safe.

---

## A. Credits / CPD calculation

### `member/credits/listMemberCreditsForPeer.ts:31-39` — **[P1][Cross]** Cross-org credit leak via undefined org filter.
`orgId` is read as `string | undefined` and passed to `repo.findMany({ organizationId: orgId, personId })`. In `association:member/repos/credits.repo.ts:60` the org filter is conditional: `if (filters.organizationId) conditions.push(eq(...))`. When `organizationId` is `undefined`, the org predicate is dropped and the query returns **that person's credit entries across ALL organizations**, then renders them on a peer's directory card. A member of org A can read a member's CPD activity logged in org B.

Why: optional-filter repo pattern + handler that doesn't assert org context present. The endpoint is "any member can view peer credits" so it's broadly reachable.

Fix: require org context, never call with undefined.
```ts
const orgId = ctx.get('organizationId') as string | undefined;
if (!orgId) throw new ValidationError('organization context required');
const entries = await repo.findMany({ organizationId: orgId, personId: query.personId });
```
Defense-in-depth: make `findMany` reject/throw when `organizationId` is absent for person-scoped reads, or split into an explicit `findManyForOrg(orgId, ...)`.

### `member/credits/adjustCreditEntry.ts:88` (also `voidCreditEntry.ts`, `awardManualCredit.ts`) — **[P2][Intra]** Synchronous `REFRESH MATERIALIZED VIEW CONCURRENTLY` inside the request path.
Every officer credit adjustment runs `REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_standings` synchronously before responding. Under concurrent credit writes this serializes (CONCURRENTLY takes an exclusive-ish refresh lock per matview — a second concurrent refresh errors or blocks), and it scans the whole standings view on every single-row write. The `try{}catch{}` swallows the failure silently, so a failed refresh leaves compliance stale with no signal.

Why: heavy global recompute coupled to a single-entity mutation; bounded only by request concurrency.

Fix: move the refresh to a debounced background job (the `creditIssue` job already owns a refresh path), or emit a `credit.changed` event and let a single coalescing worker refresh. At minimum log the catch.

### `member/credits/utils/credit-cycle.ts:43` — **[P3][Intra]** Legacy `getCycleForDate` uses `365.25` ms-based year arithmetic.
`cycleDurationMs = cyclePeriodYears * 365.25 * 24*60*60*1000` drifts vs calendar years (leap-year boundary slop), so registration-anchored cycle boundaries land hours/days off a clean date. Only the cross-org transcript still uses this path (`resolveCycle` replaced the org paths). Low blast radius but can misclassify an activity dated on a cycle edge.

Fix: use calendar-year math like `resolveCycle` (construct `new Date(year+N, month-1, 1)`), or document the tolerance.

### `member/credits/utils/credit-cycle.ts:185-194` — **[Note]** `calculateCarryover` (BR-12) looks correct: 50% floor cap, no negative. Keep, add tests (see gaps).

---

## B. Governance / Elections state machine

### `member/governance/certifyElection.ts:82-101` + `core/domain-event-consumers.ts:1164` — **[P1][Cross]** Winner certification and officer-term creation are split across a non-durable fire-and-forget event; partial success leaves "elected, no term."
`certifyElection` writes nominee `elected` statuses (loop, `repo.updateNomineeStatus`) and sets election `published` (`repo.update`) **without a transaction**, then `domainEvents.emit('election.published', ...).catch(()=>{})`. The `election.published` consumer (`domain-event-consumers.ts:1164`) is what actually transitions officers / creates the new terms. The bus is in-memory, fire-and-forget, no persistence, no retry (`core/domain-events.ts:5,70` — `Promise.allSettled`, swallowed). If the consumer throws (or the process restarts between commit and consumer), the election is published and nominees marked elected but **no officer terms exist** — governance is silently inconsistent and there is no replay.

Why: cross-module governance integrity routed through a best-effort in-memory bus; the `.catch(()=>{})` discards even the emit error.

Fix: do the officer-term transition in the same DB transaction as certify (or persist an outbox row consumed with retry). Minimal:
```ts
await db.transaction(async (tx) => {
  // tally + update nominees + update election + create/close officer terms here
});
// emit only AFTER commit, for non-critical side effects (notifications) only
```

### `member/governance/certifyElection.ts:65-85` — **[P2][Intra]** Tie votes silently resolved to first-seen nominee; no tie detection.
`maxByPosition` keeps a nominee only when `t.count > current.count` (strict). On an exact tie the **first row** the tally returns wins; order is nondeterministic. For a real election this certifies an arbitrary winner with no flag, no runoff, no error.

Fix: detect ties and refuse to auto-certify.
```ts
// after building maxByPosition, recount equals:
const tied = tallies.filter(t => t.count === maxByPosition.get(t.positionId)!.count
  && t.nomineeId !== maxByPosition.get(t.positionId)!.nomineeId);
if (tied.length) throw new BusinessLogicError('Tie detected; manual runoff required', 'ELECTION_TIE');
```

### `member/governance/certifyElection.ts:87-90` — **[P2][Intra]** Status flow uses literal `'published'` but the documented machine is `awaitingConfirmation → published`; no use of a central `isValidElectionTransition` guard.
There is no election-status transition table analogous to `MEMBERSHIP_VALID_TRANSITIONS`. Each governance handler (`openElectionVoting`, `closeElectionVoting`, `certifyElection`) hand-checks `existing.status !== X`. Drift risk: an illegal jump added later won't be caught centrally.

Fix: add `ELECTION_VALID_TRANSITIONS` to `member/membership/utils/status-transitions.ts` (or a governance equivalent) and route all four governance transitions through it.

### `member/governance/castBallot.ts:76-87` — **[P2][Intra]** Check-then-insert double-vote race (mitigated by DB constraint, surfaces as 500 not 409).
`hasVoted()` then `castVote()` are two statements, not atomic and not in a transaction. Two concurrent requests both pass `hasVoted=false` and both insert. The `election_vote_unique (electionId, voterId, positionId)` index (`elections.schema.ts:59`) prevents the duplicate row (good — no corruption), but the loser throws an unhandled 23505 → 500 instead of the intended `DUPLICATE_VOTE` 409.

Fix: drop the pre-check race window; catch 23505 on insert and map to the existing `DUPLICATE_VOTE` BusinessLogicError.

---

## C. Certificate numbering / issuance

### `member/certificates/utils/certificate-numbering.ts:7,14` — **[P2][Intra]** `FOR UPDATE` on a SELECT that returns zero rows does not lock the gap; first-issuance-of-year race.
`getNextCertificateNumber` / `reserveCertificateRange` do `SELECT ... FOR UPDATE` then branch: if 0 rows, `INSERT`. For the **first** certificate of a (org, year) there is no row to lock, so two concurrent transactions both see 0 rows and both INSERT. The `org_cert_seq_org_year_unique` constraint (`certificates.schema.ts:56`) blocks the duplicate (good — no duplicate cert numbers), but the loser gets an unhandled 23505 → failed issuance with no retry. After the row exists `FOR UPDATE` serializes correctly.

Why: `SELECT ... FOR UPDATE` only locks existing rows; gap/first-insert needs `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.

Fix: collapse to an atomic upsert that both reserves and returns the range:
```sql
INSERT INTO org_certificate_seq (organization_id, year, last_seq, org_code)
VALUES (${orgId}, ${year}, ${count}, ${orgCode})
ON CONFLICT (organization_id, year)
DO UPDATE SET last_seq = org_certificate_seq.last_seq + ${count}, updated_at = now()
RETURNING last_seq;
-- startSeq = returned last_seq - count + 1
```
This removes the read-modify-write entirely and is correct under concurrency without relying on the constraint as a tripwire.

### `member/certificates/repos/certificates.repo.ts:33-41` — **[P2][Intra]** Second, divergent numbering path using `count(*)` — non-atomic AND a different format.
`CertificatesRepository.getNextCertificateNumber` computes the next number as `count(*) WHERE certificateNumber LIKE 'CERT-YYYY-%'` + 1. This (a) has a TOCTOU race with no lock (two issuers get the same count → same number, and the unique-on-certificateNumber catches it as a 23505), and (b) emits `CERT-YYYY-NNNNNN` while the util emits `${orgCode}-YYYY-NNNN` — **two incompatible numbering schemes** in the same module. Also `count(*)` is wrong after any cert deletion (numbers reused).

Fix: delete this method; route all issuance through the seq-table upsert above. If kept temporarily, it must read the seq table, not `count(*)`.

### `member/certificates/bulkIssueCertificates.ts:31-77` — **[Note/Good]** Bulk path correctly wraps `reserveCertificateRange` in `db.transaction` and batch-inserts (N+1 fixed). The single-issue util callers should adopt the same upsert so they don't depend on transaction wrapping that single callers may omit.

---

## D. Membership lifecycle state machine

### `member/membership/utils/status-transitions.ts` vs handlers — **[P2][Intra]** Central `MEMBERSHIP_VALID_TRANSITIONS` exists but is used by only one handler.
`isValidMembershipTransition` is referenced only in `terminateMembership.ts`. `suspendMembership`, `reinstateMembership`, `unsuspendMembership`, `resignMembership`, `deceaseMembership` each re-declare their own inline allowlist (`SUSPENDABLE_STATUSES`, `REINSTATABLE_STATUSES`, …). Functionally each guards correctly today, but the central table is a façade — change it and most transitions ignore it. Drift/duplication risk on a compliance-sensitive machine.

Fix: route every membership write through `isValidMembershipTransition(from, to)` + `membershipTransitionError`; delete the per-handler inline arrays.

### `member/membership/utils/status-transitions.ts:88,92` — **[P3][Intra]** `expired` is in the transition table but documented (lines 84-85) as never produced in V1.
`pendingPayment → expired` and `expired → active|removed` are reachable in the table but the comment says EXPIRED is dropped from V1 vocabulary. Dead/contradictory transitions invite a future bug where something sets `expired` and bypasses intended flows.

Fix: remove `expired` edges from the table (keep the enum value) or implement the threshold/job the comment says doesn't ship.

---

## E. Person-deletion cascade (money-adjacent / compliance)

### `core/domain-event-consumers.ts:1518-1598` — **[P2][Cross]** `person.deleted` association:member cascade is 10 sequential writes with no transaction; partial failure leaves a half-scrubbed record (DPA 2012 gap).
The subscriber runs `update memberships` → `update statusHistory` → `update creditEntries` → … → `update duesPayments` (proof scrub) as independent awaits inside one `try/catch` that only logs. If write #5 throws, memberships are already `removed` but dunning events / dues-payment proof are **not** scrubbed — a privacy-deletion request is reported done (event consumed) yet PII proof files remain referenced. No retry (in-memory bus, Section B).

Why: regulated erasure routed through best-effort fire-and-forget with non-atomic multi-table writes.

Fix: wrap each owner's cascade in `deps.db.transaction(async tx => { ... })` so the module's scrub is all-or-nothing, and surface failures to a retry/outbox rather than swallowing.

### `core/domain-event-consumers.ts:1587-1594` — **[Good]** Dues payments are **anonymized (UPDATE: null proof fields), not deleted**, preserving `amount` per BR-32. Money records correctly retained. Confirmed no `delete(duesPayments)` anywhere.

---

## F. N+1 / unbounded queries

### `association:operations/list{Committees,CustomTrainingEnrollments,OrgAccreditedProviders,CustomEventRegistrations,CustomEventAttendance,MyCustomTrainings}.ts` — **[P2][Intra]** Unbounded list handlers (no `limit`).
e.g. `listCommittees.ts:9` → `repo.list(orgId)` returns every committee for the org, serialized whole. No pagination ceiling. For large orgs this is an unbounded result-set + response. Six handlers share the pattern.

Fix: add `limit`/`offset` (default cap, e.g. 100) consistent with the paginated roster handlers; thread through the repo `list`.

### `member/membership/listRosterMembers.ts:44` — **[Good]** Uses `listMembersWithOfficerStatus` (single JOIN) with `limit: pageSize` — officer status is joined, not N+1 per row. Keep as the template the unbounded handlers above should copy.

---

## G. Authorization

### `core/auth/officer-checks.ts:52-53,116-117` — **[P3][Intra]** 2FA-for-privileged bypass keyed on `NODE_ENV !== 'production'`.
`const isDev = process.env['NODE_ENV'] !== 'production'; if (holdsPrivileged && !twoFactorEnabled && !isDev)`. Any environment where `NODE_ENV` is unset/`test`/`staging` silently disables 2FA enforcement for President/Treasurer/Secretary. A misconfigured staging-as-prod deploy ships with privileged-officer 2FA off and no error. (Consistent with the config audit's prod-gate theme.)

Fix: gate on an explicit positive flag (`config.enforce2fa`) defaulting to ON, fail-closed; only an explicit dev opt-out disables it.

### `core/auth/officer-checks.ts` — **[Good]** Titles sourced from DB JOIN (`findActiveByPersonAndOrg`), never request body; case-insensitive OR match; privileged set shared with middleware. Authorization derivation itself is sound.

---

## Test gaps (name specific uncovered logic)

association:member 44/24 and association:operations 83/51 thin ratios. Uncovered business logic that carries real risk:

1. **`certifyElection` winner determination** (`member/governance/certifyElection.ts`) — no test for: exact-tie handling, bylaw `passageThreshold` rejection branch (lines 78-81), winner→officer-term consistency when the `election.published` consumer throws. Currently `createElection`/`deleteElection`/`openElectionNominations` have **no sibling test file** at all.
2. **Credit cycle resolution** (`resolveCycle` in `credit-cycle.ts`) — no direct test for the epoch-alignment math: activity dated just before `cycleStartMonth` (prior-cycle assignment, line 149), multi-year `cycleLengthYears` boundary, and the `getCreditCompliance.ts` / `createCreditEntry.ts` handlers (both **untested**) that depend on it. A wrong cycle window mis-reports regulatory compliance.
3. **Certificate numbering concurrency** (`certificate-numbering.ts`) — no test proving the first-of-year race or that two issuers can't collide; and no test asserting the repo `count(*)` path (`certificates.repo.ts:33`) is not used / agrees on format.
4. **Membership transition guard coverage** — `MEMBERSHIP_VALID_TRANSITIONS` is exercised only via `terminateMembership`; no test asserts that suspend/reinstate/resign/decease reject illegal source states through the central table (they use private arrays instead).
5. **`person.deleted` cascade partial-failure** — no test that a mid-cascade throw is atomic per owner (currently it is not), nor that dues-payment `amount` survives while proof fields are nulled (BR-32).
6. **`listMemberCreditsForPeer` org scoping** — no test that an absent/foreign org context cannot return another org's credit entries (the leak in Section A).

---

## Top 3 Critical (C2)

1. **`member/credits/listMemberCreditsForPeer.ts:31` + `credits.repo.ts:60`** — undefined org context drops the org filter → **cross-org CPD credit leak** (any member reads a peer's credits from other organizations). [P1/Cross]
2. **`member/governance/certifyElection.ts:82-101` + `domain-event-consumers.ts:1164` / `domain-events.ts`** — election published & nominees marked elected outside any transaction; officer-term creation runs in a non-durable, no-retry, fire-and-forget consumer → **"elected but no officer term"** governance inconsistency on consumer failure or restart. [P1/Cross]
3. **`member/certificates/utils/certificate-numbering.ts:7` + `certificates.repo.ts:33`** — `SELECT … FOR UPDATE` doesn't lock the first-of-year gap (race on initial issuance) **and** a second divergent `count(*)`-based numbering path exists with an incompatible format; both rely on the unique constraint as a tripwire that surfaces as a 500. Replace with `INSERT … ON CONFLICT DO UPDATE … RETURNING`. [P2/Intra — elevated: money/credential integrity + duplicate-scheme risk]
