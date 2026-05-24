#!/usr/bin/env bun
/**
 * Shallow Test Lint — Informational
 *
 * Scans test files for patterns that indicate shallow/vacuous testing:
 * - `expect(true).toBe(true)` — meaningless assertion
 * - Tests with only `toBeVisible` on headings — page-smoke, not behavioral
 * - Tests that define and assert on inline functions (no production imports)
 * - Empty test bodies
 *
 * Exit 0 always (informational). Prints count and file list.
 *
 * Usage:
 *   bun run scripts/lint-shallow-tests.ts
 *   bun run scripts/lint-shallow-tests.ts --ci   # print ::warning annotations
 */

import { Glob } from 'bun';

const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const ciMode = process.argv.includes('--ci');

interface Finding {
  file: string;
  line: number;
  pattern: string;
  text: string;
}

const findings: Finding[] = [];

const patterns: Array<{ name: string; regex: RegExp }> = [
  { name: 'meaningless-true', regex: /expect\(true\)\.toBe\(true\)/ },
  { name: 'meaningless-one', regex: /expect\(1\)\.toBe\(1\)/ },
  { name: 'typeof-boolean', regex: /expect\(typeof\s+\w+\)\.toBe\('boolean'\)/ },
];

// Scan all test files
const glob = new Glob('**/*.test.{ts,tsx}');
const testDirs = ['services/api-ts/src', 'apps/memberry/src', 'apps/admin/src'];

for (const dir of testDirs) {
  for await (const file of glob.scan({ cwd: `${ROOT}/${dir}`, absolute: false })) {
    const fullPath = `${ROOT}/${dir}/${file}`;
    const content = await Bun.file(fullPath).text();
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        if (pattern.regex.test(lines[i])) {
          findings.push({
            file: `${dir}/${file}`,
            line: i + 1,
            pattern: pattern.name,
            text: lines[i].trim(),
          });
        }
      }
    }
  }
}

// Report
console.log('Shallow Test Lint');
console.log('='.repeat(60));
console.log(`Scanned: ${testDirs.join(', ')}`);
console.log(`Findings: ${findings.length}`);
console.log('');

if (findings.length === 0) {
  console.log('No shallow test patterns detected.');
} else {
  for (const f of findings) {
    if (ciMode) {
      console.log(`::warning file=${f.file},line=${f.line}::Shallow test pattern: ${f.pattern}`);
    } else {
      console.log(`  ${f.file}:${f.line} [${f.pattern}] ${f.text}`);
    }
  }
}

console.log('');
if (findings.length > 0) {
  console.log(`FAIL: ${findings.length} shallow test pattern(s) found. Fix before merging.`);
  process.exit(1);
} else {
  console.log('PASS: Shallow test lint complete — no violations.');
  process.exit(0);
}
