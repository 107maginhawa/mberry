/**
 * test-honesty-gate — assertion-free "green" test detector (AHA F-4)
 *
 * The fake-green class (audit P-3): suites that pass without asserting anything
 * — a `test()` whose body exercises code but makes NO assertion, so it stays
 * green no matter what the code does. Coverage counts these; trust does not.
 * The 4 worst offenders were repaired per-module (platform-admin, documents,
 * notifications-email, auth-rbac). This is the PLATFORM gate that stops the
 * class from regrowing: it scans the whole api-ts test suite and fails if any
 * NEW assertion-free test appears.
 *
 * What counts as an assertion (a test is HONEST if its body contains any of):
 *   - `expect(...)`                      — bun:test / standard matcher
 *   - `expect<Helper>(...)` / `assert<Helper>(...)` — a shared assertion helper
 *     (this repo names them `expect*` / `assert*`, e.g. `expectValidationError`,
 *     `expectBlocked` — see docs/TEST_HONESTY.md). Name yours that way so the
 *     gate sees them.
 *   - `assert(...)` / `assert.*`         — node:assert style
 *   - `throw ...`                        — a manual/conditional throw assertion
 *     (e.g. meta-tests that collect violations then `throw new Error(...)`)
 *   - `.toMatchSnapshot()`
 *
 * NOT flagged: explicitly-pending skip / todo markers (they don't run).
 * NOT a test block: `someRegex.test(x)` and other `.test(` / `.it(` METHOD
 * calls — a negative lookbehind keeps the scanner from mistaking them for a
 * test-framework `test()` / `it()`.
 *
 * Scope: api-ts unit/integration suite (every `.test.ts` under
 * `services/api-ts/src/`). Frontend Playwright E2E (`apps/`) is a different
 * honesty model (real user
 * flows over a live page) and is out of this static gate's scope — see
 * docs/TEST_HONESTY.md.
 *
 * BASELINE_ALLOWLIST is the ratchet. It holds the assertion-free tests that
 * existed when this gate landed (intentional "does not throw" smoke tests whose
 * tightening belongs to their module's later fix batch). It may only SHRINK:
 * a NEW assertion-free test is not in it → this gate goes RED, forcing either a
 * real assertion or a conscious allowlist entry.
 */
import { describe, test, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, relative, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// services/api-ts/src
const SRC_ROOT = resolve(__dirname, '../..');

/**
 * Tests that were assertion-free when this gate landed. RATCHET: shrink only,
 * never grow. Each is an intentional "completes without throwing" smoke test;
 * tightening (add a behavioral assertion) is tracked in the owning module's
 * later AHA `04` batch. A new entry here must be a deliberate, justified edit.
 */
const BASELINE_ALLOWLIST = new Set<string>([
  'handlers/person/createPerson.test.ts :: does not call audit.logEvent when audit service is absent',
  'handlers/email/repos/suppression.repo.test.ts :: addSuppression with duplicate email+org is idempotent (no error)',
  'handlers/email/repos/suppression.repo.test.ts :: deletes the row for org+email combination',
]);

// ---------------------------------------------------------------------------
// Scanner (calibrated against the live suite; 0 false positives at landing).
// ---------------------------------------------------------------------------

/**
 * Blank the contents of strings and comments (preserving length + newlines) so
 * brace/paren matching and keyword scans never trip on `(`/`)`/`test`/`expect`
 * that live inside a string literal or comment.
 */
const maskStringsAndComments = (src: string): string => {
  let out = '';
  let i = 0;
  const n = src.length;
  let mode: null | 'line' | 'block' | 'sq' | 'dq' | 'tpl' = null;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (mode === null) {
      if (c === '/' && d === '/') { mode = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; out += '  '; i += 2; continue; }
      if (c === "'") { mode = 'sq'; out += ' '; i++; continue; }
      if (c === '"') { mode = 'dq'; out += ' '; i++; continue; }
      if (c === '`') { mode = 'tpl'; out += ' '; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'line') {
      if (c === '\n') { mode = null; out += '\n'; i++; } else { out += ' '; i++; }
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && d === '/') { mode = null; out += '  '; i += 2; } else { out += c === '\n' ? '\n' : ' '; i++; }
      continue;
    }
    // string modes: sq / dq / tpl
    const quote = mode === 'sq' ? "'" : mode === 'dq' ? '"' : '`';
    if (c === '\\') { out += '  '; i += 2; continue; }
    if (c === quote) { mode = null; out += ' '; i++; continue; }
    out += c === '\n' ? '\n' : ' ';
    i++;
  }
  return out;
};

const matchParen = (s: string, open: number): number => {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
};

const lineAt = (src: string, idx: number): number => src.slice(0, idx).split('\n').length;

// Bare global test()/it() — the lookbehind rejects `.test(`/`foo.it(` method calls.
const TEST_CALL = /(?<![.\w$])(test|it)\s*(\.\s*(only|skip|todo|failing|concurrent|each))?\s*\(/g;
// Any assertion signal inside a test body.
const ASSERTION = /(?<![.\w$])(expect|assert)\w*\s*\(|\bassert\./;
const THROW = /(?<![.\w$])throw\s/;
const SNAPSHOT = /\.toMatchSnapshot\b/;
const hasAssertion = (body: string): boolean => ASSERTION.test(body) || THROW.test(body) || SNAPSHOT.test(body);

type Finding = { key: string; rel: string; line: number };

/** Assertion-free, non-skipped test()/it() blocks in one source file. */
const findAssertionFreeTests = (src: string, rel: string): Finding[] => {
  const masked = maskStringsAndComments(src);
  const findings: Finding[] = [];
  let mm: RegExpExecArray | null;
  TEST_CALL.lastIndex = 0;
  while ((mm = TEST_CALL.exec(masked))) {
    const modifier = mm[3] || '';
    const openParen = mm.index + mm[0].length - 1;
    const close = matchParen(masked, openParen);
    if (close < 0) continue;
    // test.each(cases)(name, fn) — extend the scan range over the curried call.
    let scanEnd = close;
    let k = close + 1;
    while (k < masked.length && /\s/.test(masked[k])) k++;
    if (modifier === 'each' && masked[k] === '(') {
      const c2 = matchParen(masked, k);
      if (c2 > 0) scanEnd = c2;
    }
    const next = scanEnd + 1;
    if (modifier === 'skip' || modifier === 'todo') { TEST_CALL.lastIndex = next; continue; }

    const bodyMasked = masked.slice(mm.index, scanEnd + 1);
    if (!hasAssertion(bodyMasked)) {
      const nameMatch = src.slice(mm.index, scanEnd + 1).match(/\(\s*[`'"]([^`'"]*)[`'"]/);
      const line = lineAt(src, mm.index);
      const name = nameMatch ? nameMatch[1] : `(dynamic) L${line}`;
      findings.push({ key: `${rel} :: ${name}`, rel, line });
    }
    TEST_CALL.lastIndex = next;
  }
  return findings;
};

const collectTestFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'generated') continue;
      collectTestFiles(full, acc);
    } else if (entry.endsWith('.test.ts') && full !== __filename) {
      acc.push(full);
    }
  }
  return acc;
};

// Scan once at module load.
const TEST_FILES = collectTestFiles(SRC_ROOT);
const ALL_FINDINGS: Finding[] = TEST_FILES.flatMap((f) =>
  findAssertionFreeTests(readFileSync(f, 'utf-8'), relative(SRC_ROOT, f)),
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('test-honesty-gate (AHA F-4 — no assertion-free green tests)', () => {
  test('the scan actually ran over the suite (no vacuous pass)', () => {
    expect(TEST_FILES.length).toBeGreaterThan(100);
  });

  test('no NEW assertion-free test outside the baseline allowlist', () => {
    const fresh = ALL_FINDINGS.filter((f) => !BASELINE_ALLOWLIST.has(f.key));
    expect(
      fresh.map((f) => f.key).sort(),
      `Assertion-free test(s) found — a test body that makes no assertion stays green no matter what the code does.\n` +
        `Add a real assertion (expect / an expect*-named helper / a conditional throw), or — only if the test is an\n` +
        `intentional "completes without throwing" smoke test — add its key to BASELINE_ALLOWLIST with a reason.\n` +
        `See docs/TEST_HONESTY.md.\nOffenders:\n` +
        fresh.map((f) => `  ✗ ${f.key}  (${f.rel}:${f.line})`).join('\n'),
    ).toEqual([]);
  });

  test('baseline allowlist has not gone stale (ratchet shrinks only)', () => {
    // Every allowlisted key must still be a live assertion-free finding. If one
    // was fixed (gained an assertion) or renamed, drop it from the allowlist.
    const liveKeys = new Set(ALL_FINDINGS.map((f) => f.key));
    const stale = [...BASELINE_ALLOWLIST].filter((k) => !liveKeys.has(k)).sort();
    expect(
      stale,
      `BASELINE_ALLOWLIST entries no longer match an assertion-free test (fixed or renamed) — remove them so the ` +
        `ratchet keeps shrinking:\n` + stale.map((k) => `  - ${k}`).join('\n'),
    ).toEqual([]);
  });
});
