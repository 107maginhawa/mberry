#!/usr/bin/env bun
/**
 * UI Consistency detector — scans .tsx files for UNANNOTATED detector matches per
 * docs/audits/PATTERNS.lock.md. Exits non-zero with a per-file report on failure.
 *
 * Usage:
 *   bun run scripts/ui-consistency-detect.ts <files...>          # small lists via argv
 *   bun run scripts/ui-consistency-detect.ts --stdin             # read newline-separated file list from stdin
 *   bun run scripts/ui-consistency-detect.ts --all               # auto-scan apps/**\/*.tsx
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dir, '..')

async function getFiles(): Promise<string[]> {
  const argv = process.argv.slice(2)
  if (argv[0] === '--stdin') {
    const chunks: Buffer[] = []
    for await (const c of process.stdin) chunks.push(c as Buffer)
    return Buffer.concat(chunks).toString('utf8').split(/\s+/).filter(Boolean).filter((f) => f.endsWith('.tsx'))
  }
  if (argv[0] === '--all') {
    return execSync('find apps -type f -name "*.tsx" -not -path "*/node_modules/*"', { encoding: 'utf8', cwd: ROOT })
      .trim()
      .split('\n')
      .filter(Boolean)
  }
  return argv.filter((f) => f.endsWith('.tsx'))
}

function hasExemptNear(file: string, line: number, window = 6): boolean {
  const src = fs.readFileSync(path.resolve(ROOT, file), 'utf8').split('\n')
  for (let i = Math.max(0, line - window); i < line; i++) {
    if (/ui-c-exempt:|ui-c-exempt-floor:/.test(src[i] || '')) return true
  }
  return false
}

function fileHeaderExempt(file: string): boolean {
  const abs = path.resolve(ROOT, file)
  if (!fs.existsSync(abs)) return false
  return /ui-c-exempt:/.test(fs.readFileSync(abs, 'utf8').split('\n').slice(0, 20).join('\n'))
}

function isButtonOverride(tok: string): boolean {
  if (/^bg-(red|green|amber|yellow|orange|blue|purple|pink|teal|emerald|sky|indigo|violet|fuchsia|rose|lime|cyan|gray|slate|zinc|stone|white|black)-?\d*(\/\d+)?$/.test(tok)) return true
  if (/^hover:bg-(red|green|amber|yellow|orange|blue|purple|pink|teal|emerald|sky|indigo|violet|fuchsia|rose|lime|cyan|gray|slate|zinc|stone)-?\d*(\/\d+)?$/.test(tok)) return true
  if (/^text-(red|green|amber|yellow|orange|blue|purple|pink|teal|emerald|sky|indigo|violet|fuchsia|rose|lime|cyan|gray|slate|zinc|white|black)-\d/.test(tok)) return true
  if (/^hover:text-(red|green|amber|yellow|orange|blue|purple|pink|teal|emerald|sky|indigo|violet|fuchsia|rose|lime|cyan|gray|slate|zinc)-\d/.test(tok)) return true
  if (/^h-\d+(\.\d+)?$/.test(tok) && tok !== 'h-auto' && tok !== 'h-full') return true
  if (/^h-\[\d+(\.\d+)?(px|rem|em)\]$/.test(tok)) return true
  if (/^w-\d+(\.\d+)?$/.test(tok) && tok !== 'w-auto' && tok !== 'w-full') return true
  if (/^w-\[\d+(\.\d+)?(px|rem|em)\]$/.test(tok)) return true
  if (/^px-\d+(\.\d+)?$/.test(tok)) return true
  if (/^py-\d+(\.\d+)?$/.test(tok)) return true
  if (/^rounded-\d+/.test(tok)) return true
  if (/\[#[0-9a-fA-F]/.test(tok)) return true
  return false
}

type Hit = { file: string; line: number; rule: string; detail: string }
const hits: Hit[] = []
const layoutP = [/\/__root\.tsx$/, /\/_authenticated\.tsx$/, /\.layout\.tsx$/, /\/route\.tsx$/]

// INTENTIONAL-EXEMPT route list — mirrors docs/audits/PATTERNS.lock.md "INTENTIONAL-EXEMPT routes".
// Routes here are by-design no-PageShell (own chrome / auth / public). Update both when adding/removing entries.
const INTENTIONAL_EXEMPT_ROUTES = new Set([
  // Auth-flow
  'apps/memberry/src/routes/auth/$authView.tsx',
  'apps/memberry/src/routes/verify-email.tsx',
  // Landing-page
  'apps/memberry/src/routes/index.tsx',
  // Onboarding-step
  'apps/memberry/src/routes/onboarding.tsx',
  'apps/memberry/src/routes/join.tsx',
  'apps/memberry/src/routes/invite/$token.tsx',
  // Public-verify
  'apps/memberry/src/routes/pay/$token.tsx',
  'apps/memberry/src/routes/verify/$token.tsx',
  'apps/memberry/src/routes/verify/$certificateNumber.tsx',
  'apps/memberry/src/routes/verify/$credentialNumber.tsx',
  'apps/memberry/src/routes/org/$slug.tsx',
  'apps/memberry/src/routes/events/$eventSlug.tsx',
  // Full-height-layout (officer + bookings shells own their chrome)
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer.tsx',
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dashboard.tsx',
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster.tsx',
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/$memberId.tsx',
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/communications.tsx',
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/payments.tsx',
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dues/assessments.tsx',
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dues/member.$memberId.tsx',
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dues/treasurer.tsx',
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/funds.tsx',
  'apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/dues.tsx',
  'apps/memberry/src/routes/_authenticated/my/bookings/index.tsx',
  'apps/memberry/src/routes/_authenticated/my/bookings/$bookingId.tsx',
  'apps/memberry/src/routes/_authenticated/my/bookings/host.$personId.tsx',
  'apps/memberry/src/routes/_authenticated/my/bookings/host.$personId.$slotId.tsx',
])

const files = await getFiles()
if (files.length === 0) process.exit(0)

for (const file of files) {
  const abs = path.resolve(ROOT, file)
  if (!fs.existsSync(abs)) continue
  const src = fs.readFileSync(abs, 'utf8')

  // Detector 1: Button override
  const btnRe = /<Button\b([\s\S]*?)>/g
  let m: RegExpExecArray | null
  while ((m = btnRe.exec(src)) !== null) {
    const cnStr = m[1].match(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/)
    if (!cnStr) continue
    const cnRaw = cnStr[1] || cnStr[2] || cnStr[3] || ''
    const tokens = cnRaw.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).filter(Boolean)
    const offending = tokens.filter(isButtonOverride)
    if (offending.length === 0) continue
    const line = src.slice(0, m.index).split('\n').length
    if (!hasExemptNear(file, line)) hits.push({ file, line, rule: 'button-override', detail: offending.join(',') })
  }

  // Detector 2A: Icon arbitrary size={N}
  // Canonical scale (no annotation needed): 12, 14, 16, 18, 20, 22, 24 (nav/body), 32, 40, 48 (EmptyState hero — Tier-F codified)
  const iconRe = /<\w+\s+[^>]*\bsize=\{(26|28|30|36|44)\}/g
  while ((m = iconRe.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length
    if (!hasExemptNear(file, line)) hits.push({ file, line, rule: 'icon-arbitrary-size', detail: `size={${m[1]}}` })
  }

  // Detector 2B: h-[Npx] w-[Npx]
  const hwRe = /className=(?:"|`)[^"`]*\bh-\[\d+(?:\.\d+)?px\]\s+w-\[\d+(?:\.\d+)?px\]/g
  while ((m = hwRe.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length
    if (!hasExemptNear(file, line)) hits.push({ file, line, rule: 'arbitrary-px-container', detail: '' })
  }

  // Detector 3: Hex leakage
  const hexRe = /className=(?:"[^"]*#[0-9a-fA-F]{3,8}[^"]*"|\{`[^`]*#[0-9a-fA-F]{3,8}[^`]*`\})/g
  while ((m = hexRe.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length
    if (!hasExemptNear(file, line)) hits.push({ file, line, rule: 'hex-leakage', detail: '' })
  }

  // Detector 4: PageShell-missing (only for .tsx under routes/)
  if (/apps\/(memberry|admin)\/src\/routes\//.test(file)) {
    if (layoutP.some((p) => p.test(file))) continue
    if (INTENTIONAL_EXEMPT_ROUTES.has(file)) continue
    if (!/<PageShell\b|import.*PageShell/.test(src) && !fileHeaderExempt(file)) {
      hits.push({ file, line: 1, rule: 'pageshell-missing', detail: 'route without PageShell or exempt annotation' })
    }
  }
}

if (hits.length === 0) {
  process.exit(0)
}

console.error('\nUI consistency ratchet violation(s) — see docs/audits/PATTERNS.lock.md\n')
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  [${h.rule}]${h.detail ? '  ' + h.detail : ''}`)
}
console.error('\nFix the violation or add an inline annotation:')
console.error("  // ui-c-exempt: <category> — <one-line reason>\n")
process.exit(1)
