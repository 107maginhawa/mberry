/**
 * Playwright setup project — signs each persona in ONCE per suite run and
 * dumps the cookie jar to `.auth/<role>.json`. Spec files declare the
 * matching `storageState` via `test.use(...)` to skip the UI sign-in flow
 * entirely (~3-5s per test × 166 calls saved).
 *
 * See docs/audits/E2E_TIMEOUT_ROOT_CAUSE.md §6.
 *
 * Wired up in `playwright.config.ts` as a project named `setup` that runs
 * before chromium/mobile via `dependencies`.
 */

import { test as setup, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import {
  TEST_PASSWORD,
  SEED_OFFICER_EMAIL,
  SEED_MEMBER_EMAIL,
  SEED_TREASURER_EMAIL,
  SEED_SECRETARY_EMAIL,
  SEED_SOCIETY_EMAIL,
  SEED_IDOR_EMAIL,
} from './helpers/test-config'

const AUTH_DIR = join(__dirname, '..', '..', '.auth')
mkdirSync(AUTH_DIR, { recursive: true })

const STATE_FILES = {
  officer: join(AUTH_DIR, 'officer.json'),
  member: join(AUTH_DIR, 'member.json'),
  treasurer: join(AUTH_DIR, 'treasurer.json'),
  secretary: join(AUTH_DIR, 'secretary.json'),
  society: join(AUTH_DIR, 'society.json'),
  idor: join(AUTH_DIR, 'idor.json'),
} as const

export type AuthRole = keyof typeof STATE_FILES
export const authStateFile = (role: AuthRole): string => STATE_FILES[role]

async function signInAndSave(page: import('@playwright/test').Page, email: string, storagePath: string) {
  await page.goto('/auth/sign-in')

  const submit = page.getByRole('button', { name: /login|sign in/i })
  await expect(submit).toBeVisible({ timeout: 10000 })

  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)

  const loginResponse = page
    .waitForResponse(
      (resp) => resp.url().includes('/auth/sign-in') && resp.request().method() === 'POST',
      { timeout: 10000 },
    )
    .catch(() => null)

  await submit.click()
  const response = await loginResponse
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>')
    throw new Error(`Setup sign-in failed for ${email} (${response.status()}): ${body.slice(0, 200)}`)
  }

  // Wait for the redirect off /auth/. Allow /auth/verify-email gate too.
  await page.waitForURL(
    (url) =>
      !url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/auth/verify-email'),
    { timeout: 10000 },
  )

  mkdirSync(dirname(storagePath), { recursive: true })
  await page.context().storageState({ path: storagePath })
}

setup('authenticate as officer', async ({ page }) => {
  await signInAndSave(page, SEED_OFFICER_EMAIL, STATE_FILES.officer)
})

setup('authenticate as member', async ({ page }) => {
  await signInAndSave(page, SEED_MEMBER_EMAIL, STATE_FILES.member)
})

setup('authenticate as treasurer', async ({ page }) => {
  await signInAndSave(page, SEED_TREASURER_EMAIL, STATE_FILES.treasurer)
})

setup('authenticate as secretary', async ({ page }) => {
  await signInAndSave(page, SEED_SECRETARY_EMAIL, STATE_FILES.secretary)
})

setup('authenticate as society', async ({ page }) => {
  await signInAndSave(page, SEED_SOCIETY_EMAIL, STATE_FILES.society)
})

setup('authenticate as idor officer', async ({ page }) => {
  await signInAndSave(page, SEED_IDOR_EMAIL, STATE_FILES.idor)
})
