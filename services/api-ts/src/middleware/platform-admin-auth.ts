/**
 * Platform admin authorization middleware.
 * Verifies the authenticated user exists in the platform_admin table.
 * Returns 403 if not a platform admin or lacks required role.
 *
 * Applied as app.use('/admin/*', ...) in app.ts — not in generated routes.
 */

import type { Context, Next } from 'hono';
import { ForbiddenError } from '@/core/errors';
import { PlatformAdminRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';
import type { DatabaseInstance } from '@/core/database';

export function platformAdminAuthMiddleware() {
  return async (ctx: Context, next: Next) => {
    const user = ctx.get('user');
    if (!user) throw new ForbiddenError('Platform admin access required');

    const db = ctx.get('database') as DatabaseInstance;
    const repo = new PlatformAdminRepository(db);

    const admin = await repo.findByUserId(user.id);
    if (!admin) {
      throw new ForbiddenError('User is not a platform admin');
    }

    ctx.set('platformAdmin', admin);
    await next();
  };
}
