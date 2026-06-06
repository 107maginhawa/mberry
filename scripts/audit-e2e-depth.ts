import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

type Verdict = 'real-flow' | 'selector-only' | 'unknown';

interface SpecAudit {
  file: string;
  dataAssertions: number;
  selectorAssertions: number;
  verdict: Verdict;
  exempt: boolean;
  exemptReason?: string;
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
  return { file, dataAssertions: data, selectorAssertions: sel, verdict, exempt, exemptReason };
}

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
  },
  specs,
}, null, 2));
