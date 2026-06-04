// WF-024 — Application Approval
/**
 * Cross-persona: Society officer approves a pending member application;
 *                that applicant then signs in as a member and sees
 *                "Active membership" in their dashboard.
 *
 * Personas: P5 (society officer) → P6 (member)
 *
 * Verifies the end-to-end approval lifecycle works across two browser
 * contexts (officer + applicant) without race conditions on the shared
 * membership row.
 */

import { test, expect, type Page } from '@playwright/test'
import { authStateFile } from '../helpers/auth-state'

// Run multi-actor scenarios serial — they mutate the same membership row.
test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: officer approves member application', () => {
  test.fixme('full lifecycle: applicant submits → officer approves → member sees Active status', async ({ browser }) => {
    // 1. Applicant browser context: signUp + submit membership application
    //    (use signUp helper to get fresh email — avoids collision with seeded members)
    // 2. Officer browser context: load with storageState officer.json,
    //    navigate to /org/$ORG_ID/officer/applications, find the new applicant row,
    //    click Approve. Assert the row moves to "Approved".
    // 3. Re-open applicant context, navigate to /dashboard or /org/$ORG_ID/home,
    //    assert membership card shows status "Active" and the org name.
    //
    // Both contexts use real DB seeds via helpers/persistence.ts. No mocking
    // across the persona boundary — the approval mutation must propagate.
  })
})
