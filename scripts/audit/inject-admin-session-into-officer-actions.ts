#!/usr/bin/env bun
/**
 * **STATUS: experimental, NOT applied to repo specs.**
 *
 * Hurl's `[Cookies]` section *appends* to the cookie jar; it does NOT
 * overwrite. After a fresh sign-up, the user's `better-auth.session_token`
 * is already in the jar, so adding the admin token produces TWO entries
 * and the server picks the wrong one (Edge Host, not admin). Tried —
 * still 16 × 403 on the same spec list, see HEALTH_CHECK_PROGRESS.md §R1.
 *
 * The correct fix is per-spec rewrite: either sign-in as admin directly
 * (skip the sign-up + person migration) OR sign-out the fresh user first.
 * That choice is test-design judgment — leaving this script in the repo
 * as a starting point for a future targeted refactor.
 *
 * Original intent:
 *
 *   Symptom: scenarios sign up a fresh user, then immediately POST/PUT/PATCH
 *   /booking/events (or /association/*, /admin/*, etc.) expecting 201/200,
 *   and get 403 `Organization context required` (or similar). The fresh
 *   user is not a member of the seeded org.
 *
 *   Fix: inject `Cookie: better-auth.session_token={{admin_token}}` on the
 *   state-changing request — the contract runner already captures the admin
 *   session in its preflight (commit 5a9deabc) and exposes it as
 *   {{admin_token}}. Adding the cookie overrides the fresh user's session
 *   with the seeded president (multi-role admin).
 *
 *   Also inject `x-org-id: {{org_id}}` when the path matches a known
 *   org-scoped prefix and the header isn't already present. Runner is
 *   extended to provide the seeded ORG_ID as {{org_id}}.
 *
 * Conservative — only injects when ALL of:
 *   1. Request is POST/PUT/PATCH/DELETE
 *   2. Expected HTTP status is 200, 201, 204, or 202 (success path —
 *      4xx tests are auth-boundary checks; leave alone)
 *   3. Request doesn't already have a Cookie header (don't overwrite)
 *   4. Path doesn't start with /auth/ (Better-Auth handles its own session)
 *
 * Idempotent. Reversible — diff against the previous commit.
 *
 * Usage:
 *   bun scripts/audit/inject-admin-session-into-officer-actions.ts [--check] [--file <one.hurl>]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const fileIdx = args.indexOf('--file')
const targetDir = join(import.meta.dir, '..', '..', 'specs/api/tests/contract')

const ORG_SCOPED_PREFIXES = ['/association/', '/booking/', '/admin/', '/billing/', '/communications/', '/comms/']
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const SUCCESS_CODES = new Set([200, 201, 202, 204])

// Hurl APPENDS an explicit `Cookie:` header to the request — it does NOT
// replace cookie-jar entries. So a Cookie header AND a different cookie-jar
// entry for the same name produce TWO `Cookie:` headers; servers pick one,
// usually the wrong one. The Hurl idiom is the `[Cookies]` section, which
// OVERWRITES jar entries for that request.
//
// Header still works for non-cookie injections (x-org-id), but for the admin
// session we have to use [Cookies] — see HEALTH_CHECK_PROGRESS for the
// detailed trace.
const ORG_HEADER_LINE = 'x-org-id: {{org_id}}'
const COOKIES_BLOCK = [
  '[Cookies]',
  'better-auth.session_token: {{admin_token}}',
  'csrf_token: {{csrf_token}}',
]

interface FileStat {
  rel: string
  cookiesAdded: number
  orgHeadersAdded: number
}

function transformFile(content: string): { changed: boolean; output: string; cookiesAdded: number; orgHeadersAdded: number } {
  const lines = content.split('\n')
  const out: string[] = []
  let i = 0
  let cookiesAdded = 0
  let orgHeadersAdded = 0

  while (i < lines.length) {
    const line = lines[i]!
    out.push(line)

    const verbMatch = line.match(/^(POST|PUT|PATCH|DELETE)\s+(\S+)/)
    if (!verbMatch || !STATE_CHANGING_METHODS.has(verbMatch[1]!) || !line.includes('{{api}}')) {
      i++
      continue
    }

    const path = verbMatch[2]!.replace('{{api}}', '')
    // Skip auth endpoints — they own their own session story
    if (path.startsWith('/auth/')) {
      i++
      continue
    }

    // Walk header block. Find expected HTTP status. Track presence of x-org-id
    // and whether a [Cookies] section already follows (idempotence guard).
    let j = i + 1
    let hasOrgHeader = false
    let httpStatus = -1
    let lastHeaderIdx = i
    while (j < lines.length) {
      const next = lines[j]!
      if (next.trim() === '' || next.startsWith('{') || next.startsWith('[')) break
      const httpMatch = next.match(/^HTTP\s+(\d+)/)
      if (httpMatch) { httpStatus = Number(httpMatch[1]); break }
      if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/.test(next)) break
      const lc = next.toLowerCase()
      if (lc.startsWith('x-org-id:')) hasOrgHeader = true
      lastHeaderIdx = j
      j++
    }
    // Idempotence: if `[Cookies]` already exists immediately after this
    // request's HTTP <code> line, skip cookie injection.
    let hasCookie = false
    {
      let k = j
      // walk past body braces / blank lines until HTTP <code> + Captures/Cookies
      while (k < lines.length && !/^HTTP\s/.test(lines[k]!)) k++
      // walk past HTTP line and any [Asserts]/[Captures]/[Cookies] section
      for (let m = k + 1; m < Math.min(k + 12, lines.length); m++) {
        if (lines[m]!.trim() === '[Cookies]') { hasCookie = true; break }
      }
    }

    // Walk forward to find HTTP <code> line (may come after body)
    if (httpStatus === -1) {
      let k = j
      while (k < lines.length) {
        const m = lines[k]!.match(/^HTTP\s+(\d+)/)
        if (m) { httpStatus = Number(m[1]); break }
        if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/.test(lines[k]!)) break
        k++
      }
    }

    // Conservative gate
    if (!SUCCESS_CODES.has(httpStatus)) { i++; continue }

    const needsCookie = !hasCookie
    const needsOrgHeader = !hasOrgHeader && ORG_SCOPED_PREFIXES.some((p) => path.startsWith(p))
    if (!needsCookie && !needsOrgHeader) { i++; continue }

    // Push the remaining header lines first, then inject x-org-id (header) inline.
    for (let k = i + 1; k <= lastHeaderIdx; k++) out.push(lines[k]!)
    if (needsOrgHeader) { out.push(ORG_HEADER_LINE); orgHeadersAdded++ }

    // Inject [Cookies] — Hurl REQUEST section — between the headers and the
    // body / HTTP line. Per docs: "Optional request sections [QueryStringParams],
    // [FormParams], [MultipartFormData], [Cookies], [BasicAuth] can be in any
    // order BEFORE the body and BEFORE the HTTP response line."
    if (needsCookie) {
      for (const line of COOKIES_BLOCK) out.push(line)
      cookiesAdded++
    }
    i = lastHeaderIdx + 1
  }

  const output = out.join('\n')
  return { changed: output !== content, output, cookiesAdded, orgHeadersAdded }
}

const files = fileIdx >= 0
  ? [join(targetDir, args[fileIdx + 1]!)]
  : readdirSync(targetDir).filter((f) => f.endsWith('.hurl')).sort().map((f) => join(targetDir, f))

let totalCookies = 0
let totalOrgHeaders = 0
let changedFiles = 0
const stats: FileStat[] = []
for (const file of files) {
  const before = readFileSync(file, 'utf8')
  const { changed, output, cookiesAdded, orgHeadersAdded } = transformFile(before)
  if (!changed) continue
  changedFiles++
  totalCookies += cookiesAdded
  totalOrgHeaders += orgHeadersAdded
  stats.push({ rel: file.replace(targetDir + '/', ''), cookiesAdded, orgHeadersAdded })
  if (!checkOnly) writeFileSync(file, output, 'utf8')
}

const verb = checkOnly ? 'would inject' : 'injected'
console.log(`Scanned ${files.length} hurl files`)
console.log(`  ${changedFiles} ${checkOnly ? 'would change' : 'changed'}`)
console.log(`  ${totalCookies} admin_token cookie(s) ${verb}`)
console.log(`  ${totalOrgHeaders} x-org-id header(s) ${verb}`)
if (changedFiles > 0 && changedFiles <= 10) {
  for (const s of stats) console.log(`  ${s.rel}: +${s.cookiesAdded} cookie, +${s.orgHeadersAdded} x-org-id`)
}

if (checkOnly && changedFiles > 0) {
  console.error('\n[--check] admin_token + x-org-id drift detected. Run without --check to inject.')
  process.exit(1)
}
