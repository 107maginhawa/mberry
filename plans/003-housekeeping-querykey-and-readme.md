# Plan 003: Housekeeping — scope SendLink invoice query key by org + add an apps/org README

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm its expected result. If a "STOP condition"
> occurs, stop and report. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat d8501e09..HEAD -- apps/org/src/features/paylink/SendLink.tsx`
> If `SendLink.tsx` changed, compare the excerpt below to the live code before
> editing; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Depends on**: none
- **Risk**: LOW
- **Category**: tech-debt + docs
- **Planned at**: commit `d8501e09`, 2026-06-29

## Why this matters

Two small, unrelated housekeeping items bundled to share one review:

1. **Query-key hygiene.** Every org-scoped React Query in `apps/org` keys on
   `orgId` so switching orgs refetches (see `use-dues.ts`). One query —
   outstanding invoices in `SendLink.tsx` — omits `orgId` from its key. Data is
   still fetched correctly today (the `x-org-id` header is injected per-request
   and `membershipId` is globally unique, so there is **no cross-org leak**), but
   the inconsistency is a latent stale-cache footgun and breaks the house style.
   This is a one-line correctness-hygiene fix.
2. **No README.** `apps/org` has no README. A new contributor (human or agent)
   has to reverse-engineer the multi-org `x-org-id` model, the CSRF-mirror, and
   the SDK drift-coercion convention from source. A short README pays for itself.

> Note: an earlier audit overstated item 1 as a cross-org IDOR. It is not —
> `membershipId` is unique per membership, so two orgs cannot collide on the same
> key. Treat this as consistency hygiene, not a security fix.

## Current state

### Item 1 — `apps/org/src/features/paylink/SendLink.tsx:204-215`

```tsx
  // Fetch outstanding invoices for this membership
  const { data: invoicesData } = useQuery({
    queryKey: ['dues-invoices', membershipId],
    enabled: !!membershipId,
    retry: false,
    queryFn: async () => {
      const { data } = await listDuesInvoices({
        query: { membershipId, pageSize: 50 },
      })
      return data?.data ?? []
    },
  })
```

`orgId` is already available in the same component:
`apps/org/src/features/paylink/SendLink.tsx:196` — `const { orgId } = useSelectedOrg()`.

The house-style reference is `apps/org/src/features/dues/use-dues.ts:79` and `:91`,
where keys look like `['dues', 'outstanding', 'sent', orgId]`.

### Item 2 — README

There is no `apps/org/README.md`. Facts to capture (all verifiable in-repo):

- **Purpose**: the officer PWA for a PH dental chapter — roster import, dues,
  events, announcements, pay-links, PayMongo payment settings.
- **Dev/test/build commands** (from `apps/org/package.json`):
  - dev: `bun run --filter @monobase/org dev` → Vite on **:3005**
  - test (unit/component): `bun run --filter @monobase/org test` (Vitest)
  - e2e: `bun run --filter @monobase/org test:e2e` (Playwright; needs the dev
    server running on :3005 — specs stub the API via `page.route`)
  - typecheck: `bun run --filter @monobase/org typecheck`
- **Feature folder convention**: `src/features/<name>/` = a `use-*.ts` data hook +
  `Component.tsx` + co-located `*.test.ts(x)`. Pages live in `src/routes/`.
- **Multi-org model**: the selected org id is stored in `localStorage` under
  `org.selectedOrgId` (`src/features/org/use-org.ts`) and injected as the
  `x-org-id` header on org-scoped requests by `src/lib/api.ts`.
- **CSRF**: `src/lib/api.ts` mirrors the CSRF cookie token into the
  `x-csrf-token` header on mutating, non-allowlisted requests; its
  `CSRF_EXEMPT_PREFIXES` must track the server allowlist in
  `services/api-ts/src/app.ts`.
- **SDK drift convention**: the generated `@monobase/sdk-ts` types can diverge
  from the real handler shapes (money is bigint on the wire, some response
  envelopes are nested). Hooks deliberately `Number()`-coerce money and use
  narrow `as any` casts at the SDK seam, each with an inline comment. Never edit
  generated SDK files; never edit the frozen engine — coerce at the app boundary.
- **Error messages**: officer-facing errors must be plain language (older,
  non-technical users) — see `src/lib/friendly-error.ts` (added in plan 001).

## Commands you will need

| Purpose   | Command                                            | Expected |
|-----------|----------------------------------------------------|----------|
| Typecheck | `bun run --filter @monobase/org typecheck`         | exit 0   |
| Tests     | `bun run --filter @monobase/org test`              | all pass |

Run from repo root `/Users/elad-mini/Desktop/memberry`.

## Scope

**In scope**:
- `apps/org/src/features/paylink/SendLink.tsx` (edit, one line)
- `apps/org/README.md` (create)

**Out of scope**:
- Any other query key — only the `SendLink.tsx` invoice query is in scope.
- Root `README.md` / `CLAUDE.md` — do not touch.
- A per-app `CLAUDE.md` — not needed (the root `CLAUDE.md` covers agent
  conventions); do not create one.

## Git workflow

- Branch: `advisor/003-housekeeping`
- Conventional commit, e.g. `chore(org): scope invoice query key by org + add README`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add `orgId` to the SendLink invoice query key

In `apps/org/src/features/paylink/SendLink.tsx`, change the key on the
`['dues-invoices', membershipId]` query to include `orgId` (already in scope at
line 196). The line becomes:

```tsx
    queryKey: ['dues-invoices', orgId, membershipId],
```

Do not change `enabled`, `queryFn`, or anything else.

**Verify**: `grep -n "dues-invoices" apps/org/src/features/paylink/SendLink.tsx`
→ shows `['dues-invoices', orgId, membershipId]`.

### Step 2: Confirm nothing broke

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0, and
`bun run --filter @monobase/org test` → all pass. (If a test asserted the old
key shape, update it — it's the test for this code. Any other failure = STOP.)

### Step 3: Write `apps/org/README.md`

Create `apps/org/README.md` from the facts in "Current state → Item 2". Keep it
to one page: a one-paragraph purpose, a commands table, the feature-folder
convention, and short "Multi-org / CSRF / SDK drift / Error messages" sections.
Do not invent behavior — every claim must be checkable against the listed source
files. Cross-link `../../DESIGN.md` for the design law and `../../CLAUDE.md` for
the engine conventions.

**Verify**: `test -f apps/org/README.md && wc -l apps/org/README.md` → file
exists. Manually confirm it names port 3005, the `org.selectedOrgId` key, and the
`x-org-id` header.

## Test plan

No new automated tests required (one-line key change is covered by the existing
SendLink/paylink tests; README is docs). The existing suite passing is the gate.

## Done criteria

ALL must hold:

- [ ] `bun run --filter @monobase/org typecheck` exits 0
- [ ] `bun run --filter @monobase/org test` exits 0
- [ ] `grep -n "'dues-invoices', orgId, membershipId" apps/org/src/features/paylink/SendLink.tsx` returns 1 match
- [ ] `apps/org/README.md` exists and mentions `3005`, `org.selectedOrgId`, `x-org-id`
- [ ] Only the two in-scope files are modified/created (`git status`)
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report if:

- `SendLink.tsx` differs from the excerpt (drift since `d8501e09`).
- Adding `orgId` to the key breaks a test in a way that implies real behavior
  change beyond the cache key.

## Maintenance notes

- For a reviewer: the key change is safe because `orgId` is already in scope and
  the request already carried the org via header; this only aligns the cache key
  with the rest of the app.
- Keep the README's CSRF section in sync if `CSRF_EXEMPT_PREFIXES` in
  `src/lib/api.ts` or the server allowlist changes.
