import { describe, it, expect, vi, afterEach } from 'vitest'
import { signIn } from './sign-in'

afterEach(() => vi.unstubAllGlobals())

describe('signIn', () => {
  it('posts credentials and returns ok on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await signIn('a@b.com', 'pw', 'http://localhost/api')
    expect(res).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/auth/sign-in/email',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'pw' }),
      }),
    )
  })

  it('returns an error on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid email or password' }), { status: 401 })))
    const res = await signIn('a@b.com', 'bad', 'http://localhost/api')
    expect(res).toEqual({ ok: false, error: 'Invalid email or password' })
  })

  it('rejects when fetch throws (network error)', async () => {
    // signIn has no try/catch — a transport failure propagates as a rejection.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network Error')))
    await expect(signIn('a@b.com', 'pw', 'http://localhost/api')).rejects.toThrow('Network Error')
  })

  it('uses window.location.origin+/api as default baseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    // Call without 3rd arg — default is `${window.location.origin}/api`
    await signIn('a@b.com', 'pw')
    const calledUrl: string = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toBe(`${window.location.origin}/api/auth/sign-in/email`)
  })
})
