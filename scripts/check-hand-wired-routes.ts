import { readFileSync } from 'fs';

function parseYamlRoutes(text: string): { method: string; path: string }[] {
  const out: { method: string; path: string }[] = [];
  for (const m of text.matchAll(/method:\s*([A-Z]+),\s*path:\s*"([^"]+)"/g)) {
    out.push({ method: m[1].trim(), path: m[2].trim() });
  }
  return out;
}

const allowYaml = readFileSync('docs/quality/HAND_WIRED_ROUTES.yaml', 'utf8');
const allow = parseYamlRoutes(allowYaml).map(r => `${r.method} ${r.path}`);

const src = readFileSync('services/api-ts/src/app.ts', 'utf8');
const lines = src.split('\n');
const actual: string[] = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Match same-line: app.post('/path', ...)
  let verbMatch = line.match(/app\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/);
  // Match split-line: app.post(\n  '/path', ...)
  if (!verbMatch) {
    const verbOnly = line.match(/app\.(get|post|put|patch|delete)\(\s*$/);
    if (verbOnly && i + 1 < lines.length) {
      const pathMatch = lines[i + 1].match(/['"]([^'"]+)['"]/);
      if (pathMatch) verbMatch = [line, verbOnly[1], pathMatch[1]] as RegExpMatchArray;
    }
  }
  if (!verbMatch) continue;
  // Skip test-only routes (guarded by NODE_ENV !== 'production')
  if (verbMatch[2].startsWith('/test/')) continue;
  // Check inline exempt comment
  if (/hand-wired:allowed:\s*\S/.test(line) || (i > 0 && /hand-wired:allowed:\s*\S/.test(lines[i - 1]))) continue;
  actual.push(`${verbMatch[1].toUpperCase()} ${verbMatch[2]}`);
}

const extra = actual.filter(r => !allow.includes(r));
const missing = allow.filter(r => !actual.includes(r));

if (extra.length || missing.length) {
  if (extra.length) {
    console.error(`Routes in app.ts not in allowlist (${extra.length}):`);
    for (const r of extra) console.error(`  + ${r}`);
    console.error('  → Add entries to docs/quality/HAND_WIRED_ROUTES.yaml');
  }
  if (missing.length) {
    console.error(`Routes in allowlist not in app.ts (${missing.length}):`);
    for (const r of missing) console.error(`  - ${r}`);
    console.error('  → Remove stale entries from docs/quality/HAND_WIRED_ROUTES.yaml');
  }
  process.exit(1);
}
console.log(`Hand-wired routes OK: ${actual.length} routes`);
