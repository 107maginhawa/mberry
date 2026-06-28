import { describe, it, expect, vi, afterEach } from 'vitest'
import { requestOtp, verifyOtp } from './sign-in'

afterEach(() => vi.unstubAllGlobals())

describe('requestOtp', () => {
  it('POSTs /auth/email-otp/send-verification-otp with {email,type:sign-in} credentials:include', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await requestOtp('member@pda.ph', 'http://localhost/api')
    expect(res).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/auth/email-otp/send-verification-otp',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'member@pda.ph', type: 'sign-in' }),
      }),
    )
  })

  it('maps a "not found" API message to friendly account copy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Email not found' }), { status: 400 }),
      ),
    )
    const res = await requestOtp('bad@bad.com', 'http://localhost/api')
    expect(res).toEqual({
      ok: false,
      error: "We couldn't find an account with that email. Check the spelling, or contact your chapter officer.",
    })
  })

  it('falls back to a friendly generic when body has no message field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))
    const res = await requestOtp('a@b.com', 'http://localhost/api')
    expect(res).toEqual({ ok: false, error: 'Something went wrong. Please try again.' })
  })

  it('returns a connection error (no throw) when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const res = await requestOtp('a@b.com', 'http://localhost/api')
    expect(res).toEqual({
      ok: false,
      error: "We couldn't reach the server. Check your connection and try again.",
    })
  })

  it('uses window.location.origin+/api as default baseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await requestOtp('a@b.com')
    const calledUrl: string = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).toBe(
      `${window.location.origin}/api/auth/email-otp/send-verification-otp`,
    )
  })
})

describe('verifyOtp', () => {
  it('POSTs /auth/sign-in/email-otp with {email,otp} credentials:include', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await verifyOtp('member@pda.ph', '123456', 'http://localhost/api')
    expect(res).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/auth/sign-in/email-otp',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'member@pda.ph', otp: '123456' }),
      }),
    )
  })

  it('maps an invalid-OTP API message to friendly code copy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Invalid OTP' }), { status: 401 }),
      ),
    )
    const res = await verifyOtp('a@b.com', '000000', 'http://localhost/api')
    expect(res).toEqual({
      ok: false,
      error: "That code didn't match. Check it and try again, or resend a new code.",
    })
  })

  it('falls back to a friendly generic when body has no message field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))
    const res = await verifyOtp('a@b.com', '123456', 'http://localhost/api')
    expect(res).toEqual({ ok: false, error: 'Something went wrong. Please try again.' })
  })

  it('uses window.location.origin+/api as default baseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await verifyOtp('a@b.com', '123456')
    const calledUrl: string = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).toBe(`${window.location.origin}/api/auth/sign-in/email-otp`)
  })
})
