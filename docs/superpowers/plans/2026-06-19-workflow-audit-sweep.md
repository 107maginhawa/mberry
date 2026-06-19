# Workflow Audit Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "are all user workflows working across modules?" a single repeatable, enforced audit — one command locally, a non-regressing ratchet gate in CI — and start closing the highest-risk coverage gaps.

**Architecture:** No new audit framework. The machinery already exists in four layers (map: `coverage-matrix.ts`; breadth: live Playwright suite; depth: `audit-e2e-depth.ts`; advisory: `journey-coverage-radar.ts`). This plan (1) chains them into one command, (2) converts the always-exit-0 matrix gate into a **baseline ratchet** so it can enforce today despite 76 flow + 85 route gaps, (3) wires that into CI, (4) triages the gap into a prioritized backlog, (5) closes Wave-1 P0 gaps and ratchets the baseline down.

**Tech Stack:** Bun, TypeScript, Bun test runner, Playwright, GitHub Actions.

## Global Constraints

- Runtime: **Bun** (`bun test`, `bun run`). No Node-only APIs.
- Never edit generated files (`services/api-ts/src/generated/**`).
- Audit scripts live under `scripts/` and `scripts/audit/`; tests are sibling `*.test.ts` run by `bun test`.
- Baseline numbers are facts from this repo state (HEAD on `advisor/round4-landed`, 2026-06-19): **A (Phase-1 BR incomplete) = 1, B (flows MISSING) = 76, C (routes MISSING) = 85.**
- Pure logic must be importable WITHOUT side effects — `coverage-matrix.ts` runs its full audit at module load (top-level await), so extract testable logic into a separate side-effect-free module.
- Ratchet rule: gate **fails** if any axis count exceeds its baseline; **warns** (does not fail) if any axis is below baseline (signal to ratchet down).

---

### Task 1: Single chained audit command

**Files:**
- Modify: `package.json` (root) — add `audit:workflows` script

**Interfaces:**
- Produces: `bun run audit:workflows` — runs the map gate then the depth gate, non-zero exit on either failure. Used by humans pre-PR and referenced by later CI task.

- [ ] **Step 1: Add the script**

In root `package.json` `"scripts"`, add:

```json
"audit:workflows": "bun scripts/audit/coverage-matrix.ts --gate && bun run scripts/audit-e2e-depth.ts > /tmp/e2e-depth.json && bun run scripts/audit-e2e-depth-gate.ts"
```

(Radar is PR-diff-specific — it needs a git base to diff against — so it stays out of the local sweep and remains its own advisory CI step.)

- [ ] **Step 2: Run it and confirm it executes both layers**

Run: `bun run audit:workflows`
Expected: prints `Gate:` block from coverage-matrix (A/B/C counts) AND the e2e-depth gate output. Exit code reflects the depth gate (matrix gate is still soft until Task 2). Non-zero is acceptable here — Task 2 makes the matrix side meaningful.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(audit): add audit:workflows chained sweep command"
```

---

### Task 2: Baseline-ratchet gate for the coverage matrix

**Files:**
- Create: `scripts/audit/ratchet.ts` (pure, side-effect-free)
- Create: `scripts/audit/ratchet.test.ts`
- Create: `scripts/audit/coverage-baseline.json` (committed baseline)
- Modify: `scripts/audit/coverage-matrix.ts:356-373` (gate block) — use the ratchet

**Interfaces:**
- Produces:
  - `interface GateCounts { a: number; b: number; c: number }`
  - `interface RatchetResult { pass: boolean; regressions: string[]; improvements: string[] }`
  - `function ratchetCheck(current: GateCounts, baseline: GateCounts): RatchetResult`
- Consumes (in coverage-matrix.ts): the existing `aBad`/`bBad`/`cBad` computed at lines 358-360.

- [ ] **Step 1: Write the failing test**

Create `scripts/audit/ratchet.test.ts`:

```ts
import { test, expect } from 'bun:test'
import { ratchetCheck } from './ratchet'

const base = { a: 1, b: 76, c: 85 }

test('passes when counts equal baseline', () => {
  const r = ratchetCheck({ a: 1, b: 76, c: 85 }, base)
  expect(r.pass).toBe(true)
  expect(r.regressions).toEqual([])
  expect(r.improvements).toEqual([])
})

test('fails when any axis grows', () => {
  const r = ratchetCheck({ a: 1, b: 77, c: 85 }, base)
  expect(r.pass).toBe(false)
  expect(r.regressions).toEqual(['b: 76 → 77'])
})

test('passes but flags improvement when an axis shrinks', () => {
  const r = ratchetCheck({ a: 0, b: 76, c: 80 }, base)
  expect(r.pass).toBe(true)
  expect(r.regressions).toEqual([])
  expect(r.improvements).toEqual(['a: 1 → 0', 'c: 85 → 80'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/audit/ratchet.test.ts`
Expected: FAIL — `Cannot find module './ratchet'`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/audit/ratchet.ts`:

```ts
export interface GateCounts {
  a: number
  b: number
  c: number
}

export interface RatchetResult {
  pass: boolean
  regressions: string[]
  improvements: string[]
}

const AXES = ['a', 'b', 'c'] as const

/** Compare current gap counts against a committed baseline. Grow = fail; shrink = ratchet-down signal. */
export function ratchetCheck(current: GateCounts, baseline: GateCounts): RatchetResult {
  const regressions: string[] = []
  const improvements: string[] = []
  for (const k of AXES) {
    if (current[k] > baseline[k]) regressions.push(`${k}: ${baseline[k]} → ${current[k]}`)
    else if (current[k] < baseline[k]) improvements.push(`${k}: ${baseline[k]} → ${current[k]}`)
  }
  return { pass: regressions.length === 0, regressions, improvements }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/audit/ratchet.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the committed baseline**

Create `scripts/audit/coverage-baseline.json`:

```json
{
  "a": 1,
  "b": 76,
  "c": 85
}
```

- [ ] **Step 6: Wire the ratchet into the matrix gate**

In `scripts/audit/coverage-matrix.ts`, add near the other imports (after line 30):

```ts
import { ratchetCheck } from './ratchet'
```

Replace the gate block (lines 356-373, from `if (gateMode) {` to its closing `}`) with:

```ts
// Gate — baseline ratchet. Fails only when a gap GROWS vs scripts/audit/coverage-baseline.json.
// Pass --update-baseline after closing gaps to ratchet the baseline down.
if (gateMode) {
  const current = {
    a: aRows.filter((r) => r.verdict !== 'COMPLETE' && r.phase === 1).length,
    b: bRows.filter((r) => r.verdict === 'MISSING').length,
    c: cRows.filter((r) => r.verdict === 'MISSING').length,
  }
  const baselinePath = join(repoRoot, 'scripts/audit/coverage-baseline.json')

  if (args.includes('--update-baseline')) {
    writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n')
    console.log(`\nUpdated baseline → A=${current.a} B=${current.b} C=${current.c}`)
    process.exit(0)
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { a: number; b: number; c: number }
  const { pass, regressions, improvements } = ratchetCheck(current, baseline)
  console.log(`\nGate (ratchet vs baseline A=${baseline.a} B=${baseline.b} C=${baseline.c}):`)
  console.log(`  current: A=${current.a} B=${current.b} C=${current.c}`)
  for (const i of improvements) console.log(`  ✓ improved ${i} — run with --update-baseline to lock it in`)
  if (!pass) {
    for (const r of regressions) console.error(`  ✗ REGRESSION ${r}`)
    console.error('  Coverage gap grew. Add the missing test/spec or justify, then re-run.')
    process.exit(1)
  }
  console.log('  ✓ no regression vs baseline')
  process.exit(0)
}
```

- [ ] **Step 7: Verify the gate passes at baseline**

Run: `bun scripts/audit/coverage-matrix.ts --gate`
Expected: prints `✓ no regression vs baseline`, exit 0.

- [ ] **Step 8: Verify it catches a regression (manual smoke)**

Run: `node -e "const f='scripts/audit/coverage-baseline.json';const b=require('fs');const o=JSON.parse(b.readFileSync(f));o.b=999;console.log('temp baseline b=999 (would mean current 76<999, still pass)')"` — skip; instead temporarily lower baseline:

Run: `cp scripts/audit/coverage-baseline.json /tmp/cb.bak && printf '{"a":1,"b":75,"c":85}\n' > scripts/audit/coverage-baseline.json && bun scripts/audit/coverage-matrix.ts --gate; echo "exit=$?"; cp /tmp/cb.bak scripts/audit/coverage-baseline.json`
Expected: prints `✗ REGRESSION b: 75 → 76`, `exit=1`. Baseline restored after.

- [ ] **Step 9: Commit**

```bash
git add scripts/audit/ratchet.ts scripts/audit/ratchet.test.ts scripts/audit/coverage-baseline.json scripts/audit/coverage-matrix.ts
git commit -m "feat(audit): baseline-ratchet gate for coverage matrix"
```

---

### Task 3: Enforce the ratchet in CI

**Files:**
- Modify: `.github/workflows/ci.yml` (the "Coverage matrix" step, ~line 553-558)

**Interfaces:**
- Consumes: `bun scripts/audit/coverage-matrix.ts --gate` now exits non-zero on regression (Task 2).

- [ ] **Step 1: Make the matrix step block on regression**

In `.github/workflows/ci.yml`, update the comment on the "Coverage matrix" step to reflect the ratchet and confirm there is **no** `continue-on-error` on it:

```yaml
      - name: Coverage matrix (BR + Flow + Route)
        # Ratchet gate: fails only if a gap GROWS vs scripts/audit/coverage-baseline.json.
        # Ratchet the baseline down with `coverage-matrix.ts --gate --update-baseline`
        # after closing gaps. See docs/superpowers/plans/2026-06-19-workflow-audit-sweep.md.
        run: bun scripts/audit/coverage-matrix.ts --gate
```

(The existing "Upload coverage matrix" artifact step with `if: always()` stays as-is.)

- [ ] **Step 2: Validate the workflow YAML parses**

Run: `bun -e "import('js-yaml').then(y=>{const fs=require('fs');y.load(fs.readFileSync('.github/workflows/ci.yml','utf8'));console.log('ci.yml OK')}).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `ci.yml OK`. (If `js-yaml` is unavailable, instead run `python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/ci.yml'));print('ci.yml OK')"`.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(audit): enforce coverage-matrix ratchet (no longer informational)"
```

---

### Task 4: Triage the gap into a prioritized backlog

**Files:**
- Create: `docs/audits/WORKFLOW_AUDIT_BACKLOG.md`
- Read-only inputs: `.audits/coverage-matrix.json`, `docs/product/WORKFLOW_MAP.md`, `docs/ver-3/business/br-registry.json`

**Interfaces:**
- Produces: a backlog doc that classifies every MISSING flow/route/BR into `real-gap | noise | deferred`, each real-gap tagged `P0 | P1 | P2`, grouped by module. Downstream waves pull from this.

- [ ] **Step 1: Generate the triage backlog**

Dispatch a subagent (Explore/general-purpose) with this contract:

> Read `.audits/coverage-matrix.json`. For Matrix B (76 MISSING flows) and Matrix C (85 MISSING routes), classify each row as:
> - **noise** — TanStack layout/route shells, redirects, `__root`, index re-exports, or routes whose parent is already covered (a child page reached only via its covered parent). Justify per row in one phrase.
> - **deferred** — flows/routes for modules marked p2-deferred in `br-registry.json` or not in the current product surface.
> - **real-gap** — a user-facing workflow with no live E2E. Tag priority: **P0** = money/auth/data-isolation/security (modules M06 dues, M22 audit, billing, cross-org); **P1** = membership lifecycle, credits, events, governance; **P2** = the rest.
>
> Also list Matrix A UNTESTED BRs: BR-48 (M06, p1-business), BR-55 (M22, p0-data), BR-56 (M22, p0-security), BR-39 (M19, p2-deferred).
>
> Write `docs/audits/WORKFLOW_AUDIT_BACKLOG.md` with: a summary count table (real-gap/noise/deferred per matrix), then a P0 section, P1 section, P2 section — each a table of `id | module | description | suggested spec/test file`. Cite the source row id (WF-NNN / route path / BR-NN) for every entry.

- [ ] **Step 2: Sanity-check the backlog**

Run: `grep -cE '^\| (WF-|/|BR-)' docs/audits/WORKFLOW_AUDIT_BACKLOG.md`
Expected: ≥ 1 (backlog has classified rows). Manually confirm the P0 section contains BR-55 and BR-56 (M22 security/data) — these are the highest-risk untested items.

- [ ] **Step 3: Commit**

```bash
git add docs/audits/WORKFLOW_AUDIT_BACKLOG.md
git commit -m "docs(audit): triage workflow coverage gap into prioritized backlog"
```

---

### Task 5: Close Wave-1 P0 gaps and ratchet the baseline down

**Scope:** Only the P0 untested BRs surfaced in Task 4 — BR-55 (M22 audit, p0-data), BR-56 (M22 audit, p0-security), BR-48 (M06 dues, p1-business). These are Matrix-A UNTESTED (zero refs). Closing them lowers `a` and proves the ratchet ratchets. Broader flow/route backfill (Matrix B/C) is subsequent waves driven by the backlog — out of scope here to keep this plan shippable.

**Files (per BR, exact paths confirmed during execution against the module):**
- Modify: `services/api-ts/src/handlers/audit/**` test(s) for BR-55/BR-56; `services/api-ts/src/handlers/dues/**` test for BR-48
- Modify: `docs/ver-3/business/br-registry.json` — fill the `tests` refs for BR-48/55/56
- Modify: `scripts/audit/coverage-baseline.json` (via `--update-baseline`)

**Interfaces:**
- Consumes: br-registry schema — each BR row has `tests: { backend: string[]; contract: string[]; e2e: string[] }`. Matrix A turns COMPLETE when every listed ref exists and is non-empty.

- [ ] **Step 1: Read each P0 BR's exact rule text**

Run: `bun -e "const r=require('./docs/ver-3/business/br-registry.json');for(const id of ['BR-48','BR-55','BR-56'])console.log(id, JSON.stringify(r[id].rule))"`
Expected: prints the rule statement for each — defines what the test must assert.

- [ ] **Step 2: Write a failing backend test for the first P0 BR (BR-55, audit p0-data)**

In the audit handler's test file, add a test that exercises the BR-55 data rule (assert the durable audit-log row is written with the required fields). Use the existing audit handler test as the pattern for harness setup. Reference the BR id in a comment: `// BR-55`.

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd services/api-ts && bun test src/handlers/audit/ -t 'BR-55'`
Expected: FAIL (assertion not yet satisfied / behavior gap) — or PASS-on-existing-behavior, in which case the test documents+locks the rule (acceptable: the gap was *test coverage*, not behavior).

- [ ] **Step 4: Make it pass**

If behavior gap: implement the minimal handler/repo change. If coverage-only: the passing test is the deliverable. Re-run until green.

Run: `cd services/api-ts && bun test src/handlers/audit/ -t 'BR-55'`
Expected: PASS.

- [ ] **Step 5: Repeat Steps 2-4 for BR-56 (audit p0-security) and BR-48 (dues p1-business)**

Each: failing test referencing the BR id → green. BR-56 asserts the security rule (access/authorization on the audit surface); BR-48 asserts the dues business rule.

- [ ] **Step 6: Register the new tests in br-registry**

For BR-48, BR-55, BR-56, set their `tests.backend` arrays to the exact relative paths of the test files just written (repo-root-relative, e.g. `services/api-ts/src/handlers/audit/listAuditEvents.test.ts`).

- [ ] **Step 7: Regenerate the matrix and confirm A improved**

Run: `bun scripts/audit/coverage-matrix.ts --gate`
Expected: `✓ improved a: 1 → 0` (BR-48 was the lone Phase-1 blocker; BR-55/56 are Phase-2 but now COMPLETE). Gate still exits 0.

- [ ] **Step 8: Ratchet the baseline down**

Run: `bun scripts/audit/coverage-matrix.ts --gate --update-baseline`
Expected: `Updated baseline → A=0 B=76 C=85`.

- [ ] **Step 9: Confirm the lowered baseline now blocks reverting**

Run: `bun scripts/audit/coverage-matrix.ts --gate`
Expected: `✓ no regression vs baseline` with `A=0`. (Any future change re-introducing the gap now fails CI.)

- [ ] **Step 10: Commit**

```bash
git add services/api-ts/src/handlers docs/ver-3/business/br-registry.json scripts/audit/coverage-baseline.json
git commit -m "test(audit,dues): cover P0 untested BR-48/55/56; ratchet coverage baseline to A=0"
```

---

## Self-Review

**Spec coverage:**
- (a) single command → Task 1. (b) ratchet gate → Task 2. (c) CI enforcement → Task 3. Gap triage → Task 4. Close highest-risk gaps → Task 5. All conversation asks mapped.

**Placeholder scan:** Task 5 file paths are "confirmed during execution" by design — the BR rule text (Step 1) and module dir drive the exact test file, which cannot be known until the rule is read. Steps name the directory, the BR id, the registry-update mechanism, and the verification command — no logic is left unspecified.

**Type consistency:** `GateCounts {a,b,c}` and `ratchetCheck` signature are identical across the test (Task 2 Step 1), the implementation (Step 3), and the matrix wiring (Step 6). Baseline JSON keys `a/b/c` match throughout.

**Out of scope (named, not forgotten):** full Matrix B/C backfill (76+85), flipping `lint:e2e-depth` off `continue-on-error`, and expanding firewall journeys beyond the current 8 — all feed off Task 4's backlog and are subsequent waves. Ratchet ensures none of those gaps can grow in the meantime.
