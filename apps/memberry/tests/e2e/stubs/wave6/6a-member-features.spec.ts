// Wave 6A: Member features — NOT YET IMPLEMENTED
// These tests define the RED phase specs for features that need to be built
import { test, expect } from '@playwright/test'

test.describe('Wave 6A: Member Features (NOT IMPLEMENTED)', () => {
  // M-18: Contact officer
  test.fixme('M-18: member can message org officers', async ({ page }) => {
    // Build: contact form on org page, send message to officers
    // Route: /org/$orgId/contact or modal on org home
    // API: POST /organizations/:orgId/contact-officer
  })

  // M-23: Account lockout
  test.fixme('M-23: account locks after N failed login attempts', async ({ page }) => {
    // Build: failed attempt counter, lockout after 5 failures, cooldown timer
    // Better-Auth config: maxAttempts, lockoutDuration
  })

  // M-22: Payment dispute
  test.fixme('M-22: member can dispute a charge', async ({ page }) => {
    // Build: dispute button on payment detail, reason form, status tracking
    // Route: /my/payments/:id → dispute button
    // API: POST /dues/payments/:id/dispute
  })

  // M-21: Duplicate merge request
  test.fixme('M-21: member can flag duplicate account', async ({ page }) => {
    // Build: "Report Duplicate" on settings, enter other email, admin review queue
    // Route: /my/settings → Report Duplicate
    // API: POST /persons/me/report-duplicate
  })
})
