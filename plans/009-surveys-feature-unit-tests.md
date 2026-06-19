# Plan 009: Add unit tests for the surveys feature (currently 0 tests across 18 files)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e4bb901a..HEAD -- apps/memberry/src/features/surveys`
> If any in-scope file changed since this plan was written, compare the
> "Current state" facts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `e4bb901a`, 2026-06-19

## Why this matters

The `surveys` feature in the memberry app has **18 source files and zero unit
tests** — confirmed by `find apps/memberry/src/features/surveys -name '*.test.*'`
returning nothing. This is the largest untested feature in the app. It is
member-facing: members fill out surveys/polls (`survey-flow`, the five
`question-renderers`, `poll-card`), and the NPS subsystem (`nps-gauge`,
`nps-modal`, `use-pending-nps`) drives review prompts. A regression in question
rendering or answer capture silently breaks data collection with no test to
catch it. By contrast the `dues` feature has 29 tests. This plan brings the
highest-value, easiest-to-test surveys components up to the same baseline
following the existing test conventions.

## Current state

- Feature root: `apps/memberry/src/features/surveys/` — no `*.test.*` files exist.
- Source files (run `find apps/memberry/src/features/surveys -type f` to confirm):
  - `components/question-renderers/choice-question.tsx` — renders a choice question
  - `components/question-renderers/nps-question.tsx` — 0–10 NPS scale
  - `components/question-renderers/rating-question.tsx` — star/numeric rating
  - `components/question-renderers/text-question.tsx` — free-text answer
  - `components/question-renderers/yes-no-question.tsx` — yes/no toggle
  - `components/poll-card.tsx` — single poll display + vote
  - `components/nps-gauge.tsx` — NPS score gauge (pure presentational)
  - `components/survey-list.tsx` — list of available surveys
  - `components/survey-flow.tsx` — orchestrates a multi-question survey
  - `hooks/use-survey-draft.ts` — draft answer persistence
  - (others: `survey-builder`, `survey-results`, `survey-templates`,
    `question-editor`, `nps-modal`, `nps-provider`, `nps-trend-chart`,
    `hooks/use-pending-nps.ts` — out of scope for this plan, see Scope)

### Test conventions to follow (READ THESE FILES FIRST)

The repo has an established pattern. Before writing anything, read these two
exemplar tests in full and match their structure exactly:

- `apps/memberry/src/features/dues/components/arrears-breakdown.test.tsx` —
  the model for **pure prop-driven components**. Note:
  - Imports: `import { describe, test, expect, vi } from '@/test/vitest-shim'`
    (NOT directly from `vitest`), `import { screen, within } from '@testing-library/react'`,
    `import { renderWithProviders } from '@/test/utils'`.
  - Uses a local `makeInvoice(overrides)` factory to build props.
  - Each test is tagged `[AC-...]` in its name and asserts on rendered text via
    `screen.getByText(...)`.
  - Mocks heavy/animated children with `vi.mock('@/components/motion/glass-card', ...)`.
- `apps/memberry/src/features/dues/components/record-payment-form.test.tsx` —
  the model for **interactive/form components**: how to mock `sonner`,
  `@/hooks/use-mutation-feedback`, and shared pattern components
  (`@/components/patterns/combobox`, `date-picker`, `form-field`).

Test setup is `apps/memberry/src/test/setup.ts` (imports `@testing-library/jest-dom`).
Tests are run via the isolated runner (see Commands) which auto-detects files
that `vi.mock` local sibling modules and runs them in their own process — so
mocking siblings is allowed and won't pollute other tests.

**Do not invent component prop shapes.** For each component you test, open the
component file and read its actual exported props/interface first, then build a
factory like `makeInvoice` for that shape. If a component's props or exported
name differ from what a test assumes, fix the test to match the code — never
change the component.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Run all memberry unit tests | `cd apps/memberry && bun run test` | exit 0, all pass |
| Run one test file | `cd apps/memberry && bun run test:flat 2>/dev/null; cd ../.. && bun test apps/memberry/src/features/surveys/components/question-renderers/text-question.test.tsx` | new tests pass |
| Typecheck | `cd apps/memberry && bun run typecheck` | exit 0, no errors |
| Lint | `cd apps/memberry && bun run lint` | exit 0 |

> Note: the canonical CI command is `cd apps/memberry && bun run test` (it runs
> `bun scripts/test-isolated.ts`). Use it as the final gate. To iterate on a
> single new file quickly you may run it directly with
> `bun test <path-to-test-file>` from the repo root, but always finish with the
> full `bun run test`.

## Scope

**In scope** (create these test files only — one per component/hook):
- `apps/memberry/src/features/surveys/components/question-renderers/choice-question.test.tsx`
- `apps/memberry/src/features/surveys/components/question-renderers/nps-question.test.tsx`
- `apps/memberry/src/features/surveys/components/question-renderers/rating-question.test.tsx`
- `apps/memberry/src/features/surveys/components/question-renderers/text-question.test.tsx`
- `apps/memberry/src/features/surveys/components/question-renderers/yes-no-question.test.tsx`
- `apps/memberry/src/features/surveys/components/poll-card.test.tsx`
- `apps/memberry/src/features/surveys/components/nps-gauge.test.tsx`
- `apps/memberry/src/features/surveys/components/survey-list.test.tsx`
- `apps/memberry/src/features/surveys/components/survey-flow.test.tsx`
- `apps/memberry/src/features/surveys/hooks/use-survey-draft.test.ts`

**Out of scope** (do NOT modify, do NOT add tests for in this plan):
- Any source file under `apps/memberry/src/features/surveys/` — **tests only, no
  source edits.** If you believe a component has a bug, STOP and report it; do
  not fix it here.
- `survey-builder.tsx`, `survey-results.tsx`, `survey-templates.tsx`,
  `question-editor.tsx`, `nps-modal.tsx`, `nps-provider.tsx`,
  `nps-trend-chart.tsx`, `hooks/use-pending-nps.ts` — officer/admin-authoring
  and provider-wiring components; higher test setup cost, deferred to a
  follow-up. Skipping them is intentional.
- The coverage thresholds in `vitest.config.ts` — raising them is plan 011, not
  this one.

## Git workflow

- Branch: `advisor/009-surveys-tests` (create off the current branch).
- Commit per logical group (e.g. one commit for the 5 question-renderers, one
  for poll-card+nps-gauge+survey-list, one for survey-flow+hook). Conventional
  commits, matching repo style — example from `git log`:
  `test(surveys): add unit tests for question renderers`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the exemplars and one target component

Read `arrears-breakdown.test.tsx` and `record-payment-form.test.tsx` (paths
above). Then read `question-renderers/text-question.tsx` to learn its real prop
shape and exported name.

**Verify**: you can state, in your report, the exact props `text-question.tsx`
accepts. (No command — this is a comprehension gate.)

### Step 2: Test the five question renderers

For each of `text-question`, `choice-question`, `rating-question`,
`yes-no-question`, `nps-question`: read the component, then write a test file
modeled on `arrears-breakdown.test.tsx`. Cover, at minimum:
- **Renders** the question prompt/label text from props.
- **Renders the answer controls** (e.g. choice options, the 0–10 NPS buttons,
  the rating stars, the text input, the yes/no buttons) — assert count/labels.
- **Capture**: simulate a user selecting/typing an answer with
  `@testing-library/user-event` (or `fireEvent`) and assert the component's
  `onChange`/`onAnswer` callback (read the real prop name) fires with the
  expected value. Pass a `vi.fn()` as that callback.
- **Controlled value**: when given an existing answer prop, the control shows it
  selected/filled.

**Verify**: `cd .. && bun test apps/memberry/src/features/surveys/components/question-renderers/` → all pass (run from repo root, i.e. `/Users/elad-mini/Desktop/memberry`).

### Step 3: Test poll-card, nps-gauge, survey-list

- `nps-gauge.test.tsx`: pure presentational — assert it renders the score and
  expected label/zone for a few score props (e.g. detractor/passive/promoter
  boundaries — read the component for its actual thresholds).
- `poll-card.test.tsx`: renders poll question + options; clicking an option
  calls the vote callback (mock it). Mock `sonner` and any mutation hook as in
  `record-payment-form.test.tsx`.
- `survey-list.test.tsx`: renders a list from a surveys-array prop; shows an
  empty state when the list is empty (assert the real empty-state text).

**Verify**: `bun test apps/memberry/src/features/surveys/components/poll-card.test.tsx apps/memberry/src/features/surveys/components/nps-gauge.test.tsx apps/memberry/src/features/surveys/components/survey-list.test.tsx` (from repo root) → all pass.

### Step 4: Test survey-flow and use-survey-draft

- `survey-flow.test.tsx`: read the component first. Cover advancing between
  questions and that submitting collects answers. If `survey-flow` requires
  query/mutation context, use `renderWithProviders` and mock the SDK
  hooks/mutation the way `record-payment-form.test.tsx` mocks
  `@/hooks/use-mutation-feedback`. If the wiring is too entangled to test
  without large mocks, write the renders-first-question + answer-capture tests
  you can, and note the rest as deferred in your report — do NOT force a brittle
  test.
- `use-survey-draft.test.ts`: test the hook with `renderHook` from
  `@testing-library/react`. Cover: saving a draft answer, reading it back, and
  clearing it. Read the hook's real API first.

**Verify**: `bun test apps/memberry/src/features/surveys/components/survey-flow.test.tsx apps/memberry/src/features/surveys/hooks/use-survey-draft.test.ts` (from repo root) → all pass.

### Step 5: Full gate

**Verify**:
- `cd apps/memberry && bun run test` → exit 0, all pass.
- `cd apps/memberry && bun run typecheck` → exit 0.
- `cd apps/memberry && bun run lint` → exit 0.

## Test plan

- New tests (10 files listed in Scope). Each renderer file: 4+ cases (render
  prompt, render controls, capture answer, controlled value). poll-card: 3+.
  nps-gauge: 3+. survey-list: 2+. survey-flow: 2+. use-survey-draft: 3+.
  Target ≈ 35+ new tests total.
- Structural pattern: pure components model after
  `apps/memberry/src/features/dues/components/arrears-breakdown.test.tsx`;
  interactive/form components model after
  `apps/memberry/src/features/dues/components/record-payment-form.test.tsx`.
- Verification: `cd apps/memberry && bun run test` → all pass, including the new
  surveys tests (the suite count rises by the number you added).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd apps/memberry && bun run test` exits 0; the 10 new test files exist
      and pass.
- [ ] `find apps/memberry/src/features/surveys -name '*.test.*' | wc -l` returns
      `10`.
- [ ] `cd apps/memberry && bun run typecheck` exits 0.
- [ ] `cd apps/memberry && bun run lint` exits 0.
- [ ] `git status` shows only new `*.test.*` files under
      `apps/memberry/src/features/surveys/` added — no source files modified.
- [ ] `plans/README.md` status row for 009 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- A surveys component's actual props/exports differ so much that a test cannot
  be written without modifying the component — report which component and why.
- You find an actual bug in a surveys component (a renderer that drops the
  answer, a flow that loses state) — report it as a finding; do not fix source
  in this plan.
- The drift check shows surveys source changed since `e4bb901a` and the file
  list above no longer matches.
- `survey-flow` cannot be rendered without reconstructing large amounts of app
  context — write the achievable subset and report the rest as deferred.

## Maintenance notes

- When new question types are added under `question-renderers/`, add a matching
  test file following the same pattern.
- A reviewer should check that the "capture answer" tests assert the callback
  **payload** (the chosen value), not merely that a click happened — that is the
  test that actually protects data collection.
- Deferred to a follow-up plan: tests for the authoring components
  (`survey-builder`, `question-editor`, `survey-results`, `survey-templates`)
  and the NPS provider/modal/trend chart. They need more mock scaffolding.
