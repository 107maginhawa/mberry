/**
 * Authenticated API test helper.
 * Signs in as a seed user via Better-Auth and returns an HTTP client
 * with session cookie auto-attached to all requests.
 *
 * Requires: API server running on API_URL (default http://localhost:7213)
 * Requires: Seed users created via `bun run db:seed`
 */

const API_URL = process.env['API_URL'] || 'http://localhost:7213';
const DEFAULT_PASSWORD = 'TestPass123!';

export interface ApiClient {
  get: (path: string) => Promise<Response>;
  post: (path: string, body?: unknown) => Promise<Response>;
  put: (path: string, body?: unknown) => Promise<Response>;
  patch: (path: string, body?: unknown) => Promise<Response>;
  delete: (path: string) => Promise<Response>;
  cookie: string;
  csrfToken: string;
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function collectCookies(res: Response): string[] {
  const setCookies = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
    ?? [res.headers.get('set-cookie') || ''];
  const out: string[] = [];
  for (const sc of setCookies) {
    const match = sc.match(/^([^=]+=[^;]+)/);
    if (match) out.push(match[1]!);
  }
  return out;
}

export async function apiAs(email: string, password = DEFAULT_PASSWORD): Promise<ApiClient> {
  const signIn = await fetch(`${API_URL}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!signIn.ok) {
    throw new Error(`Sign-in failed for ${email}: ${signIn.status}`);
  }

  const sessionCookies = collectCookies(signIn);
  const sessionCookie = sessionCookies.join('; ');

  // Double-submit CSRF: fetch token + cookie, then mirror token into header
  // on state-changing requests (see middleware/csrf-token.ts).
  const csrfRes = await fetch(`${API_URL}/csrf-token`, { headers: { Cookie: sessionCookie } });
  if (!csrfRes.ok) {
    throw new Error(`CSRF token fetch failed for ${email}: ${csrfRes.status}`);
  }
  const csrfCookies = collectCookies(csrfRes);
  const { token: csrfToken } = (await csrfRes.json()) as { token: string };

  const cookie = [sessionCookie, csrfCookies.join('; ')].filter(Boolean).join('; ');

  const makeRequest = (method: string) => (path: string, body?: unknown): Promise<Response> => {
    const headers: Record<string, string> = { Cookie: cookie };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (UNSAFE_METHODS.has(method)) {
      headers['x-csrf-token'] = csrfToken;
    }
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  return {
    get: makeRequest('GET'),
    post: makeRequest('POST'),
    put: makeRequest('PUT'),
    patch: makeRequest('PATCH'),
    delete: makeRequest('DELETE'),
    cookie,
    csrfToken,
  };
}
