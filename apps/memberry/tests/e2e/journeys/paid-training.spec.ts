// WF-062 — Paid Training: fee collection via the offline proof-of-payment gate
// (TC-DEC-01/02). Officer creates + publishes a paid training; member enrolls
// (→ payment_pending), submits payment proof; officer confirms payment
// (→ enrolled). Self-contained (fresh training per run, so no enrollment clash).
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
    async req<T = any>(method: 'post' | 'get', path: string, body?: unknown) {
      const res = await ctx[method](path, { headers, data: body })
      return { status: res.status(), data: (await res.json().catch(() => null)) as T | null }
    },
    me: async () => unwrap((await (await ctx.get('/persons/me', { headers: { 'x-org-id': ORG_ID } })).json()))?.id as string,
    dispose: () => ctx.dispose(),
  }
}

test.describe('WF-062: paid training fee collection', () => {
  test('member enrolls in a paid training and an officer confirms payment', async () => {
    const officer = await roleApi('officer')
    const member = await roleApi('member')
    try {
      const memberPid = await member.me()

      // Officer creates + publishes a fresh PAID training.
      const tr = await officer.req('post', '/association/training', {
        organizationId: ORG_ID, title: `E2E Paid Training ${Date.now()}`, type: 'seminar',
        description: 'E2E paid-training coverage', location: 'Online', instructor: 'E2E Instructor',
        startDate: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        endDate: new Date(Date.now() + 14 * 86_400_000 + 7_200_000).toISOString(),
        capacity: 20, creditAmount: 5, registrationFee: 2000,
      })
      expect(tr.status, 'create training').toBe(201)
      const trainingId = unwrap(tr.data).id as string
      expect([200, 201], 'publish training').toContain(
        (await officer.req('post', `/association/training/${trainingId}/publish`, {})).status,
      )

      // Member enrolls → payment_pending (paid training gates on payment).
      const enroll = await member.req('post', `/association/training-lifecycle/${trainingId}/enroll?organizationId=${ORG_ID}`, {
        trainingId, personId: memberPid, organizationId: ORG_ID,
      })
      expect(enroll.status, 'enroll').toBe(201)
      const enrollment = unwrap(enroll.data)
      expect(enrollment.status, 'paid enrollment awaits payment').toBe('payment_pending')

      // Member submits offline payment proof.
      const proof = await member.req('post', `/association/training-lifecycle/enrollments/${enrollment.id}/payment-proof?organizationId=${ORG_ID}`, {
        proofStorageKey: `s3://e2e/proof-${Date.now()}.pdf`, proofFileName: 'proof.pdf', proofMimeType: 'application/pdf',
      })
      expect([200, 201], 'submit payment proof').toContain(proof.status)

      // Officer confirms payment → enrolled.
      const confirm = await officer.req('post', `/association/training-lifecycle/enrollments/${enrollment.id}/confirm-payment?organizationId=${ORG_ID}`, {})
      expect([200, 201], 'confirm payment').toContain(confirm.status)
      expect(unwrap(confirm.data).status, 'enrollment confirmed → enrolled').toBe('enrolled')

      // Durable read: the enrollment is now enrolled.
      const list = await officer.req('get', `/association/training-lifecycle/${trainingId}/enrollments?organizationId=${ORG_ID}`)
      expect(list.status).toBe(200)
      const rows = list.data?.data ?? list.data ?? []
      expect(rows.some((e: any) => e.personId === memberPid && e.status === 'enrolled'), 'durable enrolled').toBe(true)
    } finally {
      await officer.dispose(); await member.dispose()
    }
  })
})
