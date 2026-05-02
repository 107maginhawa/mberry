#!/usr/bin/env bun
/**
 * BR Coverage Report
 *
 * Reads br-registry.json, greps test files for [BR-##] tags,
 * and reports coverage status per business rule.
 *
 * Usage:
 *   bun run scripts/br-coverage.ts              # Full report
 *   bun run scripts/br-coverage.ts --module=dues # Scoped to module
 *   bun run scripts/br-coverage.ts --json        # JSON output
 *   bun run scripts/br-coverage.ts --phase=1     # Only Phase 1 BRs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// --- Types ---

interface BrLayer {
  required: boolean;
  paths: string[];
}

interface BrRule {
  id: string;
  title: string;
  phase: number;
  modules: string[];
  priority: string;
  primaryModule: string | null;
  layers: {
    backend: BrLayer;
    contract: BrLayer;
    e2e: BrLayer;
  };
}

interface BrRegistry {
  version: string;
  rules: BrRule[];
}

type CoverageStatus = 'COVERED' | 'PARTIAL' | 'MISSING' | 'SKIPPED';

interface BrCoverage {
  id: string;
  title: string;
  phase: number;
  priority: string;
  status: CoverageStatus;
  backend: number;
  contract: number;
  e2e: number;
  files: string[];
}

// --- Helpers ---

const ROOT = join(import.meta.dir, '..');
const REGISTRY_PATH = join(ROOT, 'docs/ver-3/business/br-registry.json');

function findFiles(dir: string, pattern: RegExp, results: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      findFiles(full, pattern, results);
    } else if (pattern.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

function countBrTags(files: string[], brId: string): { count: number; matchedFiles: string[] } {
  const tag = `[${brId}]`;
  let count = 0;
  const matchedFiles: string[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    // Count occurrences of [BR-##] in describe() or test() names
    const matches = content.split(tag).length - 1;
    if (matches > 0) {
      count += matches;
      matchedFiles.push(relative(ROOT, file));
    }
  }
  return { count, matchedFiles };
}

function classifyFile(filePath: string): 'backend' | 'contract' | 'e2e' | 'other' {
  if (filePath.includes('.hurl')) return 'contract';
  if (filePath.includes('tests/e2e/') || filePath.includes('.spec.ts')) return 'e2e';
  if (filePath.includes('handlers/') || filePath.includes('middleware/') || filePath.includes('test-utils/')) return 'backend';
  return 'other';
}

// --- Main ---

const args = process.argv.slice(2);
const moduleFilter = args.find(a => a.startsWith('--module='))?.split('=')[1];
const phaseFilter = args.find(a => a.startsWith('--phase='))?.split('=')[1];
const jsonOutput = args.includes('--json');

// Read registry
let registry: BrRegistry;
try {
  registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
} catch (err) {
  console.error(`Failed to read BR registry at ${REGISTRY_PATH}`);
  process.exit(2);
}

// Find all test files
const testFiles = [
  ...findFiles(join(ROOT, 'services/api-ts/src'), /\.(test|spec)\.(ts|tsx)$/),
  ...findFiles(join(ROOT, 'apps'), /\.(test|spec)\.(ts|tsx)$/),
  ...findFiles(join(ROOT, 'specs/api/tests'), /\.hurl$/),
  ...findFiles(join(ROOT, 'packages'), /\.(test|spec)\.(ts|tsx)$/),
];

// Determine which phases have built modules (Phase 1 always, Phase 2-3 only if handlers exist)
const builtPhases = new Set([1]);
try {
  readdirSync(join(ROOT, 'services/api-ts/src/handlers/elections'));
  builtPhases.add(2); // elections exist = some Phase 2 work done
} catch { /* not built */ }

// Filter rules
let rules = registry.rules;
if (moduleFilter) {
  rules = rules.filter(r => r.primaryModule === moduleFilter || r.modules.some(m => m.toLowerCase().includes(moduleFilter.toLowerCase())));
}
if (phaseFilter) {
  rules = rules.filter(r => r.phase === parseInt(phaseFilter));
}

// Analyze coverage
const coverages: BrCoverage[] = [];

for (const rule of rules) {
  const { count, matchedFiles } = countBrTags(testFiles, rule.id);

  // Classify matched files by layer
  let backend = 0, contract = 0, e2e = 0;
  for (const f of matchedFiles) {
    const type = classifyFile(f);
    if (type === 'backend') backend++;
    else if (type === 'contract') contract++;
    else if (type === 'e2e') e2e++;
    else backend++; // default to backend
  }

  // Determine status
  let status: CoverageStatus;
  if (!builtPhases.has(rule.phase) && count === 0) {
    status = 'SKIPPED';
  } else if (count === 0) {
    status = 'MISSING';
  } else {
    // Check if all required layers have coverage
    const requiredLayers = Object.entries(rule.layers)
      .filter(([_, layer]) => layer.required)
      .map(([name]) => name);

    const layerCoverage: Record<string, number> = { backend, contract, e2e };
    const allRequiredCovered = requiredLayers.every(l => (layerCoverage[l] || 0) > 0);

    status = allRequiredCovered ? 'COVERED' : 'PARTIAL';
  }

  coverages.push({
    id: rule.id,
    title: rule.title,
    phase: rule.phase,
    priority: rule.priority,
    status,
    backend,
    contract,
    e2e,
    files: matchedFiles,
  });
}

// Output
if (jsonOutput) {
  const summary = {
    total: coverages.length,
    covered: coverages.filter(c => c.status === 'COVERED').length,
    partial: coverages.filter(c => c.status === 'PARTIAL').length,
    missing: coverages.filter(c => c.status === 'MISSING').length,
    skipped: coverages.filter(c => c.status === 'SKIPPED').length,
    rules: coverages,
  };
  console.log(JSON.stringify(summary, null, 2));
} else {
  // Human-readable table
  console.log('');
  console.log('BR Coverage Report');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(
    'ID'.padEnd(8) +
    'Title'.padEnd(35) +
    'Priority'.padEnd(10) +
    'Status'.padEnd(10) +
    'Details'
  );
  console.log('───────────────────────────────────────────────────────────────');

  for (const c of coverages) {
    const details =
      c.status === 'SKIPPED'
        ? `(Phase ${c.phase}, not built)`
        : c.status === 'MISSING'
          ? '← NO TESTS'
          : `backend:${c.backend} contract:${c.contract} e2e:${c.e2e}`;

    const statusColor =
      c.status === 'COVERED' ? '\x1b[32m' :
      c.status === 'PARTIAL' ? '\x1b[33m' :
      c.status === 'MISSING' ? '\x1b[31m' :
      '\x1b[90m';

    console.log(
      c.id.padEnd(8) +
      c.title.substring(0, 33).padEnd(35) +
      c.priority.padEnd(10) +
      `${statusColor}${c.status}\x1b[0m`.padEnd(20) +
      details
    );
  }

  console.log('───────────────────────────────────────────────────────────────');

  const covered = coverages.filter(c => c.status === 'COVERED').length;
  const partial = coverages.filter(c => c.status === 'PARTIAL').length;
  const missing = coverages.filter(c => c.status === 'MISSING').length;
  const skipped = coverages.filter(c => c.status === 'SKIPPED').length;
  const applicable = coverages.length - skipped;
  const pct = applicable > 0 ? Math.round(((covered + partial) / applicable) * 100) : 100;

  console.log(`Total: ${covered} COVERED, ${partial} PARTIAL, ${missing} MISSING, ${skipped} SKIPPED`);
  console.log(`Coverage: ${covered}/${applicable} fully covered (${pct}% at least partial)`);

  // Check P0 missing
  const p0Missing = coverages.filter(c => c.priority === 'P0' && c.status === 'MISSING');
  if (p0Missing.length > 0) {
    console.log('');
    console.log('\x1b[31m⚠ P0 BUSINESS RULES WITHOUT TESTS:\x1b[0m');
    for (const m of p0Missing) {
      console.log(`  ${m.id}: ${m.title}`);
    }
  }

  console.log('');
}

// Exit code: 1 if any P0/P1 BR for built phases is MISSING
const blocking = coverages.filter(
  c => (c.priority === 'P0' || c.priority === 'P1') && c.status === 'MISSING' && builtPhases.has(c.phase)
);
if (blocking.length > 0) {
  process.exit(1);
}
