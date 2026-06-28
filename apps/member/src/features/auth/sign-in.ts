// Auth endpoints (/auth/*) are CSRF-exempt and NOT in the generated SDK.
// Call via raw fetch with credentials:'include'. Mirror apps/org/src/features/auth/sign-in.ts.

// Older, non-technical users should never see raw API/CSRF strings like
// "Invalid origin". Map known causes to plain language with a clear next step;
// fall back to a friendly generic instead of leaking the technical message.
function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('origin') || m.includes('csrf') || m.includes('forbidden'))
    return "We couldn't verify this device. Refresh the page and try again."
  if (m.includes('expired'))
    return 'That code expired. Tap “Resend code” to get a new one.'
  if (m.includes('otp') || m.includes('code') || m.includes('invalid') || m.includes('incorrect'))
    return "That code didn't match. Check it and try again, or resend a new code."
  if (m.includes('too many') || m.includes('rate'))
    return 'Too many tries. Please wait a minute, then try again.'
  if (m.includes('not found') || m.includes('no account') || m.includes('no user'))
    return "We couldn't find an account with that email. Check the spelling, or contact your chapter officer."
  return 'Something went wrong. Please try again.'
}

async function post(path: string, body: object, baseUrl: string) {
  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // Network failure (offline, DNS, etc.) — fetch rejects; without this the
    // form's await would throw and leave the button stuck on "Sending…".
    return { ok: false as const, error: "We couldn't reach the server. Check your connection and try again." }
  }
  if (res.ok) return { ok: true as const }
  const b = await res.json().catch(() => ({}))
  const raw = (b as { message?: string }).message ?? ''
  return { ok: false as const, error: friendlyAuthError(raw) }
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
