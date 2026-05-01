import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { PlatformAdminRepository } from './repos/platform-admin.repo';

/**
 * listAdmins
 *
 * Path: GET /admin/admins
 * OperationId: listAdmins
 */
export async function listAdmins(
  ctx: BaseContext
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PlatformAdminRepository(db, logger);

  const admins = await repo.findAll();

  return ctx.json(admins, 200);
}