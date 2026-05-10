// M-25: Account deletion
// Verifies the delete account flow in Settings > General > Danger Zone
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember } from '../helpers/auth'

test.describe('M-25: Delete Account', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/settings')
    await page.waitForLoadState('networkidle')
  })

  test('settings page shows Danger Zone with Delete Account button', async ({ page }) => {
    // General tab should be default
    await expect(page.getByText('Danger Zone')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /delete account/i })).toBeVisible()
  })

  test('clicking Delete Account shows confirmation form', async ({ page }) => {
    await expect(page.getByRole('button', { name: /delete account/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /delete account/i }).click()

    // Should show confirmation UI with type-to-confirm
    await expect(page.getByText(/type delete to confirm/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByPlaceholder('DELETE')).toBeVisible()
    await expect(page.getByRole('button', { name: /confirm delete/i })).toBeVisible()
  })

  test('Confirm Delete is disabled until DELETE is typed', async ({ page }) => {
    await expect(page.getByRole('button', { name: /delete account/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /delete account/i }).click()

    await expect(page.getByPlaceholder('DELETE')).toBeVisible({ timeout: 5000 })

    // Button should be disabled initially
    const confirmBtn = page.getByRole('button', { name: /confirm delete/i })
    await expect(confirmBtn).toBeDisabled()

    // Type wrong text
    await page.getByPlaceholder('DELETE').fill('delete')
    await expect(confirmBtn).toBeDisabled()

    // Type correct text
    await page.getByPlaceholder('DELETE').fill('DELETE')
    await expect(confirmBtn).toBeEnabled()
  })

  test('Cancel button closes confirmation form', async ({ page }) => {
    await expect(page.getByRole('button', { name: /delete account/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /delete account/i }).click()

    await expect(page.getByText(/type delete to confirm/i)).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /cancel/i }).click()

    // Should go back to showing the Delete Account button
    await expect(page.getByRole('button', { name: /delete account/i })).toBeVisible()
    await expect(page.getByText(/type delete to confirm/i)).not.toBeVisible()
  })

  test('deletion info mentions 30-day grace period and anonymization', async ({ page }) => {
    await expect(page.getByRole('button', { name: /delete account/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /delete account/i }).click()

    await expect(page.getByText(/30-day grace period/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/anonymized/i)).toBeVisible()
  })
})
