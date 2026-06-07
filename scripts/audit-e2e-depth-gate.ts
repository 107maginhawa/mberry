import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('/tmp/e2e-depth.json', 'utf8'));
const blockers = data.totals.selectorOnly + data.totals.unknown;
if (blockers > 0) {
  console.error(`E2E depth gate: ${blockers} non-exempt specs are selector-only or unknown`);
  console.error('Add `// @selector-only-ok: <reason>` or upgrade to real-flow assertions');
  process.exit(1);
}
console.log(`E2E depth gate: PASS (${data.totals.realFlow} real-flow, ${data.totals.exempt} exempt)`);
