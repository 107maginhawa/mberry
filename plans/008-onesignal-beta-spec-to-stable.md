# Plan 008: Stop advertising a beta OneSignal SDK in the manifest (align spec to installed stable)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP condition" occurs, stop and report — do not improvise. When done, update
> the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 23a91932..HEAD -- services/api-ts/package.json`
> If the file changed since this plan was written, re-confirm the dependency line
> below against the live file before editing; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dependencies
- **Planned at**: commit `23a91932`, 2026-06-19

## Why this matters

`services/api-ts/package.json` declares `"@onesignal/node-onesignal": "^5.2.1-beta1"`
— a **beta pre-release** as the version spec for a production runtime dependency
that powers all push/notification delivery (imported in `src/core/notifs.ts`,
`src/handlers/notifs/repos/notification.repo.ts`, and others). A spec anchored on
a `-beta` tag is a foot-gun: it signals "beta" to anyone reading the manifest and
permits a clean `bun install` to resolve onto a pre-release build. In practice the
caret range has already resolved to a **stable** release — the installed version
is `5.7.0` (`node_modules/@onesignal/node-onesignal/package.json`). So this is
manifest hygiene, not a behavior change: align the declared spec to the
already-installed stable so the lockfile and node_modules are unchanged. Low risk
precisely because the code already runs against `5.7.0` and the test suite is
green against it.

## Current state

`services/api-ts/package.json:36`:
```json
    "@onesignal/node-onesignal": "^5.2.1-beta1",
```

Installed (resolved) version — `node_modules/@onesignal/node-onesignal/package.json`:
```json
  "version": "5.7.0",
```

So the running code is already on stable `5.7.0`; only the declared spec still
names a beta. Import sites (do not edit — for context on blast radius):
`src/app.ts`, `src/core/email.ts`, `src/core/notifs.ts`, `src/core/config.ts`,
`src/core/ports/notification-preference.port.ts`,
`src/handlers/notifs/repos/notification.repo.ts`,
`src/handlers/communication/jobs/announcementSend.ts`,
`src/handlers/email/repos/queue.repo.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 23a91932..HEAD -- services/api-ts/package.json` | empty or matching line |
| Confirm installed version | `cat services/api-ts/node_modules/@onesignal/node-onesignal/package.json \| grep '"version"'` | `"version": "5.7.0"` (or higher 5.x stable) |
| Check latest stable (read-only) | `cd services/api-ts && bun pm view @onesignal/node-onesignal version` (or `npm view @onesignal/node-onesignal version`) | a stable `5.x` (no `-beta`) |
| Install (lockfile reconcile) | `cd /Users/elad-mini/Desktop/memberry && bun install` | exit 0, lockfile unchanged or trivially updated |
| Typecheck API | `cd services/api-ts && bun run typecheck` | exit 0 |
| Tests | `cd services/api-ts && bun test` | all pass (or baseline-identical — see note) |
| Build | `cd services/api-ts && bun run build` | exit 0 |
| Audit | `cd /Users/elad-mini/Desktop/memberry && bun audit` | no NEW advisories for `@onesignal/node-onesignal` |

> Note on tests/build: if `bun test` or `bun audit` cannot run in this
> environment (network-gated registry, missing services), capture the failure and
> compare it to a baseline run on the unmodified tree — a pre-existing failure
> that is identical before and after the change is acceptable; a NEW failure is a
> STOP condition.

## Scope

**In scope** (the only file you should modify):
- `services/api-ts/package.json` — the `@onesignal/node-onesignal` version spec
  line only.
- `bun.lock` / `bun.lockb` at the repo root **only if** `bun install`
  regenerates it as a result of the spec change (let the tool do it; do not
  hand-edit the lockfile).

**Out of scope** (do NOT touch):
- Any source file importing OneSignal — the SDK API is unchanged at `5.7.0`; no
  call-site edits are part of this plan.
- Other dependencies in `package.json`.
- Bumping to a **major** version (v6+) — that is a separate migration with its
  own breaking-change review; this plan only removes the beta tag by pinning to
  the installed stable `5.x`.

## Git workflow

- Branch: `chore/008-onesignal-stable-spec` (off the current branch).
- Commit message: `chore(deps): pin @onesignal/node-onesignal to stable 5.x (drop beta spec)`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Determine the target stable spec

Read the installed version
(`cat services/api-ts/node_modules/@onesignal/node-onesignal/package.json | grep '"version"'`).
Use that exact stable version as the new caret floor. If it reports `5.7.0`, the
new spec is `"^5.7.0"`. Do NOT jump to a different major (no `^6` / `^7`).

**Verify**: you have a concrete stable `5.x` version string with no `-beta`/`-alpha` suffix.

### Step 2: Update the manifest spec

In `services/api-ts/package.json`, change:
```json
    "@onesignal/node-onesignal": "^5.2.1-beta1",
```
to (using the version from Step 1):
```json
    "@onesignal/node-onesignal": "^5.7.0",
```

**Verify**: `grep -n 'node-onesignal' services/api-ts/package.json` → shows the
new spec with no `-beta`.

### Step 3: Reconcile lockfile and verify nothing moved

Run `cd /Users/elad-mini/Desktop/memberry && bun install`. Because `5.7.0` already
satisfies the new range and was already installed, the resolved version must not
change.

**Verify**:
- `cat services/api-ts/node_modules/@onesignal/node-onesignal/package.json | grep '"version"'` → same `5.7.0` as before.
- `cd services/api-ts && bun run typecheck` → exit 0.
- `cd services/api-ts && bun run build` → exit 0.
- `cd services/api-ts && bun test` → all pass (or baseline-identical per the note above).

## Test plan

- No new tests required: this is a manifest/spec change with no resolved-version
  or source change. The verification is that typecheck, build, and the existing
  suite are unchanged.
- If the installed version *does* move (Step 3 changes `5.7.0` to something
  else), treat it as a STOP condition and report — the plan's "no behavior
  change" premise no longer holds.

## Done criteria

ALL must hold:

- [ ] `grep -n 'node-onesignal' services/api-ts/package.json` shows a stable `^5.x` spec with no `-beta`/`-alpha`
- [ ] Installed version after `bun install` is identical to before the change (still `5.7.0` or whatever Step 1 read)
- [ ] `cd services/api-ts && bun run typecheck` exits 0
- [ ] `cd services/api-ts && bun run build` exits 0
- [ ] `cd services/api-ts && bun test` passes (or proven baseline-identical to the pre-change run)
- [ ] Only `services/api-ts/package.json` (and possibly the root lockfile, tool-generated) changed (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `package.json` changed and the dependency line no longer
  matches the excerpt.
- `bun install` changes the **resolved** OneSignal version (the plan assumes the
  installed `5.7.0` stays put; a move means a real upgrade with its own review).
- Typecheck, build, or a previously-passing test fails **after** the change but
  passed on the unmodified tree (a genuine regression — do not edit source to
  paper over it).
- The only stable versions available are a different major (v6+) — report; a
  major bump is a separate plan.

## Maintenance notes

- For a reviewer: confirm the diff is a one-line spec change (plus possibly a
  tool-regenerated lockfile) and that no resolved version moved.
- Follow-up explicitly deferred: evaluating OneSignal **v6** (the SDK's next
  major). That needs a breaking-change audit across the listed import sites and
  is intentionally not part of this hygiene fix.
- Watch in future dependency reviews: any other `-beta`/`-alpha`/`-rc` specs in
  production `dependencies` — `grep -n 'beta\|alpha\|-rc' services/api-ts/package.json`.
