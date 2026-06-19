# Roster CSV Import (D1 / ISSUE-026) — Design

**Date:** 2026-06-20
**Branch:** design/ui-ux-audit
**Status:** approved (brainstorm) → plan next

## Problem

Officer uploads a member CSV; **every new-member row 400s**. Three broken layers:

1. **Contract** — `AddMemberRequest` only accepts `personId` (existing-person UUID). No way to express "name + email for a person not yet in the system."
2. **Backend** — `importRosterMembers` is a dumb insert loop (`createOne(membership)`). No match (find existing person), no create (make PII record).
3. **Frontend** — sends `personId:''` + `tierId:'default'` (both garbage) with a comment claiming server-side match-or-create that was never built.

Plus tier resolution is missing: tiers are per-org UUIDs, no "default" concept.

## Verified facts (source)

- `AddMemberRequest`: `personId`+`tierId` required, no identity fields (`membership.tsp:540`).
- `importRosterMembers.ts`: validates `personId`+`tierId`, then `createOne` — no match/create (`:56-66`).
- `import.tsx:148-150`: sends `personId:''`, `tierId:'default'`.
- Person email lives in `contactInfo` JSONB (key `email`) — **unindexed, non-unique**, no `findByEmail`. `person.licenseNumber` is a plain varchar (`person.schema.ts`).
- Person ≠ auth user: `repo.createOne` with a generated id makes a PII-only record (no login). `createPerson` forces `id:user.id` but that's handler choice.
- Tiers per-org, no default. `MembershipTierRepository.findByCode(org, code)`; real `tierId` UUID required.
- Membership insert needs `organizationId, personId, tierId, startDate`. `(org, person)` is a **DB unique constraint** → natural dedup. `status`/`joinedAt`/`gracePeriodDays` have DB defaults.
- Existing `importRosterMembers.test.ts` asserts the OLD `personId+tierId required` contract → must be rewritten.

## Approach: dedicated import row model (Option A)

New `ImportMemberRow` purpose-built for import; **`AddMemberRequest` and single-add `addRosterMember` untouched** (zero regression on single-add). Rejected: extending `AddMemberRequest` with optional `personId` (scope creep into single-add, weakens a strict contract for an unrequested feature); client-side person resolution (N+1, PII creation must be server-authoritative).

### Contract (TypeSpec — `membership.tsp`)

```
model ImportMemberRow {
  firstName?: string;     // required to CREATE a new person (handler-enforced)
  lastName?: string;
  email?: string;         // email OR licenseNumber required per row (handler-enforced)
  licenseNumber?: string;
  memberNumber?: string;
}
model ImportMembersRequest {
  organizationId: string;
  tierId: string;         // NEW — batch tier (was missing)
  members: ImportMemberRow[];
}
model ImportRowError { index: int32; error: string; }
model ImportResult {
  imported: int32;
  skipped: int32;
  failed: int32;
  errors: ImportRowError[];   // was string[] — now structured
}
```

XOR/conditional-required rules (email|license; firstName-to-create) can't be expressed cleanly in TypeSpec → enforced in handler.

### Backend (`importRosterMembers.ts` + `PersonRepository`)

New repo method (global, person is cross-org PII):
```
findByEmailOrLicense(email?, licenseNumber?): Person | null
  // WHERE contact_info->>'email' = email  OR  license_number = licenseNumber  LIMIT 1
  // verify the exact JSONB key ('email') against person.schema.ts at impl time
```

Handler flow:
1. `requirePosition(Secretary|President)` — keep.
2. Cap 500 — keep.
3. Validate `body.tierId` belongs to org once up front → else 400 whole request (fail fast).
4. Per row (continue-on-error):
   - trim email/license; if neither → `failed` ("email or license required").
   - `person = findByEmailOrLicense(email, license)` (global).
   - no match: if no `firstName` → `failed` ("firstName required to create new member"); else `createOne` person `{firstName, lastName, contactInfo:{email}, licenseNumber}` (generated id, no auth user).
   - existing `(org, person)` membership? → `skipped++`.
   - else `createOne` membership `{org, person, tierId, startDate: today, memberNumber}` (status defaults `pendingPayment`) → `imported++`, collect personId.
   - catch → `failed`.
5. emit `membership.imported` if imported>0 — keep.
6. return `{imported, skipped, failed, errors}`.

### Frontend (`import.tsx`)

- Load org tiers (`useListMembershipTiers`); **tier `<select>` required** before import enabled. Zero tiers → block with "create a tier first" + link.
- Map rows to real fields `{firstName, lastName, email, licenseNumber, memberNumber}` (drop `personId:''`/`tierId:'default'`); body `{organizationId, tierId, members}`.
- Result banner shows `imported / skipped / failed` + per-row error list (today only shows imported).
- **"Download template CSV"** button — client-side Blob: header row + 1 example. No static asset.

### Tests

- Rewrite `importRosterMembers.test.ts`: match-existing, create-new, skip-existing-member, fail-missing-identity, fail-missing-firstName-on-create, tier-invalid→400, cap-500, 403 auth, event emission.
- Unit for `findByEmailOrLicense`.
- Keep memberry component suite green.

## Decisions

| Decision | Pick |
|---|---|
| Match key | email then license, **global** |
| Dedup | pre-check `(org, person)` → **skip** (not failed) |
| Partial failure | per-row, `{imported, skipped, failed, errors[]}` |
| Create reqs | match: email\|license; create: also firstName |
| Tier | batch dropdown (one tier/import); per-row tierCode deferred |
| Status of imported | DB default `pendingPayment` (no payment data in CSV) |
| Sample template | client-side Blob download |

## Out of scope (deferred)

- Single-add create-by-email (`addRosterMember` unchanged).
- Per-row tier codes.
- **Account claiming/linking on future signup** — imported person has no auth user; `ensurePersonForUser` keys by user.id → would duplicate on later signup. Mark in code; own feature.
- `ProfessionalLicense` rich table for matching (use plain `person.licenseNumber`).
