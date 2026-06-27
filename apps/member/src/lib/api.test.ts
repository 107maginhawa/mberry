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
    localStorage.clear()
  })

  it('injects x-csrf-token on POST to a protected path', async () => {
    const out = await interceptor(makeReq('POST', 'http://localhost/api/association/member/claim'))
    expect(out.headers.get('x-csrf-token')).toBe('csrf-abc')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost/api/csrf-token', expect.objectContaining({ credentials: 'include' }))
  })

  it('does NOT inject on GET', async () => {
    const out = await interceptor(makeReq('GET', 'http://localhost/api/association/member/dues-payments'))
    expect(out.headers.get('x-csrf-token')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does NOT inject on /auth or /pay mutating paths (engine allowlist)', async () => {
    await interceptor(makeReq('POST', 'http://localhost/api/auth/sign-in/email'))
    await interceptor(makeReq('POST', 'http://localhost/api/pay/tok/checkout'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caches the token across calls (one fetch)', async () => {
    await interceptor(makeReq('POST', 'http://localhost/api/association/member/claim'))
    await interceptor(makeReq('POST', 'http://localhost/api/association/member/dues-payments'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('injects x-org-id from member.selectedOrgId on /association/* GET', async () => {
    localStorage.setItem('member.selectedOrgId', 'org-m1')
    const out = await interceptor(makeReq('GET', 'http://localhost/api/association/member/dues-payments'))
    expect(out.headers.get('x-org-id')).toBe('org-m1')
  })

  it('does NOT inject x-org-id on /auth or /pay paths', async () => {
    localStorage.setItem('member.selectedOrgId', 'org-m1')
    const authOut = await interceptor(makeReq('GET', 'http://localhost/api/auth/me'))
    const payOut = await interceptor(makeReq('GET', 'http://localhost/api/pay/tok'))
    expect(authOut.headers.get('x-org-id')).toBeNull()
    expect(payOut.headers.get('x-org-id')).toBeNull()
  })

  it('clears token on 403 response', async () => {
    // Prime the cache.
    await interceptor(makeReq('POST', 'http://localhost/api/association/member/claim'))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Simulate 403 clearing the cache.
    responseInterceptor(new Response('', { status: 403 }), new Request('http://t'))

    // Reset fetchMock so we can count fresh calls.
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: 'csrf-new' }), { status: 200 }))

    // Next mutating request must refetch.
    const out = await interceptor(makeReq('POST', 'http://localhost/api/association/member/claim'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(out.headers.get('x-csrf-token')).toBe('csrf-new')
  })

  it('concurrency dedupe: two concurrent protected POSTs call /csrf-token exactly once', async () => {
    const p1 = interceptor(makeReq('POST', 'http://localhost/api/association/member/claim'))
    const p2 = interceptor(makeReq('POST', 'http://localhost/api/association/member/dues-payments'))
    await Promise.all([p1, p2])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
