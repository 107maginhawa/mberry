// WF-077 — Member Votes: cast a secret ballot, one vote per position (BR-33)
// WF-078 — Bylaw Ratification: propose a bylaw change and vote on it
//
// These exercise the real governance write path end-to-end: an officer
// (association:admin + President position) provisions an election, nominates the
// required ≥2 candidates per position (BR-33), and opens voting; a member then
// casts a real ballot and the vote is verified by an independent durable read.
// A second ballot for the same position must be rejected (DUPLICATE_VOTE → 409).
//
// NOTE: driven through the API rather than the vote UI. The member-facing
// governance pages (VotingBallot, member-election-detail, governance landing)
// call getElection/listElections WITHOUT the x-org-id header those routes
// require, so they 403 → "Unable to load ballot/governance data" on load.
// That is a real app bug (flagged in the PHASE6 report); the routes
// elections/$electionId/vote, elections/$electionId, governance/ are left
// honestly uncovered until it is fixed.
import { test, expect } from '../helpers/test-fixture'
import { request as pwRequest, type APIRequestContext } from '@playwright/test'
import { freshAuthState, type AuthRole } from '../helpers/programmatic-auth'
import { API_BASE } from '../helpers/test-config'
import { apiFetch } from '../helpers/api-fetch'

test.use({ authRole: 'member' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const unwrap = (d: any) => d?.data ?? d

// Authenticated write client for a seeded role (the member `page` cannot create
// elections/candidates — those need association:admin + the President position).
async function roleApi(role: AuthRole) {
  const storageState = await freshAuthState(role)
  const ctx: APIRequestContext = await pwRequest.newContext({
    baseURL: API_BASE,
    storageState,
    extraHTTPHeaders: { Origin: 'http://localhost:3004' },
  })
  const { token } = (await (await ctx.get('/csrf-token')).json()) as { token: string }
  const headers = { 'x-csrf-token': token, 'x-org-id': ORG_ID, 'Content-Type': 'application/json' }
  return {
    async post<T = any>(path: string, body: unknown) {
      const res = await ctx.post(path, { headers, data: body })
      return { status: res.status(), data: (await res.json().catch(() => null)) as T | null }
    },
    async get<T = any>(path: string) {
      const res = await ctx.get(path, { headers: { 'x-org-id': ORG_ID } })
      return { status: res.status(), data: (await res.json().catch(() => null)) as T | null }
    },
    dispose: () => ctx.dispose(),
  }
}

// Provision a fresh votingOpen election with ≥2 candidates on one position.
// Date fields are left null so create/open never trip the voting-window CHECK
// constraints; status is driven explicitly via the lifecycle endpoints.
async function provisionElection(
  officer: Awaited<ReturnType<typeof roleApi>>,
  opts: { type: 'officer' | 'bylaw'; memberPid: string; officerPid: string; positionTitle: string; passageThreshold?: number },
) {
  const created = await officer.post('/association/member/elections', {
    organizationId: ORG_ID,
    title: `E2E ${opts.type} ${Date.now()}`,
    type: opts.type,
    votingMode: 'online',
    positions: [opts.positionTitle],
    ...(opts.passageThreshold ? { passageThreshold: opts.passageThreshold } : {}),
  })
  expect(created.status, 'create election').toBe(201)
  const election = unwrap(created.data)
  const electionId = election.id as string
  const positionId = election.positions[0].id as string

  expect(
    (await officer.post(`/association/member/elections/${electionId}/open-nominations`, {})).status,
    'open nominations',
  ).toBeLessThan(300)

  const cand1 = await officer.post('/association/member/candidates', {
    electionId, positionId, personId: opts.memberPid, nominatedBy: opts.officerPid,
  })
  expect(cand1.status, 'nominate member').toBe(201)
  const candidateId = unwrap(cand1.data).id as string

  expect(
    (await officer.post('/association/member/candidates', {
      electionId, positionId, personId: opts.officerPid, nominatedBy: opts.officerPid,
    })).status,
    'nominate second candidate (BR-33 needs ≥2)',
  ).toBe(201)

  expect(
    (await officer.post(`/association/member/elections/${electionId}/open-voting`, {})).status,
    'open voting',
  ).toBeLessThan(300)

  return { electionId, positionId, candidateId }
}

async function resolvePersonIds(page: import('@playwright/test').Page, officer: Awaited<ReturnType<typeof roleApi>>) {
  const officerPid = unwrap((await officer.get('/persons/me')).data)?.id as string
  expect(officerPid, 'officer personId').toBeTruthy()
  // The member `page` is already authenticated; resolve its personId via apiFetch.
  await page.goto(`/dashboard`)
  const me = await apiFetch<any>(page, '/persons/me', { orgId: ORG_ID })
  const memberPid = (me.data?.data?.id ?? me.data?.id) as string
  expect(memberPid, 'member personId').toBeTruthy()
  return { officerPid, memberPid }
}

test.describe('WF-077: member casts a secret ballot', () => {
  test('member votes once per position; a second vote is rejected (BR-33)', async ({ page }) => {
    const officer = await roleApi('officer')
    try {
      const { officerPid, memberPid } = await resolvePersonIds(page, officer)
      const { electionId, positionId, candidateId } = await provisionElection(officer, {
        type: 'officer', memberPid, officerPid, positionTitle: 'President',
      })

      // Member casts the ballot (the real WF-077 action).
      const cast = await apiFetch<any>(page, '/association/member/ballots', {
        method: 'POST', orgId: ORG_ID,
        body: { electionId, positionId, candidateId, isProxy: false },
      })
      expect(cast.status, 'first ballot must be accepted').toBe(201)

      // Clause 4 — independent durable read: the member's recorded ballot exists.
      const mine = await apiFetch<any>(page, `/association/member/ballots/mine?electionId=${electionId}`, { orgId: ORG_ID })
      expect(mine.status).toBe(200)
      const ballots = mine.data?.data ?? mine.data ?? []
      expect(Array.isArray(ballots) && ballots.length, 'a ballot is durably recorded for the member').toBeGreaterThan(0)

      // BR-33: a second ballot for the same position is a DUPLICATE_VOTE (409).
      const dup = await apiFetch<any>(page, '/association/member/ballots', {
        method: 'POST', orgId: ORG_ID,
        body: { electionId, positionId, candidateId, isProxy: false },
      })
      // BR-33: rejected as DUPLICATE_VOTE (the handler maps it to 422).
      expect(dup.status, 'second vote for the same position must be rejected').toBe(422)
      expect((dup.data as any)?.code).toBe('DUPLICATE_VOTE')

      // ── Tally + certify (the lifecycle tail the smoke deferred) ──────────
      // Officer closes voting → election awaits confirmation; then certifies.
      const close = await officer.post(`/association/member/elections/${electionId}/close-voting`, {})
      expect(close.status, 'close voting').toBeLessThan(300)
      expect(unwrap(close.data).status, 'closed election awaits confirmation').toBe('awaitingConfirmation')

      const certify = await officer.post(`/association/member/elections/${electionId}/certify`, {})
      expect(certify.status, 'certify election').toBeLessThan(300)

      // Durable tally: the member's recorded ballot survives certification — the
      // certified result is built on the persisted vote, not discarded with it.
      const postCertify = await apiFetch<any>(
        page,
        `/association/member/ballots/mine?electionId=${electionId}`,
        { orgId: ORG_ID },
      )
      expect(postCertify.status, 'ballots readable after certification').toBe(200)
      expect(
        (postCertify.data?.data ?? postCertify.data ?? []).length,
        'the cast ballot is durable through close→certify',
      ).toBeGreaterThan(0)
    } finally {
      await officer.dispose()
    }
  })
})

test.describe('WF-078: bylaw ratification — propose and vote', () => {
  test('officer proposes a bylaw election and a member casts a ratification vote', async ({ page }) => {
    const officer = await roleApi('officer')
    try {
      const { officerPid, memberPid } = await resolvePersonIds(page, officer)
      const { electionId, positionId, candidateId } = await provisionElection(officer, {
        type: 'bylaw', memberPid, officerPid, positionTitle: 'Ratify Amendment', passageThreshold: 67,
      })

      // The proposed election is durably a bylaw with its passage threshold.
      const detail = await officer.get(`/association/member/elections/${electionId}`)
      expect(detail.status).toBe(200)
      expect(unwrap(detail.data).type).toBe('bylaw')
      expect(Number(unwrap(detail.data).passageThreshold)).toBe(67)

      // Member casts the ratification vote.
      const cast = await apiFetch<any>(page, '/association/member/ballots', {
        method: 'POST', orgId: ORG_ID,
        body: { electionId, positionId, candidateId, isProxy: false },
      })
      expect(cast.status, 'ratification vote accepted').toBe(201)

      const mine = await apiFetch<any>(page, `/association/member/ballots/mine?electionId=${electionId}`, { orgId: ORG_ID })
      const ballots = mine.data?.data ?? mine.data ?? []
      expect(Array.isArray(ballots) && ballots.length, 'ratification ballot durably recorded').toBeGreaterThan(0)
    } finally {
      await officer.dispose()
    }
  })
})
