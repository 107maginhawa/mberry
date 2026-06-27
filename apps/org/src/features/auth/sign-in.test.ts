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
})
