/**
 * E2E tests for Officer Settings module:
 * - Org Profile
 * - Officers
 * - Membership Categories
 * - Payment Gateway
 * - Providers
 *
 * NOTE: Uses flat test() calls (no test.describe/test.beforeEach) due to
 * Playwright 1.58.2 compatibility issue.
 */
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureAnyApiSuccess } from '../helpers/real-flow'

const ORG_ID = process.env.TEST_ORG_ID ?? 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const ORG_SLUG = ORG_ID

async function login(page: import('@playwright/test').Page) {
  await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
}

// ─── Org Profile ────────────────────────────────────────────────────────────

test('Settings > Org Profile renders form with org data', async ({ page }) => {
  await login(page)
  const respP = captureAnyApiSuccess(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/org`)
  await expect(
    page.getByRole('heading', { name: /organization settings/i })
  ).toBeVisible({ timeout: 10000 })
  const resp = await respP
  expect(resp?.status()).toBe(200)
  expect(resp?.ok()).toBe(true)

  await expect(
    page.getByRole('heading', { name: /organization profile/i })
  ).toBeVisible({ timeout: 10000 })

  const editBtn = page.getByRole('button', { name: /edit/i })
  await expect(editBtn).toBeVisible({ timeout: 10000 })
})

test('Settings > Org Profile edit mode shows inputs', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/org`)
  const editBtn = page.getByRole('button', { name: /edit/i })
  await expect(editBtn).toBeVisible({ timeout: 10000 })
  await editBtn.click()

  await expect(page.getByRole('button', { name: /save/i })).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible({ timeout: 5000 })

  const nameInput = page.locator('input').first()
  await expect(nameInput).toBeVisible({ timeout: 5000 })
})

// ─── Officers ───────────────────────────────────────────────────────────────

test('Settings > Officers page renders', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/officers`)
  await expect(
    page.getByRole('heading', { name: /officer management/i })
  ).toBeVisible({ timeout: 10000 })

  const addBtn = page.getByRole('button', { name: /add|assign|new/i }).first()
  const hasTable = await page.locator('table').isVisible().catch(() => false)
  const hasEmpty = await page.getByText(/no officers|empty|assign/i).first().isVisible().catch(() => false)
  const hasBtn = await addBtn.isVisible().catch(() => false)

  expect(hasBtn || hasTable || hasEmpty).toBeTruthy()
})

// ─── Membership Categories ──────────────────────────────────────────────────

test('Settings > Categories page renders', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/membership-categories`)
  await expect(
    page.getByRole('heading', { name: /membership categories/i })
  ).toBeVisible({ timeout: 10000 })

  const addBtn = page.getByRole('button', { name: /add category/i })
  await expect(addBtn).toBeVisible({ timeout: 10000 })

  const hasTable = await page.locator('table').isVisible().catch(() => false)
  const hasEmpty = await page.getByText(/no categories/i).first().isVisible().catch(() => false)
  expect(hasTable || hasEmpty).toBeTruthy()
})

test('Settings > Categories Add dialog opens', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/membership-categories`)
  const addBtn = page.getByRole('button', { name: /add category/i })
  await expect(addBtn).toBeVisible({ timeout: 10000 })
  await addBtn.click()

  await expect(page.getByText(/add membership category/i)).toBeVisible({ timeout: 5000 })
  await expect(page.locator('#cat-name')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('#cat-dues')).toBeVisible({ timeout: 5000 })
})

// ─── Payment Gateway ────────────────────────────────────────────────────────

test('Settings > Payment Gateway renders', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/gateway`)
  await expect(
    page.getByRole('heading', { name: /payment gateway/i })
  ).toBeVisible({ timeout: 10000 })

  const hasContent = await page.getByText(/stripe|connect|gateway|configuration|payment/i).first().isVisible().catch(() => false)
  expect(hasContent).toBeTruthy()
})

// ─── Providers ──────────────────────────────────────────────────────────────

test('Settings > Providers page renders', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/providers`)
  await expect(
    page.getByRole('heading', { name: /accredited providers/i })
  ).toBeVisible({ timeout: 10000 })

  const newBtn = page.getByRole('button', { name: /new provider/i })
  await expect(newBtn).toBeVisible({ timeout: 10000 })
})

test('Settings > Providers table or empty state', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/providers`)
  await page.waitForTimeout(2000)

  const hasTable = await page.locator('table').isVisible().catch(() => false)
  const hasEmpty = await page.getByText(/no providers yet/i).first().isVisible().catch(() => false)
  expect(hasTable || hasEmpty).toBeTruthy()
})

test('Settings > Providers create dialog opens', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/providers`)
  await page.getByRole('button', { name: /new provider/i }).click()

  await expect(page.getByText('New Provider').last()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('#name')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('#accreditationNumber')).toBeVisible({ timeout: 5000 })
})

test('Settings > Providers form validation', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/providers`)
  await page.getByRole('button', { name: /new provider/i }).click()
  await page.waitForTimeout(500)

  // Try submitting empty — should show validation errors
  const submitBtn = page.getByRole('button', { name: /create provider/i })
  await expect(submitBtn).toBeVisible({ timeout: 5000 })
  await submitBtn.click()
  await page.waitForTimeout(500)

  const hasError = await page.getByText(/required/i).first().isVisible().catch(() => false)
  // Form validation is onBlur, so also try tabbing out
  if (!hasError) {
    await page.locator('#name').focus()
    await page.locator('#name').blur()
    await page.waitForTimeout(300)
  }

  const hasErrorAfterBlur = await page.getByText(/required/i).first().isVisible().catch(() => false)
  expect(hasError || hasErrorAfterBlur).toBeTruthy()
})

test('Settings > Providers can create provider', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/providers`)
  await page.getByRole('button', { name: /new provider/i }).click()
  await page.waitForTimeout(500)

  // Fill form
  await page.locator('#name').fill('Test E2E Provider')
  await page.locator('#accreditationNumber').fill('PRC-E2E-001')

  // Submit
  await page.getByRole('button', { name: /create provider/i }).click()
  await page.waitForTimeout(3000)

  // Check outcomes
  const hasSuccess = await page.getByText(/provider created/i).isVisible().catch(() => false)
  const hasInTable = await page.getByText('Test E2E Provider').isVisible().catch(() => false)
  const hasError = await page.getByText(/failed|error/i).first().isVisible().catch(() => false)

  if (hasError) {
    const errorText = await page.locator('[data-sonner-toast]').first().textContent().catch(() => 'unknown')
    console.log(`PROVIDER CREATE ERROR: ${errorText}`)
  }

  expect(hasSuccess || hasInTable).toBeTruthy()
})

test('Settings > Providers API endpoint responds', async ({ page }) => {
  await login(page)
  // Test API directly
  const response = await page.request.get(`http://localhost:7213/accredited-providers/${ORG_SLUG}`)
  const status = response.status()
  const body = await response.text()
  console.log(`Providers API: status=${status}, body=${body.slice(0, 300)}`)
  expect(status).toBeLessThan(500)
})

// ─── Sidebar Navigation ─────────────────────────────────────────────────────

test('Settings > Sidebar shows settings links', async ({ page }) => {
  await login(page)
  await page.goto(`/org/${ORG_SLUG}/officer/settings/org`)
  const hasOrgProfile = await page.getByText(/org profile/i).isVisible().catch(() => false)
  const hasOfficers = await page.getByText(/officers/i).isVisible().catch(() => false)
  const hasCategories = await page.getByText(/categories/i).isVisible().catch(() => false)
  const hasGateway = await page.getByText(/payment gateway/i).isVisible().catch(() => false)
  const hasProviders = await page.getByText(/providers/i).isVisible().catch(() => false)

  console.log(`Sidebar: OrgProfile=${hasOrgProfile} Officers=${hasOfficers} Categories=${hasCategories} Gateway=${hasGateway} Providers=${hasProviders}`)
  expect(hasOrgProfile || hasOfficers || hasCategories || hasGateway || hasProviders).toBeTruthy()
})
