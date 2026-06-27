import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { client } from '@monobase/sdk-ts/generated/client.gen'
import { configureApiClient, resetCsrfCacheForTest } from './api'

describe('configureApiClient CSRF interceptor', () => {
  let interceptor: (req: Request) => Promise<Request> | Request
  const fetchMock = vi.fn()
  beforeEach(() => {
    resetCsrfCacheForTest()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: 'csrf-abc' }), { status: 200 }))
    const spy = vi.spyOn(client.interceptors.request, 'use')
    configureApiClient('http://localhost/api')
    interceptor = spy.mock.calls.at(-1)![0] as typeof interceptor
    spy.mockRestore()
  })
  afterEach(() => {
    client.interceptors.request.clear()
    client.interceptors.response.clear()
    vi.unstubAllGlobals()
  })

  it('injects x-csrf-token on POST /admin/organizations (create-org is a protected mutation)', async () => {
    const out = await interceptor(new Request('http://localhost/api/admin/organizations', { method: 'POST' }))
    expect(out.headers.get('x-csrf-token')).toBe('csrf-abc')
  })

  it('does NOT inject x-csrf-token on GET (safe method)', async () => {
    const out = await interceptor(new Request('http://localhost/api/admin/organizations', { method: 'GET' }))
    expect(out.headers.get('x-csrf-token')).toBeNull()
  })

  it('does NOT inject x-csrf-token on /auth (allowlisted)', async () => {
    const out = await interceptor(new Request('http://localhost/api/auth/sign-in/email', { method: 'POST' }))
    expect(out.headers.get('x-csrf-token')).toBeNull()
  })

  it('never sets x-org-id (console is not org-scoped)', async () => {
    const out = await interceptor(new Request('http://localhost/api/admin/organizations', { method: 'GET' }))
    expect(out.headers.get('x-org-id')).toBeNull()
  })

  it('caches the CSRF token across calls (one fetch)', async () => {
    await interceptor(new Request('http://localhost/api/admin/organizations', { method: 'POST' }))
    await interceptor(new Request('http://localhost/api/admin/organizations', { method: 'POST' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
