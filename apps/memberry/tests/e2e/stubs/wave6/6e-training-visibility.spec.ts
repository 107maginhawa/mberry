// Wave 6E: Training visibility (BR-16) — NOT YET IMPLEMENTED
// Backend: visibility field accepted but stripped in updateTraining.ts. No DB column.
// Feature blocked until schema + handler + UI are built.
import { test, expect } from '../../helpers/test-fixture'

test.describe('Wave 6E: Training Visibility BR-16', () => {
  test.fixme('BR-16: training form has visibility toggle (Internal/Network-Wide)', async ({ page }) => {
    // Role: officer creating training
    // Training creation form should have visibility dropdown.
    // Options: Internal (chapter-only), Network-Wide (all orgs in association).
  })

  test.fixme('BR-16: events default to Internal, training defaults to Network-Wide', async ({ page }) => {
    // Events default to Internal visibility (visible only to hosting org's members).
    // Training sessions default to Network-Wide visibility (visible across all orgs).
    // This is the key distinction: different defaults per activity type.
  })

  test.fixme('BR-16: officer can override default visibility before publishing', async ({ page }) => {
    // Role: officer
    // Before publishing, officer can change visibility from default.
    // After publishing, visibility changes have restrictions (see below).
  })

  test.fixme('BR-16: warning shown when changing visibility after registrations', async ({ page }) => {
    // Edge case: changing Network-Wide to Internal after external members registered
    // System must warn officer and list affected external registrants.
    // Officer may proceed (external registrations preserved, no new external
    // registrations accepted) or cancel the change.
    // External registrations are NOT silently removed.
  })
})
