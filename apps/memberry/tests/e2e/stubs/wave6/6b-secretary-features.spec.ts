// Wave 6B: Secretary features — NOT YET IMPLEMENTED
import { test, expect } from '@playwright/test'

test.describe('Wave 6B: Secretary Features (NOT IMPLEMENTED)', () => {
  // CS-4: Meeting agenda distribution
  test.fixme('CS-4: secretary distributes meeting agenda', async ({ page }) => {
    // Build: agenda composer, member list targeting, send via comms
    // Route: /org/$orgId/officer/communications/new → agenda template
  })

  // CS-5: Data correction request
  test.fixme('CS-5: data correction request flow', async ({ page }) => {
    // Build: member submits correction → secretary reviews → approves/rejects
    // API: POST /persons/me/correction-request
  })

  // CS-6: Deceased member handling
  test.fixme('CS-6: deceased member soft delete and anonymize', async ({ page }) => {
    // Build: secretary marks member deceased → soft delete → anonymize PII
    // Route: /org/$orgId/officer/roster/:id → Mark Deceased
  })

  // CS-7: Member reinstatement
  test.fixme('CS-7: reinstate lapsed member', async ({ page }) => {
    // Build: secretary reinstates lapsed → back to active with payment
    // Route: /org/$orgId/officer/roster/:id → Reinstate button for lapsed
  })
})
