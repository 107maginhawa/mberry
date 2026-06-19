# Plan 003: Correct CLAUDE.md handler-topology drift

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP condition" occurs, stop and report. When done, update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat dd2ff052..HEAD -- CLAUDE.md`
> If `CLAUDE.md` changed since this plan was written, re-read the relevant
> section and compare against the "Current state" excerpts before editing.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs / DX
- **Planned at**: commit `dd2ff052`, 2026-06-18

## Why this matters

`CLAUDE.md` is the AI-instructions file loaded into every Claude Code session
and read by humans onboarding. Its "Business Domain Modules" section describes
the API handlers as living under `services/api-ts/src/handlers/association:member/`
with "~193 handlers". That is **stale**: the mega-module decomposition closed
2026-06-07 (see `ROADMAP.md`) and moved handler implementations to
`services/api-ts/src/handlers/member/<sub>/`. A reader following the doc
navigates to the wrong directory, and an agent generating code may add files in
the wrong place. Stale docs are worse than missing docs because they actively
mislead.

The truth is nuanced and the fix must capture it accurately: **handlers** moved
to `member/<sub>/`, but **repositories and schemas** still live under
`association:member/repos/` (many files still `import … from
'@/handlers/association:member/repos/...'`), and standalone `membership/` and
`dues/` directories also still exist. The corrected doc must reflect this split,
not just rename a path.

After this plan: the "Business Domain Modules" section names the real directory
layout, so navigation and code-gen land in the right place.

## Current state

`CLAUDE.md` (in the repo root) contains, in the "## Business Domain Modules"
section, entries like:

```markdown
**Association** (mega-module domain — split deferred, see ROADMAP):
2. **association:member** — Membership, chapters, officers, positions, credits,
   credentials, elections, committees (~193 handlers). Owns spec content for
   m05-membership, m10-credit-tracking, m11-documents-credentials,
   m12-elections-governance, m19-committee-management.
3. **association:operations** — Analytics, training, events under association
   umbrella (~69 handlers).
```

This conflicts with `ROADMAP.md`, which states the decomposition is **CLOSED**
and "Final landing point: handlers/member/<sub>/ (NOT association:member)".

**Verified actual layout** (run the commands in Step 1 to confirm before editing):
- Handlers live under `services/api-ts/src/handlers/member/` in 8 subdirectories:
  `certificates`, `chapters`, `credentials`, `credits`, `directory`,
  `duesspecialassessments`, `governance`, `membership`.
- `services/api-ts/src/handlers/association:member/` still exists but now holds
  shared **repos/schemas** (e.g. `repos/special-assessments.repo.ts`,
  `repos/dues-payments.schema.ts`), not the handler entrypoints.
- Standalone `services/api-ts/src/handlers/membership/` and `.../dues/` also
  still exist.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| List member subdirs | `ls -d services/api-ts/src/handlers/member/*/` | the 8 subdirs above |
| Confirm residual repos | `ls services/api-ts/src/handlers/association:member/` | shows `repos/` (+ maybe others) |
| Count member-tree handlers | `find services/api-ts/src/handlers/member -name '*.ts' -not -name '*.test.ts' \| wc -l` | a current number to cite |
| Find stale references | `grep -n 'association:member' CLAUDE.md` | the lines to fix |

## Scope

**In scope**:
- `CLAUDE.md` — the "## Business Domain Modules" section (and any other line in
  that file that asserts handlers live under `association:member/`).

**Out of scope** (do NOT touch):
- Any source code or other docs (`README.md`, `CONTRIBUTING.md`, `ROADMAP.md`).
  This is a single-file doc correction. If you find the same drift elsewhere,
  note it in your report but do not fix it here.
- The handler-count numbers elsewhere in the file that are already hedged with
  "numbers may drift — re-run …". Only fix the path/topology claim.
- Renaming directories on disk. The doc must describe reality, not change it.

## Git workflow

- Branch: `docs/003-claude-md-handler-topology` (off `main`).
- Commit message: `docs: correct CLAUDE.md handler topology post-decomposition`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Establish ground truth

Run the four commands in "Commands you will need" and record the actual layout.
Use the real subdirectory list and the real handler count from these commands —
do not copy a number from this plan.

**Verify**: you have a confirmed list of `member/*` subdirs and the residual
contents of `association:member/`.

### Step 2: Rewrite the topology claim in CLAUDE.md

Locate the "## Business Domain Modules" section (`grep -n 'Business Domain Modules' CLAUDE.md`).
Replace the stale `association:member` / `association:operations` description
with an accurate one. The replacement must state:

1. Handler implementations now live under `services/api-ts/src/handlers/member/<sub>/`
   — list the 8 subdirs you confirmed in Step 1.
2. `services/api-ts/src/handlers/association:member/` still exists and holds
   **shared repositories and schemas** (imported via
   `@/handlers/association:member/repos/...`), not handler entrypoints.
3. Standalone `membership/` and `dues/` directories also remain.
4. Reference `ROADMAP.md` for the decomposition history (closed 2026-06-07).

Keep the surrounding markdown structure and tone consistent with the rest of the
file. Preserve the "numbers may drift — re-run …" hedge style for any counts you
include.

**Verify**: `grep -n 'association:member' CLAUDE.md` — every remaining mention
refers to the residual repos/schemas location, not to where handlers live.

## Test plan

No automated tests (docs-only). Manual verification:
- `grep -n 'handlers/member/' CLAUDE.md` shows the corrected path is present.
- Each path named in the edited section resolves: e.g.
  `ls services/api-ts/src/handlers/member/governance/` succeeds.

## Done criteria

ALL must hold:

- [ ] The "Business Domain Modules" section names `handlers/member/<sub>/` as the
      handler location and lists the real subdirectories
- [ ] The residual `association:member/repos` (shared repos/schemas) is described accurately
- [ ] No remaining sentence in `CLAUDE.md` claims handler *entrypoints* live under `association:member/`
- [ ] Every directory path mentioned in the edited section resolves on disk
- [ ] Only `CLAUDE.md` changed (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The actual filesystem layout (Step 1) does not match what this plan describes
  (e.g. `member/` does not exist, or handlers are still under `association:member/`)
  — the codebase has drifted further; report the real layout instead of guessing.

## Maintenance notes

- When the residual `association:member/repos` is eventually relocated or the
  standalone `membership/`/`dues/` dirs are consolidated, this section needs
  another pass — it tracks a structure still in motion.
- A reviewer should sanity-check the edited paths against `git ls-files services/api-ts/src/handlers/`.
