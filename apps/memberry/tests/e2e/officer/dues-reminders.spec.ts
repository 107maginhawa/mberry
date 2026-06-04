// CT-2: Batch dues reminders
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('treasurer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('CT-2: Dues Reminders', () => {
test('Send Reminders button is visible on payments page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await expect(page.getByRole('button', { name: /send reminders/i })).toBeVisible({ timeout: 10000 })
  })

  test('clicking Send Reminders triggers API call', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    const sendBtn = page.getByRole('button', { name: /send reminders/i })
    await expect(sendBtn).toBeVisible({ timeout: 10000 })

    // Intercept the API call
    const apiPromise = page.waitForResponse(
      (resp) => resp.url().includes('dues') && resp.request().method() === 'POST',
      { timeout: 10000 },
    )

    await sendBtn.click()

    const response = await apiPromise
    // Backend must respond — reject 5xx (server crash) but allow 4xx (validation/no overdue members)
    expect(response).not.toBeNull()
    expect(response.status()).toBeLessThan(500)
  })

  test('Send Reminders shows toast on completion', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    const sendBtn = page.getByRole('button', { name: /send reminders/i })
    await expect(sendBtn).toBeVisible({ timeout: 10000 })

    await sendBtn.click()
    await page.waitForTimeout(3000)

    // Should show either success or error toast
    const hasToast = await page.getByText(/reminders sent|reminders queued|failed to send/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasToast).toBeTruthy()
  })
})
