# Plan 009: Form-validation + accessibility polish (3 small fixes)

> **Executor instructions**: Follow step by step. Each fix has its own verification. If a "STOP condition" occurs, stop and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a024135..HEAD -- apps/org/src/features/events/CreateEventForm.tsx apps/org/src/features/roster/Roster.tsx apps/org/src/features/announcements/CreateAnnouncementForm.tsx`
> If any changed, compare to the excerpts below before editing; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Depends on**: none
- **Risk**: LOW
- **Category**: bug (validation) + accessibility
- **Planned at**: commit `4a024135`, 2026-06-29

## Why this matters

Three cheap correctness/accessibility gaps. The a11y one is a DESIGN.md requirement (WCAG AA for older, low-vision users): the roster "select all" checkbox shows a visual indeterminate dash but never announces "mixed" to screen readers. The two validation gaps let officers create nonsensical data (events that start in the past; fractional event capacity) and submit whitespace-only announcements.

## Current state

**Fix 1 — event start date may be in the past.** `apps/org/src/features/events/CreateEventForm.tsx` validates end-after-start but not past-start:

```tsx
    if (!title || !start || !end) { setClientError('Title, start, and end are required.'); return }
    if (new Date(end) < new Date(start)) { setClientError('End time must be after the start time.'); return }
```

**Fix 2 — capacity allows fractions.** Same file, the capacity input has `min={1}` but no `step`:

```tsx
            <div><Label htmlFor="ev-cap">Capacity</Label><Input id="ev-cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
```

**Fix 3 — select-all checkbox doesn't announce "mixed".** `apps/org/src/features/roster/Roster.tsx` sets the DOM `indeterminate` property via ref but leaves `aria-checked` tracking only `checked`:

```tsx
          <input
            type="checkbox"
            className="size-5"
            aria-label="Select all"
            checked={allFilteredSelected}
            ref={(el) => { if (el) el.indeterminate = selectedCount > 0 && !allFilteredSelected }}
            onChange={toggleAll}
          />
```

(Optional Fix 4 — announcement whitespace.) `apps/org/src/features/announcements/CreateAnnouncementForm.tsx:17` guards `if (!orgId || !title || !content) return`; inputs are `required` so empty is blocked by the browser, but a whitespace-only title/content (`"   "`) passes. Trimming closes it.

## Commands you will need

| Purpose   | Command                                          | Expected |
|-----------|--------------------------------------------------|----------|
| Typecheck | `bun run --filter @monobase/org typecheck`       | exit 0   |
| Tests     | `bun run --filter @monobase/org test`            | all pass |

Run from repo root.

## Scope

**In scope**:
- `apps/org/src/features/events/CreateEventForm.tsx` (fixes 1, 2)
- `apps/org/src/features/roster/Roster.tsx` (fix 3)
- `apps/org/src/features/announcements/CreateAnnouncementForm.tsx` (fix 4, optional)
- matching `*.test.tsx` for the files changed (CreateEventForm has a test; Roster has a test)

**Out of scope**: any backend/SDK change, the bulk-send logic, anything not listed.

## Git workflow

- Branch: `advisor/009-validation-a11y-polish`. Conventional commit, e.g. `fix(org): past-date guard, integer capacity, select-all a11y`. No push/PR unless instructed.

## Steps

### Step 1 (Fix 1): Reject past start dates

In `CreateEventForm.tsx` `onSubmit`, after the end-after-start check, add a past-start guard:

```tsx
    if (new Date(start) < new Date()) { setClientError('The event start time cannot be in the past.'); return }
```

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 2 (Fix 2): Integer-only capacity

Add `step={1}` to the capacity `<Input>` (keep `min={1}`):

```tsx
            <Input id="ev-cap" type="number" min={1} step={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
```

Optionally also reject a non-integer in `onSubmit` (`if (capacity && !Number.isInteger(Number(capacity)))`), but `step={1}` is the minimum.

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 3 (Fix 3): Announce "mixed" to screen readers

On the select-all checkbox in `Roster.tsx`, add `aria-checked` reflecting the three states:

```tsx
            aria-checked={selectedCount > 0 && !allFilteredSelected ? 'mixed' : allFilteredSelected}
```

Keep the existing `ref` that sets `el.indeterminate` (it drives the visual dash). `aria-checked="mixed"` is the WAI-ARIA standard for a partially-checked control.

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 4 (Fix 4, optional): Trim announcement inputs

In `CreateAnnouncementForm.tsx`, trim before the guard and before sending:

```tsx
    const t = title.trim(); const c = content.trim()
    if (!orgId || !t || !c) return
    create.mutate({ title: t, content: c }, { /* unchanged */ })
```

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 5: Tests + suite

- `CreateEventForm.test.tsx`: add a case that a past start date sets the client error and does NOT call the create mutation (model on the existing end-before-start test in that file; use a fixed past date string like `'2020-01-01T10:00'`).
- `Roster.test.tsx`: add/extend a case asserting the select-all checkbox has `aria-checked="mixed"` when some-but-not-all filtered rows are selected (model on the existing roster selection tests).
- (If Fix 4 done) add a whitespace-only announcement case in `CreateAnnouncementForm.test.tsx` (does not call mutate).

**Verify**: `bun run --filter @monobase/org test` → all pass.

## Test plan

New cases: past-date rejected (no mutate), select-all announces mixed, (optional) whitespace announcement rejected. Patterns: the existing sibling `*.test.tsx` for each component.

## Done criteria

- [ ] `bun run --filter @monobase/org typecheck` exits 0
- [ ] `bun run --filter @monobase/org test` exits 0; the new cases pass
- [ ] `grep -n "in the past" apps/org/src/features/events/CreateEventForm.tsx` returns a match
- [ ] `grep -n "step={1}" apps/org/src/features/events/CreateEventForm.tsx` returns a match
- [ ] `grep -n "aria-checked" apps/org/src/features/roster/Roster.tsx` returns a match (mixed handling)
- [ ] Only in-scope files changed (`git status`)
- [ ] `plans/README.md` row for 009 updated

## STOP conditions

Stop and report if: excerpts don't match live code; a past-date test is flaky because the component reads a non-injectable clock (if so, use a clearly-past literal like `2020-01-01` rather than mocking time, and note it).

## Maintenance notes

- Reviewer: the past-date guard uses `new Date()` at submit time — fine for a guard; don't over-engineer with an injectable clock. Confirm `aria-checked="mixed"` coexists with the `ref`-set `indeterminate` (both should remain; one is for AT, one for the visual).
- These are independent; if any single fix turns out riskier than expected, land the others and report the holdout.
