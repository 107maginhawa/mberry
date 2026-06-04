#!/usr/bin/env bun
/**
 * Lint: No Silent Test Skips
 *
 * Fails CI if any test file contains skip markers that silently suppress tests.
 *
 * Allowed alternatives:
 *   - test.todo("reason")                      — visible backlog (Bun)
 *   - describe.todo                             — visible backlog (Bun)
 *   - test.skip(condition, "reason")            — conditional skip (Playwright)
 *   - test.fixme(condition, "reason")           — conditional fixme (Playwright)
 *
 * Banned patterns:
 *   - xit(              — vitest/jest exclusive skip (always silent)
 *   - xdescribe(        — vitest/jest exclusive skip (always silent)
 *   - test.skip()       — unconditional skip (no reason, silent)
 *   - test.skip;        — unconditional skip reference
 *   - it.skip           — unconditional skip
 *   - describe.skip     — suite-level skip (hides entire suites)
 *
 * Conditional Playwright skips with a reason ARE allowed:
 *   test.skip(!mailpitUp, 'Mailpit not running')  ← OK
 *   test.skip()                                    ← BANNED
 *
 * Per-line escape hatch (use sparingly, e.g. integration gates):
 *   const d = API_AVAILABLE ? describe : describe.skip; // allow-skip: <reason>
 *
 * Exit 0 = clean, Exit 1 = skips found.
 */

import { Glob } from 'bun';

/**
 * Check if a test.skip usage is a conditional Playwright skip (allowed).
 * Playwright conditional: test.skip(booleanExpr, 'reason string')
 * Unconditional (banned):  test.skip()  or  test.skip('name', fn)
 */
function isConditionalPlaywrightSkip(line: string): boolean {
  // Match test.skip(!someVar, 'reason') or test.skip(condition, "reason")
  // These have a boolean condition followed by a string reason
  const match = line.match(/test\.skip\s*\(\s*(!?\w[\w.]*)\s*,\s*['"`]/);
  return match !== null;
}

const SKIP_PATTERNS: Array<{ pattern: RegExp; check?: (line: string) => boolean }> = [
  { pattern: /\bxit\s*\(/ },
  { pattern: /\bxdescribe\s*\(/ },
  { pattern: /\bit\.skip\b/ },
  { pattern: /\bdescribe\.skip\b/ },
  {
    pattern: /\btest\.skip\b/,
    // Allow conditional Playwright skips: test.skip(condition, 'reason')
    check: (line) => !isConditionalPlaywrightSkip(line),
  },
];

const TEST_GLOBS = [
  'services/**/*.test.ts',
  'apps/**/*.spec.ts',
  'apps/**/*.test.ts',
  'apps/**/*.test.tsx',
  'testing/**/*.test.ts',
  'packages/**/*.test.ts',
];

interface Violation {
  file: string;
  line: number;
  content: string;
}

const violations: Violation[] = [];

for (const globPattern of TEST_GLOBS) {
  const glob = new Glob(globPattern);
  for await (const path of glob.scan('.')) {
    const content = await Bun.file(path).text();
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Per-line escape hatch — must include a reason after `allow-skip:`.
      if (/\/\/\s*allow-skip\s*:\s*\S/.test(line)) continue;
      for (const { pattern, check } of SKIP_PATTERNS) {
        if (pattern.test(line)) {
          // If there's a check function, only flag if it returns true
          if (check && !check(line)) continue;
          violations.push({
            file: path,
            line: i + 1,
            content: line.trim(),
          });
        }
      }
    }
  }
}

if (violations.length === 0) {
  console.log('✓ No silent test skips found');
  process.exit(0);
}

console.error(`✗ Found ${violations.length} silent test skip(s):\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    ${v.content}\n`);
}
console.error('Fix: use test.todo("reason"), describe.todo, or conditional test.skip(condition, "reason").');
process.exit(1);
