#!/usr/bin/env bun
/**
 * Strip the most-common redundant Playwright wait pattern:
 *
 *   await page.goto(...)
 *   await page.waitForLoadState('networkidle')   ← remove this line
 *
 * `page.goto()` already waits for the `load` event by default; the trailing
 * networkidle adds 500ms of silence wait that hangs on apps with WebSockets,
 * OneSignal beacons, or LogRocket-style telemetry. The 27s saved per run
 * from this pattern alone was measured in the auth helper fix (commit
 * 68cc76c4 — 95s → 59s on auth.spec.ts).
 *
 * Idempotent. Safe — only strips networkidle when DIRECTLY preceded by goto.
 *
 * Usage:
 *   bun scripts/audit/strip-redundant-waits.ts [--check] [--dir <path>]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { Glob } from 'bun'
import { join } from 'node:path'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const dirIdx = args.indexOf('--dir')
const targetDir = dirIdx >= 0 ? args[dirIdx + 1]! : join(import.meta.dir, '..', '..', 'apps/memberry/tests/e2e')

let filesScanned = 0
let filesChanged = 0
let stripped = 0

const glob = new Glob('**/*.spec.ts')
for await (const rel of glob.scan({ cwd: targetDir })) {
  if (rel.includes('/stubs/')) continue
  filesScanned++
  const path = join(targetDir, rel)
  const before = readFileSync(path, 'utf8')
  // Match a goto line, optional blank, then a networkidle-only waitForLoadState line.
  const after = before.replace(
    /(await\s+page\.goto\([^)]+\)(?:\.[^\n]*)?\n)(\s*)await\s+page\.waitForLoadState\(\s*['"`]networkidle['"`]\s*\)\s*\n/g,
    (_, gotoLine) => {
      stripped++
      return gotoLine
    },
  )
  if (after !== before) {
    filesChanged++
    if (!checkOnly) writeFileSync(path, after, 'utf8')
  }
}

const verb = checkOnly ? 'would strip' : 'stripped'
console.log(`Scanned ${filesScanned} spec files`)
console.log(`  ${filesChanged} ${checkOnly ? 'would change' : 'changed'}`)
console.log(`  ${stripped} redundant networkidle wait(s) ${verb}`)

if (checkOnly && filesChanged > 0) {
  console.error('\n[--check] redundant networkidle waits detected. Run without --check to strip.')
  process.exit(1)
}
