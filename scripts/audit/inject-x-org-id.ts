#!/usr/bin/env bun
/**
 * Add `x-org-id: {{org_id}}` to every Hurl request targeting an org-scoped
 * path that doesn't already have one. Org-scoped middleware refuses with
 * 403 "Organization context required" otherwise.
 *
 * Conservative — only adds the header when the path matches a known org-scoped
 * prefix. Skips requests that already have an x-org-id (idempotent) or that
 * encode the org as a path param.
 *
 * Usage:
 *   bun scripts/audit/inject-x-org-id.ts [--check]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const targetDir = join(import.meta.dir, '..', '..', 'specs/api/tests/contract')

const ORG_PREFIXES = [
  '/association/',
  '/communications/',
  '/comms/',
  '/billing/',
  '/booking/',
  '/email/templates',
  '/email/preferences',
  '/email/queue',
]

const HEADER_LINE = 'x-org-id: {{org_id}}'

let filesChanged = 0
let headersAdded = 0
let filesScanned = 0

for (const fn of readdirSync(targetDir).filter((f) => f.endsWith('.hurl')).sort()) {
  filesScanned++
  const path = join(targetDir, fn)
  const before = readFileSync(path, 'utf8')
  const lines = before.split('\n')
  const out: string[] = []
  let added = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    out.push(line)
    const m = line.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\{\{api\}\}\/[^\s?]+)/)
    if (!m) continue
    const path = m[2]!.replace('{{api}}', '')
    if (!ORG_PREFIXES.some((p) => path.startsWith(p))) continue
    // Skip if path already encodes org id literal or via {{org_id}} variable
    if (path.includes('{{org_id}}') || /\/[a-f0-9-]{36}/i.test(path)) continue

    // Walk the header block, check for existing x-org-id (case-insensitive)
    let j = i + 1
    let hasOrg = false
    let lastHeaderIdx = i
    while (j < lines.length) {
      const next = lines[j]!
      if (next.trim() === '' || next.startsWith('{') || next.startsWith('[') || /^HTTP\s/.test(next) || /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/.test(next)) break
      if (next.toLowerCase().startsWith('x-org-id:')) hasOrg = true
      lastHeaderIdx = j
      j++
    }
    if (hasOrg) continue

    // Emit remaining header lines, then inject x-org-id, then advance
    for (let k = i + 1; k <= lastHeaderIdx; k++) out.push(lines[k]!)
    out.push(HEADER_LINE)
    added++
    i = lastHeaderIdx
  }

  if (added > 0) {
    filesChanged++
    headersAdded += added
    if (!checkOnly) writeFileSync(path, out.join('\n'), 'utf8')
  }
}

const verb = checkOnly ? 'would add' : 'added'
console.log(`Scanned ${filesScanned} hurl files`)
console.log(`  ${filesChanged} ${checkOnly ? 'would change' : 'changed'}`)
console.log(`  ${headersAdded} x-org-id header(s) ${verb}`)

if (checkOnly && filesChanged > 0) {
  console.error('\n[--check] x-org-id drift detected. Run without --check to inject.')
  process.exit(1)
}
