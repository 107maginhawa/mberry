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
 * Flags:
 *   --update   overwrite the baseline snapshot from the current spec
 *   --strict   block on ANY drift, including purely-additive new ops
 *              (the original pre-F-5 behavior)
 *
 * Exit codes:
 *   0  — no drift, OR additive-only drift (new ops, non-breaking) without
 *        --strict, OR snapshot absent (warning) / --update succeeded
 *   1  — BREAKING drift (removed or changed op) detected; or any drift under
 *        --strict
 *   2  — script error (couldn't read or parse openapi.json)
 *
 * F-5 / P-9: an ADDED operationId only grows the SDK surface and cannot break
 * an existing consumer, so it no longer fails the gate by default. Only REMOVED
 * or CHANGED (method/path moved under the same op id) ops break consumers.
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

export type DriftClassification = {
  added: OpEntry[]
  removed: OpEntry[]
  changed: { opId: string; was: string; now: string }[]
}

/** Diff a baseline op set against the current set. Pure — no IO. */
export function classifyDrift(
  baselineOps: OpEntry[],
  currentOps: OpEntry[],
): DriftClassification {
  const baselineMap = new Map(baselineOps.map((o) => [o.operationId, o]))
  const currentMap = new Map(currentOps.map((o) => [o.operationId, o]))
  const added: OpEntry[] = []
  const removed: OpEntry[] = []
  const changed: { opId: string; was: string; now: string }[] = []

  for (const [opId, entry] of currentMap) {
    const prev = baselineMap.get(opId)
    if (!prev) {
      added.push(entry)
      continue
    }
    const wasSig = `${prev.method} ${prev.path}`
    const nowSig = `${entry.method} ${entry.path}`
    if (wasSig !== nowSig) changed.push({ opId, was: wasSig, now: nowSig })
  }
  for (const [opId, entry] of baselineMap) {
    if (!currentMap.has(opId)) removed.push(entry)
  }
  return { added, removed, changed }
}

/**
 * Decide the process exit code from a drift classification.
 *
 * F-5 / P-9: ADDED ops are additive (grow the SDK surface, cannot break an
 * existing consumer) → non-blocking. REMOVED / CHANGED ops are breaking →
 * block. `--strict` restores the original block-on-any-drift behavior.
 */
export function decideExit(
  d: DriftClassification,
  opts: { strict: boolean },
): { code: 0 | 1; breakingCount: number; additiveCount: number } {
  const breakingCount = d.removed.length + d.changed.length
  const additiveCount = d.added.length
  const block = opts.strict
    ? breakingCount + additiveCount > 0
    : breakingCount > 0
  return { code: block ? 1 : 0, breakingCount, additiveCount }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const updateMode = args.includes('--update')
  const strict = args.includes('--strict')

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
  const drift = classifyDrift(baselineOps, currentOps)
  const { added, removed, changed } = drift

  console.log(`SDK compat check — baseline ${SNAPSHOT_PATH} vs current build`)
  console.log(`  baseline ops: ${baselineOps.length}  (captured ${baselineRaw.capturedAt ?? 'unknown'})`)
  console.log(`  current ops:  ${currentOps.length}`)
  console.log(`  added:        ${added.length}`)
  console.log(`  removed:      ${removed.length}`)
  console.log(`  changed:      ${changed.length}`)

  if (added.length) {
    console.log('\n— added operationIds (new SDK surface — ADDITIVE, non-breaking):')
    for (const e of added) console.log(`  + ${e.method} ${e.path} :: ${e.operationId}`)
  }
  if (removed.length) {
    console.log('\n— removed operationIds (BREAKING for SDK consumers):')
    for (const e of removed) console.log(`  - ${e.method} ${e.path} :: ${e.operationId}`)
  }
  if (changed.length) {
    console.log('\n— changed signatures (method/path moved under same op id — BREAKING):')
    for (const c of changed) console.log(`  ~ ${c.opId}: ${c.was}  →  ${c.now}`)
  }

  const { code, breakingCount, additiveCount } = decideExit(drift, { strict })
  if (breakingCount === 0 && additiveCount === 0) {
    console.log('\n✅ No operationId drift. SDK surface unchanged.')
  } else if (code === 0) {
    console.log(`\n✅ ${additiveCount} additive operationId(s), 0 breaking. SDK surface grew (non-breaking).`)
    console.log(`   Run \`bun run check:sdk-compat --update\` to refresh the baseline, or pass \`--strict\` to block on additive drift.`)
  } else {
    const tail = strict && additiveCount > 0 ? ` + ${additiveCount} additive (--strict)` : ''
    console.log(`\n❌ ${breakingCount} breaking operationId change(s) detected (removed/changed)${tail}. Block merge.`)
  }
  process.exit(code)
}
