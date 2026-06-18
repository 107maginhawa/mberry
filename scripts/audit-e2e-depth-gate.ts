import { readFileSync } from 'fs';
import { describeMissing } from './audit-e2e-depth';

interface SpecRow {
  file: string;
  journey?: boolean;
  journeyMissing?: string[];
}

const data = JSON.parse(readFileSync('/tmp/e2e-depth.json', 'utf8')) as {
  totals: { selectorOnly: number; unknown: number; realFlow: number; exempt: number; journeys: number };
  specs: SpecRow[];
};

let failed = false;

const blockers = data.totals.selectorOnly + data.totals.unknown;
if (blockers > 0) {
  console.error(`E2E depth gate: ${blockers} non-exempt specs are selector-only or unknown`);
  console.error('Add `// @selector-only-ok: <reason>` or upgrade to real-flow assertions');
  failed = true;
}

// Phase C: must-never-break journeys (`// @journey-firewall`) must assert all 4
// DoD clauses. Two trivial matching expects no longer suffice.
const journeyViolations = data.specs.filter((s) => s.journey && (s.journeyMissing?.length ?? 0) > 0);
if (journeyViolations.length > 0) {
  console.error(
    `\nE2E depth gate: ${journeyViolations.length} must-never-break journey(s) drop a DoD clause:`,
  );
  for (const s of journeyViolations) {
    const rel = s.file.split('/tests/e2e/')[1] ?? s.file;
    console.error(`  • ${rel}: missing ${describeMissing(s.journeyMissing ?? [])}`);
  }
  console.error(
    '\nA `// @journey-firewall` spec must assert all 4 clauses of the journey DoD.',
  );
  console.error(
    'See docs/aha/outputs/verification-hardening-prompt.md (THE 4-CLAUSE DEFINITION OF DONE).',
  );
  failed = true;
}

if (failed) process.exit(1);

console.log(
  `E2E depth gate: PASS (${data.totals.realFlow} real-flow, ${data.totals.exempt} exempt, ${data.totals.journeys} journeys 4/4)`,
);
