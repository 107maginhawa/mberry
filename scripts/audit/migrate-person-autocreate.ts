#!/usr/bin/env bun
/**
 * Migrate Hurl contract scenarios to the sign-up auto-create-person reality.
 *
 * Before: each scenario did POST /auth/sign-up/email → 200, then POST /persons
 *   → 201, capturing `person_id: jsonpath "$.id"` for later use. The Better-Auth
 *   `user.create.after` hook now auto-creates a person row with id=user.id,
 *   so the explicit POST /persons returns 409 `User already has a person profile`.
 *
 * After: this script deletes the now-redundant POST /persons block in each
 *   scenario and moves its `[Captures] person_id: jsonpath "$.id"` onto the
 *   preceding sign-up response as `[Captures] person_id: jsonpath "$.user.id"`.
 *
 * Safety analysis (run before authoring this script):
 *   grep -c '{{person_<field>}}' showed ZERO references to person.firstName,
 *   lastName, email, address, phone, gender, or dateOfBirth across all .hurl
 *   files. The only downstream variable used is `{{person_id}}`, which
 *   sign-up's user.id satisfies (the auto-create uses id=user.id for a
 *   strict 1:1 relationship).
 *
 * Idempotent: re-runs detect the migrated state and skip.
 *
 * Usage:
 *   bun scripts/audit/migrate-person-autocreate.ts [--check] [--dir <path>]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const dirIdx = args.indexOf('--dir')
const targetDir = dirIdx >= 0 ? args[dirIdx + 1]! : join(import.meta.dir, '..', '..', 'specs', 'api', 'tests', 'contract')

const SIGNUP_LINE = /^POST\s+\{\{api\}\}\/auth\/sign-up\/email\s*$/
const POST_PERSONS_LINE = /^POST\s+\{\{api\}\}\/persons\s*$/
const HTTP_LINE = /^HTTP\s+(\d+)\s*$/
// Only drop POST /persons blocks that intend to CREATE a person profile (expects 201).
// POST /persons blocks expecting 400/401/403/404 are validation / auth-failure tests
// for the endpoint itself — those must stay.
const CREATE_PERSON_STATUS = 201
const CAPTURES_LINE = /^\[Captures\]\s*$/
const PERSON_ID_CAPTURE = /^person_id\s*:\s*jsonpath\s+"\$\.id"\s*$/

interface Stats {
  filesScanned: number
  filesChanged: number
  blocksRemoved: number
  capturesMoved: number
  skipped: number
}
const stats: Stats = { filesScanned: 0, filesChanged: 0, blocksRemoved: 0, capturesMoved: 0, skipped: 0 }

/**
 * Find the block of lines that constitute a single Hurl request:
 * starts at `startIdx`, ends after the HTTP <code> line and any [Captures] /
 * [Asserts] sections that follow before the next blank-blank or next verb.
 * Returns [start, end) range (end-exclusive).
 */
function findRequestBlock(lines: string[], startIdx: number): { end: number; httpIdx: number; httpStatus: number; capturesPersonId: boolean } {
  let i = startIdx + 1
  let httpIdx = -1
  let httpStatus = -1
  let capturesPersonId = false
  let sawCaptures = false

  while (i < lines.length) {
    const line = lines[i]!
    if (httpIdx === -1) {
      const m = HTTP_LINE.exec(line)
      if (m) {
        httpIdx = i
        httpStatus = Number(m[1])
        i++
        continue
      }
    }
    if (httpIdx !== -1) {
      if (CAPTURES_LINE.test(line)) {
        sawCaptures = true
        i++
        continue
      }
      if (sawCaptures && PERSON_ID_CAPTURE.test(line)) {
        capturesPersonId = true
        i++
        continue
      }
      // End of block: blank line followed by blank, or next verb, or [Asserts] under different request — keep walking until blank
      if (line.trim() === '') {
        // Look ahead — if next non-empty is a new verb or another blank, block ends here.
        let j = i + 1
        while (j < lines.length && lines[j]!.trim() === '') j++
        if (j >= lines.length) return { end: j, httpIdx, httpStatus, capturesPersonId }
        if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/.test(lines[j]!)) {
          return { end: j, httpIdx, httpStatus, capturesPersonId }
        }
        // continuation inside same block (rare — [Asserts] after blank)
        i = j
        continue
      }
    }
    i++
  }
  return { end: lines.length, httpIdx, httpStatus, capturesPersonId }
}

function transformFile(content: string): { changed: boolean; output: string; blocksRemoved: number; capturesMoved: number } {
  const lines = content.split('\n')
  const out: string[] = []
  let i = 0
  let blocksRemoved = 0
  let capturesMoved = 0

  while (i < lines.length) {
    const line = lines[i]!

    if (SIGNUP_LINE.test(line)) {
      // Capture sign-up block boundaries
      const signupBlock = findRequestBlock(lines, i)
      // Emit lines from sign-up start up to and including HTTP line
      const signupHttpIdx = signupBlock.httpIdx
      for (let k = i; k <= signupHttpIdx; k++) out.push(lines[k]!)

      // Detect if there is already a [Captures] block immediately under sign-up's HTTP line
      let cursor = signupHttpIdx + 1
      let hasUserIdCapture = false
      while (cursor < lines.length && (lines[cursor]!.trim() === '' || CAPTURES_LINE.test(lines[cursor]!) || lines[cursor]!.startsWith('person_id') || lines[cursor]!.startsWith('user_id'))) {
        if (lines[cursor]! === 'person_id: jsonpath "$.user.id"') hasUserIdCapture = true
        cursor++
      }

      // Peek: is the NEXT request (after blanks) the now-redundant POST /persons?
      let peek = signupBlock.end
      while (peek < lines.length && lines[peek]!.trim() === '') peek++
      const nextIsPostPersons = peek < lines.length && POST_PERSONS_LINE.test(lines[peek]!)

      if (nextIsPostPersons) {
        const personsBlock = findRequestBlock(lines, peek)
        // CRITICAL: only drop the block if it intends to create a person (expects 201).
        // Validation / auth-failure tests on POST /persons (400, 401, 403, 404, 409) must stay.
        if (personsBlock.httpStatus === CREATE_PERSON_STATUS) {
          if (!hasUserIdCapture) {
            out.push('[Captures]')
            out.push('person_id: jsonpath "$.user.id"')
            capturesMoved++
          }
          blocksRemoved++
          i = personsBlock.end
          if (out[out.length - 1] !== '') out.push('')
          continue
        }
        // Else: leave the POST /persons block intact (it's a test of the endpoint, not a precondition).
      }
      // Not followed by POST /persons OR POST /persons is a test, not precondition — continue normally
      i = signupHttpIdx + 1
      continue
    }

    out.push(line)
    i++
  }

  const output = out.join('\n')
  return { changed: output !== content, output, blocksRemoved, capturesMoved }
}

const files = readdirSync(targetDir)
  .filter((f) => f.endsWith('.hurl'))
  .sort()
  .map((f) => join(targetDir, f))

for (const file of files) {
  stats.filesScanned++
  const before = readFileSync(file, 'utf8')
  const { changed, output, blocksRemoved, capturesMoved } = transformFile(before)
  if (!changed) {
    stats.skipped++
    continue
  }
  stats.filesChanged++
  stats.blocksRemoved += blocksRemoved
  stats.capturesMoved += capturesMoved
  if (!checkOnly) writeFileSync(file, output, 'utf8')
}

const verb = checkOnly ? 'would change' : 'changed'
console.log(`Scanned ${stats.filesScanned} hurl files in ${targetDir}`)
console.log(`  ${stats.filesChanged} ${verb}`)
console.log(`  ${stats.blocksRemoved} redundant POST /persons block(s) ${checkOnly ? 'to drop' : 'dropped'}`)
console.log(`  ${stats.capturesMoved} person_id capture(s) ${checkOnly ? 'to hoist' : 'hoisted'} onto sign-up`)
console.log(`  ${stats.skipped} already migrated`)

if (checkOnly && stats.filesChanged > 0) {
  console.error('\n[--check] person-autocreate migration drift detected. Run without --check to fix.')
  process.exit(1)
}
