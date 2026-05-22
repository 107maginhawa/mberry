/**
 * unsubscribeEmail
 *
 * RFC 8058 one-click unsubscribe endpoint.
 *
 * This endpoint is PUBLIC — users click links from their email client without
 * being logged in. It must be registered BEFORE the /email/* auth middleware
 * in app.ts.
 *
 * Security: T-25-07 — HMAC-SHA256 token verification before any DB write.
 * An attacker who does not know UNSUBSCRIBE_SECRET cannot forge a valid token.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { verifyUnsubToken } from './utils/unsub-token';
import { SuppressionRepository } from './repos/suppression.repo';

const UNSUBSCRIBE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body>
<p>You have been unsubscribed from this mailing list.</p>
</body>
</html>`;

const BAD_REQUEST_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Invalid Request</title></head>
<body>
<p>Invalid or missing unsubscribe link. Please contact support if you need assistance.</p>
</body>
</html>`;

/**
 * Handle GET and POST requests to /email/unsubscribe
 *
 * Query params: token, email, orgId
 */
export async function unsubscribeEmail(c: Context): Promise<Response> {
  const token = c.req.query('token');
  const email = c.req.query('email');
  const orgId = c.req.query('orgId');

  // Validate required params
  if (!token || !email || !orgId) {
    return c.body(BAD_REQUEST_HTML, 400, { 'Content-Type': 'text/html; charset=utf-8' });
  }

  // Verify HMAC token (T-25-07: tamper protection)
  if (!verifyUnsubToken(token, email, orgId)) {
    return c.body(BAD_REQUEST_HTML, 400, { 'Content-Type': 'text/html; charset=utf-8' });
  }

  // Add to suppression list (idempotent)
  const db = c.get('database') as DatabaseInstance;
  const logger = c.get('logger');
  const repo = new SuppressionRepository(db, logger);

  await repo.addSuppression({ orgId, email, reason: 'unsubscribe' });

  logger?.info({ email, orgId, action: 'unsubscribe' }, 'User unsubscribed via email link');

  return c.body(UNSUBSCRIBE_HTML, 200, { 'Content-Type': 'text/html; charset=utf-8' });
}
