# Plan 010: Build the announcements list (close the create-only coherence gap)

> **Executor instructions**: Follow step by step. Run every verification command. If a "STOP condition" occurs, stop and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a024135..HEAD -- apps/org/src/routes/announcements.tsx apps/org/src/features/announcements`
> If changed, compare to the excerpts below before editing; on a mismatch, STOP.

## Status

- **Priority**: P3 (direction / build — closes a workflow hole; not a defect)
- **Effort**: M
- **Depends on**: none
- **Risk**: MED (new query path + cache coordination with create)
- **Category**: direction (feature completion)
- **Planned at**: commit `4a024135`, 2026-06-29

## Why this matters

The announcements screen is **create-only**: an officer can post an announcement but has no way to see what was posted, when, or its status. That's an incomplete workflow — officers can't confirm a post landed or review history. The engine already exposes a list endpoint (`listAnnouncements`), so this is a read-only UI addition that completes the journey. (Edit/delete are explicitly out of scope here — see Maintenance notes.)

## Current state

`apps/org/src/routes/announcements.tsx` renders only the create form:

```tsx
function AnnouncementsPage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-title font-semibold text-foreground">Announcements</h1>
      <CreateAnnouncementForm />
    </main>
  )
}
```

`apps/org/src/features/announcements/use-create-announcement.ts` is a mutation that does NOT invalidate any list (there is no list yet):

```ts
import { createAnnouncement, publishAnnouncement, type Announcement } from '@monobase/sdk-ts/generated'
// …createAnnouncement → publishAnnouncement; returns published; no queryClient/invalidation…
```

### SDK endpoint (confirmed present)

`listAnnouncements` exists in `@monobase/sdk-ts/generated`:

```ts
// sdk.gen.ts
export const listAnnouncements = (options) => client.get<ListAnnouncementsResponses, …>({ … })
// types.gen.ts
export type ListAnnouncementsData = {
  path: { organizationId: Uuid }
  query?: { status?: AnnouncementStatus; /* … */ }
}
```

**You must open `packages/sdk-ts/src/generated/types.gen.ts` and read `ListAnnouncementsResponse` and the `Announcement` type** to learn the exact item shape (field names for title, content/body, status, createdAt/publishedAt). Do NOT guess field names — the SDK types may drift from intuition (e.g. `content` vs `body`, dates as `Date` vs string). Anchor your rendering and any coercion to the real type.

### The pattern to mirror

`apps/org/src/features/events/use-org-events.ts` is the closest exemplar: a list hook that calls a path-org list endpoint, unwraps `data.data`, maps to a small view type, and returns `{ status: 'idle'|'loading'|'ready'|'empty'|'error', items, refetch }`. Copy its shape exactly. For the list UI states, mirror `DuesView.tsx` / `Roster.tsx` (Skeleton loading, `EmptyState`, `ErrorState` with retry — all from `@monobase/ui`).

## Commands you will need

| Purpose   | Command                                                  | Expected |
|-----------|----------------------------------------------------------|----------|
| Typecheck | `bun run --filter @monobase/org typecheck`               | exit 0   |
| Tests     | `bun run --filter @monobase/org test`                    | all pass |
| One file  | `bun run --filter @monobase/org test -- list-announcements` | pass  |
| E2E       | `bun run --filter @monobase/org test:e2e`                | all pass (dev server on :3005) |

Run from repo root.

## Scope

**In scope** (create + small edits):
- `apps/org/src/features/announcements/use-list-announcements.ts` (create — list hook, mirror `use-org-events.ts`)
- `apps/org/src/features/announcements/AnnouncementsList.tsx` (create — read-only list with loading/empty/error states)
- `apps/org/src/routes/announcements.tsx` (edit — render the list below the form)
- `apps/org/src/features/announcements/use-create-announcement.ts` (edit — invalidate the list query on create success so a new post appears)
- tests: `use-list-announcements.test.ts`, `AnnouncementsList.test.tsx` (create)

**Out of scope**: edit/delete/archive/schedule of announcements (engine has the endpoints but those are separate features); the generated SDK; the engine; the create form's fields/validation (covered by plan 009).

## Git workflow

- Branch: `advisor/010-announcements-list`. Conventional commit, e.g. `feat(org): announcements list view`. No push/PR unless instructed.

## Steps

### Step 1: List hook

Create `use-list-announcements.ts` mirroring `use-org-events.ts`: `useQuery` with `queryKey: ['announcements', orgId]`, `enabled: !!orgId`, `retry: false`, `queryFn` calling `listAnnouncements({ path: { organizationId: orgId! }, query: {} })`, unwrap `data.data` (read the real response type first — it may be `{ data: [...] }` or flat; anchor to `ListAnnouncementsResponse`), map to a small view type (`id`, `title`, `status`, a date, and the body field by its REAL name), return `{ status, announcements, refetch }`.

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 2: List component

Create `AnnouncementsList.tsx`: a presentational list driven by the hook's `status`. Loading → Skeletons; `error` → `ErrorState` with `onRetry`; `empty` → `EmptyState` ("No announcements yet"); `ready` → a list of cards showing title, a status badge (use `StatusBadge` if status is meaningful), the date (formatted, `toLocaleDateString('en-PH')` as elsewhere), and the body text. Use only `@monobase/ui` components and Tailwind layout (match `DuesView.tsx` list styling). ≥48px taps if any controls; 18px base inherited.

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 3: Wire into the route + invalidate on create

In `announcements.tsx`, render `<AnnouncementsList />` below `<CreateAnnouncementForm />`. In `use-create-announcement.ts`, add a `useQueryClient()` and, in the mutation's `onSuccess`, invalidate `['announcements', orgId]` so a newly posted announcement shows up without a manual refresh. (Match how other hooks obtain `queryClient`, e.g. `use-import-roster.ts` / `use-gateway-config.ts`.)

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 4: Tests

- `use-list-announcements.test.ts`: mock `listAnnouncements`, assert happy-path mapping + `enabled:false` when `orgId` null + error→`status:'error'`. Model on `apps/org/src/features/dues/use-dues.test.tsx` / `use-org-events` tests if present (same `vi.mock` + `ok()` helper from `test-utils/mock-sdk`).
- `AnnouncementsList.test.tsx`: mock the list hook for each state and assert loading/empty/error/ready render. Model on an existing component test.

**Verify**: `bun run --filter @monobase/org test -- list-announcements AnnouncementsList` → pass.

### Step 5: Suite + e2e

**Verify**: `bun run --filter @monobase/org test` → all pass. `bun run --filter @monobase/org test:e2e` → all pass (the announcements route still renders; if you add an e2e it's optional).

## Test plan

New unit tests for the hook (mapping + states) and the component (4 states). Optional e2e: post an announcement, assert it appears in the list (stub `listAnnouncements` + `createAnnouncement`/`publishAnnouncement`, model on `payment-settings-flow.spec.ts`). The existing suite passing is the required gate.

## Done criteria

- [ ] `bun run --filter @monobase/org typecheck` exits 0
- [ ] `bun run --filter @monobase/org test` exits 0; hook + component tests pass
- [ ] `bun run --filter @monobase/org test:e2e` exits 0
- [ ] `announcements.tsx` renders `AnnouncementsList`
- [ ] `use-create-announcement.ts` invalidates `['announcements', orgId]` on success (`grep -n "invalidateQueries" apps/org/src/features/announcements/use-create-announcement.ts`)
- [ ] Field names in the list match the real `Announcement`/`ListAnnouncementsResponse` SDK types (no guessed fields)
- [ ] Only in-scope files changed (`git status`)
- [ ] `plans/README.md` row for 010 updated

## STOP conditions

Stop and report if: `listAnnouncements`'s response shape can't be determined from `types.gen.ts`; the endpoint requires a param the app can't supply; the list requires an officer permission that 403s in dev (note it — like other officer-gated reads); the create→list invalidation can't be wired without changing the mutation's public return type.

## Maintenance notes

- Reviewer: confirm the list field names trace to the real SDK type (the repo's recurring drift class). Confirm the create→list cache key matches the list hook's key exactly, or the new post won't appear.
- Deferred on purpose: edit / delete / archive / schedule of announcements (the SDK has `updateAnnouncement`, `deleteAnnouncement`, `archiveAnnouncement`, `scheduleAnnouncement` — each is a separate feature with its own confirm/permission UX; do not bundle them here). The events edit/delete gap is the same shape and similarly deferred.
