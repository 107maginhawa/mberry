import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

type Verdict = 'real-flow' | 'selector-only' | 'unknown';

export interface ClausePresence {
  /** Marked with `// @journey-firewall` — a must-never-break journey. */
  journey: boolean;
  /** Clause 1 — error surface enforced (attachErrorSurface / strict fixture opts). */
  c1: boolean;
  /** Clause 2 — goal-state value assertion (beyond a bare status check). */
  c2: boolean;
  /** Clause 3 — at least one network status assertion (every-step). */
  c3: boolean;
  /** Clause 4 — independent-session durable read. */
  c4: boolean;
}

interface SpecAudit {
  file: string;
  dataAssertions: number;
  selectorAssertions: number;
  verdict: Verdict;
  exempt: boolean;
  exemptReason?: string;
  journey: boolean;
  clauses: ClausePresence;
  journeyMissing: string[];
}

const DATA_PATTERNS = [
  /expect\([^)]*\.status\(?\)?\)/,            // expect(response.status())
  /expect\([^)]*\.data/,                       // expect(body.data...)
  /expect\([^)]*\)\.toHaveLength/,
  /expect\([^)]*\)\.toEqual\(/,
  /expect\([^)]*\)\.toContain(?:Equal)?\(/,
  /expect\([^)]*\)\.toMatchObject/,
  /waitForResponse/,
  /\.toBe\((\d{3}|true|false)\)/,              // expect(x).toBe(200) etc.
];

const SELECTOR_PATTERNS = [
  /\.toBeVisible\(/,
  /\.toHaveText\(/,
  /\.toContainText\(/,
  /\.toHaveCount\(/,
  /\.toBeEnabled\(/,
  /\.toBeDisabled\(/,
];

// ─── Phase C: must-never-break journey clause detection ─────────────────────
// A journey opts in with the `// @journey-firewall` marker and must then assert
// all 4 DoD clauses. This hardens the gameable `dataAssertions >= 2` heuristic:
// two trivial matching expects no longer satisfy a journey — it must also wire
// the error-surface fixture (c1), an independent-session read (c4), a status
// assertion (c3) AND a goal-value assertion distinct from status (c2).
const JOURNEY_MARKER = /@journey-firewall/;

const CLAUSE1_PATTERNS = [/attachErrorSurface\s*\(/, /failOnUnexpected4xx/, /failOnConsoleError/];
// Allow an optional generic type param: independentRead<{...}>(...) | independentRead(...)
const CLAUSE4_PATTERNS = [/independentRead\s*(?:<[^>]*>)?\s*\(/];
// Clause 3 — a network status code is asserted somewhere.
const CLAUSE3_PATTERNS = [
  /expect\([^)]*\.status/,            // expect(r.status) / expect(resp.status())
  /\.toBe\(\s*\d{3}\s*\)/,            // .toBe(200)
  /expect\(\s*\[\s*\d{3}/,           // expect([200, 404]).toContain(status)
  /toBeGreaterThanOrEqual\(\s*\d{3}/,
  /toBeLessThan\(\s*\d{3}/,
  /toBeGreaterThan\(\s*\d{3}/,
];
// Clause 2 — a goal-state VALUE is asserted (not just a status code). Catches
// comparisons against parsed body/data: a variable equality, a regex match,
// existence-in-list, shape, truthiness, or a non-empty/count goal.
const CLAUSE2_PATTERNS = [
  /\.toMatch\(/,
  /\.some\(/,
  /\.toEqual\(/,
  /\.toContainEqual\(/,
  /\.toHaveProperty\(/,
  /\.toBeTruthy\(/,
  /\.toBeGreaterThan\(\s*0\s*\)/, // count/non-empty goal (e.g. roster length > 0)
  /\.toBe\(\s*['"][^'"]/, // .toBe('string-literal') — type/shape goal
  /\.toBe\(\s*(?!true\b|false\b|null\b|undefined\b|\d)[A-Za-z_$][\w$.]*\s*\)/, // .toBe(variable)
];

const anyMatch = (src: string, pats: RegExp[]) => pats.some((p) => p.test(src));

export function detectClauses(src: string): ClausePresence {
  return {
    journey: JOURNEY_MARKER.test(src),
    c1: anyMatch(src, CLAUSE1_PATTERNS),
    c2: anyMatch(src, CLAUSE2_PATTERNS),
    c3: anyMatch(src, CLAUSE3_PATTERNS),
    c4: anyMatch(src, CLAUSE4_PATTERNS),
  };
}

/** Missing clause ids for a marked journey (empty for non-journeys / compliant). */
export function journeyMissingClauses(c: ClausePresence): string[] {
  if (!c.journey) return [];
  const missing: string[] = [];
  if (!c.c1) missing.push('clause1');
  if (!c.c2) missing.push('clause2');
  if (!c.c3) missing.push('clause3');
  if (!c.c4) missing.push('clause4');
  return missing;
}

const CLAUSE_LABELS: Record<string, string> = {
  clause1: 'clause 1 (no silent error surface — attachErrorSurface / failOnUnexpected4xx)',
  clause2: 'clause 2 (goal-state value assertion, not just status)',
  clause3: 'clause 3 (assert each network status)',
  clause4: 'clause 4 (independent-session durable read — independentRead)',
};
export function describeMissing(ids: string[]): string {
  return ids.map((i) => CLAUSE_LABELS[i] ?? i).join('; ');
}

const ROOTS = ['apps/memberry/tests/e2e', 'apps/admin/tests/e2e'];
const BASE = '/Users/elad-mini/Desktop/memberry';

function walk(d: string): string[] {
  const out: string[] = [];
  try { statSync(d); } catch { return out; }
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

function audit(file: string): SpecAudit {
  const src = readFileSync(file, 'utf8');
  const exemptMatch = src.match(/\/\/\s*@selector-only-ok:\s*(.+)/);
  const exempt = !!exemptMatch;
  const exemptReason = exemptMatch?.[1]?.trim();

  let data = 0;
  for (const r of DATA_PATTERNS) data += (src.match(new RegExp(r.source, 'g'))?.length ?? 0);
  let sel = 0;
  for (const r of SELECTOR_PATTERNS) sel += (src.match(new RegExp(r.source, 'g'))?.length ?? 0);

  const verdict: Verdict = data >= 2 ? 'real-flow' : sel > 0 ? 'selector-only' : 'unknown';
  const clauses = detectClauses(src);
  const journeyMissing = journeyMissingClauses(clauses);
  return {
    file,
    dataAssertions: data,
    selectorAssertions: sel,
    verdict,
    exempt,
    exemptReason,
    journey: clauses.journey,
    clauses,
    journeyMissing,
  };
}

function main() {
  const specs: SpecAudit[] = [];
  const seen = new Set<string>();
  for (const root of ROOTS) {
    for (const f of walk(join(BASE, root))) {
      if (seen.has(f)) continue;
      seen.add(f);
      specs.push(audit(f));
    }
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals: {
      files: specs.length,
      realFlow: specs.filter(s => s.verdict === 'real-flow').length,
      selectorOnly: specs.filter(s => s.verdict === 'selector-only' && !s.exempt).length,
      unknown: specs.filter(s => s.verdict === 'unknown' && !s.exempt).length,
      exempt: specs.filter(s => s.exempt).length,
      journeys: specs.filter(s => s.journey).length,
      journeyViolations: specs.filter(s => s.journey && s.journeyMissing.length > 0).length,
    },
    specs,
  }, null, 2));
}

if (import.meta.main) main();
