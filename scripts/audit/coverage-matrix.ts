#!/usr/bin/env bun
/**
 * Coverage Matrix — three views over what the test suites actually exercise.
 *
 *  Matrix A — BR → tests
 *    Source: docs/ver-3/business/br-registry.json (authoritative)
 *    Per BR row: list backend/contract/e2e refs, verify each file exists,
 *    flag rows with zero coverage on any axis.
 *
 *  Matrix B — Flow → E2E spec
 *    Source: docs/product/WORKFLOW_MAP.md (table rows with WF-NNN)
 *    Per WF row: grep apps/*\/tests/e2e for `WF-NNN` mentions.
 *
 *  Matrix C — Route → E2E `page.goto`
 *    Source: apps/memberry/src/routes/**, apps/admin/src/routes/**
 *    Per route: convert file path to URL pattern, grep e2e specs for matching
 *    page.goto() invocations.
 *
 * Output:
 *   - docs/audits/COVERAGE_MATRIX.md  (human-readable tables)
 *   - .audits/coverage-matrix.json    (machine-readable for CI gate)
 *
 * Usage:
 *   bun scripts/audit/coverage-matrix.ts
 *   bun scripts/audit/coverage-matrix.ts --gate   (exit non-zero on regressions)
 */

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { Glob } from 'bun'
import { join, relative } from 'node:path'
import { ratchetCheck, countUndeferredPhase1Gaps } from './ratchet'

const repoRoot = join(import.meta.dir, '..', '..')
const args = process.argv.slice(2)
const gateMode = args.includes('--gate')

// ───────────────────────────────────────────────────────────────────────────────
// Matrix A — BR → tests
// ───────────────────────────────────────────────────────────────────────────────

interface BRRow {
  rule: string
  phase: number
  module: string
  ruleClass: string
  tests: { backend: string[]; contract: string[]; e2e: string[] }
  annotations?: string
  deferredReason?: string
}

interface BRResult {
  id: string
  rule: string
  phase: number
  module: string
  ruleClass: string
  backend: { count: number; missing: string[] }
  contract: { count: number; missing: string[] }
  e2e: { count: number; missing: string[] }
  verdict: 'COMPLETE' | 'INCOMPLETE' | 'UNTESTED'
  deferred: boolean
}

function checkRefs(refs: string[]): { count: number; missing: string[] } {
  const missing: string[] = []
  for (const ref of refs) {
    const abs = join(repoRoot, ref)
    if (!existsSync(abs) || statSync(abs).size === 0) missing.push(ref)
  }
  return { count: refs.length, missing }
}

function auditBRRegistry(): BRResult[] {
  const path = join(repoRoot, 'docs/ver-3/business/br-registry.json')
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, BRRow>
  const results: BRResult[] = []
  for (const [id, row] of Object.entries(raw)) {
    const backend = checkRefs(row.tests?.backend ?? [])
    const contract = checkRefs(row.tests?.contract ?? [])
    const e2e = checkRefs(row.tests?.e2e ?? [])
    const total = backend.count + contract.count + e2e.count
    const totalMissing = backend.missing.length + contract.missing.length + e2e.missing.length
    let verdict: BRResult['verdict']
    if (total === 0) verdict = 'UNTESTED'
    else if (totalMissing > 0) verdict = 'INCOMPLETE'
    else verdict = 'COMPLETE'
    results.push({
      id,
      rule: row.rule,
      phase: row.phase,
      module: row.module,
      ruleClass: row.ruleClass,
      backend,
      contract,
      e2e,
      verdict,
      deferred: Boolean(row.deferredReason),
    })
  }
  return results.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
}

// ───────────────────────────────────────────────────────────────────────────────
// Matrix B — Flow → E2E spec
// ───────────────────────────────────────────────────────────────────────────────

interface FlowRow {
  id: string
  module: string
  type: string
  description: string
}

interface FlowResult extends FlowRow {
  refs: string[]
  verdict: 'COVERED' | 'MISSING'
}

function parseWorkflowMap(): FlowRow[] {
  const path = join(repoRoot, 'docs/product/WORKFLOW_MAP.md')
  if (!existsSync(path)) return []
  const md = readFileSync(path, 'utf8')
  const rows: FlowRow[] = []
  // Match table rows: | WF-NNN | M0X | type | description | source |
  const re = /^\|\s*(WF-\d+)\s*\|\s*(M\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm
  let m
  while ((m = re.exec(md)) !== null) {
    rows.push({ id: m[1]!, module: m[2]!, type: m[3]!.trim(), description: m[4]!.trim() })
  }
  return rows
}

async function gatherE2EFiles(): Promise<string[]> {
  const files: string[] = []
  for (const pattern of ['apps/memberry/tests/e2e/**/*.spec.ts', 'apps/admin/tests/e2e/**/*.spec.ts']) {
    const glob = new Glob(pattern)
    for await (const p of glob.scan({ cwd: repoRoot })) files.push(p)
  }
  return files
}

async function auditFlows(): Promise<FlowResult[]> {
  const flows = parseWorkflowMap()
  const e2eFiles = await gatherE2EFiles()
  const fileContents = new Map<string, string>()
  for (const f of e2eFiles) {
    fileContents.set(f, readFileSync(join(repoRoot, f), 'utf8'))
  }
  const results: FlowResult[] = []
  for (const flow of flows) {
    const refs: string[] = []
    for (const [path, body] of fileContents) {
      if (body.includes(flow.id)) refs.push(path)
    }
    results.push({ ...flow, refs, verdict: refs.length > 0 ? 'COVERED' : 'MISSING' })
  }
  return results
}

// ───────────────────────────────────────────────────────────────────────────────
// Matrix C — Route → E2E page.goto
// ───────────────────────────────────────────────────────────────────────────────

interface RouteResult {
  app: 'memberry' | 'admin'
  path: string         // URL form, e.g. /org/$orgSlug/dashboard
  fileRel: string
  refs: string[]
  verdict: 'COVERED' | 'MISSING'
}

function routeFilesToUrlPaths(app: 'memberry' | 'admin'): { fileRel: string; urlPath: string }[] {
  const baseRel = `apps/${app}/src/routes`
  const base = join(repoRoot, baseRel)
  if (!existsSync(base)) return []
  const out: { fileRel: string; urlPath: string }[] = []
  const glob = new Glob('**/*.tsx')
  for (const f of glob.scanSync({ cwd: base })) {
    // Skip __root, layout, server-only files
    if (f === '__root.tsx') continue
    // Convert file path to TanStack file-based route URL:
    //   _authenticated.tsx          → (layout, skip)
    //   _authenticated/dashboard.tsx → /dashboard
    //   _authenticated/org/$orgSlug/dues.tsx → /org/$orgSlug/dues
    //   _authenticated/org/$orgSlug/route.tsx → /org/$orgSlug
    //   index.tsx                    → /
    let url = f
      .replace(/\.tsx$/, '')
      .replace(/(^|\/)index$/, '$1') // index → ''
      .replace(/\/route$/, '')        // route → '' (layout-with-data)
      .replace(/^_authenticated\/?/, '')
      .replace(/^_/, '')              // leading layout segments
    url = url.split('/').filter((seg) => !seg.startsWith('_')).join('/')
    if (url === '') url = '/'
    else if (!url.startsWith('/')) url = '/' + url
    if (url === '/__root') continue
    out.push({ fileRel: `${baseRel}/${f}`, urlPath: url })
  }
  return out
}

async function auditRoutes(): Promise<RouteResult[]> {
  const e2eFiles = await gatherE2EFiles()
  const fileContents = new Map<string, string>()
  for (const f of e2eFiles) fileContents.set(f, readFileSync(join(repoRoot, f), 'utf8'))

  const results: RouteResult[] = []
  for (const app of ['memberry', 'admin'] as const) {
    const routes = routeFilesToUrlPaths(app)
    for (const r of routes) {
      // Convert TanStack $param to a regex matcher: $orgSlug → [^/'"`]+
      // We match against page.goto("...") string-literal contents.
      const pattern = r.urlPath
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\$\w+/g, '[^/\'"`]+')
      const re = new RegExp(`page\\.goto\\(\\s*[\\'\\"\`][^\\'\\"\`]*${pattern}(?:[/?\\'\\"\`]|$)`)
      const refs: string[] = []
      for (const [path, body] of fileContents) {
        if (re.test(body)) refs.push(path)
      }
      results.push({
        app,
        path: r.urlPath,
        fileRel: r.fileRel,
        refs,
        verdict: refs.length > 0 ? 'COVERED' : 'MISSING',
      })
    }
  }
  return results
}

// ───────────────────────────────────────────────────────────────────────────────
// Output rendering
// ───────────────────────────────────────────────────────────────────────────────

function renderMatrixA(rows: BRResult[]): string {
  const byVerdict = { COMPLETE: 0, INCOMPLETE: 0, UNTESTED: 0 }
  for (const r of rows) byVerdict[r.verdict]++
  const lines: string[] = []
  lines.push('## Matrix A — BR → tests')
  lines.push('')
  lines.push(`Source: \`docs/ver-3/business/br-registry.json\` (${rows.length} BRs)`)
  lines.push('')
  const deferredPhase1 = rows.filter((r) => r.deferred && r.phase === 1 && r.verdict !== 'COMPLETE')
  lines.push(`- ✅ COMPLETE: ${byVerdict.COMPLETE}`)
  lines.push(`- ⚠️ INCOMPLETE (file ref points at missing/empty): ${byVerdict.INCOMPLETE}`)
  lines.push(`- ❌ UNTESTED (zero refs across BE+contract+E2E): ${byVerdict.UNTESTED}`)
  lines.push(
    `- 🟡 Phase-1 gaps excluded from gate via \`deferredReason\` (reviewed known-gaps): ${deferredPhase1.length}${deferredPhase1.length ? ` — ${deferredPhase1.map((r) => r.id).join(', ')}` : ''}`,
  )
  lines.push('')
  lines.push('| BR | Phase | Module | Class | Verdict | BE | Contract | E2E | Missing |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    const missing = [...r.backend.missing, ...r.contract.missing, ...r.e2e.missing]
    const m = missing.length === 0 ? '—' : missing.slice(0, 2).join(', ') + (missing.length > 2 ? ` (+${missing.length - 2})` : '')
    lines.push(`| \`${r.id}\` | ${r.phase} | ${r.module} | ${r.ruleClass} | ${r.verdict} | ${r.backend.count - r.backend.missing.length}/${r.backend.count} | ${r.contract.count - r.contract.missing.length}/${r.contract.count} | ${r.e2e.count - r.e2e.missing.length}/${r.e2e.count} | ${m} |`)
  }
  return lines.join('\n')
}

function renderMatrixB(rows: FlowResult[]): string {
  const covered = rows.filter((r) => r.verdict === 'COVERED').length
  const missing = rows.filter((r) => r.verdict === 'MISSING').length
  const byModule = new Map<string, { covered: number; missing: number }>()
  for (const r of rows) {
    const m = byModule.get(r.module) ?? { covered: 0, missing: 0 }
    if (r.verdict === 'COVERED') m.covered++
    else m.missing++
    byModule.set(r.module, m)
  }
  const lines: string[] = []
  lines.push('## Matrix B — Flow → E2E spec')
  lines.push('')
  lines.push(`Source: \`docs/product/WORKFLOW_MAP.md\` (${rows.length} flows)`)
  lines.push('')
  lines.push(`- ✅ COVERED: ${covered}`)
  lines.push(`- ❌ MISSING (no E2E spec mentions WF-id): ${missing}`)
  lines.push('')
  lines.push('| Module | Covered | Missing |')
  lines.push('|---|---|---|')
  for (const [m, c] of [...byModule.entries()].sort()) lines.push(`| ${m} | ${c.covered} | ${c.missing} |`)
  lines.push('')
  lines.push('### Missing flows (drop into E2E backlog)')
  lines.push('')
  lines.push('| WF | Module | Type | Description |')
  lines.push('|---|---|---|---|')
  for (const r of rows.filter((r) => r.verdict === 'MISSING')) {
    lines.push(`| \`${r.id}\` | ${r.module} | ${r.type} | ${r.description} |`)
  }
  return lines.join('\n')
}

function renderMatrixC(rows: RouteResult[]): string {
  const byApp = { memberry: { covered: 0, missing: 0 }, admin: { covered: 0, missing: 0 } }
  for (const r of rows) {
    if (r.verdict === 'COVERED') byApp[r.app].covered++
    else byApp[r.app].missing++
  }
  const lines: string[] = []
  lines.push('## Matrix C — Route → E2E `page.goto`')
  lines.push('')
  lines.push(`Source: file-based routes under \`apps/*/src/routes\` (${rows.length} routes total)`)
  lines.push('')
  lines.push(`- ✅ memberry COVERED: ${byApp.memberry.covered} / ${byApp.memberry.covered + byApp.memberry.missing}`)
  lines.push(`- ✅ admin COVERED:    ${byApp.admin.covered} / ${byApp.admin.covered + byApp.admin.missing}`)
  lines.push('')
  lines.push('### Missing route coverage')
  lines.push('')
  lines.push('| App | URL Path | Route File |')
  lines.push('|---|---|---|')
  for (const r of rows.filter((r) => r.verdict === 'MISSING').sort((a, b) => a.app.localeCompare(b.app) || a.path.localeCompare(b.path))) {
    lines.push(`| ${r.app} | \`${r.path}\` | \`${r.fileRel}\` |`)
  }
  return lines.join('\n')
}

// ───────────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────────

console.log('Auditing BRs…')
const aRows = auditBRRegistry()
console.log(`  ${aRows.length} BRs`)

console.log('Auditing flows…')
const bRows = await auditFlows()
console.log(`  ${bRows.length} flows`)

console.log('Auditing routes…')
const cRows = await auditRoutes()
console.log(`  ${cRows.length} routes (${cRows.filter((r) => r.app === 'memberry').length} memberry, ${cRows.filter((r) => r.app === 'admin').length} admin)`)

const reportPath = join(repoRoot, 'docs/audits/COVERAGE_MATRIX.md')
mkdirSync(join(repoRoot, 'docs/audits'), { recursive: true })
const md = [
  '# COVERAGE_MATRIX.md — BR + Flow + Route Coverage',
  '',
  `Generated by \`scripts/audit/coverage-matrix.ts\` on ${new Date().toISOString()}.`,
  '',
  '> Run `bun scripts/audit/coverage-matrix.ts` to regenerate.',
  '',
  '---',
  '',
  renderMatrixA(aRows),
  '',
  '---',
  '',
  renderMatrixB(bRows),
  '',
  '---',
  '',
  renderMatrixC(cRows),
].join('\n')
writeFileSync(reportPath, md)
console.log(`\nWrote ${relative(repoRoot, reportPath)}`)

const jsonPath = join(repoRoot, '.audits/coverage-matrix.json')
mkdirSync(join(repoRoot, '.audits'), { recursive: true })
writeFileSync(jsonPath, JSON.stringify({ A: aRows, B: bRows, C: cRows }, null, 2))
console.log(`Wrote ${relative(repoRoot, jsonPath)}`)

// Gate — baseline ratchet. Fails only when a gap GROWS vs .audits/coverage-baseline.json.
// Pass --update-baseline after closing gaps to ratchet the baseline down.
if (gateMode) {
  const current = {
    a: countUndeferredPhase1Gaps(aRows),
    b: bRows.filter((r) => r.verdict === 'MISSING').length,
    c: cRows.filter((r) => r.verdict === 'MISSING').length,
  }
  const baselinePath = join(import.meta.dir, 'coverage-baseline.json')

  if (args.includes('--update-baseline')) {
    writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n')
    console.log(`\nUpdated baseline → A=${current.a} B=${current.b} C=${current.c}`)
    process.exit(0)
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { a: number; b: number; c: number }
  const { pass, regressions, improvements } = ratchetCheck(current, baseline)
  console.log(`\nGate (ratchet vs baseline A=${baseline.a} B=${baseline.b} C=${baseline.c}):`)
  console.log(`  current: A=${current.a} B=${current.b} C=${current.c}`)
  for (const i of improvements) console.log(`  ✓ improved ${i} — run with --update-baseline to lock it in`)
  if (!pass) {
    for (const r of regressions) console.error(`  ✗ REGRESSION ${r}`)
    console.error('  Coverage gap grew. Add the missing test/spec or justify, then re-run.')
    process.exit(1)
  }
  console.log('  ✓ no regression vs baseline')
  process.exit(0)
}
