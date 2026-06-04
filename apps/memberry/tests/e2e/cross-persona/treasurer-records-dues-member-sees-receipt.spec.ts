/**
 * Cross-persona: Treasurer records a manual dues payment on behalf of a member;
 *                that member signs in and sees the new payment + updated
 *                dues balance.
 *
 * Personas: P3 (treasurer) → P6 (member)
 *
 * Verifies BR-04 (dues amount) + BR-08 (refund policy) glue: payment events
 * fan out to the member's dashboard via the dues read model.
 */

import { test, expect } from '@playwright/test'
import { authStateFile } from '../helpers/auth-state'

test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: treasurer records dues, member sees receipt', () => {
  test.fixme('treasurer manual payment propagates to member dues view + receipt list', async ({ browser }) => {
    // 1. Treasurer context (storageState 'treasurer.json'):
    //    - navigate to /org/$ORG_ID/officer/payments/new
    //    - pick a seeded member, fill amount, method=cash, click Record Payment
    //    - assert success toast + redirect to payment detail page
    // 2. Member context (signUp fresh member OR signIn as the picked seeded member):
    //    - navigate to /org/$ORG_ID/dues
    //    - assert the new payment appears in the receipt list with correct amount
    //    - assert dues balance decreased by the recorded amount
    // 3. Cross-check: GET /persons/me/dues via SDK should reflect the same balance.
  })
})
