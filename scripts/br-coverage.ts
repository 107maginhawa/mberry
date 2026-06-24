#!/usr/bin/env bun
/**
 * BR Coverage Report — Rule-Class-Based
 *
 * Reads br-registry.json with ruleClass field, derives coverage status
 * per rule class (not naive layer counting), verifies test files exist,
 * and prints a summary table.
 *
 * Flags:
 *   --ci    Exit 1 if any non-allowlisted BR regresses (regression gate)
 *   --json  Machine-readable JSON output for downstream scripts
 *
 * Usage:
 *   bun run scripts/br-coverage.ts
 *   bun run scripts/br-coverage.ts --ci
 *   bun run scripts/br-coverage.ts --json
 */

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const REGISTRY_PATH = `${ROOT}/docs/ver-3/business/br-registry.json`;

const args = new Set(process.argv.slice(2));
const ciMode = args.has("--ci");
const jsonMode = args.has("--json");

// ── Types ─────────────────────────────────────────────────

type RuleClass = "p0-security" | "p0-data" | "p0-auth" | "p1-business" | "p2-deferred";
type DerivedStatus = "COMPLETE" | "INCOMPLETE" | "STUB" | "DEFERRED" | "UNTESTED";

interface BrEntry {
  rule: string;
  phase: number;
  module: string;
  ruleClass: RuleClass;
  tests: {
    backend: string[];
    contract: string[];
    e2e: string[];
  };
  notes?: string;
  annotations?: string;
  deferredReason?: string;
}

type Registry = Record<string, BrEntry>;

// ── Known-incomplete allowlist (shrinks as gaps are filled) ──
// These BRs are known to not meet their rule-class requirements.
// CI gate passes if only these are incomplete. Adding a new incomplete
// BR without adding it here will fail CI (regression detection).
const KNOWN_INCOMPLETE: Set<string> = new Set([
  // All cleared in v1.3.0 Phase 31:
  // BR-01 removed: membership-actions.spec.ts verifies suspend→status change (behavioral, not smoke)
  // BR-03 removed: membership-actions.spec.ts verifies status-appropriate actions per state
  // BR-32 removed: soft-delete explicitly asserted in deletionProcessor.test.ts (Phase 28)
  // BR-33 removed: handler-level tests cover all integrity rules (Phase 27-28)
  // BR-34 removed: handler-level tests + contract cover all eligibility rules (Phase 27-28)

  // Wave G8 audit (2026-05-30) — three BRs carry documented `deferredReason`
  // in br-registry.json explaining why contract/E2E layers cannot exist for
  // them. Backend assertions are the correct (and only feasible) coverage
  // layer. Allowlisted so the gate respects the registry's deferral rationale.
  "BR-47", // Banned Users: Better-Auth ban is admin-internal, no public-API
           // wire to exercise; backend integration in middleware/auth.test.ts
           // + E2E in auth.spec.ts cover the rule.
  // R4-5 (2026-06-23): BR-48 REMOVED from the registry — it was the only
  // UNTESTED BR, describing a `bulkRecordPayments` batch-size limit for a handler
  // that does NOT exist anywhere in services/api-ts (no handler, no route, no
  // MAX_BATCH_SIZE constant, no boundary tests despite the stale annotation
  // claiming them). UNTESTED since inception with nothing to wire or cover.
  // Removed per the wire-or-remove decision; mint a fresh BR if bulk dues-payment
  // recording is ever built.
  "BR-51", // Service Token Timing-Safe Comparison: cryptographic property of
           // the comparator, not observable at the wire layer. Backend test
           // in middleware/auth.test.ts asserts crypto.timingSafeEqual is the
           // primitive and that near-miss tokens reject identically.
  "BR-42", // Training Type Restricted to Platform-Defined Types: enforced at
           // request-validation layer via Zod enum on
           // TrainingCreateRequestSchema. Backend test in
           // createTraining.test.ts exercises every valid type + unknown +
           // missing. Contract/E2E would only re-test the Zod enum reach
           // (always 400 VALIDATION_ERROR) — no additional coverage gained.

  // M22 email module BRs minted 2026-06-02 to resolve TR-P1-003.
  // All annotations explicitly state "Test coverage to be backfilled in a
  // follow-up audit pass" — they were registered without test mappings
  // and have remained UNTESTED since. Pre-existing INCOMPLETE state
  // unrelated to the mega-module decomposition; allowlisted until the
  // dedicated M22 coverage pass lands.
  // R2-1 (2026-06-23): BR-56 REMOVED — the bounce/complaint webhook is now wired
  // (POST /webhooks/postmark) with a contract test, so BR-56 (p0-security) is
  // COMPLETE. BR-55 stays here: its trigger is wired + contract-tested too, but
  // p0-data also wants an e2e, which is N/A for a provider webhook (no UI flow).
  // R4-2 (2026-06-23): BR-53/54 REMOVED — email-extended-flow.hurl now
  // contract-covers them (BR-53 draft-template→404 enqueue guard; BR-54
  // cancelled→retry 409 transition guard). BR-52/57 stay (async send-pipeline:
  // suppression-at-send + transactional override are worker behavior, not
  // wire-observable; backend-covered). BR-58 stays (template-var validation
  // needs the variables-schema). BR-59 stays (p0-data, audit-trail e2e N/A).
  "BR-52", "BR-55", "BR-57", "BR-58", "BR-59",

  // M21 billing module BRs minted 2026-06-02 to resolve TR-P1-002.
  // Backend tests EXIST per the registry; missing contract+e2e layers
  // make these INCOMPLETE. M21 contract/e2e suite is a planned milestone
  // pass — allowlisted until that pass ships.
  // R2-2 (2026-06-23): BR-62 REMOVED — Stripe webhook signature rejection is
  // now contract-tested (billing-webhook-signature.hurl), so the p0-security
  // rule is COMPLETE.
  // R2-3 (2026-06-23): BR-65 REMOVED — gateway-key encryption-at-rest +
  // never-returned is now contract-tested (assoc-dues-gateway-flow.hurl) + real-PG
  // (gateway-config-encryption.integration.test.ts), so the p0-security rule is COMPLETE.
  "BR-60", "BR-61", "BR-63", "BR-64", "BR-66",

  // M20 booking module BRs minted 2026-06-02 to resolve TR-P1-001.
  // Same situation as M21: backend tests exist, contract+e2e planned
  // for a dedicated M20 coverage pass.
  // R4-1 (2026-06-23): BR-75/76/77 REMOVED — booking config validation now
  // contract-tested (booking-validation.hurl: bad date-order/range → 400);
  // BR-75 also fixed a 500→400 leak. BR-70/71/74 stay (advance-notice/lead-time/
  // buffer are booking-time / slot-generation enforcement, not create-config).
  "BR-68", "BR-69", "BR-70", "BR-71", "BR-72", "BR-73", "BR-74",

  // ── Lean launch (T3, 2026-06-24) ──────────────────────────
  // The memberry/admin frontend apps were deleted (lean-launch cleanup; full
  // platform preserved in /desktop/memberry-full). Every BR below declared its
  // E2E layer as a spec under apps/memberry|apps/admin — those files are gone, so
  // the p0-data/p0-auth "needs e2e" requirement can no longer be met. Their
  // BACKEND + CONTRACT layers are UNCHANGED (api-ts is untouched and still gated by
  // the unit-tests + contract CI jobs), so each rule is still tested where it
  // matters. Allowlisted (not deleted) until T9 re-authors lean E2E journeys
  // against apps/org + apps/member + apps/console and ratchets these back out.
  "BR-01", "BR-03", "BR-06", "BR-07", "BR-08", "BR-09", "BR-10", "BR-21",
  "BR-24", "BR-25", "BR-26", "BR-32", "BR-36", "BR-41", "BR-43", "BR-44",
  "BR-45", "BR-46", "BR-49", "BR-50", "BR-67",
]);

// ── Coverage derivation ──────────────────────────────────

function deriveStatus(id: string, entry: BrEntry): DerivedStatus {
  if (entry.ruleClass === "p2-deferred") {
    return entry.tests.backend.length > 0 ? "DEFERRED" : "UNTESTED";
  }

  const hasBackend = entry.tests.backend.length > 0;
  const hasContract = entry.tests.contract.length > 0;
  const hasE2e = entry.tests.e2e.length > 0;

  if (!hasBackend) return "UNTESTED";

  switch (entry.ruleClass) {
    case "p0-security":
      // Requires backend + contract
      return hasContract ? "COMPLETE" : "INCOMPLETE";

    case "p0-data":
    case "p0-auth":
      // Requires backend + contract + e2e
      return (hasContract && hasE2e) ? "COMPLETE" : "INCOMPLETE";

    case "p1-business":
      // Requires backend + (contract OR e2e)
      return (hasContract || hasE2e) ? "COMPLETE" : "INCOMPLETE";

    default:
      return "INCOMPLETE";
  }
}

// ── Stub detection for contract tests ─────────────────────

async function isStubContract(filePath: string): Promise<boolean> {
  const full = `${ROOT}/${filePath}`;
  try {
    const content = await Bun.file(full).text();
    const lines = content.split("\n").filter(l => l.trim().length > 0);
    // Stub = under 10 non-empty lines OR only status-code assertions
    if (lines.length < 10) return true;
    const assertionLines = lines.filter(l => /^HTTP\s|status\s|jsonpath/.test(l.trim()));
    const statusOnlyAssertions = assertionLines.every(l => /^HTTP\s\d{3}$/.test(l.trim()));
    return assertionLines.length > 0 && statusOnlyAssertions;
  } catch {
    return false;
  }
}

// ── Read registry ─────────────────────────────────────────

const file = Bun.file(REGISTRY_PATH);
if (!(await file.exists())) {
  console.error(`Registry not found: ${REGISTRY_PATH}`);
  process.exit(2);
}

const registry: Registry = await file.json();

// ── Verify files & derive coverage ────────────────────────

const missing: string[] = [];
const stubContracts: string[] = [];
const phaseStats: Record<number, { total: number; complete: number; incomplete: number; deferred: number; untested: number }> = {};

interface BrResult {
  id: string;
  rule: string;
  phase: number;
  ruleClass: RuleClass;
  backend: number;
  contract: number;
  e2e: number;
  status: DerivedStatus;
  annotations?: string;
  hasStubContract: boolean;
}

const results: BrResult[] = [];

for (const [id, entry] of Object.entries(registry)) {
  // Verify each listed test file exists
  for (const layer of ["backend", "contract", "e2e"] as const) {
    for (const path of entry.tests[layer]) {
      const full = `${ROOT}/${path}`;
      const exists = await Bun.file(full).exists();
      if (!exists) {
        missing.push(`${id} ${layer}: ${path}`);
      }
    }
  }

  // Check for stub contracts
  let hasStubContract = false;
  for (const path of entry.tests.contract) {
    if (await isStubContract(path)) {
      hasStubContract = true;
      stubContracts.push(`${id}: ${path}`);
    }
  }

  const status = deriveStatus(id, entry);

  // Accumulate phase stats
  const p = entry.phase;
  if (!phaseStats[p]) phaseStats[p] = { total: 0, complete: 0, incomplete: 0, deferred: 0, untested: 0 };
  phaseStats[p].total++;
  if (status === "COMPLETE") phaseStats[p].complete++;
  else if (status === "INCOMPLETE" || status === "STUB") phaseStats[p].incomplete++;
  else if (status === "DEFERRED") phaseStats[p].deferred++;
  else phaseStats[p].untested++;

  results.push({
    id,
    rule: entry.rule,
    phase: entry.phase,
    ruleClass: entry.ruleClass,
    backend: entry.tests.backend.length,
    contract: entry.tests.contract.length,
    e2e: entry.tests.e2e.length,
    status,
    annotations: entry.annotations,
    hasStubContract,
  });
}

// ── JSON output ───────────────────────────────────────────

if (jsonMode) {
  const output = {
    results,
    missing,
    stubContracts,
    phaseStats,
    knownIncomplete: [...KNOWN_INCOMPLETE],
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

// ── Print missing files ───────────────────────────────────

if (missing.length > 0) {
  console.log("");
  console.log("Missing test files:");
  for (const m of missing) {
    console.log(`  ${m}`);
  }
}

// ── Print stub contracts ──────────────────────────────────

if (stubContracts.length > 0) {
  console.log("");
  console.log("Stub contract tests (status-code-only assertions):");
  for (const s of stubContracts) {
    console.log(`  ${s}`);
  }
}

// ── Summary table ─────────────────────────────────────────

console.log("");
console.log("BR Coverage Summary (rule-class-based)");
console.log("=".repeat(85));
console.log(
  "BR".padEnd(8) +
  "Rule".padEnd(34) +
  "Class".padEnd(14) +
  "B".padEnd(4) +
  "C".padEnd(4) +
  "E".padEnd(4) +
  "Status"
);
console.log("-".repeat(85));

for (const r of results) {
  console.log(
    r.id.padEnd(8) +
    r.rule.substring(0, 32).padEnd(34) +
    r.ruleClass.padEnd(14) +
    String(r.backend).padEnd(4) +
    String(r.contract).padEnd(4) +
    String(r.e2e).padEnd(4) +
    r.status
  );
}

console.log("-".repeat(85));

// ── Phase breakdown ───────────────────────────────────────

console.log("");
console.log("By Phase:");
for (const [phase, stats] of Object.entries(phaseStats).sort()) {
  console.log(
    `  Phase ${phase}: ${stats.total} total, ` +
    `${stats.complete} COMPLETE, ${stats.incomplete} INCOMPLETE, ` +
    `${stats.deferred} DEFERRED, ${stats.untested} UNTESTED`
  );
}

const totalComplete = results.filter(r => r.status === "COMPLETE").length;
const totalIncomplete = results.filter(r => r.status === "INCOMPLETE" || r.status === "STUB").length;
const totalDeferred = results.filter(r => r.status === "DEFERRED").length;
const totalUntested = results.filter(r => r.status === "UNTESTED").length;

console.log("");
console.log(
  `Overall: ${results.length} BRs, ${totalComplete} COMPLETE, ` +
  `${totalIncomplete} INCOMPLETE, ${totalDeferred} DEFERRED, ${totalUntested} UNTESTED`
);

// ── CI Gate ───────────────────────────────────────────────

if (ciMode) {
  // Fail on missing files in non-deferred BRs
  const criticalMissing = missing.filter(m => {
    const brId = m.split(" ")[0];
    const entry = registry[brId];
    return entry && entry.ruleClass !== "p2-deferred";
  });

  if (criticalMissing.length > 0) {
    console.log("");
    console.log("::error::Missing test files for non-deferred BRs:");
    for (const m of criticalMissing) {
      console.log(`::error::  ${m}`);
    }
    process.exit(1);
  }

  // Fail on regressions: incomplete BRs not in allowlist
  const regressions = results.filter(r =>
    (r.status === "INCOMPLETE" || r.status === "STUB" || r.status === "UNTESTED") &&
    r.ruleClass !== "p2-deferred" &&
    !KNOWN_INCOMPLETE.has(r.id)
  );

  if (regressions.length > 0) {
    console.log("");
    console.log("::error::Coverage regressions detected (not in allowlist):");
    for (const r of regressions) {
      console.log(`::error::  ${r.id}: ${r.rule} [${r.ruleClass}] = ${r.status}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log(`PASS: No coverage regressions. ${KNOWN_INCOMPLETE.size} known-incomplete BRs in allowlist.`);
  process.exit(0);
}

console.log("");
console.log("PASS: Coverage report complete.");
