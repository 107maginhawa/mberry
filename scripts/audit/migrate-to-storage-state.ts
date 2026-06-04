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
  // Body must be exactly: `await signInAs<X>(page)` — single statement.
  const singleCallRe = /^await\s+(signInAs\w+)\s*\(\s*page\s*\)\s*;?\s*$/
  const callMatch = singleCallRe.exec(body)
  if (!callMatch) return { changed: false, output: content, skipReason: 'beforeEach has extra setup beyond signInAs<X>' }

  const fnName = callMatch[1]!
  const role = ROLE_MAP[fnName]
  if (!role) return { changed: false, output: content, skipReason: `unknown helper ${fnName}` }

  // Don't migrate if multiple personas signed in across the file
  const otherPersonaCalls = Object.keys(ROLE_MAP).filter((n) => n !== fnName)
  const switchesPersona = otherPersonaCalls.some((n) => new RegExp(`\\b${n}\\s*\\(`).test(content))
  if (switchesPersona) return { changed: false, output: content, skipReason: 'file switches between personas' }

  // Compute the relative import path from this spec to tests/e2e/helpers/auth-state.ts.
  // (Importing from auth.setup.ts directly is forbidden — that file has setup()
  // calls and Playwright treats it as a test file.)
  const specDir = dirname(join(targetDir, relPath))
  const setupAbs = join(targetDir, 'helpers/auth-state.ts')
  let relImport = relative(specDir, setupAbs).replace(/\.ts$/, '')
  if (!relImport.startsWith('.')) relImport = './' + relImport

  let next = content

  // 1. Remove the beforeEach block (handles a leading blank line too)
  next = next.replace(new RegExp(`\\n?\\s*${beforeEachRe.source}\\s*`, 's'), '\n')

  // 2. Remove the import of the signIn helper (if it was the only import from auth)
  next = next.replace(
    new RegExp(`import\\s*\\{\\s*${fnName}\\s*\\}\\s*from\\s*['"][^'"]*helpers\\/auth['"];?\\n`),
    '',
  )
  // 3. Or remove just the symbol from a multi-import
  next = next.replace(
    new RegExp(`(import\\s*\\{[^}]*?)\\b${fnName}\\s*,\\s*`),
    '$1',
  )
  next = next.replace(
    new RegExp(`(import\\s*\\{[^}]*?),\\s*${fnName}\\b([^}]*\\})`),
    '$1$2',
  )

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
