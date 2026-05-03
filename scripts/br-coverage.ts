#!/usr/bin/env bun
/**
 * BR Coverage Report
 *
 * Reads br-registry.json, verifies listed test files exist,
 * counts coverage by phase and overall, prints a summary table.
 * Exits with code 1 if any Phase 1 BR is UNTESTED.
 *
 * Usage:
 *   bun run scripts/br-coverage.ts
 */

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const REGISTRY_PATH = `${ROOT}/docs/ver-3/business/br-registry.json`;

interface BrEntry {
  rule: string;
  phase: number;
  module: string;
  tests: {
    backend: string[];
    contract: string[];
    e2e: string[];
  };
  coverage: "COMPLETE" | "PARTIAL" | "UNTESTED";
}

type Registry = Record<string, BrEntry>;

// ── Read registry ──────────────────────────────────────────

const file = Bun.file(REGISTRY_PATH);
if (!(await file.exists())) {
  console.error(`Registry not found: ${REGISTRY_PATH}`);
  process.exit(2);
}

const registry: Registry = await file.json();

// ── Verify files & recompute coverage ──────────────────────

const missing: string[] = [];
const phaseStats: Record<number, { total: number; complete: number; partial: number; untested: number }> = {};

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

  // Recompute coverage from actual file lists
  const hasBackend = entry.tests.backend.length > 0;
  const hasContract = entry.tests.contract.length > 0;
  const hasE2e = entry.tests.e2e.length > 0;
  const layers = [hasBackend, hasContract, hasE2e].filter(Boolean).length;

  let actual: BrEntry["coverage"];
  if (layers === 3) actual = "COMPLETE";
  else if (layers >= 1) actual = "PARTIAL";
  else actual = "UNTESTED";

  if (actual !== entry.coverage) {
    console.warn(`  [warn] ${id} registry says ${entry.coverage}, actual is ${actual}`);
  }

  // Accumulate phase stats
  const p = entry.phase;
  if (!phaseStats[p]) phaseStats[p] = { total: 0, complete: 0, partial: 0, untested: 0 };
  phaseStats[p].total++;
  if (actual === "COMPLETE") phaseStats[p].complete++;
  else if (actual === "PARTIAL") phaseStats[p].partial++;
  else phaseStats[p].untested++;
}

// ── Print missing files ────────────────────────────────────

if (missing.length > 0) {
  console.log("");
  console.log("Missing test files:");
  for (const m of missing) {
    console.log(`  ${m}`);
  }
}

// ── Summary table ──────────────────────────────────────────

console.log("");
console.log("BR Coverage Summary");
console.log("=".repeat(70));
console.log(
  "BR".padEnd(8) +
  "Rule".padEnd(36) +
  "Phase".padEnd(7) +
  "B".padEnd(4) +
  "C".padEnd(4) +
  "E".padEnd(4) +
  "Status"
);
console.log("-".repeat(70));

for (const [id, entry] of Object.entries(registry)) {
  const b = entry.tests.backend.length;
  const c = entry.tests.contract.length;
  const e = entry.tests.e2e.length;
  const layers = [b > 0, c > 0, e > 0].filter(Boolean).length;
  const status = layers === 3 ? "COMPLETE" : layers >= 1 ? "PARTIAL" : "UNTESTED";

  console.log(
    id.padEnd(8) +
    entry.rule.substring(0, 34).padEnd(36) +
    String(entry.phase).padEnd(7) +
    String(b).padEnd(4) +
    String(c).padEnd(4) +
    String(e).padEnd(4) +
    status
  );
}

console.log("-".repeat(70));

// ── Phase breakdown ────────────────────────────────────────

console.log("");
console.log("By Phase:");
for (const [phase, stats] of Object.entries(phaseStats).sort()) {
  console.log(
    `  Phase ${phase}: ${stats.total} total, ` +
    `${stats.complete} COMPLETE, ${stats.partial} PARTIAL, ${stats.untested} UNTESTED`
  );
}

const allEntries = Object.values(registry);
const totalComplete = allEntries.filter(e => {
  const layers = [e.tests.backend.length > 0, e.tests.contract.length > 0, e.tests.e2e.length > 0].filter(Boolean).length;
  return layers === 3;
}).length;
const totalPartial = allEntries.filter(e => {
  const layers = [e.tests.backend.length > 0, e.tests.contract.length > 0, e.tests.e2e.length > 0].filter(Boolean).length;
  return layers >= 1 && layers < 3;
}).length;
const totalUntested = allEntries.filter(e => {
  const layers = [e.tests.backend.length > 0, e.tests.contract.length > 0, e.tests.e2e.length > 0].filter(Boolean).length;
  return layers === 0;
}).length;

console.log("");
console.log(`Overall: ${allEntries.length} BRs, ${totalComplete} COMPLETE, ${totalPartial} PARTIAL, ${totalUntested} UNTESTED`);

// ── Gate: exit 1 if any Phase 1 BR is UNTESTED ────────────

const phase1Untested = Object.entries(registry).filter(([_, e]) => {
  if (e.phase !== 1) return false;
  const layers = [e.tests.backend.length > 0, e.tests.contract.length > 0, e.tests.e2e.length > 0].filter(Boolean).length;
  return layers === 0;
});

if (phase1Untested.length > 0) {
  console.log("");
  console.log("FAIL: Phase 1 BRs with no tests:");
  for (const [id, e] of phase1Untested) {
    console.log(`  ${id}: ${e.rule}`);
  }
  process.exit(1);
}

console.log("");
console.log("PASS: All Phase 1 BRs have at least one test.");
