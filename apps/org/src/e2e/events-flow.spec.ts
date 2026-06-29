// apps/org/src/e2e/events-flow.spec.ts
//
// E2E: officer events money flow — create an event, then publish a draft.
//
// All API calls are stubbed via page.route so this spec only needs the org dev
// server on :3005 — no live API, no Postgres, no seed.
//
// Authed-state pattern (from import-flow.spec.ts, the currently-passing template):
// memberships always returns 200 → RootGate.useSession reports 'authed', and an
// addInitScript seed of localStorage('org.selectedOrgId') makes useSelectedOrg
// resolve a single org WITHOUT driving the (email-OTP) sign-in form. officer-flow
// .spec.ts's email/password sign-in is stale (the app moved to OTP) so we do NOT
// model on it.
//
// Stub shapes match REAL handler/transformer expectations (verified against
// use-org-events.ts, use-create-event.ts, use-publish-event.ts + the generated
// responseTransformers):
//  - searchEvents → eventListResponseTransformer maps data.data[]; each event runs
//    eventSchemaResponseTransformer → createdAt/updatedAt/startDate/endDate Dates.
//  - createEvent / publishEvent → eventSchemaResponseTransformer (same Date fields);
//    the hooks only require a truthy `data`.
//  - createEvent + publishEvent are POSTs (NOT CSRF-exempt) → lib/api fetches
//    /csrf-token first; without the stub the mutation never fires.
import { test, expect, type Page } from '@playwright/test'

const ORG_ID = 'org-1'

function authStubs(page: Page) {
  // CSRF — fetched lazily before any non-exempt mutating SDK call (create/publish).
  page.route('**/csrf-token', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 't' }) }),
  )
  // Memberships — useSession + useOrgs. Always 200 → 'authed' (no sign-in needed).
  page.route('**/persons/me/memberships', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ organizationId: ORG_ID, orgName: 'Dental Chapter' }], total: 1 }),
    }),
  )
  // Seed selected org so useSelectedOrg resolves ORG_ID before any query fires.
  return page.addInitScript((id) => localStorage.setItem('org.selectedOrgId', id), ORG_ID)
}

const iso = (d: string) => new Date(d).toISOString()

test('officer creates an event and it appears in the list', async ({ page }) => {
  await authStubs(page)

  let created = false
  await page.route('**/association/events**', (route) => {
    if (route.request().method() === 'POST') {
      created = true
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ev-new',
          organizationId: ORG_ID,
          title: 'Spring General Assembly',
          eventType: 'assembly',
          status: 'draft',
          createdAt: iso('2026-06-01'),
          updatedAt: iso('2026-06-01'),
          startDate: iso('2026-09-01T10:00'),
          endDate: iso('2026-09-01T12:00'),
        }),
      })
    }
    // GET searchEvents — empty until the create POST flips `created`.
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: created
          ? [
              {
                id: 'ev-new',
                organizationId: ORG_ID,
                title: 'Spring General Assembly',
                eventType: 'assembly',
                status: 'draft',
                createdAt: iso('2026-06-01'),
                updatedAt: iso('2026-06-01'),
                startDate: iso('2026-09-01T10:00'),
                endDate: iso('2026-09-01T12:00'),
              },
            ]
          : [],
      }),
    })
  })

  await page.goto('/events')

  // Empty state before creating.
  await expect(page.getByText(/no events yet/i)).toBeVisible()

  // Fill the required fields (Title / Start / End) and submit.
  await page.getByLabel('Title').fill('Spring General Assembly')
  await page.getByLabel('Start').fill('2026-09-01T10:00')
  await page.getByLabel('End').fill('2026-09-01T12:00')
  await page.getByRole('button', { name: 'Create event' }).click()

  // Success signal: toast + the new event rendered in the list (after refetch).
  await expect(page.getByText('Event created')).toBeVisible()
  await expect(page.getByText('Spring General Assembly')).toBeVisible()
})

test('officer publishes a draft event', async ({ page }) => {
  await authStubs(page)

  let published = false
  await page.route('**/association/events**', (route) => {
    const req = route.request()
    if (req.url().includes('/publish')) {
      published = true
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ev-9',
          organizationId: ORG_ID,
          title: 'Annual Convention',
          eventType: 'assembly',
          status: 'published',
          createdAt: iso('2026-06-01'),
          updatedAt: iso('2026-06-01'),
          startDate: iso('2026-10-01T09:00'),
          endDate: iso('2026-10-01T17:00'),
        }),
      })
    }
    // GET searchEvents — draft until publish flips it to published.
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'ev-9',
            organizationId: ORG_ID,
            title: 'Annual Convention',
            eventType: 'assembly',
            status: published ? 'published' : 'draft',
            createdAt: iso('2026-06-01'),
            updatedAt: iso('2026-06-01'),
            startDate: iso('2026-10-01T09:00'),
            endDate: iso('2026-10-01T17:00'),
          },
        ],
      }),
    })
  })

  await page.goto('/events')

  // Draft event renders with a Draft badge and a Publish button.
  await expect(page.getByText('Annual Convention')).toBeVisible()
  await expect(page.getByText('Draft')).toBeVisible()

  // Open the confirm dialog, then confirm publish.
  await page.getByRole('button', { name: 'Publish Annual Convention' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click()

  // The row reconciles to Published after the publish POST + refetch.
  await expect(page.getByText('Published')).toBeVisible()
})
