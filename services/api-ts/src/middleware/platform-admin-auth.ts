/**
 * Platform admin authorization middleware.
 * Verifies the authenticated user exists in the platform_admin table.
 * Returns 403 if not a platform admin or lacks required role.
 *
 * Applied as app.use('/admin/*', ...) in app.ts — not in generated routes.
 *
 * S-C4-014 (Wave G2): platform-admin lookup goes through `core/ports`
 * instead of importing `PlatformAdminRepository` directly.
 */

import type { Context, Next } from 'hono';
import { ForbiddenError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { getPlatformAdminPort, type PlatformAdminPort } from '@/core/ports';

export interface PlatformAdminAuthDeps {
  /**
   * Optional override for the platform-admin port. When omitted, the
   * middleware resolves the production adapter via `core/ports`. Tests
   * inject a fake port to bypass the dynamic import + DB round-trip.
   */
  platformAdminPort?: PlatformAdminPort;
}

export function platformAdminAuthMiddleware(deps: PlatformAdminAuthDeps = {}) {
  return async (ctx: Context, next: Next) => {
    const user = ctx.get('user');
    if (!user) throw new ForbiddenError('Platform admin access required');

    const db = ctx.get('database') as DatabaseInstance;
    const port = deps.platformAdminPort ?? (await getPlatformAdminPort(db));

    const admin = await port.findByUserId(user.id);
    if (!admin) {
      throw new ForbiddenError('User is not a platform admin');
    }

    ctx.set('platformAdmin', admin);
    await next();
  };
}
