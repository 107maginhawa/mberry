#!/usr/bin/env bun
/**
 * Wave G5 W5 — loading-state-hygiene gate.
 *
 * Wired into the pre-commit checklist. Steps:
 *   1. Regenerate CODE_COMPONENT_REGISTRY.json so the gate operates on fresh
 *      data (otherwise stale trace can mask real violations or false-flag fixes).
 *   2. Read loading_state_hygiene.violation on every component entry.
 *   3. Count `// oli-execute: skeleton-ok` exemptions tree-wide.
 *   4. Fail if any violation present OR exemption count > MAX_EXEMPTIONS.
 *
 * Exemption markers:
 *   `// oli-execute: skeleton-ok`            — explicit ack of intentional
 *                                              skeleton with no error branch.
 *                                              Capped at MAX_EXEMPTIONS tree-wide.
 *   `// oli-execute: error-handled-inline`   — 404-as-success / inline branch
 *                                              outside the skeleton path (no cap).
 */
import { readFileSync } from 'fs'
import { resolve, join } from 'path'
import { spawnSync } from 'child_process'

const ROOT = resolve(import.meta.dir, '..', '..')
const REGISTRY = join(ROOT, 'docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json')
const GENERATOR = join(ROOT, 'scripts/codebase-map/generate-component-flow.ts')

const MAX_EXEMPTIONS = 5

type Component = {
  file_path: string
  loading_state_hygiene?: {
    violation?: string | null
    has_skeleton_ok_marker?: boolean
  }
}

const skipRegen = process.argv.includes('--no-regen')
const changedOnly = process.argv.includes('--changed-only')
if (!skipRegen) {
  console.log('→ Regenerating component flow trace…')
  const r = spawnSync('bun', [GENERATOR], { cwd: ROOT, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error('✗ generate-component-flow.ts failed')
    process.exit(1)
  }
}

let changedFiles: Set<string> | null = null
if (changedOnly) {
  const r = spawnSync('git', ['diff', '--name-only', '--cached', '--diff-filter=ACMR'], { cwd: ROOT, encoding: 'utf8' })
  if (r.status !== 0) {
    console.error('✗ git diff failed; falling back to full-tree mode')
  } else {
    changedFiles = new Set(r.stdout.split('\n').map((s) => s.trim()).filter(Boolean))
    if (changedFiles.size === 0) {
      // Nothing staged — also accept unstaged working-tree changes so the gate
      // is useful during dev, not just at commit time.
      const r2 = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMR'], { cwd: ROOT, encoding: 'utf8' })
      if (r2.status === 0) {
        changedFiles = new Set(r2.stdout.split('\n').map((s) => s.trim()).filter(Boolean))
      }
    }
    console.log(`→ --changed-only: scoping to ${changedFiles.size} changed files`)
  }
}

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8')) as { components: Record<string, Component> }

const violations: { path: string; violation: string }[] = []
let skeletonOkCount = 0

for (const [path, comp] of Object.entries(registry.components)) {
  const h = comp.loading_state_hygiene
  if (!h) continue
  if (h.violation && (!changedFiles || changedFiles.has(path))) {
    violations.push({ path, violation: h.violation })
  }
  if (h.has_skeleton_ok_marker) skeletonOkCount++
}

console.log(`Violations:               ${violations.length}`)
console.log(`skeleton-ok exemptions:   ${skeletonOkCount} (cap ${MAX_EXEMPTIONS})`)

let failed = false

if (violations.length > 0) {
  console.error('\n✗ Components with skeleton-but-no-error-branch:')
  for (const v of violations.slice(0, 30)) {
    console.error(`  - ${v.path}: ${v.violation}`)
  }
  if (violations.length > 30) console.error(`  ...and ${violations.length - 30} more`)
  console.error(
    `\n  Fix: add an isError branch returning an error UI, OR add\n` +
    `       // oli-execute: skeleton-ok          (cap ${MAX_EXEMPTIONS} tree-wide), OR\n` +
    `       // oli-execute: error-handled-inline (no cap).`,
  )
  failed = true
}

if (skeletonOkCount > MAX_EXEMPTIONS) {
  console.error(`\n✗ skeleton-ok exemption count ${skeletonOkCount} exceeds cap ${MAX_EXEMPTIONS}.`)
  console.error('  Tighten exemptions or rework loading state.')
  failed = true
}

if (failed) process.exit(1)
console.log('\n✓ loading-state-hygiene gate passed')
