import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'
import { captureAnyApiSuccess } from '../helpers/real-flow'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Certificate Management', () => {
  test('certificate management page renders with heading', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    await expect(
      page.getByRole('heading', { name: /certificate management/i, level: 1 }),
    ).toBeVisible({ timeout: 10000 })
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
  })

  test('shows bulk issue section', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    await expect(
      page.getByRole('heading', { name: /bulk issue/i }).first(),
    ).toBeVisible({ timeout: 10000 })
    // Required input labels (text appears in <Label> elements).
    await expect(page.getByText(/training title/i).first())
      .toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/org code/i).first())
      .toBeVisible({ timeout: 10000 })
  })

  test('shows verify certificate section', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    // "Verify Certificate" appears in BOTH the section heading and the
    // submit button. Scope to the heading role.
    await expect(
      page.getByRole('heading', { name: /verify certificate/i }).first(),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('button', { name: /^verify/i }).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('issue button shows validation error when fields are empty', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    await page.getByRole('button', { name: /issue certificates/i }).first().click()
    await expect(
      page.getByText(/fill in all required fields/i).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('can fill bulk issue form fields', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    // Training title input — pick by Label, not placeholder.
    const titleInput = page.getByLabel(/training title/i).first()
    await expect(titleInput).toBeVisible({ timeout: 10000 })
    await titleInput.fill('Test Training Event 2026')

    // Org code field — Label-based selector avoids the dual-placeholder
    // strict-mode collision (PDA appears in two placeholder examples).
    const orgCodeInput = page.getByLabel(/org code/i).first()
    await expect(orgCodeInput).toBeVisible({ timeout: 10000 })
    await orgCodeInput.fill('PDA')

    await expect(
      page.getByRole('button', { name: /issue certificates/i }).first(),
    ).toBeVisible({ timeout: 5000 })
  })

  test('verify with invalid certificate number shows error', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    const certInput = page.getByLabel(/certificate number/i).first()
    await expect(certInput).toBeVisible({ timeout: 10000 })
    await certInput.fill('INVALID-CERT-999')
    await page.getByRole('button', { name: /^verify/i }).first().click()
    await expect(
      page
        .getByText(/certificate not found|verification failed|invalid certificate/i)
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })
})
