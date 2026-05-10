// Wave 6E: Training visibility (BR-16) — NOT YET IMPLEMENTED
import { test, expect } from '@playwright/test'

test.describe('Wave 6E: Training Visibility BR-16 (NOT IMPLEMENTED)', () => {
  // BR-16: Training visibility toggle
  test.fixme('BR-16: training form has visibility toggle (Internal/Network-Wide)', async ({ page }) => {
    // Build: add visibility dropdown to training-form.tsx
    // Default: Internal (chapter-only)
    // Options: Internal, Network-Wide
    // Warning if changed after registrations exist
  })

  test.fixme('BR-16: default visibility is Internal per BR-16', async ({ page }) => {
    // Verify new training defaults to Internal visibility
  })

  test.fixme('BR-16: warning shown when changing visibility after registrations', async ({ page }) => {
    // If training has enrollments, warn before changing visibility scope
  })
})
