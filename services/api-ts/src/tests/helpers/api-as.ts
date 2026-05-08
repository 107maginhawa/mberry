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
}

export async function apiAs(email: string, password = DEFAULT_PASSWORD): Promise<ApiClient> {
  const res = await fetch(`${API_URL}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Sign-in failed for ${email}: ${res.status}`);
  }

  const cookies: string[] = [];
  const setCookies = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [res.headers.get('set-cookie') || ''];
  for (const sc of setCookies) {
    const match = sc.match(/^([^=]+=[^;]+)/);
    if (match) cookies.push(match[1]!);
  }
  const cookie = cookies.join('; ');

  const makeRequest = (method: string) => (path: string, body?: unknown): Promise<Response> => {
    const headers: Record<string, string> = { Cookie: cookie };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
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
  };
}
