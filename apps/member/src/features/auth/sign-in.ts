// Auth endpoints (/auth/*) are CSRF-exempt and NOT in the generated SDK.
// Call via raw fetch with credentials:'include'. Mirror apps/org/src/features/auth/sign-in.ts.

async function post(path: string, body: object, baseUrl: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.ok) return { ok: true as const }
  const b = await res.json().catch(() => ({}))
  return { ok: false as const, error: (b as { message?: string }).message ?? 'Request failed' }
}

export const requestOtp = (
  email: string,
  baseUrl = `${window.location.origin}/api`,
): Promise<{ ok: true } | { ok: false; error: string }> =>
  post('/auth/email-otp/send-verification-otp', { email, type: 'sign-in' }, baseUrl)

// [review C1] MUST hit /auth/sign-in/email-otp (not /check-verification-otp):
// this is the actual passwordless sign-in that creates the user + session cookie
// and sets emailVerified=true (enables engine account-claim Task A2).
export const verifyOtp = (
  email: string,
  otp: string,
  baseUrl = `${window.location.origin}/api`,
): Promise<{ ok: true } | { ok: false; error: string }> =>
  post('/auth/sign-in/email-otp', { email, otp }, baseUrl)

// better-auth sign-out (POST /auth/sign-out, CSRF-exempt /auth/*). Clears the
// session cookie server-side; caller invalidates ['session'] + redirects.
export const signOut = (
  baseUrl = `${window.location.origin}/api`,
): Promise<{ ok: true } | { ok: false; error: string }> =>
  post('/auth/sign-out', {}, baseUrl)
