# Continuation prompt — CONTINUE-53 (fix the 2 real bugs surfaced by e2e triage)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-53-prompt.md`.
(context-mode knowledge base + git history persist across /clear.)

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode active.

---

## Where we are (CONTINUE-51 done, PR #8 merged)

PR #8 merged to `main` (`cddfb1bc`). Announcement empty-org 500 fixed. e2e was triaged on a
**fresh DB**: 259/721 fail, but the bulk is **test-harness debt** (failures scale with run
length — auth/session/state degrade over a 25-46 min run; every feature passes in isolation;
clean DB == polluted DB). That harness work is **out of scope here** — it's a separate effort
(make e2e a real gate: per-test auth refresh + seed isolation + sharding).

This prompt is **only** the small tail of GENUINE bugs the triage surfaced. Scope tight. Do not
start the e2e-infra project.

## THE TASK — fix 2 real bugs (TDD where you touch code)

### Bug 1 — nested `<a>` hydration error on the officer dashboard (CONFIRMED app bug)
Browser console during e2e: `In HTML, <a> cannot be a descendant of <a>. This will cause a
hydration error.` under `<OfficerDashboard>` → `<ModuleSummaryCard>`.

Root cause: `apps/memberry/src/features/admin/components/dashboard/module-summary-card.tsx`
wraps the whole card in an outer `<Link to={href}>` (~L34) AND renders an inner
`<Link to={secondaryAction.href}>` (~L50) for `secondaryAction`. Inner anchor nested inside the
outer anchor = invalid HTML. The inner `onClick={e => e.stopPropagation()}` doesn't fix the
nesting.

Fix options (pick the cleanest for the design):
- Don't wrap the entire card in `<Link>`; make the card a non-anchor container with an explicit
  primary link/button, so the secondary action is a sibling, not a descendant. OR
- Render `secondaryAction` as a `<button>` that calls `navigate(secondaryAction.href)` instead of
  a nested `<Link>`. OR
- Use a single clickable card + a visually-separate secondary control outside the outer anchor.
Verify: officer dashboard renders with no `<a> cannot be a descendant of <a>` console error.
Check every consumer of `ModuleSummaryCard` (`officer-dashboard.tsx` + any others) still works.

### Bug 2 — officer/communications spec failures (triage app-vs-test, fix the real side)
`apps/memberry/tests/e2e/officer/communications.spec.ts` fails these EVEN IN ISOLATION
(so not the run-length harness issue — they're legit):
- `:55` "status badges show readable text, not raw enum"
- `:72` "create draft, view detail, then publish"
- `:135` "detail page shows metadata and back link" (`getByText(/Back to Communications/i)` not found)

NOTE: `"Back to Communications"` text DOES exist in source
(`apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/communications/$announcementId.tsx`),
so `:135` is likely the detail page not rendering in the test's scenario (or a selector/markup
mismatch) — determine which. For each: boot the stack, open the exact page the test drives,
compare what renders vs what the test asserts, then fix the REAL side (app bug → fix component;
stale selector/assertion → fix the test). No fake-green; don't delete the test to pass.

Repro (servers must be fresh; do NOT run heavy commands during a Playwright run):
```
cd services/api-ts && bun dev            # 7213; migrations auto-run; then `bun run db:seed`
cd apps/memberry && bun dev              # 3004
cd apps/memberry && bunx playwright test tests/e2e/officer/communications.spec.ts \
  --workers=1 --max-failures=100 --reporter=line
```
Tip: a fresh throwaway DB avoids the polluted dev `monobase`:
`DATABASE_URL=...localhost:5432/<freshdb> bun dev` + seed (create the DB first).

### Ground rules (unchanged)
- TDD where you change a handler; frontend bugs — verify in a real browser (boot + navigate),
  not just selectors. **no fake-green.** Migrations hand-written, next **0073**, do NOT
  `db:generate`. Never edit `generated/**` except migrations.
- Preserve the dirty tree; **no destructive git**. Branch `aha/continue-49-subscription-billing`
  is merged but kept — commit fixes there (or a fresh branch off `main`, your call). Pre-commit
  hook passes WITHOUT `--no-verify`. End commits with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do NOT push to `main` directly; open
  a PR.
- `check:sdk-compat` exits 1 BY DESIGN. `db:generate` exits 127 in Quality Gates (benign).

### Definition of done
- Bug 1: no nested-anchor hydration error on officer dashboard; all `ModuleSummaryCard` consumers
  render + both primary/secondary actions navigate correctly. Verified in a browser.
- Bug 2: `:55/:72/:135` pass for the RIGHT reason (real fix, verified by re-running the spec
  isolated on a fresh DB). If any turns out to be a stale-selector test bug, fix the test.
- Commit atomically, open a PR, STOP before merge.

### NOT in scope (do not start)
- The e2e harness/isolation/sharding project (separate; the 259 run-length failures).
- Triaging member/journeys/states specs.
