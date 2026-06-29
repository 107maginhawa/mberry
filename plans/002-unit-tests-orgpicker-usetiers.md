# Plan 002: Add unit tests for OrgPicker and useTiers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP condition" occurs, stop and report — do not improvise. When done, update
> the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat d8501e09..HEAD -- apps/org/src/features/org apps/org/src/features/roster-import/use-tiers.ts`
> If any in-scope file changed, compare the "Current state" excerpts to the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Depends on**: none
- **Risk**: LOW
- **Category**: tests
- **Planned at**: commit `d8501e09`, 2026-06-29

## Why this matters

Two pieces of `apps/org` have **no unit tests** while nearly every sibling does:

- `OrgPicker` — the `<select>` an officer uses to switch the active organization.
  It sits in the critical path (used in the Roster and Import screens); a
  regression in its selection wiring silently breaks every org-scoped query.
- `useTiers` — the hook that loads membership tiers for the roster-import
  dropdown; it unwraps a **nested** SDK envelope (`{ data: { data: [...] } }`),
  a known drift-shape that is easy to break.

Both are cheap to cover and the test patterns already exist in the repo. Closing
these gaps protects the org-switch and import flows at near-zero cost.

## Current state

### `apps/org/src/features/org/OrgPicker.tsx` (full file)

```tsx
import { useOrgs, useSelectedOrg } from './use-org'

export function OrgPicker() {
  const { orgs } = useOrgs()
  const { orgId, setOrgId } = useSelectedOrg()

  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption font-medium text-text-secondary">Organisation</span>
      <select
        className="min-h-tap rounded border border-[var(--color-border)] bg-surface px-3 py-2 text-body text-foreground"
        value={orgId ?? ''}
        onChange={(e) => setOrgId(e.target.value)}
        aria-label="Select organisation"
      >
        <option value="" disabled>Select an organisation…</option>
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>{org.name}</option>
        ))}
      </select>
    </label>
  )
}
```

It depends on `./use-org` (`useOrgs` returns `{ status, orgs }`; `useSelectedOrg`
returns `{ orgId, setOrgId }`). The cleanest test **mocks `./use-org`** so the
component can be driven in isolation.

### `apps/org/src/features/roster-import/use-tiers.ts` (full file)

```ts
import { useQuery } from '@tanstack/react-query'
import { listMembershipTiers } from '@monobase/sdk-ts/generated'

export type Tier = { id: string; name: string; code: string }

export function useTiers(orgId: string | null): { tiers: Tier[]; loading: boolean } {
  const q = useQuery({
    queryKey: ['tiers', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      // listMembershipTiers returns a NESTED body: { data: tiers[], pagination }.
      const { data } = await listMembershipTiers()
      if (!data) throw new Error('tiers failed')
      return (data.data as Array<{ id: string; name: string; code: string }>).map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
      }))
    },
  })
  return { tiers: q.data ?? [], loading: !!orgId && q.isLoading }
}
```

### Test conventions (exemplars to copy)

- **Hook test** → model after `apps/org/src/features/dues/use-dues.test.tsx`. It
  mocks the SDK module with `vi.mock('@monobase/sdk-ts/generated', …)`, wraps the
  hook in a `QueryClientProvider` (retry off), uses the `ok()` envelope helper
  from `apps/org/src/test-utils/mock-sdk.ts`, and awaits with `waitFor`.
- **Component test** → model after any `*.test.tsx` in `apps/org/src/features`
  that renders a component with `@testing-library/react` (e.g.
  `apps/org/src/features/roster/BulkResults.test.tsx`). Use `render`, query by
  role/label, and `@testing-library/user-event` for interaction.

The `ok()` helper (`apps/org/src/test-utils/mock-sdk.ts:16-26`) builds the
hey-api success envelope:

```ts
export function ok<T>(data: T, status = 200) {
  return { data, error: undefined, request: new Request('http://t'), response: new Response('', { status }) }
}
```

## Commands you will need

| Purpose   | Command                                            | Expected           |
|-----------|----------------------------------------------------|--------------------|
| Typecheck | `bun run --filter @monobase/org typecheck`         | exit 0             |
| Run tests | `bun run --filter @monobase/org test`              | all pass           |
| One file  | `bun run --filter @monobase/org test -- use-tiers` | new tests pass     |
| One file  | `bun run --filter @monobase/org test -- OrgPicker` | new tests pass     |

Run from repo root `/Users/elad-mini/Desktop/memberry`.

## Scope

**In scope** (create only):
- `apps/org/src/features/roster-import/use-tiers.test.ts`
- `apps/org/src/features/org/OrgPicker.test.tsx`

**Out of scope** (do NOT modify):
- `OrgPicker.tsx`, `use-tiers.ts`, `use-org.ts` — this plan is tests only. If you
  believe the source has a bug, STOP and report; do not fix it here.
- The generated SDK and the engine.

## Git workflow

- Branch: `advisor/002-org-unit-tests`
- Conventional commit, e.g. `test(org): cover OrgPicker and useTiers`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: `useTiers` hook test

Create `apps/org/src/features/roster-import/use-tiers.test.ts`. Mock
`@monobase/sdk-ts/generated` exporting `listMembershipTiers`. Use the `ok()`
helper from `../../test-utils/mock-sdk`. Cover:

1. **Happy path** — `listMembershipTiers` resolves the nested envelope
   `ok({ data: [{ id, name, code }, …], pagination: {…} } as any)`; assert
   `result.current.tiers` maps to `[{ id, name, code }]` and `loading` is false
   after settle.
2. **Disabled when no org** — `useTiers(null)`: assert `listMembershipTiers` is
   NOT called and `tiers` is `[]` (the query is `enabled: !!orgId`).
3. **Extra fields stripped** — include an extra field on a tier in the mock
   (e.g. `description`); assert the mapped object has only `id`, `name`, `code`.

Use `useDuesDashboard`'s test (in `use-dues.test.tsx`) as the structural model
(same wrapper, same `vi.mock`, same `waitFor`).

**Verify**: `bun run --filter @monobase/org test -- use-tiers` → all new pass.

### Step 2: `OrgPicker` component test

Create `apps/org/src/features/org/OrgPicker.test.tsx`. Mock the local module
`./use-org` so you control both hooks:

```tsx
import { vi } from 'vitest'
const setOrgId = vi.fn()
vi.mock('./use-org', () => ({
  useOrgs: () => ({ status: 'ready', orgs: [{ id: 'o1', name: 'Chapter A' }, { id: 'o2', name: 'Chapter B' }] }),
  useSelectedOrg: () => ({ orgId: 'o1', setOrgId }),
}))
```

Cover:

1. **Renders an accessible select** — `render(<OrgPicker />)`; assert
   `screen.getByLabelText('Select organisation')` (or `getByRole('combobox')`)
   is present, and both org names render as options.
2. **Reflects current selection** — assert the select's value is `'o1'`.
3. **Calls `setOrgId` on change** — use `@testing-library/user-event`
   `selectOptions` to pick "Chapter B"; assert `setOrgId` was called with `'o2'`.

**Verify**: `bun run --filter @monobase/org test -- OrgPicker` → all new pass.

### Step 3: Full suite green

**Verify**: `bun run --filter @monobase/org test` → all pass (existing + new).
And `bun run --filter @monobase/org typecheck` → exit 0.

## Test plan

(The deliverables ARE the tests.) New cases:
- `use-tiers.test.ts`: happy path, disabled-when-null, extra-fields-stripped (3).
- `OrgPicker.test.tsx`: renders+a11y, reflects selection, calls setOrgId (3).

Pattern sources: `apps/org/src/features/dues/use-dues.test.tsx` (hook),
`apps/org/src/features/roster/BulkResults.test.tsx` (component).

## Done criteria

ALL must hold:

- [ ] `bun run --filter @monobase/org typecheck` exits 0
- [ ] `bun run --filter @monobase/org test` exits 0
- [ ] `apps/org/src/features/roster-import/use-tiers.test.ts` exists, ≥3 cases pass
- [ ] `apps/org/src/features/org/OrgPicker.test.tsx` exists, ≥3 cases pass
- [ ] No non-test files modified (`git status` shows only the two new files)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report if:

- `OrgPicker.tsx` or `use-tiers.ts` differs from the excerpts above (drift).
- A test can only pass by changing source code — that means a real bug; report it.
- `apps/org/src/test-utils/mock-sdk.ts` no longer exports `ok` (the helper moved).

## Maintenance notes

- For a reviewer: confirm the `OrgPicker` test asserts the **callback argument**
  (`setOrgId('o2')`), not just that a change fired — the value wiring is the bug
  class that matters.
- If `useTiers` ever switches from the nested `{ data: { data } }` envelope to a
  flat shape, case 1 must change in lockstep.
- Deferred: route-level tests for thin route wrappers are intentionally skipped
  (E2E covers those — see plan 004).
