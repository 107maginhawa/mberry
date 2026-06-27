import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { client } from '@monobase/sdk-ts/generated/client.gen'
import { configureApiClient, resetCsrfCacheForTest } from './api'

function makeReq(method: string, url: string): Request {
  return new Request(url, { method })
}

describe('configureApiClient CSRF interceptor', () => {
  let interceptor: (req: Request) => Promise<Request> | Request
  let responseInterceptor: (res: Response, req: Request) => Response
  const fetchMock = vi.fn()

  beforeEach(() => {
    resetCsrfCacheForTest()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: 'csrf-abc' }), { status: 200 }))
    // Capture interceptors by spying on use() before configureApiClient registers them.
    const reqUseSpy = vi.spyOn(client.interceptors.request, 'use')
    const resUseSpy = vi.spyOn(client.interceptors.response, 'use')
    configureApiClient('http://localhost/api')
    interceptor = reqUseSpy.mock.calls.at(-1)![0] as typeof interceptor
    responseInterceptor = resUseSpy.mock.calls.at(-1)![0] as typeof responseInterceptor
    reqUseSpy.mockRestore()
    resUseSpy.mockRestore()
  })

  afterEach(() => {
    client.interceptors.request.clear()
    client.interceptors.response.clear()
    vi.unstubAllGlobals()
  })

  it('injects x-csrf-token on POST to a protected path', async () => {
    const out = await interceptor(makeReq('POST', 'http://localhost/api/org/o1/payments/send-link'))
    expect(out.headers.get('x-csrf-token')).toBe('csrf-abc')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost/api/csrf-token', expect.objectContaining({ credentials: 'include' }))
  })

  it('does NOT inject on GET', async () => {
    const out = await interceptor(makeReq('GET', 'http://localhost/api/membership/members/o1'))
    expect(out.headers.get('x-csrf-token')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does NOT inject on /auth or /pay mutating paths (engine allowlist)', async () => {
    await interceptor(makeReq('POST', 'http://localhost/api/auth/sign-in/email'))
    await interceptor(makeReq('POST', 'http://localhost/api/pay/tok/checkout'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caches the token across calls (one fetch)', async () => {
    await interceptor(makeReq('POST', 'http://localhost/api/org/o1/payments/send-link'))
    await interceptor(makeReq('POST', 'http://localhost/api/org/o1/payments/t1/revoke'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('injects x-org-id from localStorage on a dues GET', async () => {
    localStorage.setItem('org.selectedOrgId', 'o9')
    const out = await interceptor(makeReq('GET', 'http://localhost/api/association/member/dues-payments'))
    expect(out.headers.get('x-org-id')).toBe('o9')
    localStorage.removeItem('org.selectedOrgId')
  })

  it('does NOT inject x-org-id on /auth or /pay paths (MIN-2)', async () => {
    localStorage.setItem('org.selectedOrgId', 'o9')
    const authReq = await interceptor(makeReq('POST', 'http://localhost/api/auth/sign-in/email'))
    const payReq = await interceptor(makeReq('POST', 'http://localhost/api/pay/tok/checkout'))
    expect(authReq.headers.get('x-org-id')).toBeNull()
    expect(payReq.headers.get('x-org-id')).toBeNull()
    localStorage.removeItem('org.selectedOrgId')
  })

  it('clear-on-403: response interceptor clears cache so next POST refetches /csrf-token (IMP-2a)', async () => {
    // Populate cache with first call.
    await interceptor(makeReq('POST', 'http://localhost/api/org/o1/payments/send-link'))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Simulate a 403 response — clears the cached token.
    const fakeReq = makeReq('POST', 'http://localhost/api/org/o1/payments/send-link')
    responseInterceptor(new Response(null, { status: 403 }), fakeReq)

    // Reset fetchMock so we can count fresh calls.
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: 'csrf-new' }), { status: 200 }))

    // Next mutating request must refetch.
    const out = await interceptor(makeReq('POST', 'http://localhost/api/org/o1/payments/send-link'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(out.headers.get('x-csrf-token')).toBe('csrf-new')
  })

  it('concurrency dedupe: two concurrent protected POSTs call /csrf-token exactly once (IMP-2b)', async () => {
    // Fire both without awaiting in between — they race for the token.
    const p1 = interceptor(makeReq('POST', 'http://localhost/api/org/o1/payments/send-link'))
    const p2 = interceptor(makeReq('POST', 'http://localhost/api/org/o1/payments/t1/revoke'))
    await Promise.all([p1, p2])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
