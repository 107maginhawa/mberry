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
  // p0-data: E2E tests are page smoke, not behavioral verification
  "BR-01", // Membership Status — E2E doesn't verify transitions
  "BR-03", // Membership Transitions — E2E doesn't verify state machine
  // BR-32 removed: soft-delete explicitly asserted in deletionProcessor.test.ts (Phase 28)
  // BR-33 removed: handler-level tests cover all integrity rules (Phase 27-28)
  // BR-34 removed: handler-level tests + contract cover all eligibility rules (Phase 27-28)
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
