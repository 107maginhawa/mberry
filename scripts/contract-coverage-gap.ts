/**
 * Contract Coverage Gap Analyzer
 *
 * Compares OpenAPI endpoints against existing Hurl contract tests.
 * Outputs:
 *   docs/quality/CONTRACT_COVERAGE.json  — machine-readable baseline
 *
 * Usage:
 *   bun run scripts/contract-coverage-gap.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

// ── 1. Load OpenAPI spec ─────────────────────────────────────────────────────

const spec = JSON.parse(readFileSync('specs/api/dist/openapi/openapi.json', 'utf8'));
const endpoints: { method: string; path: string; tag: string; operationId: string }[] = [];

for (const [pth, methods] of Object.entries(spec.paths as Record<string, any>)) {
  for (const [method, op] of Object.entries(methods as Record<string, any>)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    endpoints.push({
      method: method.toUpperCase(),
      path: pth,
      tag: (op as any)?.tags?.[0] ?? 'untagged',
      operationId: (op as any)?.operationId ?? `${method} ${pth}`,
    });
  }
}

// ── 2. Collect covered paths from Hurl files ─────────────────────────────────

function walk(d: string): string[] {
  const out: string[] = [];
  try { statSync(d); } catch { return out; }
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.hurl')) out.push(p);
  }
  return out;
}

const covered = new Set<string>();
const hurlFiles = walk('specs/api/tests/contract');

for (const f of hurlFiles) {
  const src = readFileSync(f, 'utf8');
  // Match lines like: GET {{api}}/some/path or POST https://host/some/path
  for (const m of src.matchAll(/^(GET|POST|PUT|PATCH|DELETE)\s+([^\s\n]+)/gm)) {
    let p = m[2]
      .replace(/\{\{api\}\}/, '')           // strip {{api}} variable
      .replace(/^https?:\/\/[^/]+/, '')      // strip absolute host
      .split('?')[0]                          // strip query string
      .replace(/\/$/, '');                   // strip trailing slash
    if (p === '') p = '/';
    covered.add(`${m[1]} ${p}`);
  }
}

// ── 3. Match spec endpoints against covered set ───────────────────────────────

function pathMatches(specPath: string, hurlPath: string): boolean {
  // Normalise trailing slash
  const sp = specPath.replace(/\/$/, '') || '/';
  const hp = hurlPath.replace(/\/$/, '') || '/';
  if (sp === hp) return true;

  const specParts = sp.split('/');
  const hurlParts = hp.split('/');
  if (specParts.length !== hurlParts.length) return false;

  return specParts.every((seg, i) =>
    (seg.startsWith('{') && seg.endsWith('}')) || seg === hurlParts[i]
  );
}

const uncovered: typeof endpoints = [];

for (const ep of endpoints) {
  const normPath = ep.path.replace(/\/$/, '') || '/';
  const key = `${ep.method} ${normPath}`;
  if (covered.has(key)) continue;

  // Template-based match
  let found = false;
  for (const c of covered) {
    const spaceIdx = c.indexOf(' ');
    const m = c.slice(0, spaceIdx);
    const p = c.slice(spaceIdx + 1);
    if (m === ep.method && pathMatches(ep.path, p)) { found = true; break; }
  }
  if (!found) uncovered.push(ep);
}

// ── 4. Aggregate by tag ───────────────────────────────────────────────────────

const byTag: Record<string, number> = {};
for (const e of uncovered) {
  byTag[e.tag] = (byTag[e.tag] ?? 0) + 1;
}

// Total endpoints per tag (for coverage % per tag)
const totalByTag: Record<string, number> = {};
for (const e of endpoints) {
  totalByTag[e.tag] = (totalByTag[e.tag] ?? 0) + 1;
}

const tagStats = Object.entries(byTag)
  .sort((a, b) => b[1] - a[1])
  .map(([tag, uncoveredCount]) => ({
    tag,
    uncoveredCount,
    totalCount: totalByTag[tag] ?? 0,
    coveredCount: (totalByTag[tag] ?? 0) - uncoveredCount,
    coveragePercent: Math.round(((totalByTag[tag] - uncoveredCount) / totalByTag[tag]) * 100),
  }));

// ── 5. Write output ───────────────────────────────────────────────────────────

mkdirSync('docs/quality', { recursive: true });

const result = {
  generatedAt: new Date().toISOString(),
  totals: {
    endpoints: endpoints.length,
    hurlFiles: hurlFiles.length,
    coveredCount: endpoints.length - uncovered.length,
    uncoveredCount: uncovered.length,
    coveragePercent: Math.round(((endpoints.length - uncovered.length) / endpoints.length) * 100),
  },
  uncoveredByTag: tagStats,
  uncoveredEndpoints: uncovered,
};

writeFileSync('docs/quality/CONTRACT_COVERAGE.json', JSON.stringify(result, null, 2));

// ── 6. Console summary ────────────────────────────────────────────────────────

console.log(`\nContract Coverage Baseline`);
console.log(`==========================`);
console.log(`OpenAPI endpoints : ${result.totals.endpoints}`);
console.log(`Hurl files        : ${result.totals.hurlFiles}`);
console.log(`Covered           : ${result.totals.coveredCount}`);
console.log(`Uncovered         : ${result.totals.uncoveredCount}`);
console.log(`Coverage          : ${result.totals.coveragePercent}%`);
console.log(`Target            : 60%`);
console.log(`\nTop 10 uncovered by tag:`);
for (const t of result.uncoveredByTag.slice(0, 10)) {
  console.log(`  ${t.tag.padEnd(30)} uncovered=${t.uncoveredCount}/${t.totalCount}  (${t.coveragePercent}% covered)`);
}
console.log(`\nWrote: docs/quality/CONTRACT_COVERAGE.json`);
