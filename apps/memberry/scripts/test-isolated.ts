#!/usr/bin/env bun
/**
 * Memberry test runner with per-file isolation for polluters.
 *
 * Bun's `mock.module` is process-global; once a test file mocks an in-app
 * module (`./<sibling>`, `../<x>`, `@/<x>`), every subsequent test in the
 * same process sees the stub. Tests that own those modules then fail
 * (e.g. `event-list.test.tsx` mocks `./event-card`, poisoning
 * `event-card.test.tsx`).
 *
 * This runner classifies each test file as polluter or clean:
 *   - polluter = file contains `vi.mock(...)` or `mock.module(...)` whose
 *     specifier starts with `./`, `../`, or `@/` (in-app local modules)
 *   - clean = everything else
 *
 * Clean files run in ONE bun:test process (fast, batched).
 * Polluter files run ONE-PER-PROCESS (isolated).
 *
 * Aggregate pass/fail totals printed at end; non-zero exit on any failure.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, relative } from 'path';

const APP_DIR = new URL('..', import.meta.url).pathname;
const REPO_ROOT = new URL('../../..', import.meta.url).pathname;
const SRC_DIR = join(APP_DIR, 'src');

const POLLUTER_RE = /(?:vi\.mock|mock\.module)\(\s*['"](?:\.{1,2}\/|@\/)/;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage' || entry === 'tests') continue;
      walk(full, acc);
    } else if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

const testFiles = walk(SRC_DIR);
const polluters: string[] = [];
const clean: string[] = [];
for (const f of testFiles) {
  const content = readFileSync(f, 'utf8');
  (POLLUTER_RE.test(content) ? polluters : clean).push(f);
}

console.log(`[memberry test-isolated] ${testFiles.length} test files: ${clean.length} clean / ${polluters.length} polluter`);

const PASS_RE = /\s(\d+)\s+pass/;
const FAIL_RE = /\s(\d+)\s+fail/;
const SKIP_RE = /\s(\d+)\s+skip/;
const TODO_RE = /\s(\d+)\s+todo/;
const TOTAL_RE = /Ran\s+(\d+)\s+tests/;

let totalPass = 0;
let totalFail = 0;
let totalSkip = 0;
let totalTodo = 0;
let totalTests = 0;
let anyFail = false;
const failingFiles: string[] = [];

function runBatch(label: string, files: string[]): void {
  if (files.length === 0) return;
  const args = ['test', ...files.map((f) => relative(REPO_ROOT, f))];
  const start = Date.now();
  const result = spawnSync('bun', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  const out = (result.stdout ?? '') + (result.stderr ?? '');
  const wall = ((Date.now() - start) / 1000).toFixed(2);
  const pass = Number(out.match(PASS_RE)?.[1] ?? 0);
  const fail = Number(out.match(FAIL_RE)?.[1] ?? 0);
  const skip = Number(out.match(SKIP_RE)?.[1] ?? 0);
  const todo = Number(out.match(TODO_RE)?.[1] ?? 0);
  const ran = Number(out.match(TOTAL_RE)?.[1] ?? 0);
  totalPass += pass;
  totalFail += fail;
  totalSkip += skip;
  totalTodo += todo;
  totalTests += ran;
  if (fail > 0 || result.status !== 0) {
    anyFail = true;
    failingFiles.push(...files.map((f) => relative(REPO_ROOT, f)));
    process.stdout.write(out);
    console.log(`[${label}] ${fail} fail / ${pass} pass (${wall}s)`);
  } else if (pass > 0) {
    console.log(`[${label}] ${pass} pass${skip ? ` / ${skip} skip` : ''}${todo ? ` / ${todo} todo` : ''} (${wall}s)`);
  } else {
    process.stdout.write(out);
  }
}

const overallStart = Date.now();

runBatch('clean-batch', clean);

for (const p of polluters) {
  const label = `polluter:${relative(SRC_DIR, p)}`;
  runBatch(label, [p]);
}

const overallWall = ((Date.now() - overallStart) / 1000).toFixed(2);
console.log('');
console.log(`============================================================`);
console.log(`memberry aggregate: ${totalPass} pass / ${totalFail} fail / ${totalSkip} skip / ${totalTodo} todo (${totalTests} tests, ${overallWall}s)`);
if (anyFail && failingFiles.length > 0) {
  console.log(`failing batches:`);
  for (const f of failingFiles) console.log(`  - ${f}`);
}
console.log(`============================================================`);

process.exit(anyFail ? 1 : 0);
