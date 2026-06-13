export const meta = {
  name: 'aha-autorun',
  description: 'Autonomously run the decision-free AHA 04 remediation passes — isolated fresh context per pass, independently adversarially verified, hard-stop at product decisions / failures / bypassed work',
  whenToUse: 'Clear the decision-free AHA Track-A + carry-forward backlog without per-pass babysitting. Halts (does not skip) at any product-decision-gated item, failure, or unresolved must-fix.',
  phases: [
    { title: 'Plan' },
    { title: 'Execute' },
    { title: 'Verify' },
  ],
}

// ───────────────────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────────────────
const ROOT = '/Users/elad-mini/Desktop/memberry'
const RULES = `${ROOT}/docs/aha/prompts/00-aha-shared-rules.md`
const P04 = `${ROOT}/docs/aha/prompts/04-module-or-group-fix-tdd.md`
const FP = (slug) => `${ROOT}/docs/aha/module-fix-plans/${slug}-fix-ready-plan.md`
const FR = (slug) => `${ROOT}/docs/aha/module-fix-plans/${slug}-fix-report.md`
const GP = (slug) => `${ROOT}/docs/aha/module-gap-plans/${slug}-gap-plan.md`

// Items that REQUIRE a human/product decision — executors must STOP (BLOCKED),
// never guess. Surfaced in the final summary as the Track-B agenda.
const PRODUCT_DECISIONS = [
  'Training: paid-training V1 scope + M06 path (G5)',
  'Training: canonical 45-vs-60 required-credits default literal',
  'Training: manual-entry pending-counting policy (does pending count toward totals?)',
  'Training: completeCustomTraining / self-complete existence + program-complete bulk-award semantics',
  'Training: fractional CPD units (integer→numeric migration, F4)',
  'Dues: gateway-refund-API call V1 (Q-PD6)',
  'Dues: partial-refund expiry-reversal direction (Q-PD2)',
  'Dues: token expiry 72h-vs-30d + consume-on-confirm (Q-PD1)',
  'Dues: PayMongo V1 (Q-PD5)',
  'Dues: first-invoice funnel + Pay-Now CTA (Q-PD7/Q-PD8)',
  'Auth/RBAC: officerAuthMiddleware dead-triplet — delete vs amend',
]

// Ordered, decision-free pass registry. The array order IS the dependency order
// (sequential execution — no working-tree races). `requiresLiveStack` passes need
// API+app booted (E2E/browser); skip them with args.skipLiveStack for an
// unattended backend-only run.
const PASSES = [
  {
    id: 'training-E',
    module: 'Training & Credits',
    slug: 'training-credits',
    batch: 'Batch E subset — FIX-014 (real E2E proof + cross-org RBAC)',
    requiresLiveStack: true,
    fixes: ['FIX-014 (E2E proof of P0 attendance→credit journey)', 'FIX-014 (cross-org compliance RBAC test)'],
    scope: [
      'PRIMARY: replace the FAKE-GREEN apps/memberry/tests/e2e/officer/training-completion.spec.ts (and strengthen member/training-completion-flow.spec.ts) with a REAL journey: officer checks in a named member -> that member /my/credits shows a persisted AUTO CreditEntry (correct member + source/type + the training creditAmount) -> survives reload. Add a negative control so the spec cannot fake-green.',
      'SECONDARY (backend, bun test only): officer of org A is 403 on org B compliance — extend getCreditCompliance.test.ts / getComplianceReport.test.ts. If it reveals a real MISSING guard, document as a finding + recommended follow-up; do NOT add a new tenant guard (out of test-only subset).',
      'See docs/aha/outputs/CONTINUE-22-prompt.md for the full prescriptive scope.',
    ],
    doNotTouch: ['source/handlers/schema/TypeSpec/generated** (FIX-014 is TEST-ONLY)', 'no migration, no regen'],
    deferNote: 'DEFER the cross-path cycle-consistency (FIX-004/G2) and void/pending-exclusion (FIX-005/G3) regression nets to the training Batch B pass — they presuppose unshipped fixes; writing them now is fake-RED.',
  },
  {
    id: 'training-B',
    module: 'Training & Credits',
    slug: 'training-credits',
    batch: 'Batch B — FIX-004 cycle authority, FIX-005 void/pending aggregates, FIX-006 one required-credits source',
    requiresLiveStack: false,
    fixes: ['FIX-004', 'FIX-005', 'FIX-006', 'the deferred cycle-consistency + void-exclusion regression nets from FIX-014'],
    scope: [
      'Implement single cycle authority (resolveCycle over org_cpd_config) across the 3 write paths; void/pending-aware aggregate filters at the repo + verify the compliance_standings matview filters status; collapse required-credits to org_cpd_config server-side and strip client-supplied transcript params.',
      'NOW land the deferred cycle-consistency + void-exclusion regression tests against the real fixed behavior.',
    ],
    doNotTouch: ['do NOT relocate credits schema/repo (P1-11 split)', 'hand-wired transcript routes in app.ts — edit with care, confirm middleware order'],
    productDecisionStops: [
      'The 45-vs-60 required-credits DEFAULT LITERAL value (do the plumbing — resolve-from-config — but if forced to seed a specific default literal, STOP/flag, do not invent).',
      'Manual-entry PENDING-counting policy for the FIX-005 aggregate filter (does verificationStatus=pending count?). If the filter choice forces this policy, STOP/flag.',
    ],
  },
  {
    id: 'training-C',
    module: 'Training & Credits',
    slug: 'training-credits',
    batch: 'Batch C — FIX-007 persist training.type, FIX-008 lock creditAmount after first award',
    requiresLiveStack: false,
    fixes: ['FIX-007 (training.type column + persist + real search filter)', 'FIX-008 (M9-R2 credit-value lock)'],
    scope: [
      'Add the training.type column (DB migration) + persist on create + make the search filter real. Lock creditAmount/status against mutation once any AUTO credit exists.',
      'This pass DOES run a DB migration + TypeSpec regen: edit schema + training.tsp, then cd specs/api && bun run build && cd ../../services/api-ts && bun run generate. NEVER hand-edit generated/**. Restart API after regen if serving.',
    ],
    doNotTouch: ['NOT the fractional-credits numeric migration (F4 — product-decision gated)'],
    productDecisionStops: ['Fractional CPD units (F4) — defer.'],
  },
  {
    id: 'training-D',
    module: 'Training & Credits',
    slug: 'training-credits',
    batch: 'Batch D — FIX-009 toggle, FIX-010 dup-enroll guard, FIX-011 /my/training predicate, FIX-012 CSV export, FIX-013 createTraining org-strip',
    requiresLiveStack: false,
    fixes: ['FIX-009', 'FIX-010', 'FIX-011', 'FIX-012', 'FIX-013'],
    scope: [
      'Enforce creditTracking toggle at award path; add unique/partial index + pre-check on (trainingId, personId) [small migration]; fix /my/training earned-credit predicate (completed not enrolled); client-side CSV export from standings; bind createTraining to ctx org (strip body.organizationId).',
    ],
    doNotTouch: [],
    productDecisionStops: [],
  },
  {
    id: 'dues-settle-seam',
    module: 'Dues & Payments',
    slug: 'dues-payments',
    batch: 'Settle-seam pass — FIX-007 over-refund cap + eligibility, FIX-010 confirmPaymentProof atomicity, + the updateDuesConfig/deleteDuesConfig cross-org tenant guard surfaced in Batch B',
    requiresLiveStack: false,
    fixes: ['FIX-007 (over-refund cap + wire validateRefundEligibility — NOT the gateway-API call)', 'FIX-010 (confirmPaymentProof in a db.transaction)', 'updateDuesConfig/deleteDuesConfig cross-org tenant guard'],
    scope: [
      'Cap refunds at remaining and wire the refund-eligibility util; wrap confirmPaymentProof settle+status+invoice in one db.transaction (mirror recordDuesPayment). Add the cross-org tenant guard to updateDuesConfig + deleteDuesConfig (mirror confirmPaymentProof: existing.organizationId !== ctx.organizationId -> Forbidden).',
      'CROSS-MODULE RISK: refund/confirm settle into membership-lifecycle — tests MUST assert membership-status side effects. Do not double-fix the domain-event-consumer expiry path.',
    ],
    doNotTouch: ['the gateway-refund-API call (Q-PD6 product decision + billing dependency)'],
    productDecisionStops: [
      'Gateway-refund-API call for V1 (Q-PD6).',
      'Whether partial refunds reverse membership expiry (Q-PD2) — the allocation-sum-invariant rounding part may proceed, but the EXPIRY-reversal direction is gated.',
    ],
  },
  {
    id: 'realtime-DM-ui',
    module: 'Realtime Comms',
    slug: 'realtime-comms',
    batch: 'FIX-006 — DM creation UI (decision-free frontend)',
    requiresLiveStack: true,
    fixes: ['FIX-006 (DM creation UI)'],
    scope: ['Build the decision-free DM creation UI per the realtime-comms fix-ready plan FIX-006 row. Verify the flow in a real browser (create DM -> message sends/receives over the WS the prior pass wired).'],
    doNotTouch: ['PD-1/2/3 gated realtime items'],
    productDecisionStops: ['Any realtime PD-1/2/3 gated behavior.'],
  },
  {
    id: 'jobs-B',
    module: 'Jobs',
    slug: 'jobs',
    batch: 'Batch B — handler-org-trust hardening',
    requiresLiveStack: false,
    fixes: ['createJobPosting body-org trust', 'searchJobPostings org-scope default'],
    scope: ['Per the jobs fix-ready plan Batch B: stop trusting body.organizationId in createJobPosting (bind to ctx org); make searchJobPostings org-scoped by default. Test-first RBAC/scoping.'],
    doNotTouch: [],
    productDecisionStops: [],
  },
  {
    id: 'notifications-webhook',
    module: 'Notifications & Email',
    slug: 'notifications-email',
    batch: 'stripe-webhook silent-fail — organizationId on createNotification',
    requiresLiveStack: false,
    fixes: ['handleStripeWebhook omits organizationId on 5 createNotification calls'],
    scope: ['handlers/billing/handleStripeWebhook.ts omits organizationId on 5 createNotification calls -> notifications silently drop. Thread the organizationId through. CROSS-MODULE RISK (billing<->notifs) — assert the notification is created with the org. Test-first.'],
    doNotTouch: [],
    productDecisionStops: [],
  },
  {
    id: 'auth-officer-triplet',
    module: 'Auth/RBAC',
    slug: 'auth-rbac',
    batch: 'officerAuthMiddleware dead-triplet — delete vs amend',
    requiresLiveStack: false,
    fixes: ['officerAuthMiddleware dead-triplet decision'],
    scope: ['Investigate the dead officerAuthMiddleware triplet. This requires a DELETE-vs-AMEND decision. Do NOT delete code on a guess: investigate consumers + intent, and if the safe action is ambiguous, return BLOCKED with a recommendation for human sign-off.'],
    doNotTouch: ['do not delete code without certainty'],
    productDecisionStops: ['Delete vs amend the dead triplet (needs human sign-off if ambiguous).'],
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Schemas
// ───────────────────────────────────────────────────────────────────────────
const PASS_RESULT = {
  type: 'object',
  additionalProperties: false,
  required: ['passId', 'completion', 'fixes', 'productDecisionHit', 'reportAppended', 'summary'],
  properties: {
    passId: { type: 'string' },
    completion: { type: 'string', enum: ['COMPLETE', 'PARTIALLY_COMPLETE', 'BLOCKED', 'FAILED'] },
    fixes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fixId', 'status', 'reason'],
        properties: {
          fixId: { type: 'string' },
          status: { type: 'string', enum: ['Fixed', 'PartiallyFixed', 'Deferred', 'Blocked', 'OutOfScope'] },
          reason: { type: 'string' },
        },
      },
    },
    testsRun: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['cmd', 'result'],
        properties: { cmd: { type: 'string' }, result: { type: 'string' } },
      },
    },
    productDecisionHit: { type: 'boolean' },
    blockers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item', 'why'],
        properties: { item: { type: 'string' }, why: { type: 'string' } },
      },
    },
    reportAppended: { type: 'boolean' },
    reportPath: { type: 'string' },
    summary: { type: 'string' },
  },
}

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  required: ['passId', 'verdict', 'bypassedInScopeFix', 'fakeGreenRisk', 'findings'],
  properties: {
    passId: { type: 'string' },
    verdict: { type: 'string', enum: ['SOLID', 'ISSUES'] },
    // The two teeth that enforce "don't bypass needed tasks" + "stay effective":
    bypassedInScopeFix: { type: 'boolean' }, // an in-scope fix marked not-done WITHOUT a real product/env blocker
    fakeGreenRisk: { type: 'boolean' },      // tests assert render/no-throw only, or would pass with the fix reverted
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lens', 'severity', 'title', 'detail', 'file', 'mustFix'],
        properties: {
          lens: { type: 'string', enum: ['correctness', 'scope', 'test-integrity'] },
          severity: { type: 'string', enum: ['must-fix', 'should-fix', 'nit'] },
          title: { type: 'string' },
          detail: { type: 'string' },
          file: { type: 'string' },
          mustFix: { type: 'boolean' },
        },
      },
    },
  },
}

// ───────────────────────────────────────────────────────────────────────────
// Prompt builders
// ───────────────────────────────────────────────────────────────────────────
function executePrompt(p, isFixRound, mustFix) {
  const fixesBlock = p.fixes.map((f) => `  - ${f}`).join('\n')
  const scopeBlock = p.scope.map((s) => `  - ${s}`).join('\n')
  const dnt = (p.doNotTouch || []).map((s) => `  - ${s}`).join('\n') || '  - (none beyond the standard out-of-scope rules)'
  const pdStops = (p.productDecisionStops || []).map((s) => `  - ${s}`).join('\n') || '  - (none specific to this pass)'
  const fixRound = isFixRound
    ? `\n\nThis is a FIX ROUND. A prior adversarial verifier found these MUST-FIX issues — resolve every one, re-run the relevant tests, and update the fix report:\n${(mustFix || []).map((m) => `  - [${m.lens}] ${m.title}: ${m.detail} (${m.file})`).join('\n')}\n`
    : ''
  return `You are executing ONE AHA "04" remediation pass IN ISOLATION on the live working tree at ${ROOT}. Work to full quality — this is real money/compliance code.

PASS: ${p.module} — ${p.batch} (id: ${p.id})

MANDATORY PROTOCOL:
1. Read and strictly follow ${RULES} then ${P04}.
2. Use the fix-ready plan as the PRIMARY guide: ${FP(p.slug)} (gap plan as context: ${GP(p.slug)}).
3. APPEND your results to the existing fix report ${FR(p.slug)} — create a clearly-delimited new section; do NOT rewrite prior sections.
4. TEST-DRIVEN, NO EXCEPTIONS: write/flip the failing test FIRST, watch it fail for the right reason, then minimal GREEN. NO fake-green, NO weakened assertions, NO asserting render/no-throw only. Prove REAL persisted behavior (rows, status, side-effects), reload/re-read to prove persistence where relevant.
5. Check git working tree first. The tree is intentionally dirty from prior AHA passes — PRESERVE it. FORBIDDEN: git reset --hard, checkout ., clean -fd, restore ., rm -rf. Touch ONLY files needed for THIS pass's fixes. Do NOT commit.

FIXES IN SCOPE (do every one, or mark it Blocked/OutOfScope with a REAL reason):
${fixesBlock}

SCOPE / APPROACH:
${scopeBlock}
${p.deferNote ? `\nDEFER (out of this pass, on purpose): ${p.deferNote}\n` : ''}
DO NOT TOUCH:
${dnt}

HARD STOP — PRODUCT-DECISION GATES (if a fix genuinely requires one of these, mark that fix Blocked, set productDecisionHit=true, and STOP that fix — never guess money/compliance semantics):
${pdStops}
Also STOP (BLOCKED) if a fix needs a DB migration you cannot safely generate/apply in-env, or a shared/cross-module change too broad for this pass.

VALIDATION before you finish: run the focused new tests, the module test suite, and record full \`bun test\` vs the baseline (~6205 pass / 1 fail = pre-existing registerEmailJobs / 4 todo — do NOT attribute that to this pass), plus \`bun run --filter '*' typecheck\` (expect 5/5).${p.requiresLiveStack ? ' This pass needs a LIVE stack: boot the API (cd services/api-ts && bun dev, port 7213) and memberry (cd apps/memberry && bun dev, port 3004); Playwright is pinned 1.58.2 — DO NOT bump it. If the stack genuinely cannot boot, set completion=BLOCKED with a [BLOCKED BY ENVIRONMENT] blocker — do NOT fake-green the E2E.' : ''}${fixRound}

Return the structured PASS_RESULT honestly. completion=COMPLETE only if every in-scope fix is Fixed AND validation passed. Use BLOCKED if a product-decision/env/shared blocker stopped a needed fix. Use FAILED if something broke and you could not reach green. List EVERY in-scope fix in \`fixes\` with its true status — do not omit a fix you skipped.`
}

function verifyPrompt(p, execResult) {
  return `You are an INDEPENDENT adversarial verifier for a just-completed AHA "04" pass. You did NOT write this code. Try hard to find REAL defects — do not rubber-stamp, do not invent nitpicks. Read the actual diff and files at ${ROOT}.

PASS: ${p.module} — ${p.batch} (id: ${p.id})
Fix-ready plan: ${FP(p.slug)}   Fix report (appended section): ${FR(p.slug)}

The executor reported: completion=${execResult.completion}, productDecisionHit=${execResult.productDecisionHit}.
Fixes it claims: ${execResult.fixes.map((f) => `${f.fixId}=${f.status}`).join(', ')}.

Inspect via: cd ${ROOT} && git status --porcelain && git diff (this pass's files only — prior-pass dirty files are NOT this pass's responsibility). Read the changed source + tests + the appended fix-report section.

Check THREE lenses:
- CORRECTNESS: does each claimed-Fixed fix actually achieve its goal? Trace the real code path (auth/org resolution, persistence, side-effects). Find concrete holes with file:line evidence.
- SCOPE: did the pass touch ONLY in-scope files? Did it expand beyond the listed fixes, perform an out-of-scope refactor, or run a migration/regen it shouldn't? (Distinguish prior-pass dirty files — those are NOT this pass's.)
- TEST-INTEGRITY: are the tests honest? Set fakeGreenRisk=true if any test asserts only render/no-throw, would pass with the fix reverted, or lacks a real persisted-data/negative assertion. Verify RED→GREEN was genuine.

CRITICAL TEETH:
- Set bypassedInScopeFix=true if ANY in-scope fix was marked Deferred/OutOfScope/PartiallyFixed WITHOUT a genuine product-decision/env/shared blocker (i.e. a needed task was silently skipped).
- A finding is mustFix=true only if it is a real correctness hole, a scope violation, a fake-green test, or a bypassed in-scope fix.

Return the structured VERDICT.`
}

// ───────────────────────────────────────────────────────────────────────────
// Orchestration
// ───────────────────────────────────────────────────────────────────────────
phase('Plan')
const opts = (typeof args === 'object' && args) || {}

// SAFETY INTERLOCK (2026-06-12 incident): a subagent ran `git checkout HEAD -- .`
// + `git reset --hard HEAD && git stash drop` on the SHARED working tree, reverting
// tracked work. Prompt prohibitions are NOT enforcement. Until each pass runs under
// real isolation (worktree + merge-back) or a git pre-exec guard, this orchestrator
// must NOT touch the live tree unattended. Pass { armed: true } only after that fix.
if (!opts.dryRun && !opts.armed) {
  return {
    refused: true,
    reason: 'SAFETY INTERLOCK: live-tree autorun disabled after the 2026-06-12 git-revert incident. Subagents can run destructive git in the shared tree. Fix required before re-arming: per-pass worktree isolation (isolation:"worktree") with explicit merge-back, OR a git pre-exec guard that blocks reset/checkout/clean/restore. Use { dryRun: true } to preview. Re-run with { armed: true } ONLY after the isolation fix lands.',
    recovery: 'Pre-incident tree preserved at tag recovery-2025-incident (git checkout recovery-2025-incident -- .).',
  }
}

const startIdx = opts.startFrom ? PASSES.findIndex((p) => p.id === opts.startFrom) : 0
const planned = PASSES
  .slice(startIdx < 0 ? 0 : startIdx)
  .filter((p) => !opts.only || opts.only.includes(p.id))
  .filter((p) => !(opts.skipLiveStack && p.requiresLiveStack))

log(`AHA autorun: ${planned.length} decision-free pass(es) queued${opts.skipLiveStack ? ' (live-stack passes skipped)' : ''}: ${planned.map((p) => p.id).join(' -> ')}`)
const skippedLive = (opts.skipLiveStack ? PASSES.filter((p) => p.requiresLiveStack).map((p) => p.id) : [])

if (opts.dryRun) {
  return {
    mode: 'dry-run',
    planned: planned.map((p) => ({ id: p.id, module: p.module, batch: p.batch, requiresLiveStack: !!p.requiresLiveStack })),
    skippedLiveStack: skippedLive,
    productDecisionAgenda: PRODUCT_DECISIONS,
    note: 'No agents spawned. Re-run without dryRun to execute. Recommended first run: { skipLiveStack: true } for the backend-only chain, then run live-stack passes interactively.',
  }
}

const done = []
const flagged = [] // product-decision / env items surfaced by passes that still completed their decision-free work
let halted = null

for (const p of planned) {
  // Execute (isolated fresh context, full tool access, real working tree)
  phase('Execute')
  const exec = await agent(executePrompt(p, false), { label: `exec:${p.id}`, phase: 'Execute', schema: PASS_RESULT })

  if (!exec) { halted = { passId: p.id, reason: 'executor returned null (died/skipped)' }; break }
  if (exec.completion === 'FAILED') { halted = { passId: p.id, reason: 'pass FAILED', exec }; break }
  // A WHOLLY blocked pass halts the chain (its in-scope work could not be done).
  // A pass that did its decision-free work but FLAGGED a product-decision sub-item
  // (PARTIALLY_COMPLETE + productDecisionHit) does NOT halt — record the flag and
  // proceed; the verifier's bypassedInScopeFix tooth catches any work silently skipped.
  if (exec.completion === 'BLOCKED') { halted = { passId: p.id, reason: 'pass BLOCKED — in-scope work could not be completed', exec }; break }
  if (exec.productDecisionHit || (exec.blockers && exec.blockers.length)) {
    flagged.push({ passId: p.id, blockers: exec.blockers || [] })
  }

  // Independent adversarial verification (read-only Explore agent)
  phase('Verify')
  let verdict = await agent(verifyPrompt(p, exec), { label: `verify:${p.id}`, phase: 'Verify', schema: VERDICT, agentType: 'Explore' })

  let mustFix = verdict ? verdict.findings.filter((f) => f.mustFix) : []
  let bypassed = verdict ? verdict.bypassedInScopeFix : false
  let fakeGreen = verdict ? verdict.fakeGreenRisk : false

  // One fix round if the verifier found real problems
  if (mustFix.length || bypassed || fakeGreen) {
    log(`${p.id}: verifier found ${mustFix.length} must-fix${bypassed ? ' + bypassed-in-scope-fix' : ''}${fakeGreen ? ' + fake-green-risk' : ''} — one fix round`)
    phase('Execute')
    const fixed = await agent(executePrompt(p, true, mustFix), { label: `fix:${p.id}`, phase: 'Execute', schema: PASS_RESULT })
    if (!fixed || fixed.completion === 'FAILED' || fixed.completion === 'BLOCKED' || fixed.productDecisionHit) {
      halted = { passId: p.id, reason: 'fix round did not resolve / hit a gate', exec, fixed }
      break
    }
    phase('Verify')
    verdict = await agent(verifyPrompt(p, fixed), { label: `reverify:${p.id}`, phase: 'Verify', schema: VERDICT, agentType: 'Explore' })
    mustFix = verdict ? verdict.findings.filter((f) => f.mustFix) : []
    bypassed = verdict ? verdict.bypassedInScopeFix : false
    fakeGreen = verdict ? verdict.fakeGreenRisk : false
    if (mustFix.length || bypassed || fakeGreen) {
      // HALT — do not proceed to the next pass on unresolved must-fix / bypass / fake-green.
      halted = { passId: p.id, reason: 'unresolved must-fix / bypassed-in-scope-fix / fake-green after fix round', verdict }
      break
    }
  }

  done.push({ id: p.id, module: p.module, batch: p.batch, completion: exec.completion, report: FR(p.slug), verdict: verdict ? verdict.verdict : 'unverified' })
  log(`${p.id}: DONE (${exec.completion}, verified ${verdict ? verdict.verdict : 'n/a'})`)
}

return {
  mode: 'run',
  completed: done,
  flaggedForDecision: flagged, // passes that completed their decision-free work but surfaced a product-decision sub-item
  halted, // null if the full queue finished; otherwise where + why it stopped (NOT skipped)
  skippedLiveStack: skippedLive,
  remainingProductDecisions: PRODUCT_DECISIONS,
  next: halted
    ? `HALTED at "${halted.passId}" (${halted.reason}). Resolve it (likely a product decision — see remainingProductDecisions), then re-run with { startFrom: "${halted.passId}" }.`
    : 'All queued decision-free passes complete + verified. Next: resolve the Track-B product-decision agenda, run the now-unblocked gated batches, then Track C (re-run 07-consolidate-roadmap + milestone ship/PR).',
}
