// Officer-facing error mapper. Older, non-technical users must never see raw
// API/validator/gateway strings (DESIGN.md plain-language law). Map known
// technical causes to plain language with a next step; fall back to a friendly
// generic. Mirrors apps/member/src/features/auth/sign-in.ts:friendlyAuthError.
export function friendlyApiError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('origin') || m.includes('csrf') || m.includes('forbidden'))
    return "We couldn't verify this device. Refresh the page and try again."
  if (m.includes('403') || m.includes('officer') || m.includes('permission') || m.includes('not authorized') || m.includes('unauthorized'))
    return 'You need Treasurer or President access (with two-factor enabled) to do this.'
  if (m.includes('paymongo') || m.includes('gateway') || m.includes('api key') || m.includes('api_key') || m.includes('credential') || m.includes('invalid key'))
    return "We couldn't reach the payment provider. Double-check your PayMongo keys and try again."
  if (m.includes('too many') || m.includes('rate'))
    return 'Too many tries. Please wait a minute, then try again.'
  if (m.includes('network') || m.includes('timeout') || m.includes('fetch') || m.includes('502') || m.includes('503') || m.includes('504'))
    return "We couldn't reach the server. Check your connection and try again."
  return 'Something went wrong. Please try again.'
}
