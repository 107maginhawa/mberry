/**
 * Playwright global setup — runs once before any test/worker spawns.
 *
 * Restores known-mutable seeded rows (org name, contact, association
 * country/currency) to their canonical values. Without this, any spec
 * that PATCHes the seeded org (`pda-metro-manila` → "Updated-...")
 * leaves the suite poisoned for every subsequent run.
 *
 * Cheap (< 200ms — handful of UPDATEs).
 *
 * Wired in playwright.config.ts as `globalSetup`.
 */

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default async function globalSetup() {
  const apiTsDir = resolve(__dirname, '..', '..', '..', '..', 'services', 'api-ts')
  const result = spawnSync('bun', ['src/seed/reset-mutated.ts'], {
    cwd: apiTsDir,
    encoding: 'utf8',
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`seed-reset failed with exit code ${result.status}`)
  }
}
