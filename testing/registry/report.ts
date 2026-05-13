/**
 * Registry coverage report — run via `bun run test:registry`
 * Reads BR data from br-registry.json (single source of truth),
 * derives coverage per rule class, prints stats.
 * Exit code 0 = info only.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { flowRegistry, getFlowStats } from './flow-registry'

const ROOT = resolve(import.meta.dir, "../..");
const REGISTRY_PATH = resolve(ROOT, "docs/ver-3/business/br-registry.json");

type RuleClass = "p0-security" | "p0-data" | "p0-auth" | "p1-business" | "p2-deferred";

interface BrEntry {
  rule: string;
  phase: number;
  module: string;
  ruleClass: RuleClass;
  tests: { backend: string[]; contract: string[]; e2e: string[] };
  annotations?: string;
  deferredReason?: string;
}

type Registry = Record<string, BrEntry>;

function deriveStatus(entry: BrEntry): "covered" | "partial" | "deferred" | "untested" {
  if (entry.ruleClass === "p2-deferred") {
    return entry.tests.backend.length > 0 ? "deferred" : "untested";
  }

  const hasBackend = entry.tests.backend.length > 0;
  const hasContract = entry.tests.contract.length > 0;
  const hasE2e = entry.tests.e2e.length > 0;

  if (!hasBackend) return "untested";

  switch (entry.ruleClass) {
    case "p0-security":
      return hasContract ? "covered" : "partial";
    case "p0-data":
    case "p0-auth":
      return (hasContract && hasE2e) ? "covered" : "partial";
    case "p1-business":
      return (hasContract || hasE2e) ? "covered" : "partial";
    default:
      return "partial";
  }
}

// ── Load BR registry from JSON ──
let registry: Registry;
try {
  registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
} catch (e) {
  console.error(`Failed to read BR registry: ${REGISTRY_PATH}`);
  process.exit(2);
}

const entries = Object.entries(registry);
const total = entries.length;
const nonDeferred = entries.filter(([_, e]) => e.ruleClass !== "p2-deferred");
const covered = nonDeferred.filter(([_, e]) => deriveStatus(e) === "covered").length;
const partial = nonDeferred.filter(([_, e]) => deriveStatus(e) === "partial").length;
const untested = nonDeferred.filter(([_, e]) => deriveStatus(e) === "untested").length;
const deferred = entries.filter(([_, e]) => e.ruleClass === "p2-deferred").length;
const coveragePercent = nonDeferred.length > 0 ? Math.round((covered / nonDeferred.length) * 100) : 0;

const p0Untested = entries
  .filter(([_, e]) => e.ruleClass.startsWith("p0-") && deriveStatus(e) === "untested")
  .map(([id, e]) => ({ id, name: e.rule, module: e.module }));

console.log('\n=== BR Registry Coverage ===')
console.log(`Total: ${total} | Covered: ${covered} | Partial: ${partial} | Untested: ${untested} | Deferred: ${deferred}`)
console.log(`Coverage (non-deferred): ${coveragePercent}%`)

if (p0Untested.length > 0) {
  console.log(`\nP0 BRs without tests (${p0Untested.length}):`)
  for (const item of p0Untested) {
    console.log(`  ${item.id}: ${item.name} [${item.module}]`)
  }
}

const flow = getFlowStats()

console.log('\n=== Flow Registry Coverage ===')
console.log(`Total: ${flow.total} | Covered: ${flow.covered} | Partial: ${flow.partial} | Untested: ${flow.untested}`)
console.log(`Coverage: ${flow.coveragePercent}%`)

const untestedFlows = flowRegistry.filter(f => f.status === 'untested')
if (untestedFlows.length > 0) {
  console.log(`\nUntested flows (${untestedFlows.length}):`)
  for (const f of untestedFlows) {
    console.log(`  ${f.id}: ${f.name} [${f.modules.join(' -> ')}]`)
  }
}

console.log('\n=== Summary ===')
console.log(`BR: ${coveragePercent}% | Flows: ${flow.coveragePercent}% | Combined: ${Math.round(((covered + flow.covered) / (nonDeferred.length + flow.total)) * 100)}%`)
console.log('')
