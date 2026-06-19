// WF-057 — Waitlist Auto-Promotion (BR-27): when a confirmed registrant cancels,
// the first waitlisted registrant is promoted to confirmed (FIFO).
// Officer provisions a free, capacity-1 event; member A confirms, member B
// waitlists; A cancels → B is promoted.
import { test, expect } from '../helpers/test-fixture'
import { request as pwRequest, type APIRequestContext } from '@playwright/test'
import { freshAuthState, type AuthRole } from '../helpers/programmatic-auth'
import { API_BASE } from '../helpers/test-config'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const unwrap = (d: any) => d?.data ?? d

async function roleApi(role: AuthRole) {
  const storageState = await freshAuthState(role)
  const ctx: APIRequestContext = await pwRequest.newContext({
    baseURL: API_BASE, storageState, extraHTTPHeaders: { Origin: 'http://localhost:3004' },
  })
  const { token } = (await (await ctx.get('/csrf-token')).json()) as { token: string }
  const headers = { 'x-csrf-token': token, 'x-org-id': ORG_ID, 'Content-Type': 'application/json' }
  return {
    async req<T = any>(method: 'post' | 'get' | 'delete', path: string, body?: unknown) {
      const res = await ctx[method](path, { headers, data: body })
      return { status: res.status(), data: (await res.json().catch(() => null)) as T | null }
    },
    me: async () => unwrap((await (await ctx.get('/persons/me', { headers: { 'x-org-id': ORG_ID } })).json()))?.id as string,
    dispose: () => ctx.dispose(),
  }
}

test.describe('WF-057: waitlist auto-promotion', () => {
  test('cancelling a confirmed spot promotes the first waitlisted registrant', async () => {
    const officer = await roleApi('officer')
    const memberA = await roleApi('member')
    const memberB = await roleApi('secretary')
    try {
      const pidB = await memberB.me()

      // Free, capacity-1 event so the 2nd registrant must waitlist.
      const start = new Date(Date.now() + 14 * 86_400_000).toISOString()
      const end = new Date(Date.now() + 14 * 86_400_000 + 3_600_000).toISOString()
      const ev = await officer.req('post', '/association/events', {
        organizationId: ORG_ID, title: `E2E Waitlist ${Date.now()}`, eventType: 'seminar',
        startDate: start, endDate: end, creditBearing: false, capacity: 1, registrationFee: 0,
      })
      expect(ev.status, 'create event').toBe(201)
      const eventId = unwrap(ev.data).id as string

      // Registration only opens on published events.
      const pub = await officer.req('post', `/association/events/${eventId}/publish`, {})
      expect([200, 201], 'publish event').toContain(pub.status)

      // A confirms (capacity 1) → an event-registration row.
      const regA = await memberA.req('post', `/association/event-lifecycle/${eventId}/register`)
      expect(regA.status, 'A registers').toBe(201)
      expect(unwrap(regA.data).status, 'A confirmed').toBe('confirmed')
      const regAId = unwrap(regA.data).id as string

      // B is over capacity → auto-waitlisted (waitlist_entry).
      const regB = await memberB.req('post', `/association/event-lifecycle/${eventId}/register`)
      expect(regB.status, 'B registers').toBe(201)
      expect(unwrap(regB.data).waitlisted, 'B waitlisted').toBe(true)

      // A cancels via the matching subsystem → BR-27 promotes B (waitlist_entry
      // → confirmed event-registration).
      const cancel = await officer.req('post', `/association/events/registrations/${regAId}/cancel`, {})
      expect([200, 201, 204], 'A cancellation').toContain(cancel.status)

      // Durable read: B now holds a confirmed registration.
      const list = await officer.req('get', `/association/events/registrations?eventId=${eventId}`)
      expect(list.status).toBe(200)
      const regs = list.data?.data ?? list.data ?? []
      const bReg = regs.find((r: any) => r.personId === pidB && r.status === 'confirmed')
      expect(bReg, 'B promoted to a confirmed registration (FIFO)').toBeTruthy()
    } finally {
      await officer.dispose(); await memberA.dispose(); await memberB.dispose()
    }
  })
})
