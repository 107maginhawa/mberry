import type { BaseContext } from '@/types/app';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';

/**
 * getAdminRole
 *
 * Path: GET /admin/me/role
 * OperationId: getAdminRole
 * Security: platformAdminAuthMiddleware (set via app.use('/admin/*', ...))
 *
 * Returns the authenticated platform admin's role, email, and name.
 */
export async function getAdminRole(
  ctx: BaseContext
): Promise<Response> {
  const admin = ctx.get('platformAdmin');
  if (!admin) {
    throw new ForbiddenError('Not a platform admin');
  }

  return ctx.json(
    { role: admin.role, email: admin.email, name: admin.name },
    200
  );
}
