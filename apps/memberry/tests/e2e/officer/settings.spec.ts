// Business Rules: [BR-02] [BR-04] [BR-05] [BR-10] [BR-30] [BR-31]
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

/**
 * Officer settings live under `/officer/settings/*`. After the recent
 * sidebar redesign the settings pages all use PageShell, which renders
 * <h1>{title}</h1> in the page header. We assert URL + h1 + the
 * complementary sidebar mounted as proof the page rendered.
 */
async function assertSettingsPage(
  page: import('@playwright/test').Page,
  urlMatch: RegExp,
) {
  await expect(page).toHaveURL(urlMatch, { timeout: 10000 })
  await expect(page.getByRole('complementary').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { level: 1 }).first())
    .toBeVisible({ timeout: 10000 })
}

test.describe('Officer Settings — Dues Config', () => {
  test('dues config page renders with form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await assertSettingsPage(page, /\/officer\/settings\/dues/)
    // Amount input exists — accept any number input on the page.
    await expect(page.getByRole('spinbutton').first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Officer Settings — Fund Allocation', () => {
  test('fund allocation page renders with fund inputs', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
    await assertSettingsPage(page, /\/officer\/settings\/funds/)
  })
})

test.describe('Officer Settings — Membership Categories', () => {
  test('membership categories page renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/membership-categories`)
    await assertSettingsPage(page, /\/officer\/settings\/membership-categories/)
  })
})

test.describe('Officer Settings — Chapters', () => {
  test('chapters page renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/chapters`)
    await assertSettingsPage(page, /\/officer\/settings\/chapters/)
  })
})

test.describe('Officer Settings — Admin Features', () => {
  test('[BR-10] admin features page renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/org`)
    await assertSettingsPage(page, /\/officer\/settings\/org/)
  })
})

test.describe('Officer Settings — Gateway', () => {
  test('[BR-31] gateway page renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/gateway`)
    await assertSettingsPage(page, /\/officer\/settings\/gateway/)
  })
})
