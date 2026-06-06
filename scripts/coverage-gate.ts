import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

// Default thresholds; per-module overrides via thresholds.json
const DEFAULT_LINE = 70;
const DEFAULT_FN = 70;
const THRESHOLDS_FILE = 'services/api-ts/.coverage-thresholds.json';

interface ModuleThreshold {
  line: number;
  function: number;
}

const overrides: Record<string, ModuleThreshold> = existsSync(THRESHOLDS_FILE)
  ? JSON.parse(readFileSync(THRESHOLDS_FILE, 'utf8'))
  : {};

// Run bun test --coverage and capture stdout
const result = spawnSync('bun', ['test', '--coverage'], {
  cwd: 'services/api-ts',
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});

const output = (result.stdout ?? '') + (result.stderr ?? '');
process.stdout.write(output);

// Parse Bun's text-format coverage table:
// Format is:
// ----------------------|---------|---------|-------------------
// File                  | % Funcs | % Lines | Uncovered Line #s
// ----------------------|---------|---------|-------------------
// All files             |  85.34  |  78.91  |
// src/...               |  90.00  |  82.50  | 1-3
// ----------------------|---------|---------|-------------------
const lineRe = /^([^\s|][^|]*?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/gm;
const fileCoverage: Array<{ file: string; fn: number; line: number }> = [];
for (const m of output.matchAll(lineRe)) {
  const file = m[1].trim();
  if (file === 'File' || file === 'All files' || file.startsWith('-')) continue;
  fileCoverage.push({ file, fn: parseFloat(m[2]), line: parseFloat(m[3]) });
}

const failures: string[] = [];
for (const cov of fileCoverage) {
  const moduleKey = cov.file.split('/').slice(0, 3).join('/');  // e.g. src/handlers/person
  const t = overrides[moduleKey] ?? { line: DEFAULT_LINE, function: DEFAULT_FN };
  if (cov.line < t.line) failures.push(`${cov.file}: line ${cov.line.toFixed(1)}% < ${t.line}%`);
  if (cov.fn < t.function) failures.push(`${cov.file}: function ${cov.fn.toFixed(1)}% < ${t.function}%`);
}

if (result.status !== 0) {
  console.error('\nCoverage gate: bun test exited non-zero');
  process.exit(result.status ?? 1);
}

if (failures.length > 0) {
  console.error('\nCoverage gate: FAILURES');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\nCoverage gate: PASS (${fileCoverage.length} files checked)`);
