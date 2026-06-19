# Plan 011: Deepen money-path form tests (dues) and raise coverage thresholds

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e4bb901a..HEAD -- apps/memberry/src/features/dues apps/memberry/vitest.config.ts`
> If the cited files changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (independent of 009; do 009 first only if you want the
  threshold bump in step 4 to clear more easily)
- **Category**: tests
- **Planned at**: commit `e4bb901a`, 2026-06-19

## Why this matters

The `dues` feature handles money — recording payments, refunds, proof uploads,
fund allocation. It has 29 test files, but the money-input forms are tested
**shallowly**: the tests mock out the very components that hold the validation
and interaction logic, so they assert "the form renders" without ever exercising
amount validation, member selection, date entry, or submission payload. Example:
`record-payment-form.test.tsx` mocks `Combobox`, `DatePicker`, `FormField`, and
`use-mutation-feedback`, then asserts only that labels render and the button is
disabled. A regression that lets a negative or zero amount through, or that
submits the wrong payload, would not be caught. This plan adds **interaction and
validation** tests on the two highest-value money forms, then raises the
coverage thresholds modestly so the floor reflects reality and resists
backsliding.

## Current state

- `apps/memberry/src/features/dues/components/record-payment-form.test.tsx` — the
  shallow test. Current excerpt (lines 21–47, 54–76) mocks the interactive
  children:
  ```tsx
  vi.mock('@/components/patterns/combobox', () => ({
    Combobox: ({ value, onValueChange, placeholder, ...rest }: any) => (
      <input data-testid="combobox" value={value ?? ''} placeholder={placeholder}
        onChange={(e: any) => onValueChange?.(e.target.value)} {...rest} />
    ),
  }))
  vi.mock('@/components/patterns/date-picker', () => ({ DatePicker: (...) }))
  vi.mock('@/components/patterns/form-field', () => ({ FormField: (...) }))
  // ...
  vi.mock('@/hooks/use-mutation-feedback', () => ({
    useMutationFeedback: ({ mutationFn }: any) => ({
      mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null,
    }),
  }))
  // tests assert: 'renders form fields', 'shows fund allocation message',
  //               'button disabled when incomplete', 'member search placeholder'
  ```
  The mutation is fully stubbed, so no test asserts what payload submit sends or
  that invalid amounts are blocked.
- `apps/memberry/src/features/dues/components/refund-form.test.tsx` and
  `proof-upload-form.test.tsx` exist — read them; they likely share the same
  shallow shape.
- `apps/memberry/vitest.config.ts` (lines 19–29) sets low coverage thresholds:
  ```ts
  coverage: {
    provider: 'v8',
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/routeTree.gen.ts'],
    thresholds: { statements: 29, branches: 29, functions: 23, lines: 29 },
  },
  ```

### Conventions to follow

- Keep using the lightweight stub for `Combobox`/`DatePicker` (they wrap heavy
  Radix UI and are not the unit under test) — BUT do NOT stub `FormField` or the
  mutation when the point of a test is to exercise validation/submission. To
  assert the submit payload, replace the fully-stubbed `use-mutation-feedback`
  mock with one that **captures the call**:
  ```tsx
  const mutateAsync = vi.fn().mockResolvedValue({})
  vi.mock('@/hooks/use-mutation-feedback', () => ({
    useMutationFeedback: ({ mutationFn }: any) => ({
      mutate: (...a: any[]) => mutateAsync(...a),
      mutateAsync, isPending: false, isError: false, error: null,
    }),
  }))
  ```
  (Read the real `record-payment-form.tsx` to see whether it calls `mutate` or
  `mutateAsync` and what argument shape it passes — assert against THAT.)
- Use `@testing-library/user-event` for typing/selecting; assert with
  `screen.getByText` / `getByRole` / `findByText`.
- Read the actual component source for each form before writing tests — confirm
  the real validation rules (min/max amount, required fields) rather than
  assuming. Test the rules the code actually implements. If you believe a
  validation rule is *missing* (e.g. negative amounts allowed), STOP and report
  it as a finding — do not add the validation yourself (this is a tests-only
  plan).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Run all memberry unit tests | `cd apps/memberry && bun run test` | exit 0, all pass |
| Run one test file (from repo root) | `bun test apps/memberry/src/features/dues/components/record-payment-form.test.tsx` | pass |
| Coverage report | `cd apps/memberry && bunx vitest run --coverage` | prints a coverage table; thresholds pass |
| Typecheck | `cd apps/memberry && bun run typecheck` | exit 0 |
| Lint | `cd apps/memberry && bun run lint` | exit 0 |

## Scope

**In scope**:
- `apps/memberry/src/features/dues/components/record-payment-form.test.tsx` (extend)
- `apps/memberry/src/features/dues/components/refund-form.test.tsx` (extend)
- `apps/memberry/vitest.config.ts` (raise thresholds — step 4 only)

**Out of scope** (do NOT modify):
- Any `dues` **source** component — tests only. If validation is missing, report
  it; don't add it here.
- `proof-upload-form.test.tsx` and other dues tests — leave as-is unless
  extending them is trivial; not required.
- The coverage `include`/`exclude` globs — only change the four threshold
  numbers.

## Git workflow

- Branch: `advisor/011-dues-test-depth`.
- Commit the test-deepening separately from the threshold bump, e.g.
  `test(dues): exercise payment/refund validation and submit payload` then
  `test(memberry): raise coverage thresholds to match`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the forms and their current tests

Read `record-payment-form.tsx`, `refund-form.tsx`, and their existing test
files. Note the real submit mechanism (`mutate` vs `mutateAsync`), the payload
shape, required fields, and any amount validation (min/max/decimal).

**Verify**: you can state the exact submit payload shape for each form. (Comprehension gate.)

### Step 2: Deepen `record-payment-form.test.tsx`

Add tests (keep the existing ones):
- **Valid submission**: fill member (via the stubbed combobox), a valid amount,
  a date; submit; assert the capturing `mutateAsync`/`mutate` mock was called
  once with the expected payload (correct `orgId`, amount in the unit the code
  uses — confirm cents vs pesos, member id, date).
- **Invalid amount blocked**: enter an empty/zero/negative amount (whichever the
  code rejects); assert the submit mock is NOT called and the expected
  validation message renders. Test only rules the code actually has.
- **Required-field gating**: with member missing, submit is blocked.

Do NOT stub `FormField` for these new tests if it carries the error display the
test asserts — use the real component (remove that mock or scope it).

**Verify**: `bun test apps/memberry/src/features/dues/components/record-payment-form.test.tsx` (from repo root) → all pass.

### Step 3: Deepen `refund-form.test.tsx`

Apply the same approach to the refund form: a valid refund submits with the
correct payload; a refund amount exceeding the refundable max (if the code
enforces it) is blocked; submit calls the mutation exactly once. Read the
component for the real rules first.

**Verify**: `bun test apps/memberry/src/features/dues/components/refund-form.test.tsx` (from repo root) → all pass.

### Step 4: Raise coverage thresholds

First measure the new baseline:
`cd apps/memberry && bunx vitest run --coverage` and read the summary
percentages. Then in `apps/memberry/vitest.config.ts` raise the four thresholds
to **just under** the new measured numbers (round down to a clean value so CI
has headroom), but do not exceed the measured coverage. Suggested target if the
measured numbers allow: `statements: 35, branches: 33, functions: 30, lines: 35`
— but **never set a threshold above the actual measured coverage**, or CI breaks.
If coverage rose less than that, set each threshold 1–2 points below its measured
value instead.

**Verify**: `cd apps/memberry && bunx vitest run --coverage` → exit 0, no
threshold failure.

### Step 5: Full gate

**Verify**:
- `cd apps/memberry && bun run test` → exit 0.
- `cd apps/memberry && bun run typecheck` → exit 0.
- `cd apps/memberry && bun run lint` → exit 0.

## Test plan

- Extend `record-payment-form.test.tsx`: +3 cases (valid submit payload, invalid
  amount blocked, required-field gating).
- Extend `refund-form.test.tsx`: +2–3 cases (valid refund payload, over-max
  blocked if enforced, single mutation call).
- Pattern: the capturing-mutation approach in "Conventions to follow";
  structurally model after the existing
  `record-payment-form.test.tsx`.
- Verification: `cd apps/memberry && bun run test` → all pass; coverage run
  passes the raised thresholds.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd apps/memberry && bun run test` exits 0 with the new cases present.
- [ ] `cd apps/memberry && bunx vitest run --coverage` exits 0 and the four
      thresholds in `vitest.config.ts` are higher than the prior `29/29/23/29`.
- [ ] At least one test asserts the **submit payload** of `record-payment-form`
      (grep the test for the mutation-capture mock + a payload assertion).
- [ ] `cd apps/memberry && bun run typecheck` exits 0; `bun run lint` exits 0.
- [ ] `git status` shows only the two test files and `vitest.config.ts` changed.
- [ ] `plans/README.md` status row for 011 updated.

## STOP conditions

Stop and report back if:

- A money form **lacks** validation you expected (e.g. accepts negative/zero
  amounts, or a refund above the refundable balance) — report as a correctness
  finding; do NOT add validation in this tests-only plan.
- The measured coverage is *below* the current thresholds (would mean the
  thresholds are already not enforced as written) — report the real numbers.
- The drift check shows the dues forms or `vitest.config.ts` changed since
  `e4bb901a` and the excerpts no longer match.
- A form cannot be submitted in the test environment without large additional
  app context — report what's blocking; land the achievable subset.

## Maintenance notes

- If 009 (surveys tests) also lands, re-measure coverage; you may be able to
  raise thresholds further in a follow-up.
- A reviewer should confirm the new tests assert **payloads and validation
  outcomes**, not just renders — that is the whole point of this plan.
- Keep `Combobox`/`DatePicker` stubbed (they wrap heavy Radix internals); the
  thing under test is the form's validation and submission, not those wrappers.
