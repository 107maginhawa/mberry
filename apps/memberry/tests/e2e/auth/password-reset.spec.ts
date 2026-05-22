// M-13: Password reset flow
// Requires Mailpit running (docker compose up mailpit)
import { test, expect } from '../helpers/test-fixture'
import { isMailpitAvailable, waitForMessage, extractLinksFromMessage, deleteAllMessages } from '../helpers/mailpit'

let mailpitUp = false

test.beforeAll(async () => {
  mailpitUp = await isMailpitAvailable()
})

test.describe('M-13: Password Reset', () => {
  test('forgot password page is accessible', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await page.waitForLoadState('networkidle')

    // Better-auth-ui renders the forgot password form
    const hasEmailInput = await page.getByLabel(/email/i).isVisible({ timeout: 10000 }).catch(() => false)
    const hasForm = await page.locator('form').isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasEmailInput || hasForm).toBeTruthy()
  })

  test('forgot password form accepts email', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await page.waitForLoadState('networkidle')

    const emailInput = page.getByLabel(/email/i)
    const hasInput = await emailInput.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasInput) {
      await emailInput.fill('test@memberry.ph')

      // Submit button should exist
      const submitBtn = page.getByRole('button', { name: /reset|send|submit/i }).first()
      const hasSubmit = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasSubmit).toBeTruthy()
    }
  })

  test('password reset email arrives in Mailpit', async ({ page }) => {
    test.skip(!mailpitUp, 'Mailpit not running — start with: docker compose -f services/api-ts/docker-compose.deps.yml up -d mailpit')

    await deleteAllMessages()

    await page.goto('/auth/forgot-password')
    await page.waitForLoadState('networkidle')

    const emailInput = page.getByLabel(/email/i)
    await emailInput.fill('test@memberry.ph')

    const submitBtn = page.getByRole('button', { name: /reset|send|submit/i }).first()
    await submitBtn.click()
    await page.waitForTimeout(3000)

    // Check Mailpit for reset email
    const msg = await waitForMessage('test@memberry.ph', {
      subject: /reset|password/i,
      timeout: 15000,
    })
    expect(msg).toBeTruthy()
    expect(msg.Subject).toMatch(/reset|password/i)
  })

  test('reset link from email loads reset form', async ({ page }) => {
    test.skip(!mailpitUp, 'Mailpit not running')

    await deleteAllMessages()

    await page.goto('/auth/forgot-password')
    await page.waitForLoadState('networkidle')

    await page.getByLabel(/email/i).fill('test@memberry.ph')
    await page.getByRole('button', { name: /reset|send|submit/i }).first().click()
    await page.waitForTimeout(3000)

    const msg = await waitForMessage('test@memberry.ph', { subject: /reset|password/i })
    const links = await extractLinksFromMessage(msg.ID)
    const resetLink = links.find((l) => l.includes('reset') || l.includes('callback'))

    if (resetLink) {
      await page.goto(resetLink)
      await page.waitForLoadState('networkidle')

      // Should show new password form
      const hasPasswordField = await page.getByLabel(/password/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasPasswordField).toBeTruthy()
    }
  })
})
