import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Certificate Management', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('certificate management page renders with heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    await expect(
      page.getByText(/certificate management/i).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows bulk issue section with required fields', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    await expect(
      page.getByText(/bulk issue certificates/i),
    ).toBeVisible({ timeout: 10000 })

    // Required input fields
    await expect(
      page.getByText(/training title/i),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText(/org code/i),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText(/person ids/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows verify certificate section', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    await expect(
      page.getByText(/verify certificate/i),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText(/certificate number/i),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByRole('button', { name: /verify/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('issue button shows validation error when fields are empty', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    // Click issue without filling required fields
    await page.getByRole('button', { name: /issue certificates/i }).click()

    // Should show a toast error about required fields
    await expect(
      page.getByText(/fill in all required fields/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test('can fill bulk issue form fields', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    // Fill in training title
    const titleInput = page.getByPlaceholder(/annual dental conference/i)
    await expect(titleInput).toBeVisible({ timeout: 10000 })
    await titleInput.fill('Test Training Event 2026')

    // Fill in org code
    const orgCodeInput = page.getByPlaceholder(/PDA/i)
    await expect(orgCodeInput).toBeVisible({ timeout: 10000 })
    await orgCodeInput.fill('PDA')

    // Fill in person IDs
    const personIdsTextarea = page.getByPlaceholder(/person-uuid-1/i)
    await expect(personIdsTextarea).toBeVisible({ timeout: 10000 })
    await personIdsTextarea.fill('00000000-0000-0000-0000-000000000001')

    // Verify the issue button is present
    await expect(
      page.getByRole('button', { name: /issue certificates/i }),
    ).toBeVisible({ timeout: 5000 })
  })

  test('verify with invalid certificate number shows error', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/certificates`)
    const certInput = page.getByPlaceholder(/PDA-2026-0001/i)
    await expect(certInput).toBeVisible({ timeout: 10000 })
    await certInput.fill('INVALID-CERT-999')

    await page.getByRole('button', { name: /verify/i }).click()

    // Should show "not found" toast
    await expect(
      page.getByText(/certificate not found/i),
    ).toBeVisible({ timeout: 10000 })
  })
})
