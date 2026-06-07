/**
 * Storage-state file paths for the persona setup project.
 *
 * Lives separately from `tests/e2e/auth.setup.ts` because Playwright
 * forbids spec files from importing other test files (auth.setup.ts has
 * `setup(...)` calls, making it a test file).
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const AUTH_DIR = join(__dirname, '..', '..', '..', '.auth')

export const AUTH_STATE_FILES = {
  officer: join(AUTH_DIR, 'officer.json'),
  member: join(AUTH_DIR, 'member.json'),
  treasurer: join(AUTH_DIR, 'treasurer.json'),
  secretary: join(AUTH_DIR, 'secretary.json'),
  society: join(AUTH_DIR, 'society.json'),
  idor: join(AUTH_DIR, 'idor.json'),
} as const

export type AuthRole = keyof typeof AUTH_STATE_FILES

export function authStateFile(role: AuthRole): string {
  return AUTH_STATE_FILES[role]
}

export { AUTH_DIR }
