# C1 — Identity & Onboarding Review (2026-06-16)

Scope: `handlers/person/`, `handlers/membership/`, `handlers/invite/`, `handlers/onboarding/`.
Cross-module touchpoints reviewed: `core/domain-events.ts`, `core/domain-event-consumers.ts` (person.deleted cascade), `person/jobs/deletionProcessor.ts`.

Every finding cites a line actually read. Drizzle `sql\`\`` interpolations are parameterized and were not flagged.

---

## person/

- `person/jobs/deletionProcessor.ts:70-76` & `person/executeAccountDeletion.ts:67-86` — **[Priority High] [Cross-Module]** Account-deletion cascade is best-effort with no failure gate. `executeCascadeDeletion` calls `domainEvents.emit('person.deleted', …)`, and `emit` (domain-events.ts:70-82) runs every subscriber under `Promise.allSettled`, swallowing all rejections (only logs). The caller gets `void` back and then unconditionally stamps the person `deletionCompletedAt` (deletionProcessor.ts:73-76 / executeAccountDeletion.ts:70-86). If any of the 9 cascade subscribers in `domain-event-consumers.ts` throws (DB blip, FK restrict, e.g. surveys responder_id `onDelete:'restrict'` noted at line 1751), that module is left holding the deleted person's PII (orphaned memberships, credits, documents, subscriptions, etc.) while the person row is marked complete — and the deletion processor is idempotent (`isNull(deletionCompletedAt)` filter, line 55), so it will **never retry**. DPA right-to-erasure silently incomplete. Why it matters: regulated PII persists undetected; no signal, no retry. Fix: make `emit`/cascade return per-handler outcomes and only mark `deletionCompletedAt` when all critical subscribers succeed; re-enqueue on partial failure.
  ```ts
  const outcomes = await domainEvents.emitSettled('person.deleted', { personId });
  if (outcomes.some(o => o.status === 'rejected')) {
    logger.error({ personId }, 'cascade incomplete — leaving deletionCompletedAt unset for retry');
    return; // do NOT anonymize/complete; next cron run retries
  }
  ```

- `person/executeAccountDeletion.ts:70-86` — **[Priority High] [Intra-Module]** Dead handler carrying a *drifted* PII scrub list. The file is unrouted (no registration in routes.ts/app.ts; grep finds only a doc comment reference), confirmed by its own header (lines 5-12) and `anonymize-person.ts:5-8`. Its inline scrub object **omits `bio` and `gender`** — exactly the two fields the canonical `anonymizePersonFields()` (anonymize-person.ts:38-39) was created to stop dropping. Why it matters: a latent landmine — anyone who re-routes or copies this handler reintroduces the DPA erasure gap the team already fixed once. Two scrub code paths must never coexist. Fix: delete `executeAccountDeletion.ts` (live path is `deletionProcessor.ts`, which already uses the canonical helper), or replace its inline object with `anonymizePersonFields(now)`.

- `person/getPerson.ts:80-83` — **[Priority Low] [Intra-Module]** Runtime `instanceof Date` guard contradicts the static type (`dateOfBirth: string | null`) and only serializes `dateOfBirth`; other Date-typed columns returned via `...person` (line 86) are spread raw, relying on `ctx.json` Date coercion. Inconsistent and fragile. Fix: normalize serialization in the repo mapper, drop the ad-hoc cast.

- `person/updateMyProfile.ts:46-48` — **[Priority Low] [Intra-Module]** Read-modify-write on `contactInfo` JSON (`{ ...existing.contactInfo, phone }`) between `findOneById` (line 27) and `updateOneById` (line 50) is a lost-update race: a concurrent email change is clobbered. Low impact (self-edit only). Fix: update the JSON sub-key server-side with `jsonb_set` rather than read-merge-write.

- `person/getPerson.ts:85-90` — **[Priority Low] [Cross-Module]** Whole person row (all PII columns) returned to owner with no field projection. Fine for owner-self today, but `isInternalExpand` (line 59) bypasses authz and returns the same full PII envelope to any parent resource that expands a person. Confirm every expand caller is itself authz-gated. Fix: add a projected "public/expand" view for internal-expand callers instead of the full row.

## membership/

- `membership/listOrgMembers.ts:59-76` — **[Priority Med] [Intra-Module]** Unbounded query — no `limit`/`offset`. Selects **every** member of an org with a person join, then `.map`s `computeMembershipStatus` over all rows (lines 79-99). For a large association roster this is an unbounded result set + O(n) per-request CPU. The sibling `MembershipRepository.listMembers` (membership.repo.ts:83-84) paginates; this hand-rolled query does not. Why it matters: latency/OOM risk on big orgs; inconsistent with the paginated path. Fix: add `.limit(?).offset(?)` and return pagination meta, or route through `MembershipRepository.listMembers`.
  ```ts
  .where(eq(memberships.organizationId, orgId))
  .orderBy(desc(memberships.joinedAt))
  .limit(limit ?? 50).offset(offset ?? 0);
  ```

- `membership/repos/membership.repo.ts:245-277` — **[Priority Med] [Intra-Module]** `upsertCategory` is a check-then-update with no unique constraint on `(organizationId, name)` (acknowledged in comment, line 246). Two concurrent upserts both miss the SELECT and both INSERT → duplicate categories. Why it matters: silent duplicate categories corrupt member categorization. Fix: add a partial unique index on `(organization_id, lower(name))` and use `onConflictDoUpdate`.

- `membership/repos/membership.repo.ts:230-233` — **[Priority Low] [Intra-Module]** `bulkImportMembers` inserts an arbitrary-length array in one statement with no chunking/cap. A large CSV import (see invite/bulkImportMembers) could exceed the PG parameter limit. Fix: batch in chunks of ~500.

## invite/

- `invite/bulkImportMembers.ts:200-217` — **[Priority High] [Intra-Module]** Import-mode generates a claim token but **throws away the raw value**: `const { hash } = generateInviteToken(secret)` destructures only `hash` (line 202), so `raw` is never captured, never emailed, never returned. Single-invite `createInvite.ts:67-74` correctly returns `raw`. Result: every bulk-imported member gets a DB invite row whose token can never be delivered — the entire bulk-import flow produces unclaimable invitations. Why it matters: core onboarding feature is non-functional end-to-end; members can't claim. Fix: capture `raw`, then enqueue an invite email (or collect raws into the response) per row.
  ```ts
  const { raw, hash } = generateInviteToken(secret);
  const invite = await inviteRepo.create({ …, tokenHash: hash });
  await enqueueInviteEmail(r.email, raw, orgId); // currently absent
  ```

- `invite/claimInvite.ts:59-102` — **[Priority High] [Cross-Module]** Claim is non-atomic across two writes with no transaction. `markClaimed` (line 59) commits, then `getMember`/`addMember` (lines 70-102) run separately. If `addMember` fails (e.g. `tierId` null-cast at line 92 hitting the NOT-NULL column when no org default trigger exists — flagged in the comment lines 89-91), the invite is already burned (`status='claimed'`) but no membership exists. The user is permanently locked out: re-claim throws `ConflictError('already been claimed')` (line 42). Why it matters: a single membership-insert failure strands the invitee with no recovery path. Fix: wrap mark-claimed + membership-create in one `db.transaction`, and resolve the real default tier instead of the `null as unknown as string` cast (line 92).

- `invite/claimInvite.ts:70-74` + `createInvite.ts:42-45` — **[Priority Med] [Intra-Module]** Claim race / double-membership. Two concurrent claims of the same token both pass the `status!=='claimed'` check before either `markClaimed` commits → both proceed to `addMember`. The `existingMembership` guard (line 72) is also check-then-insert with no unique constraint shown on `(organizationId, personId)`. Why it matters: duplicate memberships from rapid double-submit. Fix: same transaction as above + a unique index on `(organization_id, person_id)`; make `markClaimed` a conditional update (`WHERE status='pending'`) and treat 0-rows-affected as already-claimed.

- `invite/repos/invite.repo.ts:91-101` — **[Priority Low] [Intra-Module]** `listByOrg` hard-caps at `.limit(100)` with no offset and no total — silently truncates orgs with >100 invites and offers no pagination. Fix: accept limit/offset params and return a count.

- `invite/createInvite.ts:53` & `claimInvite.ts:76-80` — **[Priority Low] [Cross-Module]** `metadata` is accepted from request body (`body.metadata`, createInvite.ts:60) and later trusted as `{ membershipTierId, membershipCategoryId, licenseNumber }` to drive membership creation (claimInvite.ts:86-94). An officer-supplied metadata blob flows unvalidated into a membership tier/category assignment. Why it matters: weak typing at a trust boundary; a malformed/hostile tierId reaches `addMember`. Fix: validate `metadata` shape with a Zod schema at createInvite time.

## onboarding/

- `onboarding/updateOnboardingStep.ts:32-78` — **[Priority Med] [Intra-Module]** Lost-update / double-bootstrap race. `findByOrg` → branch → `create`/`update` is a read-modify-write with no row lock or transaction. Two concurrent step saves for a fresh org both see `state===null` (line 35) and both `repo.create` (line 42) — `onboarding.repo.ts:29-34` is a plain INSERT with no `onConflictDoNothing`, so the second insert errors (or duplicates if no unique constraint on `organizationId`). Concurrent saves of the same current step also clobber `stepsCompleted`. Why it matters: wizard state corruption on double-click. Fix: unique constraint on `organizationId` + `onConflictDoUpdate`, or `SELECT … FOR UPDATE` inside a transaction.

- `onboarding/updateOnboardingStep.ts:78-91` — **[Priority Low] [Intra-Module]** Completion event vs. persistence ordering: `repo.update` is awaited (line 78) but the `nowComplete && !wasComplete` emit of `onboarding.completed` (lines 86-91) is computed from the in-memory `completedAt`, not the returned `updated` row. If `repo.update` returns `undefined` (no row — the race above), the handler still emits `onboarding.completed` and returns `saved:true`. Fix: gate the emit on `updated?.completedAt != null`.

- `onboarding/getOnboardingState.ts:31-34` — **[Priority Low] [Intra-Module]** Inline `OfficerTermRepository.findActiveByPersonAndOrg` "any active term" check duplicates the `x-require-officer` middleware semantics that `updateOnboardingStep` gets declaratively (onboarding.tsp:119). Read path hand-rolls authz; write path is declarative. Not a bug (CLAUDE.md permits inline checks for query-param org), but the divergence is a maintenance trap. Fix: confirm GET route also carries `x-require-officer #{ from: "query.orgId" }` or document why it can't.

---

## Testing gaps (uncovered business logic)

**onboarding/** — only `onboarding.test.ts` (11 cases) for 3 src files; repo untested.
- `onboarding.repo.ts:29-47` — `create` and `update` have **zero** direct tests; the double-bootstrap INSERT path (concurrent create) and `update` returning `undefined` for a missing org are both untested. These are exactly the race branches flagged above.
- `updateOnboardingStep.ts:86` — no test asserts `onboarding.completed` is **not** emitted when `repo.update` returns `undefined`. Existing test only covers the re-save-no-reemit case (test line 128).

**invite/** — highest-value gaps:
- `bulkImportMembers.ts:200-217` — **no test asserts a deliverable token is produced/sent in import mode.** Current tests can't catch the dropped-`raw` bug because they only check `imported` counts. Add a test that import mode yields a claimable token (round-trip into `claimInvite`).
- `claimInvite.ts:59-102` — no test for the partial-failure path: `markClaimed` succeeds then `addMember` throws → assert invite is NOT left burned (transaction). Also no concurrent-double-claim test.
- `bulkImportMembers.ts:108-113` — the `twoFactorEnabled` + non-dev 2FA gate has no test (President/Secretary without 2FA in prod must be rejected).

**membership/** — `listOrgMembers.ts:88-95` — no test exercises `computeMembershipStatus` mapping for the unbounded path with a `deceased`/`suspended` row to lock in the FIX-002 status parity; and no test for the org-scoping `ForbiddenError` (line 54) for a non-member non-admin.

**person/** — `executeAccountDeletion.ts` is tested but **dead** (unrouted) — those tests give false confidence on a code path that never runs and whose scrub list is wrong; the *live* `deletionProcessor.ts` cascade-partial-failure branch (catch at line 103) has no test asserting the person is left `deletionCompletedAt`-null for retry.

---

## Top 3 Critical (C1)

1. **`invite/bulkImportMembers.ts:202`** — bulk import discards the raw token (`const { hash } = …`), so every bulk-imported invite is **unclaimable**; the entire bulk-onboarding flow is non-functional end-to-end. (High)
2. **`person/jobs/deletionProcessor.ts:70-76`** (+ `domain-events.ts:70-82`) — person.deleted cascade is fire-and-forget with swallowed rejections; person is marked `deletionCompletedAt` even when a subscriber fails, leaving **orphaned PII in other modules with no retry** — silent DPA erasure gap. (High)
3. **`invite/claimInvite.ts:59-102`** — non-atomic claim (markClaimed then addMember, no transaction; `tierId` null-cast into a NOT-NULL column) can **burn the invite while creating no membership**, permanently locking the invitee out. (High)
