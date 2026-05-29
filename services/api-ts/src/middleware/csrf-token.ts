/**
 * CSRF token middleware (double-submit cookie pattern).
 *
 * Defense-in-depth on top of:
 *   - `hono/csrf` origin verification (Sec-Fetch-Site + Origin header check) in app.ts
 *   - Better-Auth's `SameSite=Lax` session cookies
 *
 * Pattern:
 *   1. Browser fetches GET /csrf-token to receive both a `Set-Cookie`
 *      (`__Host-csrf` or `csrf_token` depending on prod/dev) and a JSON body
 *      containing the same token.
 *   2. Browser stores the token in memory (or in a non-HttpOnly cookie that
 *      JS can read; here we use a non-HttpOnly cookie so the SDK can mirror
 *      it into the `x-csrf-token` request header).
 *   3. On every state-changing request (POST/PUT/PATCH/DELETE), the middleware
 *      requires that the cookie value equals the `x-csrf-token` header value.
 *      A mismatch or missing header → HTTP 403 with a structured error.
 *
 * Why this is meaningful:
 *   - The origin check in `hono/csrf` rejects cross-origin form submissions
 *     and `<img>`-style hijacks, but does not stop a fully same-origin XSS
 *     payload abusing the user's authenticated session. A double-submit token
 *     forces the attacker to also read a value out of a different cookie they
 *     cannot exfiltrate via simple HTML markup — and Hono won't auto-populate
 *     the `x-csrf-token` header for them.
 *
 * Safe methods (GET/HEAD/OPTIONS) are exempt — they should not have side
 * effects. Allowlist exemptions are supported for webhook + public unsubscribe
 * routes that intentionally precede auth and have their own integrity checks.
 *
 * Sentinel: this middleware deliberately does NOT consume the request body.
 * Header + cookie are sufficient for the double-submit check.
 */

import type { MiddlewareHandler, Hono } from 'hono';
import { randomBytes, timingSafeEqual } from 'node:crypto';

export const CSRF_HEADER = 'x-csrf-token';
export const CSRF_COOKIE = 'csrf_token';
const TOKEN_BYTES = 24; // 192 bits — encoded base64url ≈ 32 chars
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface CsrfTokenOptions {
  /**
   * Path prefixes that bypass CSRF token enforcement entirely.
   * Use ONLY for routes that have their own integrity story
   * (Stripe webhook signature, RFC 8058 List-Unsubscribe).
   */
  allowlist?: readonly string[];
}

function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  // Fast-path: lengths must match for a safe comparison.
  if (a.length !== b.length) return false;
  // Use Buffer + timingSafeEqual to avoid early-exit comparison.
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Returns a Hono middleware that enforces double-submit CSRF tokens.
 */
export function createCsrfTokenMiddleware(options: CsrfTokenOptions = {}): MiddlewareHandler {
  const allowlist = options.allowlist ?? [];

  return async function csrfTokenMiddleware(c, next) {
    const method = c.req.method.toUpperCase();
    if (SAFE_METHODS.has(method)) {
      return next();
    }

    const path = new URL(c.req.url).pathname;
    if (allowlist.some((prefix) => path.startsWith(prefix))) {
      return next();
    }

    const cookieToken = getCookie(c.req.raw, CSRF_COOKIE);
    const headerToken = c.req.header(CSRF_HEADER);

    if (!cookieToken || !headerToken) {
      return c.json(
        {
          error: 'CSRF token required',
          code: 'CSRF_TOKEN_MISSING',
          detail: 'State-changing requests must include matching CSRF cookie and header.',
        },
        403,
      );
    }

    if (!constantTimeEqual(cookieToken, headerToken)) {
      return c.json(
        {
          error: 'CSRF token mismatch',
          code: 'CSRF_TOKEN_MISMATCH',
          detail: 'CSRF cookie and header tokens did not match.',
        },
        403,
      );
    }

    return next();
  };
}

/**
 * Mounts `GET /csrf-token` on the given Hono app. The endpoint issues a fresh
 * CSRF token, sets the matching cookie, and returns the token in the JSON body
 * so the SDK can mirror it into the `x-csrf-token` request header.
 *
 * The cookie is intentionally NOT HttpOnly — the SDK on the same origin needs
 * to read it. Confidentiality is not the goal; the goal is forcing the attacker
 * to read a same-origin cookie, which an off-origin XSS / CSRF cannot do.
 */
export function registerCsrfTokenEndpoint(app: Hono<any>): void {
  app.get('/csrf-token', (c) => {
    const token = generateToken();
    // Cookie attributes:
    //   - Path=/ so it's visible to every request
    //   - SameSite=Lax matches Better-Auth session cookie posture
    //   - Secure when behind https (left off for tests / local dev)
    const isHttps = c.req.url.startsWith('https://');
    const attrs = [
      `${CSRF_COOKIE}=${token}`,
      'Path=/',
      'SameSite=Lax',
      isHttps ? 'Secure' : null,
    ].filter(Boolean).join('; ');
    c.header('Set-Cookie', attrs, { append: true });
    return c.json({ token });
  });
}
