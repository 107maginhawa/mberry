import { API_URL, PASSWORD, extractCookie } from './helpers';

export class SeedClient {
  cookie = '';
  csrfToken = '';
  orgId = '';
  personId = '';
  userId = '';
  email = '';

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  /**
   * Fetch CSRF token + cookie (double-submit pattern, see middleware/csrf-token.ts).
   * Must be called before any POST/PUT/PATCH/DELETE that is not /auth/*.
   * Merges the csrf_token cookie into this.cookie so subsequent state-changing
   * requests carry both the auth session cookie and the csrf cookie.
   */
  async fetchCsrf(): Promise<void> {
    const res = await fetch(`${API_URL}/csrf-token`, {
      headers: this.cookie ? { Cookie: this.cookie } : {},
    });
    if (!res.ok) {
      console.error(`  ✗ Fetch /csrf-token failed: ${res.status}`);
      return;
    }
    const data = await res.json() as { token?: string; csrf_token?: string };
    this.csrfToken = data.token || data.csrf_token || '';
    const setCookie = res.headers.get('set-cookie') || '';
    const m = /csrf_token=([^;]+)/.exec(setCookie);
    if (m) {
      const csrfCookie = `csrf_token=${m[1]}`;
      // Merge into existing cookie jar (remove any prior csrf_token entry first)
      const filtered = this.cookie
        .split(/;\s*/)
        .filter((c) => c && !c.startsWith('csrf_token='))
        .join('; ');
      this.cookie = filtered ? `${filtered}; ${csrfCookie}` : csrfCookie;
    }
  }

  async signUp(email: string, name: string): Promise<boolean> {
    this.email = email;
    const res = await fetch(`${API_URL}/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, name }),
    });
    if (res.status === 409 || res.status === 422) {
      // Already exists — sign in instead
      return this.signIn(email);
    }
    if (!res.ok) {
      const text = await res.text();
      console.error(`  ✗ Sign-up failed for ${email}: ${res.status} ${text.slice(0, 200)}`);
      return false;
    }
    const data = await res.json() as { user?: { id: string }; id?: string };
    this.userId = data.user?.id || data.id || '';
    this.cookie = extractCookie(res);
    await this.fetchCsrf();
    return true;
  }

  async signIn(email: string): Promise<boolean> {
    this.email = email;
    const res = await fetch(`${API_URL}/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (!res.ok) {
      console.error(`  ✗ Sign-in failed for ${email}: ${res.status}`);
      return false;
    }
    const data = await res.json() as { user?: { id: string }; id?: string };
    this.userId = data.user?.id || data.id || '';
    this.cookie = extractCookie(res);
    await this.fetchCsrf();
    return true;
  }

  async createPerson(data: {
    firstName: string; lastName: string;
    specialization?: string; licenseNumber?: string;
    dateOfBirth?: string; gender?: string;
  }): Promise<string | null> {
    const res = await this.post('/persons', {
      ...data,
      contactInfo: { email: this.email },
    });
    if (res?.__conflict) {
      // Person exists — fetch
      const existing = await this.get('/persons/me');
      this.personId = existing?.id || '';
      return this.personId;
    }
    this.personId = res?.id || res?.data?.id || '';
    return this.personId;
  }

  async post(path: string, body?: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: this.cookie,
    };
    if (this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }
    if (this.orgId && path.startsWith('/association/')) {
      headers['x-org-id'] = this.orgId;
    }
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 409) return { __conflict: true };
    if (!res.ok) {
      const text = await res.text();
      console.error(`  ✗ POST ${path} → ${res.status}: ${text.slice(0, 300)}`);
      return null;
    }
    if (res.status === 204) return {};
    return res.json();
  }

  async get(path: string): Promise<any> {
    const headers: Record<string, string> = {
      Cookie: this.cookie,
    };
    if (this.orgId && path.startsWith('/association/')) {
      headers['x-org-id'] = this.orgId;
    }
    const res = await fetch(`${API_URL}${path}`, { headers });
    if (!res.ok) return null;
    return res.json();
  }

  async patch(path: string, body: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: this.cookie,
    };
    if (this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }
    if (this.orgId && path.startsWith('/association/')) {
      headers['x-org-id'] = this.orgId;
    }
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  }
}
