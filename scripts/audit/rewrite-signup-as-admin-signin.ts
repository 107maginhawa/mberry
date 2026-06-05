#!/usr/bin/env bun
/**
 * **STATUS: experimental — built and validated, but NOT applied.**
 *
 * Attempt #2 at automating the 16 × 403 contract residuals (attempt #1 was
 * `inject-admin-session-into-officer-actions.ts`, which failed because Hurl
 * [Cookies] appends to the jar instead of overwriting). This script tried
 * the next idea: replace `POST /auth/sign-up/email` with
 * `POST /auth/sign-in/email` as the seeded admin so the session-token
 * cookie gets properly REWRITTEN by the server's Set-Cookie response.
 *
 * Validated mechanically — 56 specs are eligible per the conservative gates
 * (skip auth-* specs, skip 4xx state-changes, skip multi-actor, skip
 * person_id in body fields). Targeted application to the 9 currently-failing
 * eligible specs left the contract pass rate at 61/99 — zero net change.
 * Investigation: the rewritten specs hit 400/403 on their next request
 * because the BODY SHAPE is also stale (admin+org context produces a
 * VALIDATION_ERROR with the current handler schema, not 201). The contract
 * specs have drifted across MULTIPLE dimensions (auth + body schema + id
 * lookups), so a per-spec hand-fix is the only safe path forward.
 *
 * Keeping the script in repo as a starting point for the eventual per-spec
 * audit; the eligibility classification is correct, the regex is right, only
 * the downstream-validation gap remains.
 *
 * Original intent:
 * for scenarios that only exercise success paths on officer endpoints.
 *
 * Why this is safer than the cookie-injection approach (commit b8fd8384):
 *   Hurl `[Cookies]` appends to the jar — fresh user's session_token wins.
 *   The only way to flip the active session is to issue a new sign-in,
 *   which the server responds to with `Set-Cookie: better-auth.session_token=...`
 *   and that DOES overwrite the jar entry.
 *
 * Conservative gates (skip the rewrite if any apply):
 *   1. File contains a state-change expecting 4xx (auth-boundary test)
 *   2. File has multiple distinct sign-ups (multi-actor scenario)
 *   3. Filename suggests it tests sign-up itself (auth-*, person-*)
 *   4. File captures `person_id` AND uses it in a body field (rewrite would
 *      change the value — admin's id, not the fresh user's). Captures alone
 *      are fine — the value just changes.
 *
 * Sign-up block becomes:
 *   POST {{api}}/auth/sign-in/email
 *   Origin: {{origin}}
 *   x-csrf-token: {{csrf_token}}
 *   Content-Type: application/json
 *   {
 *     "email": "{{admin_email}}",
 *     "password": "{{admin_password}}"
 *   }
 *   HTTP 200
 *   [Captures]
 *   person_id: jsonpath "$.user.id"
 *
 * Idempotent. Re-runnable.
 *
 * Usage:
 *   bun scripts/audit/rewrite-signup-as-admin-signin.ts [--check] [--file <one.hurl>]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const fileIdx = args.indexOf('--file')
const targetDir = join(import.meta.dir, '..', '..', 'specs/api/tests/contract')

const SKIP_FILENAME_PATTERNS = [
  /^auth-/,                 // auth-signup-signin, auth-password-reset — tests auth itself
  /^person-/,               // person-lifecycle, person-validation — tests person endpoint
  /^persons-/,              // persons-extended-flow
  /^security-officer-auth/, // tests officer auth specifically
  /^errors\.hurl$/,         // tests validation/error envelope
  /^public-flow/,
  /^cors/,
  /^health/,
  /^auth-verification/,
  /^read-all-flow/,
  /^impersonation/,
  /^onboarding/,
]

interface FileResult {
  rel: string
  rewritten: boolean
  skipReason?: string
}

function rewriteFile(content: string, filename: string): { changed: boolean; output: string; skipReason?: string } {
  for (const p of SKIP_FILENAME_PATTERNS) {
    if (p.test(filename)) return { changed: false, output: content, skipReason: `filename matches ${p}` }
  }

  // Count sign-up calls
  const signUpMatches = content.match(/^POST\s+\{\{api\}\}\/auth\/sign-up\/email/gm) ?? []
  if (signUpMatches.length === 0) return { changed: false, output: content, skipReason: 'no sign-up to rewrite' }
  if (signUpMatches.length > 1) return { changed: false, output: content, skipReason: `${signUpMatches.length} sign-ups (multi-actor)` }

  // Skip if file already migrated (uses admin sign-in)
  if (/POST\s+\{\{api\}\}\/auth\/sign-in\/email[\s\S]{0,200}\{\{admin_email\}\}/.test(content)) {
    return { changed: false, output: content, skipReason: 'admin sign-in already present' }
  }

  // Skip if there's a state-changing request expecting 4xx (auth-boundary test).
  // A 4xx on POST /auth/* is also an auth-boundary test we must preserve.
  const lines = content.split('\n')
  let i = 0
  let hasErrorTest = false
  while (i < lines.length) {
    const line = lines[i]!
    const verb = line.match(/^(POST|PUT|PATCH|DELETE)\s+(\S+)/)
    if (verb) {
      // walk forward to HTTP line
      let j = i + 1
      while (j < lines.length && !/^HTTP\s+(\d+)/.test(lines[j]!)) j++
      if (j < lines.length) {
        const code = Number(lines[j]!.match(/^HTTP\s+(\d+)/)![1])
        if (code >= 400 && code < 500) { hasErrorTest = true; break }
      }
    }
    i++
  }
  if (hasErrorTest) return { changed: false, output: content, skipReason: 'spec asserts 4xx on a state-change (auth-boundary test)' }

  // Skip if person_id is used inside a JSON body — its value changes (admin's id),
  // could break referential assumptions like "verify ownership of person X".
  // person_id in PATH params is fine (most cases) — it just resolves to admin.id,
  // and admin has access to themselves.
  const usesPersonIdInBody = /"\s*\w+\s*"\s*:\s*"\{\{person_id\}\}"/m.test(content)
  if (usesPersonIdInBody) return { changed: false, output: content, skipReason: 'person_id is referenced in a body field (could change semantics)' }

  // Rewrite: replace the sign-up block (POST line through [Captures] body) with
  // the admin sign-in block. Capture identical person_id from $.user.id.
  const signUpBlockRe = /^POST\s+\{\{api\}\}\/auth\/sign-up\/email\s*\n([\s\S]*?)HTTP\s+200\s*\n(?:\[Captures\]\s*\n[^\n]+\s*\n)?/m
  const signupMatch = signUpBlockRe.exec(content)
  if (!signupMatch) return { changed: false, output: content, skipReason: 'sign-up block does not match expected shape' }

  // Preserve the Origin/x-csrf-token/Content-Type header lines (Hurl needs them)
  const headerBlock = signupMatch[1]!
    .split('\n')
    .filter((ln) => /^(Origin|x-csrf-token|Content-Type):/i.test(ln.trim()))
    .join('\n')

  const replacement =
    `POST {{api}}/auth/sign-in/email\n` +
    `${headerBlock}\n` +
    `{\n` +
    `  "email": "{{seed_officer_email}}",\n` +
    `  "password": "{{seed_officer_password}}"\n` +
    `}\n` +
    `HTTP 200\n` +
    `[Captures]\n` +
    `person_id: jsonpath "$.user.id"\n`

  const output = content.replace(signUpBlockRe, replacement)
  if (output === content) return { changed: false, output, skipReason: 'replace produced no diff (regex mismatch)' }
  return { changed: true, output }
}

const files = fileIdx >= 0
  ? [join(targetDir, args[fileIdx + 1]!)]
  : readdirSync(targetDir).filter((f) => f.endsWith('.hurl')).sort().map((f) => join(targetDir, f))

const results: FileResult[] = []
let rewritten = 0
for (const file of files) {
  const rel = file.replace(targetDir + '/', '')
  const before = readFileSync(file, 'utf8')
  const { changed, output, skipReason } = rewriteFile(before, rel)
  if (changed) {
    rewritten++
    results.push({ rel, rewritten: true })
    if (!checkOnly) writeFileSync(file, output, 'utf8')
  } else {
    results.push({ rel, rewritten: false, skipReason })
  }
}

const verb = checkOnly ? 'would rewrite' : 'rewrote'
console.log(`Scanned ${files.length} hurl files`)
console.log(`  ${rewritten} ${verb} (sign-up → admin sign-in)`)

const reasons = new Map<string, number>()
for (const r of results.filter((r) => !r.rewritten && r.skipReason)) {
  reasons.set(r.skipReason!, (reasons.get(r.skipReason!) ?? 0) + 1)
}
if (reasons.size > 0) {
  console.log('  skipped:')
  for (const [reason, count] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${count}\t${reason}`)
  }
}

if (checkOnly && rewritten > 0) {
  console.error('\n[--check] sign-up → admin sign-in drift detected. Run without --check to rewrite.')
  process.exit(1)
}
