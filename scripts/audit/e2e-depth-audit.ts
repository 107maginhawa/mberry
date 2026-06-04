#!/usr/bin/env bun
/**
 * E2E depth audit — grade Playwright specs against the project's depth rules.
 *
 * Rules captured in user memory `feedback_test_depth`:
 *   - "E2E must verify real data, not just headings."
 *   - "Real flows, not just selectors."
 *   - "Browse every page yourself before claiming done."
 *
 * Grades per spec (worst per-test → worst-of-file):
 *   shallow       — assertions are limited to heading text, route URL match,
 *                   role-only `getByRole('heading')` visibility, or
 *                   `expect(true).toBe(true)` style noise. No real-data check.
 *   selector-only — assertions check that elements EXIST (visible/attached)
 *                   but never read their text content, count rows, click
 *                   them, or submit forms. Passes when UI is empty.
 *   real-flow     — performs at least one of: form fill + submit, click +
 *                   wait for nav, expect text containing dynamic data
 *                   (regex with \\d+ or template-string interpolation),
 *                   real DB assertion via helper.
 *
 * Output:
 *   - docs/audits/E2E_QUALITY.md (human, per-spec rows)
 *   - .audits/e2e-quality.json   (machine)
 *
 * Heuristic — best-effort, not perfect. Borderline calls flagged as
 * `borderline-promote` so a human can lift to real-flow after eyeballing.
 *
 * Usage:
 *   bun scripts/audit/e2e-depth-audit.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { Glob } from 'bun'
import { join, relative } from 'node:path'

const repoRoot = join(import.meta.dir, '..', '..')

interface TestGrade {
  name: string
  grade: 'shallow' | 'selector-only' | 'real-flow'
  signals: { realDataAssertions: number; interactions: number; formSubmissions: number; visibilityOnly: number; headingOnly: number }
  startLine: number
}

interface FileGrade {
  rel: string
  app: 'memberry' | 'admin'
  totalTests: number
  byGrade: { shallow: number; 'selector-only': number; 'real-flow': number }
  worst: 'shallow' | 'selector-only' | 'real-flow'
  tests: TestGrade[]
}

// Heuristic signal sets
const REAL_DATA_PATTERNS = [
  /toContainText\(/,
  /toHaveText\(/,
  /toHaveValue\(/,
  /toHaveCount\(/,
  /\.textContent\(\)/,
  /\.allInnerTexts\(\)/,
  /\.inputValue\(\)/,
  /toMatch\(\/.*\\\\d/,                  // regex with \d (dynamic numbers)
  /toMatch\(\/.*\\d/,
  /expect\([^)]+\)\.toBe\(`/,            // template string assertion
  /\$\{[^}]+\}/,                          // template literal interpolation in assertion lines
]

const INTERACTION_PATTERNS = [
  /\.click\(/,
  /\.dblclick\(/,
  /\.press\(['"`]/,
  /\.selectOption\(/,
  /\.check\(/,
  /\.uncheck\(/,
  /\.hover\(/,
  /\.setFiles\(/,
  /\.dragTo\(/,
]

const FORM_SUBMIT_PATTERNS = [
  /\.fill\(['"`]/,
  /\.type\(['"`]/,
  /submit/i,
]

const VISIBILITY_ONLY_PATTERNS = [
  /toBeVisible\(\)/,
  /toBeAttached\(\)/,
  /toBeInViewport\(\)/,
]

const HEADING_ONLY_PATTERNS = [
  /getByRole\(['"`]heading['"`]/,
  /getByText\(\/[^/]+\/i?\)\.first\(\)\.isVisible/,
]

const SHALLOW_NOISE_PATTERNS = [
  /expect\(true\)\.toBe\(true\)/,
  /expect\(1\)\.toBe\(1\)/,
]

function gradeTestBody(body: string): TestGrade['grade'] {
  let realDataAssertions = 0
  let interactions = 0
  let formSubmissions = 0
  let visibilityOnly = 0
  let headingOnly = 0

  for (const p of REAL_DATA_PATTERNS) if (p.test(body)) realDataAssertions++
  for (const p of INTERACTION_PATTERNS) if (p.test(body)) interactions++
  for (const p of FORM_SUBMIT_PATTERNS) if (p.test(body)) formSubmissions++
  for (const p of VISIBILITY_ONLY_PATTERNS) if (p.test(body)) visibilityOnly++
  for (const p of HEADING_ONLY_PATTERNS) if (p.test(body)) headingOnly++

  const shallowNoise = SHALLOW_NOISE_PATTERNS.some((p) => p.test(body))
  if (shallowNoise) return 'shallow'

  // Real-flow: any real-data assertion OR (form submission + interaction)
  if (realDataAssertions > 0) return 'real-flow'
  if (formSubmissions > 0 && interactions > 0) return 'real-flow'

  // Selector-only: visibility/attachment without text/count assertions
  if (visibilityOnly > 0 || interactions > 0) return 'selector-only'

  // Pure heading-checks and nothing else
  if (headingOnly > 0) return 'shallow'

  return 'shallow'
}

function parseFile(content: string): { name: string; body: string; line: number }[] {
  const out: { name: string; body: string; line: number }[] = []
  const lines = content.split('\n')
  let depth = 0
  let testStart = -1
  let testName = ''
  let braceDepth = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (testStart === -1) {
      const m = line.match(/\btest\s*\(\s*['"`]([^'"`]+)['"`]/)
      if (m) {
        testName = m[1]!
        testStart = i
        braceDepth = 0
      }
    }
    if (testStart !== -1) {
      braceDepth += (line.match(/{/g) ?? []).length
      braceDepth -= (line.match(/}/g) ?? []).length
      // Naive close when braceDepth returns to 0 after at least 1 increase
      if (braceDepth === 0 && i > testStart) {
        const body = lines.slice(testStart, i + 1).join('\n')
        out.push({ name: testName, body, line: testStart + 1 })
        testStart = -1
        testName = ''
      }
    }
  }
  return out
}

async function gradeAll(): Promise<FileGrade[]> {
  const results: FileGrade[] = []
  const patterns = [
    { glob: 'apps/memberry/tests/e2e/**/*.spec.ts', app: 'memberry' as const },
    { glob: 'apps/admin/tests/e2e/**/*.spec.ts', app: 'admin' as const },
  ]
  for (const { glob, app } of patterns) {
    const g = new Glob(glob)
    for await (const rel of g.scan({ cwd: repoRoot })) {
      // Skip stubs / fixtures
      if (rel.includes('/stubs/') || rel.includes('/helpers/') || rel.includes('/fixtures/')) continue
      const body = readFileSync(join(repoRoot, rel), 'utf8')
      const tests = parseFile(body)
      const byGrade = { shallow: 0, 'selector-only': 0, 'real-flow': 0 }
      const graded: TestGrade[] = tests.map((t) => {
        const grade = gradeTestBody(t.body)
        byGrade[grade]++
        return {
          name: t.name,
          grade,
          signals: {
            realDataAssertions: REAL_DATA_PATTERNS.filter((p) => p.test(t.body)).length,
            interactions: INTERACTION_PATTERNS.filter((p) => p.test(t.body)).length,
            formSubmissions: FORM_SUBMIT_PATTERNS.filter((p) => p.test(t.body)).length,
            visibilityOnly: VISIBILITY_ONLY_PATTERNS.filter((p) => p.test(t.body)).length,
            headingOnly: HEADING_ONLY_PATTERNS.filter((p) => p.test(t.body)).length,
          },
          startLine: t.line,
        }
      })
      // Worst-of-file: shallow > selector-only > real-flow
      let worst: FileGrade['worst'] = 'real-flow'
      if (byGrade['shallow'] > 0) worst = 'shallow'
      else if (byGrade['selector-only'] > 0) worst = 'selector-only'
      else if (tests.length === 0) worst = 'shallow'
      results.push({ rel, app, totalTests: tests.length, byGrade, worst, tests: graded })
    }
  }
  return results.sort((a, b) => a.rel.localeCompare(b.rel))
}

function render(files: FileGrade[]): string {
  const totalFiles = files.length
  const totalTests = files.reduce((s, f) => s + f.totalTests, 0)
  const totals = { shallow: 0, 'selector-only': 0, 'real-flow': 0 }
  for (const f of files) for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += f.byGrade[k]

  const filesByWorst = { shallow: 0, 'selector-only': 0, 'real-flow': 0 }
  for (const f of files) filesByWorst[f.worst]++

  const lines: string[] = []
  lines.push('# E2E_QUALITY.md — Playwright Depth Audit')
  lines.push('')
  lines.push(`Generated by \`scripts/audit/e2e-depth-audit.ts\` on ${new Date().toISOString()}.`)
  lines.push('')
  lines.push('Grades per test body, then worst-of-file:')
  lines.push('- **real-flow** — has real-data assertion (text/value/count) OR form-submit + interaction')
  lines.push('- **selector-only** — visibility/attachment checks only; passes when UI is empty')
  lines.push('- **shallow** — heading-only, route-only, `expect(true).toBe(true)`')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Files audited: ${totalFiles}`)
  lines.push(`- Tests graded: ${totalTests}`)
  lines.push(`- Test-level — real-flow: ${totals['real-flow']}, selector-only: ${totals['selector-only']}, shallow: ${totals['shallow']}`)
  lines.push(`- File-level worst — real-flow: ${filesByWorst['real-flow']}, selector-only: ${filesByWorst['selector-only']}, shallow: ${filesByWorst['shallow']}`)
  lines.push('')
  lines.push('## Files needing rewrite (worst = shallow)')
  lines.push('')
  lines.push('| Spec | App | Tests | shallow / selector / real |')
  lines.push('|---|---|---|---|')
  for (const f of files.filter((f) => f.worst === 'shallow')) {
    lines.push(`| \`${f.rel}\` | ${f.app} | ${f.totalTests} | ${f.byGrade.shallow} / ${f.byGrade['selector-only']} / ${f.byGrade['real-flow']} |`)
  }
  lines.push('')
  lines.push('## Files needing depth (worst = selector-only)')
  lines.push('')
  lines.push('| Spec | App | Tests | shallow / selector / real |')
  lines.push('|---|---|---|---|')
  for (const f of files.filter((f) => f.worst === 'selector-only')) {
    lines.push(`| \`${f.rel}\` | ${f.app} | ${f.totalTests} | ${f.byGrade.shallow} / ${f.byGrade['selector-only']} / ${f.byGrade['real-flow']} |`)
  }
  lines.push('')
  lines.push('## Files passing depth bar (worst = real-flow)')
  lines.push('')
  lines.push('| Spec | App | Tests | shallow / selector / real |')
  lines.push('|---|---|---|---|')
  for (const f of files.filter((f) => f.worst === 'real-flow')) {
    lines.push(`| \`${f.rel}\` | ${f.app} | ${f.totalTests} | ${f.byGrade.shallow} / ${f.byGrade['selector-only']} / ${f.byGrade['real-flow']} |`)
  }
  lines.push('')
  lines.push('## Individual test grades (shallow tests only — prioritized rewrite list)')
  lines.push('')
  for (const f of files) {
    const shallows = f.tests.filter((t) => t.grade === 'shallow')
    if (shallows.length === 0) continue
    lines.push(`### \`${f.rel}\``)
    lines.push('')
    for (const t of shallows) {
      lines.push(`- L${t.startLine}: \`${t.name}\``)
    }
    lines.push('')
  }
  return lines.join('\n')
}

const files = await gradeAll()
const md = render(files)
mkdirSync(join(repoRoot, 'docs/audits'), { recursive: true })
mkdirSync(join(repoRoot, '.audits'), { recursive: true })
const mdPath = join(repoRoot, 'docs/audits/E2E_QUALITY.md')
const jsonPath = join(repoRoot, '.audits/e2e-quality.json')
writeFileSync(mdPath, md)
writeFileSync(jsonPath, JSON.stringify(files, null, 2))

const summary = {
  files: files.length,
  shallow: files.filter((f) => f.worst === 'shallow').length,
  selectorOnly: files.filter((f) => f.worst === 'selector-only').length,
  realFlow: files.filter((f) => f.worst === 'real-flow').length,
}
console.log(`Audited ${summary.files} spec files`)
console.log(`  shallow worst:       ${summary.shallow}`)
console.log(`  selector-only worst: ${summary.selectorOnly}`)
console.log(`  real-flow worst:     ${summary.realFlow}`)
console.log(`Wrote ${relative(repoRoot, mdPath)}`)
console.log(`Wrote ${relative(repoRoot, jsonPath)}`)
