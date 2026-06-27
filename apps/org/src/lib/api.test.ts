import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { client } from '@monobase/sdk-ts/generated/client.gen'
import { configureApiClient, resetCsrfCacheForTest } from './api'

function makeReq(method: string, url: string): Request {
  return new Request(url, { method })
}

describe('configureApiClient CSRF interceptor', () => {
  let interceptor: (req: Request) => Promise<Request> | Request
  const fetchMock = vi.fn()

  beforeEach(() => {
    resetCsrfCacheForTest()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: 'csrf-abc' }), { status: 200 }))
    // Capture the registered interceptor by spying on the client's use().
    const useSpy = vi.spyOn(client.interceptors.request, 'use')
    configureApiClient('http://localhost/api')
    interceptor = useSpy.mock.calls.at(-1)![0] as typeof interceptor
    useSpy.mockRestore()
  })
  afterEach(() => vi.unstubAllGlobals())

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
})
