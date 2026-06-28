import { describe, it, expect, vi, afterEach } from 'vitest'
import { requestOtp, verifyOtp, signOut } from './sign-in'

afterEach(() => vi.unstubAllGlobals())

describe('officer email-OTP auth', () => {
  it('requestOtp posts to send-verification-otp and returns ok on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await requestOtp('a@b.com', 'http://localhost/api')
    expect(res).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/auth/email-otp/send-verification-otp',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'a@b.com', type: 'sign-in' }),
      }),
    )
  })

  it('verifyOtp hits the session-creating /auth/sign-in/email-otp endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await verifyOtp('a@b.com', '123456', 'http://localhost/api')
    expect(res).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/auth/sign-in/email-otp',
      expect.objectContaining({ body: JSON.stringify({ email: 'a@b.com', otp: '123456' }) }),
    )
  })

  it('returns an error on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Email not found' }), { status: 404 })))
    const res = await verifyOtp('a@b.com', '000000', 'http://localhost/api')
    expect(res).toEqual({ ok: false, error: 'Email not found' })
  })

  it('signOut posts to /auth/sign-out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await signOut('http://localhost/api')
    expect(res).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/auth/sign-out',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
