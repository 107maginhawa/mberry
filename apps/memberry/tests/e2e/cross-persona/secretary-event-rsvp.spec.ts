// WF-049 — Event Registration
/**
 * Cross-persona: Secretary creates and publishes an event; member RSVPs to it;
 *                president views the roster and sees the member.
 *
 * Personas: P4 (secretary) → P6 (member) → P2 (president)
 *
 * Verifies BR-17 (attendance confirmation) chain end-to-end across three
 * actors. Tests event publish → registration → roster aggregation.
 */

import { test, expect } from '@playwright/test'
import { authStateFile } from '../helpers/auth-state'

test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: secretary creates event → member RSVPs → officer sees roster', () => {
  test.fixme('three-actor flow with real WebSocket comms', async ({ browser }) => {
    // 1. Secretary context: navigate to /org/$ORG_ID/officer/events/new,
    //    fill title + dates + capacity, click Publish. Capture event_id.
    // 2. Member context: navigate to /org/$ORG_ID/events, click the new event,
    //    click Register. Assert "You are registered" message renders.
    // 3. Officer (president) context: navigate to
    //    /org/$ORG_ID/officer/events/${event_id}/roster, assert the member's
    //    name appears in the roster.
    // 4. Notifications cross-check: member should have a "registration confirmed"
    //    notification in /my/notifications.
  })
})
