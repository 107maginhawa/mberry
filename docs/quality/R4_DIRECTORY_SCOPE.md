# R4 — Member/Directory Cutover Scope

**Step 6 sub-domain #4 of 9.** Same mechanical pattern as R1 (chapters), R2 (governance), R3 (credentials). Branch base: `d85ccd3e` (R3 HEAD).

## TypeSpec source

- `specs/api/src/association/member/directory.tsp`
- Namespace: `Association.Member.Directory`
- Interfaces: `DirectoryProfileManagement`, `DirectorySearchService`

## Operation IDs (7)

From `directory.tsp`:

1. `createDirectoryProfile` — POST `/association/member/directory/profiles`
2. `getDirectoryProfile` — GET `/association/member/directory/profiles/{profileId}`
3. `listDirectoryProfiles` — GET `/association/member/directory/profiles` (admin)
4. `updateDirectoryProfile` — PATCH `/association/member/directory/profiles/{profileId}`
5. `deleteDirectoryProfile` — DELETE `/association/member/directory/profiles/{profileId}`
6. `searchDirectory` — GET `/association/member/directory/search`
7. `getPublicDirectoryProfile` — GET `/association/member/directory/search/{personId}/public` (public/unauth)

## Handler files to move (8 total)

Source: `services/api-ts/src/handlers/association:member/`
Target: `services/api-ts/src/handlers/member/directory/`

| File | Op match | Notes |
|---|---|---|
| `createDirectoryProfile.ts` | createDirectoryProfile | |
| `getDirectoryProfile.ts` | getDirectoryProfile | |
| `listDirectoryProfiles.ts` | listDirectoryProfiles | |
| `updateDirectoryProfile.ts` | updateDirectoryProfile | |
| `deleteDirectoryProfile.ts` | deleteDirectoryProfile | |
| `searchDirectory.ts` | searchDirectory | |
| `getPublicDirectoryProfile.ts` | getPublicDirectoryProfile | Public/unauth — preserve `bearerAuth \| NoAuth` |
| `publishMyDirectoryProfile.ts` | — (orphan, no tsp op, not in registry, not in app.ts) | Self-contained handler kept for future wiring; move with module |

## Test files to move (colocated)

- `services/api-ts/src/handlers/association:member/directory.test.ts` → `services/api-ts/src/handlers/member/directory/directory.test.ts`

## Repos (stay in place — path-stable)

- `services/api-ts/src/handlers/association:member/repos/directory.repo.ts`
- `services/api-ts/src/handlers/association:member/repos/directory.schema.ts`

## Jobs (stay in place — follows R3 pattern)

- `services/api-ts/src/handlers/association:member/jobs/directoryAutoPopulate.ts` + `.test.ts` + `.integration.test.ts`

R3 left jobs at `association:member/jobs/`. R4 same.

## main.tsp tag changes (2)

Lines 410, 414 — change `@tag("Association:Member")` → `@tag("Member/Directory")` on:

- `AssocDirectoryProfileManagement` (line 412)
- `AssocDirectorySearchService` (line 416)

After change: rebuild OpenAPI via `cd specs/api && bun run build`.

## Cross-module schema importers (path-stable — no changes required)

All import from `@/handlers/association:member/repos/directory.schema` (absolute, repo stays):

- `services/api-ts/src/core/domain-event-consumers.ts:39` — `person.deleted` cascade deletes `directoryProfiles`
- `services/api-ts/src/handlers/member/credentials/lookupCredentialPublic.ts:5` — joins directory display data into public lookup
- `services/api-ts/src/seed/layer-5-gap-fill.ts:23` — seed data

## app.ts (no handler imports to retarget)

- Lines 430–431: `ASSOCIATION_PUBLIC_PATHS` contains `/association/member/directory/public` and `/association/member/directory/search` — **route patterns**, not handler imports. Routes do not change. **No app.ts edits needed.**
- Line 138: comment only ("Wave 3a — Trust Directory").

## Generated registry entries to verify post-regen

After `bun run generate`, expect these imports in `services/api-ts/src/generated/openapi/registry.ts`:

```
import { createDirectoryProfile } from '../../handlers/member/directory/createDirectoryProfile';
import { getDirectoryProfile } from '../../handlers/member/directory/getDirectoryProfile';
import { listDirectoryProfiles } from '../../handlers/member/directory/listDirectoryProfiles';
import { updateDirectoryProfile } from '../../handlers/member/directory/updateDirectoryProfile';
import { deleteDirectoryProfile } from '../../handlers/member/directory/deleteDirectoryProfile';
import { searchDirectory } from '../../handlers/member/directory/searchDirectory';
import { getPublicDirectoryProfile } from '../../handlers/member/directory/getPublicDirectoryProfile';
```

## Contract tests to author (≥5)

Target: `specs/api/tests/contract/member/directory/`. Auto-discovered by recursive walker.

Probe each before asserting (envelope/status drift gotchas from R1–R3):

- **createDirectoryProfile** — 201 envelope, owner role
- **getDirectoryProfile** — 200 envelope, ID lookup
- **listDirectoryProfiles** — admin-only, pagination envelope `{data, pagination}` or direct array (probe)
- **updateDirectoryProfile** — PATCH partial body, 200 (avoid 500 from `toISOString` on full body)
- **deleteDirectoryProfile** — probe 200 vs 204
- **searchDirectory** — member role, query filters (specialty/location/tags)
- **getPublicDirectoryProfile** — unauth path, visibility-filtered view

Seed: officer `test@memberry.ph` / `TestPass123!`, org `ed8e3a96-8126-4341-be42-e6eb7940c562`, chapter `c5b0ed2c-1a51-4445-b548-416df7d27415`, member `member01@memberry.ph` / `TestPass123!`.

## Module spec to author

`docs/product/MODULE_SPEC.member.directory.md` — follow `chapters` / `governance` / `credentials` pattern.

## Gates (R3 floor — match-or-exceed)

| Gate | R3 baseline |
|---|---|
| typecheck | 5/5 |
| unit | 5918 pass (1 pre-existing fail: registerEmailJobs) |
| contract (live API on :7213) | 127/127 + new |
| SDK drift | 0 |
| observability | 94% |
| contract coverage | 79% |

## Non-changes (preserve at parity)

- Inline `auditAction()`, `requireOfficerTerm()`, `requirePosition()` — keep, do **not** migrate to `@extension` unless trivial (e.g., handler already has `x-audit` ext and inline call is duplicate).
- Domain-event subscriber in `domain-event-consumers.ts` — unchanged (already uses absolute schema path).
- Job in `association:member/jobs/directoryAutoPopulate.ts` — unchanged.
- `directory.repo.ts` / `directory.schema.ts` — unchanged.
