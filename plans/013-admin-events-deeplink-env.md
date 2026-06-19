# Plan 013: Build the admin "Open in Memberry" deep link from VITE_MEMBERRY_URL

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e4bb901a..HEAD -- apps/admin/src/routes/events/index.tsx`
> If the file changed since this plan was written, compare the "Current state"
> excerpt below against the live code before editing; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e4bb901a`, 2026-06-19

## Why this matters

The admin Events detail sheet renders an "Open in Memberry" deep link that
**hardcodes `localhost:3004`**. In any deployed environment (the memberry app is
not on localhost), this link is broken — it sends the operator to
`https://localhost:3004/...`, which does not resolve. The app already has the
right config value for this: `VITE_MEMBERRY_URL` (declared in
`apps/admin/.env.example` and already used by `__root.tsx` for the sign-in
redirect). This is a one-line fix that makes the deep link work in production by
reusing the existing env var with the same localhost fallback the rest of the
app uses.

## Current state

- `apps/admin/src/routes/events/index.tsx:256` — the broken link:

```tsx
              <a
                href={`${window.location.protocol}//localhost:3004/org/${selectedEvent.organizationId}/officer/events/${selectedEvent.id}`}
                target="_blank"
                rel="noopener noreferrer"
                ...
              >
                <ExternalLink className="w-4 h-4" />
                Open in Memberry
              </a>
```

- The exemplar to match — `apps/admin/src/routes/__root.tsx:29-31` already
  derives a memberry URL from the env var with a localhost fallback:

```tsx
const MEMBERRY_LOGIN_URL = import.meta.env.VITE_MEMBERRY_URL
  ? `${import.meta.env.VITE_MEMBERRY_URL}/auth/sign-in?redirect=admin`
  : 'http://localhost:3004/auth/sign-in?redirect=admin'
```

- `apps/admin/.env.example:8` — `VITE_MEMBERRY_URL=http://localhost:3004`
  (already documented; no env-doc change needed).
- `grep -rn 'localhost:3004' apps/admin/src` returns exactly two lines:
  `__root.tsx:31` (the intended fallback — leave it) and
  `events/index.tsx:256` (the bug — fix it).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck admin | `cd apps/admin && tsc --noEmit` | exit 0, no errors |
| Lint admin | `cd apps/admin && eslint src` | no new errors |
| Confirm no stray hardcode | `cd /Users/elad-mini/Desktop/memberry && grep -rn 'localhost:3004' apps/admin/src` | only `__root.tsx:31` remains |
| Run admin suite | `cd /Users/elad-mini/Desktop/memberry && bun test apps/admin/src` | `0 fail` |

## Scope

**In scope** (modify this file only):
- `apps/admin/src/routes/events/index.tsx`

**Out of scope** (do NOT touch):
- `apps/admin/src/routes/__root.tsx` — its `localhost:3004` is the intended
  fallback; leave it exactly as is.
- `apps/admin/.env.example` — `VITE_MEMBERRY_URL` is already documented there.
- `apps/admin/src/routes/associations/index.tsx` — note: the `created_at!`
  non-null assertion at line 223 was considered and is NOT a bug (it sits inside
  a `(assoc.createdAt || assoc.created_at) ? ... : '--'` guard, so it never
  dereferences null). Do not "fix" it.
- Any other file.

## Git workflow

- Branch: `advisor/013-admin-events-deeplink`.
- One commit, conventional style, e.g.
  `fix(admin): build events "Open in Memberry" link from VITE_MEMBERRY_URL`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Define a memberry base URL from the env var

In `apps/admin/src/routes/events/index.tsx`, derive the base URL the same way
`__root.tsx` does. Either a module-level const near the top of the file:

```tsx
const MEMBERRY_BASE_URL = import.meta.env.VITE_MEMBERRY_URL || 'http://localhost:3004'
```

(Prefer this over reusing `window.location.protocol` — the env var already
carries the correct scheme+host for each environment, matching `__root.tsx`.)

### Step 2: Use it in the deep link

Replace the `href` at line 256 with:

```tsx
                href={`${MEMBERRY_BASE_URL}/org/${selectedEvent.organizationId}/officer/events/${selectedEvent.id}`}
```

Leave `target`, `rel`, className, and the rest of the anchor unchanged.

**Verify**: `grep -rn 'localhost:3004' apps/admin/src` → only `__root.tsx:31`
remains; `grep -n 'MEMBERRY_BASE_URL' apps/admin/src/routes/events/index.tsx`
→ shows the const and its use.

### Step 3: Typecheck, lint, test

**Verify**: `cd apps/admin && tsc --noEmit` → exit 0;
`cd apps/admin && eslint src` → no new errors;
`cd /Users/elad-mini/Desktop/memberry && bun test apps/admin/src` → `0 fail`.

## Test plan

No new automated test required (env-driven URL string; the existing events route
test still passes). Optional: if you also execute plan 012 and add an events
data-render test, you may assert the deep-link `href` starts with
`http://localhost:3004` under the test env — but that is plan 012's territory,
not required here.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn 'localhost:3004' apps/admin/src` returns exactly one line
      (`__root.tsx:31`).
- [ ] `events/index.tsx` builds the deep link from
      `import.meta.env.VITE_MEMBERRY_URL` with a localhost fallback.
- [ ] `cd apps/admin && tsc --noEmit` exits 0.
- [ ] `cd /Users/elad-mini/Desktop/memberry && bun test apps/admin/src` → `0 fail`.
- [ ] `git status` shows only `apps/admin/src/routes/events/index.tsx` modified.
- [ ] `plans/README.md` status row for 013 updated.

## STOP conditions

Stop and report back if:

- The line-256 excerpt does not match the live code (file drifted).
- `tsc --noEmit` reports `VITE_MEMBERRY_URL` is not a known env type — there
  should be a `/// <reference types="vite/client" />` (it is at the top of
  `__root.tsx`); if the events file lacks vite client types, report it rather
  than adding new global type plumbing.

## Maintenance notes

- If a third place ever needs a memberry deep link, factor `MEMBERRY_BASE_URL`
  into a shared `src/lib` helper rather than copy-pasting the env read a third
  time (two is fine; three is the threshold).
- A reviewer should confirm the fallback string still matches `__root.tsx` and
  `.env.example` so all three agree on `http://localhost:3004`.
