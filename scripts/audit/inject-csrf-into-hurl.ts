#!/usr/bin/env bun
/**
 * Idempotent CSRF injector for Hurl contract scenarios.
 *
 * Pre-CSRF state: state-changing requests in .hurl files lacked the
 *   `x-csrf-token` header + the matching `csrf_token` cookie, so the
 *   middleware added in commit 9f23085c started returning 403 to all of them.
 *
 * Post-injection state per .hurl file:
 *   1. A preamble fetches GET /csrf-token and captures the token into
 *      `csrf_token`. Hurl auto-persists the Set-Cookie in the per-file jar.
 *   2. Every POST/PUT/PATCH/DELETE that targets {{api}} gets an
 *      `x-csrf-token: {{csrf_token}}` header injected right after the
 *      request line. Auth-bypass routes ({{api}}/auth/*) still receive
 *      the header; servers ignore the extra header on bypass paths.
 *
 * Idempotent: re-runs detect prior injection and skip.
 *
 * Usage:
 *   bun scripts/audit/inject-csrf-into-hurl.ts [--check] [--dir <path>]
 *
 *   --check : exit non-zero if any file would change (CI gate)
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const dirIdx = args.indexOf('--dir')
const targetDir = dirIdx >= 0 ? args[dirIdx + 1]! : join(import.meta.dir, '..', '..', 'specs', 'api', 'tests', 'contract')

const PREAMBLE = `# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"


`

const PREAMBLE_MARKER = '# CSRF preamble — fetches token + sets cookie for state-changing requests.'
// Two headers injected on every state-changing request:
//   - x-csrf-token: matches the cookie captured by the preamble (double-submit middleware)
//   - Origin: required by hono/csrf origin-verification middleware (app.ts:263);
//     value must match an entry in config.cors.origins. We use the memberry frontend
//     port (also matches the dev SDK's Origin), provided as {{origin}} by the runner.
const HEADER_BLOCK = 'x-csrf-token: {{csrf_token}}\nOrigin: {{origin}}'

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

interface Stats {
  filesScanned: number
  filesChanged: number
  preamblesAdded: number
  headersAdded: number
  skipped: number
}

const stats: Stats = {
  filesScanned: 0,
  filesChanged: 0,
  preamblesAdded: 0,
  headersAdded: 0,
  skipped: 0,
}

function transformFile(content: string): { changed: boolean; output: string; headersAdded: number; preambleAdded: boolean } {
  const lines = content.split('\n')
  const out: string[] = []
  let i = 0
  let headersAdded = 0

  // 1. Preamble — prepend if not present.
  const hasPreamble = content.includes(PREAMBLE_MARKER)
  let preambleAdded = false
  if (!hasPreamble) {
    out.push(PREAMBLE)
    preambleAdded = true
  }

  // 2. Walk lines. For each state-changing request line targeting {{api}},
  //    look ahead to see if x-csrf-token already in the header block; inject if not.
  while (i < lines.length) {
    const line = lines[i]!
    out.push(line)

    // Match: METHOD {{api}}/... at line start (ignore trailing whitespace)
    const m = line.match(/^(POST|PUT|PATCH|DELETE)\s+(\S+)/)
    if (m && STATE_CHANGING_METHODS.has(m[1]!) && line.includes('{{api}}')) {
      // Scan forward for header block (lines after request line, before body/HTTP/blank).
      // Header block ends at: empty line, or line starting with '{', '[', 'HTTP ', or another verb.
      let j = i + 1
      let alreadyHasCsrf = false
      let alreadyHasOrigin = false
      while (j < lines.length) {
        const next = lines[j]!
        if (next.trim() === '' || next.startsWith('{') || next.startsWith('[') || /^HTTP\s/.test(next) || /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/.test(next)) {
          break
        }
        const lc = next.toLowerCase()
        if (lc.startsWith('x-csrf-token:')) alreadyHasCsrf = true
        if (lc.startsWith('origin:')) alreadyHasOrigin = true
        j++
      }

      if (!alreadyHasCsrf) {
        out.push('x-csrf-token: {{csrf_token}}')
        headersAdded++
      }
      if (!alreadyHasOrigin) {
        out.push('Origin: {{origin}}')
        headersAdded++
      }
    }

    i++
  }

  const output = out.join('\n')
  const changed = output !== content
  return { changed, output, headersAdded, preambleAdded }
}

const files = readdirSync(targetDir)
  .filter((f) => f.endsWith('.hurl'))
  .sort()
  .map((f) => join(targetDir, f))

for (const file of files) {
  stats.filesScanned++
  const before = readFileSync(file, 'utf8')
  const { changed, output, headersAdded, preambleAdded } = transformFile(before)
  if (!changed) {
    stats.skipped++
    continue
  }
  stats.filesChanged++
  stats.headersAdded += headersAdded
  if (preambleAdded) stats.preamblesAdded++

  if (!checkOnly) {
    writeFileSync(file, output, 'utf8')
  }
}

const verb = checkOnly ? 'would change' : 'changed'
console.log(`Scanned ${stats.filesScanned} hurl files in ${targetDir}`)
console.log(`  ${stats.filesChanged} ${verb}`)
console.log(`  ${stats.preamblesAdded} CSRF preamble(s) ${checkOnly ? 'to add' : 'added'}`)
console.log(`  ${stats.headersAdded} x-csrf-token header(s) ${checkOnly ? 'to add' : 'added'}`)
console.log(`  ${stats.skipped} already up-to-date`)

if (checkOnly && stats.filesChanged > 0) {
  console.error('\n[--check] CSRF injection drift detected. Run without --check to fix.')
  process.exit(1)
}
