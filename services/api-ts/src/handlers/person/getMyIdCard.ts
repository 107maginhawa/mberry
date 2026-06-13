/**
 * GET /persons/me/id-card/:orgId
 * Returns structured ID card data as JSON for the authenticated member.
 */

import type { Context } from 'hono';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { getIdCardData } from './utils/id-card-data';

export async function getMyIdCard(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const personId = session.user.id;
  const orgId = ctx.req.param('orgId') ?? '';
  const db = ctx.get('database') as DatabaseInstance;

  if (!orgId) return ctx.json({ error: 'orgId is required' }, 400);

  const cardData = await getIdCardData(db, personId, orgId, ctx.get('logger'));
  if (!cardData) throw new NotFoundError('Person not found');

  return ctx.json({ data: cardData });
}
