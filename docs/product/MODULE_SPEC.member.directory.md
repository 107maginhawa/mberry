# MODULE_SPEC: member/directory

Sub-domain #4 of 9 in the `association:member` mega-module rebuild (Step 6 R4).

## 1. Purpose

Owns the member-facing directory surface of an association: the curated
public profile each member chooses to project, the privacy-gated
visibility model around it, and the cross-org search/index that powers
discovery. One TypeSpec file, two interfaces, seven operations:

- **Directory Profiles** — per-member profile records (displayName,
  title, organization, specialty, location, bio, photo, contact
  channels, social links) with three-level visibility
  (`public` / `memberOnly` / `hidden`).
- **Directory Search** — full-text + faceted search (specialty,
  location, tags) over the member directory, optional geo-spatial
  proximity, returning trust-enriched profiles for authenticated
  members.
- **Public Projection** — unauthenticated lookup of a member's
  `PublicDirectoryProfile` shape (reduced field set, only published when
  `visibility === 'public'`).

## 2. Bounded Context

In scope:
- The two TypeSpec interfaces wired in `main.tsp` under
  `@tag("Member/Directory")`:
  `DirectoryProfileManagement`, `DirectorySearchService`.
- All routes under
  `/association/member/directory/{profiles,search,search/{personId}/public}`
  — 7 operationIds total.
- The shared `directory.repo` + `directory.schema` (tables
  `directory_profiles`, `directory_search_index`).

Out of scope:
- `association:member/jobs/directoryAutoPopulate.ts` — background job
  that backfills directory profiles from `person` data. Stays at
  `association:member/jobs/` (same pattern as R3 credentials —
  jobs do not migrate with handlers).
- `member/credentials/lookupCredentialPublic.ts` — reads the
  `directoryProfiles` table to enrich a public credential lookup with
  display name / photo / specialty, but is not part of this surface.
- Trust-signal computation
  (`association:member/utils/trust-signals.ts`) — referenced by
  `searchDirectory` but lives as a utility module under `association:member/utils/`.

Adjacent modules and the seams between them:

| Adjacent module | Seam |
|---|---|
| `person` | Subscribes to `person.deleted` and cascade-deletes `directoryProfiles` for the person via `core/domain-event-consumers.ts`. |
| `member/credentials` | `lookupCredentialPublic` joins `directory_profiles` (displayName, photoUrl, specialty) onto the public credential lookup response. |
| `member/governance`, `member/chapters` | Officer status + chapter affiliation feed into the trust signals batch-loaded by `searchDirectory`. |
| `core/auth` + `middleware/org-context` | The `/directory/search*` prefix is in `ASSOCIATION_PUBLIC_PATHS` (app.ts) so it bypasses the global auth + org-context middleware to keep `getPublicDirectoryProfile` reachable; `searchDirectory` then re-checks `orgMembership` inline. |

## 3. Handler Inventory

All handlers live at `services/api-ts/src/handlers/member/directory/`.

| Handler file | Verb | Auth | Audit action | Notes |
|---|---|---|---|---|
| createDirectoryProfile.ts | POST /association/member/directory/profiles | `association:member:owner`, `association:admin` | `create directory-profile` | 201, direct envelope. No uniqueness constraint on `(orgId, personId)` — admin may create multiple per person. |
| getDirectoryProfile.ts | GET .../{profileId} | `association:member:owner`, `association:admin` | — | 200, direct envelope. |
| listDirectoryProfiles.ts | GET /association/member/directory/profiles | `association:admin` | — | Admin-only view. Envelope: `{data: [...], pagination: {...}}`. Optional `visibility` query filter. |
| updateDirectoryProfile.ts | PATCH .../{profileId} | `association:member:owner`, `association:admin` | `update directory-profile` | PATCH partial. Full body with timestamp string trips `toISOString` 500. |
| deleteDirectoryProfile.ts | DELETE .../{profileId} | `association:member:owner`, `association:admin` | `delete directory-profile` | 204. |
| searchDirectory.ts | GET /association/member/directory/search | `association:member`, `association:admin` | — | Public-prefix bypass means `orgMembership` is unset on this lifecycle; handler returns 403 `"Organization membership required"`. The trust-enriched member-search flow is expected to migrate to a non-public sub-route in a follow-up. |
| getPublicDirectoryProfile.ts | GET .../search/{personId}/public | `bearerAuth \| NoAuth` | — | Public projection. Returns `PublicDirectoryProfile` only when a profile with `visibility === 'public'` exists; otherwise 404. |
| publishMyDirectoryProfile.ts | PATCH .../profiles/mine/publish (unrouted) | self | — | **Orphan.** No `@operationId` in `directory.tsp`, no entry in generated `registry.ts`, no hand-wired entry in `app.ts`. Preserved in-module for future wiring; importing it is a no-op unless app.ts adds an explicit route. |

8 handler files · 3 mutating ops carry `x-audit` · 0 inline
`requireOfficerTerm` / `requirePosition` calls (all role auth expressed
via `x-security-required-roles` extension on the operation).

## 4. TypeSpec source

`specs/api/src/association/member/directory.tsp` — 7 operationIds
across 2 interfaces (`DirectoryProfileManagement`,
`DirectorySearchService`). Routed via `specs/api/src/main.tsp` under
`@tag("Member/Directory")` on both interfaces (R4 retag — was
`@tag("Association:Member")`).

## 5. Database schema

- `services/api-ts/src/handlers/association:member/repos/directory.repo.ts`
- `services/api-ts/src/handlers/association:member/repos/directory.schema.ts`

Schema stays under `association:member/repos/` on purpose. Inbound
importers depend on this path:

- `core/domain-event-consumers.ts` — `directoryProfiles` table for
  `person.deleted` cascade (cleanup step in the member-owned subscriber
  group).
- `handlers/member/credentials/lookupCredentialPublic.ts` — joins
  `directoryProfiles` (displayName, photoUrl, specialty) onto the
  public credential lookup response.
- `seed/layer-5-gap-fill.ts` — directory fixtures.

Moving the schema would force a cascade rewrite for zero behavioral
gain (same reasoning as R1/R2/R3).

Tables (per directory.schema.ts):
- `directory_profiles` — (id, organizationId, personId, displayName,
  title?, organization?, specialty?, location?, photoUrl?, bio?,
  contactEmail?, contactPhone?, website?, socialLinks (json)?,
  visibility, publishedAt?, lastUpdatedAt)
- `directory_search_index` — (id, organizationId, personId,
  searchableText, tags (text[]), geoLocation?, verified)

## 6. Cross-module dependencies

Emits domain events:
- None at this time. Directory mutations write directly to the
  database; no `directory.*` events are published.

Consumes events:
- `person.deleted` → consumer deletes directory profiles owned by the
  person. Cascade lives in `core/domain-event-consumers.ts`; this
  module owns no consumer code.

Calls into other modules:
- `searchDirectory` invokes
  `batchLoadTrustSignals` from
  `@/handlers/association:member/utils/trust-signals`, which reads
  credentials + officer + dues state to compute per-profile trust
  badges.
- `getPublicDirectoryProfile` is a pure read against
  `directoryProfiles` — no cross-module fan-out.

## 7. Test coverage status

- **Unit tests**: 1 file moved colocated to
  `services/api-ts/src/handlers/member/directory/`:
  - `directory.test.ts` — cross-cutting handler-level tests for
    `searchDirectory`, `getPublicDirectoryProfile`,
    `listDirectoryProfiles`, `createDirectoryProfile` (BR-21 cross-org
    independence, AC-M05-005 privacy-filtered public view, search
    performance contract).

  Per-handler unit suites for the remaining 4 ops + orphan are a
  follow-up.

- **Contract scenarios**: 5 Hurl files in
  `specs/api/tests/contract/member/directory/`:
  - `directory-crud.hurl` (create → get → list → update → delete → 404)
  - `directory-public-view.hurl` (admin publishes member01 → unauth
    public projection returns reduced shape → unknown personId → 404)
  - `directory-rbac.hurl` (401 unauth on create/update/delete + 403
    non-admin list)
  - `directory-search-guards.hurl` (locks current public-prefix
    bypass behavior: 401 unauth, 403 authenticated officer + member
    both)
  - `directory-visibility-update.hurl` (fresh person → public profile →
    partial PATCH `visibility=hidden` → public projection 404 → admin
    GET still works → delete)

- **E2E**: deferred to broader directory UI work in
  `apps/memberry/src/features/directory/`.

## 8. Hand-wired routes

None for directory operations. All 7 ops route through the generated
registry. The orphan `publishMyDirectoryProfile.ts` is not wired in
`app.ts`; adding a hand-wired entry for it is out of scope for R4.

`app.ts` carries two route-path strings in
`ASSOCIATION_PUBLIC_PATHS` (lines 430–431):

```
'/association/member/directory/public',
'/association/member/directory/search', // covers /search/:personId/public
```

These are middleware-bypass prefixes, **not handler imports**. R4 did
not touch them; the route paths under directory are unchanged.

## 9. Known gotchas

- **Public-prefix bypass leaks into `searchDirectory`.** The
  `/directory/search` prefix is in `ASSOCIATION_PUBLIC_PATHS` so the
  global auth + org-context middleware is skipped to keep the unauth
  public projection reachable. Per-route `@useAuth(bearerAuth)` on
  `searchDirectory` still requires a session, but `orgMembership` is
  never populated. The handler then returns 403 `"Organization
  membership required"`. Migrating member-search to a non-public
  sub-route is a follow-up; until then the contract pins the 403 edge.
- **No uniqueness on `(orgId, personId)`** in `directory_profiles`.
  Admins can create multiple profiles per person. `getPublicDirectoryProfile`
  picks the first match (repo ordering, not a domain rule). Contract
  tests use freshly signed-up persons to avoid seed coupling.
- **Partial PATCH only.** `updateDirectoryProfile` sends `PATCH` with
  `implicitOptionality`, so include only changed fields. Sending a
  full body with the resource's `lastUpdatedAt` as a string crashes
  with `toISOString is not a function` 500 — same gotcha pattern as
  R1/R2/R3.
- **`getPublicDirectoryProfile` only returns `visibility === 'public'`
  profiles.** `memberOnly` and `hidden` both project as 404 on the
  public endpoint. Authenticated `getDirectoryProfile` still returns
  any visibility.
- **`PublicDirectoryProfile` is a reduced shape.** No `id`, no
  audit fields, no `contactPhone`, no internal `visibility` field —
  intentional projection so the unauth response cannot leak PII or
  internal state.
- **DELETE returns 204** (asymmetric with `member/governance` where
  positions / officer-terms / elections return 200; symmetric with
  R3 credentials / licenses).
- **`publishMyDirectoryProfile` is an orphan.** Not in
  `directory.tsp`, not in `registry.ts`, not in `app.ts`. The file
  is preserved so the next person to wire a self-publish flow does
  not have to recreate the body. If you don't intend to wire it,
  feel free to remove in a follow-up.
- **`trust-signals` import path is absolute.** Restored handlers
  import `batchLoadTrustSignals` from
  `@/handlers/association:member/utils/trust-signals` — the utility
  did not migrate with R4 (intentional; trust-signals is consumed by
  more than directory). Editing this import to a relative `./utils`
  path will break typecheck.

## 10. AI extension checklist

To add a new endpoint to this module:

1. Add the operation to `specs/api/src/association/member/directory.tsp`
   with `@operationId(...)`, the verb, `@useAuth(bearerAuth)`, and
   `@extension("x-security-required-roles", ...)`. Add
   `@extension("x-audit", #{ action, resourceType })` for any mutation.
2. Wire the interface (or extend an existing one) in
   `specs/api/src/main.tsp` under `@tag("Member/Directory")`.
3. `cd specs/api && bun run build` — regenerates OpenAPI.
4. `cd services/api-ts && bun run generate` — emits handler stub at
   `services/api-ts/src/handlers/member/directory/`.
5. Implement the handler using `DirectoryProfileRepository` from
   `@/handlers/association:member/repos/directory.repo`. For
   trust-enriched search, use `batchLoadTrustSignals` from
   `@/handlers/association:member/utils/trust-signals`.
6. Add unit tests in `member/directory/*.test.ts`.
7. Add at least one contract scenario in
   `specs/api/tests/contract/member/directory/`.
8. Run: `bun run check:sdk-compat` — must show 0 op drift after baseline
   is unfrozen (post-Step-6 close).

Forbidden:
- Editing `services/api-ts/src/generated/**`.
- Adding new hand-wired routes in `services/api-ts/src/app.ts` for
  directory operations (no grandfathered entries — all 7 ops are
  generated; the two `ASSOCIATION_PUBLIC_PATHS` entries are
  middleware-bypass prefixes, not handler imports).
- Moving `repos/directory.schema.ts` without first updating the
  consumer list in §5.
- Returning fields beyond the `PublicDirectoryProfile` shape from
  `getPublicDirectoryProfile` (no PII leak via unauth endpoint).
- Removing the public-prefix bypass for `/directory/search/*` without
  re-wiring `getPublicDirectoryProfile` onto a non-prefixed route —
  the unauth public projection depends on it.
