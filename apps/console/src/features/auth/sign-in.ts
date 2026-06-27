// Sign-in goes straight to better-auth's catch-all (CSRF-allowlisted, sets the
// httpOnly session cookie). Not an SDK fn — better-auth routes aren't in the
// generated OpenAPI client.
export async function signIn(
  email: string,
  password: string,
  baseUrl = `${window.location.origin}/api`,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${baseUrl}/auth/sign-in/email`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (res.ok) return { ok: true }
  const body = await res.json().catch(() => ({}))
  return { ok: false, error: (body as { message?: string }).message ?? 'Sign-in failed' }
}
