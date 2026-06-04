#!/usr/bin/env bun
/**
 * Migrate Playwright specs from `beforeEach(signInAs<X>)` to the storage-state
 * setup project (tests/e2e/auth.setup.ts).
 *
 * Pattern targeted (conservative — only the simplest form):
 *
 *   import { signInAsMember } from '../helpers/auth'
 *   ...
 *   test.beforeEach(async ({ page }) => {
 *     await signInAsMember(page)
 *   })
 *
 * Becomes:
 *
 *   import { test } from '@playwright/test'   // or preserve existing
 *   import { authStateFile } from '../auth.setup'
 *   test.use({ storageState: authStateFile('member') })
 *   // beforeEach block removed (or kept if it had additional setup)
 *
 * Skipped scenarios (not migrated automatically — left for human review):
 *   - beforeEach with multiple statements beyond signIn (e.g. extra
 *     page.goto + waitForLoadState — those need preserving)
 *   - Files that switch personas mid-test (call signInAsOfficer + signInAsMember)
 *   - Files using raw signIn(page, EMAIL, PASSWORD) — those use non-shared
 *     accounts or test signin itself
 *
 * Idempotent. Re-run safely.
 *
 * Usage:
 *   bun scripts/audit/migrate-to-storage-state.ts [--check] [--dir <path>]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { Glob } from 'bun'
import { join, relative, dirname } from 'node:path'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const dirIdx = args.indexOf('--dir')
const repoRoot = join(import.meta.dir, '..', '..')
const targetDir = dirIdx >= 0 ? args[dirIdx + 1]! : join(repoRoot, 'apps/memberry/tests/e2e')

const ROLE_MAP: Record<string, 'officer' | 'member' | 'treasurer' | 'secretary' | 'society' | 'idor'> = {
  signInAsOfficer: 'officer',
  signInAsAdmin: 'officer', // alias — same SEED_OFFICER_EMAIL per auth.ts
  signInAsMember: 'member',
  signInAsTreasurer: 'treasurer',
  signInAsSecretary: 'secretary',
  signInAsSociety: 'society',
}

// `signIn(page, SEED_X_EMAIL, ...)` → role lookup. Maps the email-constant
// name (NOT the value) to a role. Same source of truth as helpers/auth.ts.
const RAW_SIGNIN_EMAIL_TO_ROLE: Record<string, 'officer' | 'member' | 'treasurer' | 'secretary' | 'society' | 'idor'> = {
  SEED_OFFICER_EMAIL: 'officer',
  SEED_MEMBER_EMAIL: 'member',
  SEED_TREASURER_EMAIL: 'treasurer',
  SEED_SECRETARY_EMAIL: 'secretary',
  SEED_SOCIETY_EMAIL: 'society',
  SEED_IDOR_EMAIL: 'idor',
  // Common per-file aliases of the same constants
  MEMBER_EMAIL: 'member',
  OFFICER_EMAIL: 'officer',
}

interface FileResult {
  rel: string
  migrated: boolean
  role?: string
  skipReason?: string
}

const results: FileResult[] = []

function migrateFileContent(content: string, relPath: string): { changed: boolean; output: string; role?: string; skipReason?: string } {
  // Skip the auth helpers themselves
  if (relPath.includes('helpers/auth.ts') || relPath.endsWith('auth.setup.ts')) {
    return { changed: false, output: content, skipReason: 'helper or setup file' }
  }

  // Detect a single-statement beforeEach that only calls a known signInAsX helper.
  // Captures the helper name for role mapping.
  const beforeEachRe = /(test\.beforeEach\s*\(\s*async\s*\(\s*\{\s*page[^}]*\}\s*\)\s*=>\s*\{)([^{}]+?)(\}\s*\))/s

  const match = beforeEachRe.exec(content)
  if (!match) return { changed: false, output: content, skipReason: 'no test.beforeEach found' }

  const body = match[2]!.trim()

  // Variant A: single `await signInAs<X>(page)` call
  const singleHelperRe = /^await\s+(signInAs\w+)\s*\(\s*page\s*\)\s*;?\s*$/
  // Variant B: single `await signIn(page, SEED_X_EMAIL, ...)` call
  const singleRawRe = /^await\s+signIn\s*\(\s*page\s*,\s*(\w+)\s*,/
  // Variant C: signIn (raw or helper) + a single `await page.goto(...)` afterward
  const helperPlusGotoRe = /^await\s+(signInAs\w+)\s*\(\s*page\s*\)\s*;?\s*\n\s*(await\s+page\.goto\([^)]+\)\s*;?)\s*$/s
  const rawPlusGotoRe = /^await\s+signIn\s*\(\s*page\s*,\s*(\w+)\s*,[^)]+\)\s*;?\s*\n\s*(await\s+page\.goto\([^)]+\)\s*;?)\s*$/s

  let fnName: string | null = null
  let emailConst: string | null = null
  let preservedTail: string | null = null

  let m
  if ((m = singleHelperRe.exec(body))) {
    fnName = m[1]!
  } else if ((m = singleRawRe.exec(body))) {
    emailConst = m[1]!
  } else if ((m = helperPlusGotoRe.exec(body))) {
    fnName = m[1]!
    preservedTail = m[2]!
  } else if ((m = rawPlusGotoRe.exec(body))) {
    emailConst = m[1]!
    preservedTail = m[2]!
  } else {
    return { changed: false, output: content, skipReason: 'beforeEach has extra setup beyond signInAs<X>' }
  }

  const role: string | undefined = fnName
    ? ROLE_MAP[fnName]
    : RAW_SIGNIN_EMAIL_TO_ROLE[emailConst!]
  if (!role) return { changed: false, output: content, skipReason: `unknown auth call (${fnName ?? emailConst})` }

  // Don't migrate if multiple personas signed in across the file
  const otherHelperNames = Object.keys(ROLE_MAP).filter((n) => n !== fnName)
  const otherEmailNames = Object.keys(RAW_SIGNIN_EMAIL_TO_ROLE).filter((n) => n !== emailConst)
  const switchesPersona =
    otherHelperNames.some((n) => new RegExp(`\\b${n}\\s*\\(`).test(content)) ||
    otherEmailNames.some((n) => new RegExp(`\\bsignIn\\s*\\(\\s*page\\s*,\\s*${n}\\b`).test(content))
  if (switchesPersona) return { changed: false, output: content, skipReason: 'file switches between personas' }

  // Compute the relative import path from this spec to tests/e2e/helpers/auth-state.ts.
  // (Importing from auth.setup.ts directly is forbidden — that file has setup()
  // calls and Playwright treats it as a test file.)
  const specDir = dirname(join(targetDir, relPath))
  const setupAbs = join(targetDir, 'helpers/auth-state.ts')
  let relImport = relative(specDir, setupAbs).replace(/\.ts$/, '')
  if (!relImport.startsWith('.')) relImport = './' + relImport

  let next = content

  // 1. Replace the beforeEach block. If a goto was preserved, rebuild a
  //    minimal beforeEach that does just the navigation; else strip entirely.
  if (preservedTail) {
    next = next.replace(beforeEachRe, `test.beforeEach(async ({ page }) => {\n    ${preservedTail}\n  })`)
  } else {
    next = next.replace(new RegExp(`\\n?\\s*${beforeEachRe.source}\\s*`, 's'), '\n')
  }

  // 2. Remove the auth-helper import that is no longer used.
  //    fnName-style imports: `signInAsX` from '../helpers/auth'
  //    raw-signin imports:  `signIn` from '../helpers/auth' — only if no other
  //                         usage of signIn remains in the file.
  const removedSymbol = fnName ?? 'signIn'
  const stillUsed = new RegExp(`\\b${removedSymbol}\\s*\\(`).test(next.replace(beforeEachRe, ''))
  if (!stillUsed) {
    // single-import line removal
    next = next.replace(
      new RegExp(`import\\s*\\{\\s*${removedSymbol}\\s*\\}\\s*from\\s*['"][^'"]*helpers\\/auth['"];?\\n`),
      '',
    )
    // multi-import: drop the symbol
    next = next.replace(
      new RegExp(`(import\\s*\\{[^}]*?)\\b${removedSymbol}\\s*,\\s*`),
      '$1',
    )
    next = next.replace(
      new RegExp(`(import\\s*\\{[^}]*?),\\s*${removedSymbol}\\b([^}]*\\})`),
      '$1$2',
    )
  }

  // 3. Remove the SEED_X_EMAIL + TEST_PASSWORD imports if no other usage
  //    remains. Conservative — only touch test-config imports.
  if (emailConst) {
    const stillUsedEmail = new RegExp(`\\b${emailConst}\\b`).test(next.replace(beforeEachRe, ''))
    if (!stillUsedEmail) {
      next = next.replace(
        new RegExp(`(import\\s*\\{[^}]*?)\\b${emailConst}\\s*,\\s*`),
        '$1',
      )
      next = next.replace(
        new RegExp(`(import\\s*\\{[^}]*?),\\s*${emailConst}\\b([^}]*\\})`),
        '$1$2',
      )
    }
    const stillUsesPassword = /\bTEST_PASSWORD\b/.test(next.replace(beforeEachRe, ''))
    if (!stillUsesPassword) {
      next = next.replace(
        new RegExp(`(import\\s*\\{[^}]*?)\\bTEST_PASSWORD\\s*,\\s*`),
        '$1',
      )
      next = next.replace(
        new RegExp(`(import\\s*\\{[^}]*?),\\s*TEST_PASSWORD\\b([^}]*\\})`),
        '$1$2',
      )
    }
  }

  // 4. Insert `test.use({ storageState: authStateFile('<role>') })` after the existing imports.
  //    Also add the authStateFile import if not present.
  if (!next.includes('authStateFile')) {
    // Find the last import line and append the new import after it.
    const importBlockRe = /(^(?:import[^\n]+\n)+)/m
    next = next.replace(importBlockRe, (m) => `${m}import { authStateFile } from '${relImport}'\n`)
  }

  // Insert test.use right after the import block (idempotent — skip if already there)
  if (!new RegExp(`test\\.use\\s*\\(\\s*\\{\\s*storageState:\\s*authStateFile\\(['"]${role}['"]\\)`).test(next)) {
    next = next.replace(
      /^((?:import[^\n]+\n)+\n?)/m,
      `$1\ntest.use({ storageState: authStateFile('${role}') })\n`,
    )
  }

  return { changed: next !== content, output: next, role }
}

const glob = new Glob('**/*.spec.ts')
let migrated = 0
for await (const rel of glob.scan({ cwd: targetDir })) {
  if (rel.includes('/stubs/')) continue
  const path = join(targetDir, rel)
  const before = readFileSync(path, 'utf8')
  const result = migrateFileContent(before, rel)
  if (result.changed) {
    migrated++
    results.push({ rel, migrated: true, role: result.role })
    if (!checkOnly) writeFileSync(path, result.output, 'utf8')
  } else {
    results.push({ rel, migrated: false, skipReason: result.skipReason })
  }
}

console.log(`Scanned ${results.length} specs`)
console.log(`  ${migrated} ${checkOnly ? 'would migrate' : 'migrated'}`)
const skipReasons = new Map<string, number>()
for (const r of results.filter((r) => !r.migrated && r.skipReason)) {
  skipReasons.set(r.skipReason!, (skipReasons.get(r.skipReason!) ?? 0) + 1)
}
console.log('  skipped breakdown:')
for (const [reason, count] of [...skipReasons.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${count}\t${reason}`)
}

if (checkOnly && migrated > 0) {
  console.error('\n[--check] migration would change files. Run without --check to apply.')
  process.exit(1)
}
