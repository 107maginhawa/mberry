#!/usr/bin/env bun
/**
 * SDK Compatibility Gate
 *
 * Diffs the current OpenAPI operationId set against a committed baseline
 * snapshot. Used as a merge gate during the association:member rebuild
 * milestone — any added / removed / renamed operationId fails the run so
 * SDK-side consumer breakage gets caught at cutover time, not after
 * `@hey-api/openapi-ts` regenerates types.
 *
 * Why a committed snapshot vs `git show <tag>:openapi.json`?
 *   `specs/api/dist/openapi/openapi.json` is gitignored (build artifact), so
 *   it is unreachable from a tagged ref. A small JSON snapshot of just the
 *   operationIds (method + path + opId) is fast to diff and reviewable in PRs.
 *
 * Usage:
 *   bun run check:sdk-compat                # diff current against snapshot
 *   bun run check:sdk-compat --update       # overwrite snapshot from current
 *                                           # spec (do this once at R0.5,
 *                                           # then never again until Step 6
 *                                           # closes)
 *
 * Exit codes:
 *   0  — operationId set unchanged, or snapshot absent (warning) / --update succeeded
 *   1  — any add / remove / rename detected
 *   2  — script error (couldn't read or parse openapi.json)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const OPENAPI_PATH = 'specs/api/dist/openapi/openapi.json'
const SNAPSHOT_PATH = 'docs/quality/SDK_BASELINE_OPS.json'

type OpEntry = { method: string; path: string; operationId: string }

function extractOps(spec: any): OpEntry[] {
  const ops: OpEntry[] = []
  if (!spec?.paths) return ops
  for (const [p, methods] of Object.entries(spec.paths as Record<string, any>)) {
    for (const [m, def] of Object.entries(methods as Record<string, any>)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(m)) continue
      const opId = (def as any)?.operationId
      if (!opId) continue
      ops.push({ method: m.toUpperCase(), path: p, operationId: opId })
    }
  }
  ops.sort((a, b) => a.operationId.localeCompare(b.operationId))
  return ops
}

function loadCurrentSpec(): any {
  if (!existsSync(OPENAPI_PATH)) {
    console.error(`ERROR: ${OPENAPI_PATH} not found. Run \`cd specs/api && bun run build\` first.`)
    process.exit(2)
  }
  try {
    return JSON.parse(readFileSync(OPENAPI_PATH, 'utf8'))
  } catch (e) {
    console.error(`ERROR: failed to parse ${OPENAPI_PATH}:`, (e as Error).message)
    process.exit(2)
  }
}

const args = process.argv.slice(2)
const updateMode = args.includes('--update')

const currentOps = extractOps(loadCurrentSpec())

if (updateMode) {
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true })
  const snap = {
    capturedAt: new Date().toISOString(),
    count: currentOps.length,
    note: 'Baseline operationId set for the association:member rebuild milestone (Step 6). Regenerated only once at R0.5 of docs/quality/R0_BASELINE.md and frozen until Step 6 closes. Diffed by scripts/check-sdk-compat.ts.',
    ops: currentOps,
  }
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snap, null, 2) + '\n')
  console.log(`✅ Wrote baseline snapshot to ${SNAPSHOT_PATH} (${currentOps.length} ops).`)
  process.exit(0)
}

if (!existsSync(SNAPSHOT_PATH)) {
  console.warn(`⚠️  Baseline snapshot ${SNAPSHOT_PATH} not found.`)
  console.warn(`   Run \`bun run check:sdk-compat --update\` once at R0.5 to seed it.`)
  console.warn(`   Skipping diff.`)
  process.exit(0)
}

const baselineRaw = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
const baselineOps: OpEntry[] = baselineRaw.ops ?? []
const baselineMap = new Map(baselineOps.map((o) => [o.operationId, o]))
const currentMap = new Map(currentOps.map((o) => [o.operationId, o]))

const added: OpEntry[] = []
const removed: OpEntry[] = []
const changed: { opId: string; was: string; now: string }[] = []

for (const [opId, entry] of currentMap) {
  if (!baselineMap.has(opId)) {
    added.push(entry)
    continue
  }
  const prev = baselineMap.get(opId)!
  const wasSig = `${prev.method} ${prev.path}`
  const nowSig = `${entry.method} ${entry.path}`
  if (wasSig !== nowSig) {
    changed.push({ opId, was: wasSig, now: nowSig })
  }
}

for (const [opId, entry] of baselineMap) {
  if (!currentMap.has(opId)) removed.push(entry)
}

const drift = added.length + removed.length + changed.length

console.log(`SDK compat check — baseline ${SNAPSHOT_PATH} vs current build`)
console.log(`  baseline ops: ${baselineOps.length}  (captured ${baselineRaw.capturedAt ?? 'unknown'})`)
console.log(`  current ops:  ${currentOps.length}`)
console.log(`  added:        ${added.length}`)
console.log(`  removed:      ${removed.length}`)
console.log(`  changed:      ${changed.length}`)

if (added.length) {
  console.log('\n— added operationIds (new SDK surface):')
  for (const e of added) console.log(`  + ${e.method} ${e.path} :: ${e.operationId}`)
}
if (removed.length) {
  console.log('\n— removed operationIds (BREAKING for SDK consumers):')
  for (const e of removed) console.log(`  - ${e.method} ${e.path} :: ${e.operationId}`)
}
if (changed.length) {
  console.log('\n— changed signatures (method/path moved under same op id):')
  for (const c of changed) console.log(`  ~ ${c.opId}: ${c.was}  →  ${c.now}`)
}

if (drift === 0) {
  console.log('\n✅ No operationId drift. SDK surface unchanged.')
  process.exit(0)
}
console.log(`\n❌ ${drift} operationId change(s) detected. Block merge.`)
process.exit(1)
