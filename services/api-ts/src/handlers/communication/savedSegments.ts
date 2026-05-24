/**
 * Saved Segments — hand-wired CRUD endpoints for audience segment presets.
 *
 * POST   /communications/segments              — create saved segment
 * GET    /communications/segments               — list saved segments for org
 * DELETE /communications/segments/:id           — delete saved segment
 */

import type { Context } from 'hono';
import { SavedSegmentRepository } from './repos/communication.repo';
import type { DatabaseInstance } from '@/core/database';

export async function createSavedSegment(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const body = await ctx.req.json();
  const { organizationId, name, filters } = body;

  if (!organizationId || !name || !filters) {
    return ctx.json({ error: 'organizationId, name, and filters are required' }, 400);
  }

  if (typeof name !== 'string' || name.length > 100) {
    return ctx.json({ error: 'name must be a string of 100 characters or fewer' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SavedSegmentRepository(db);

  const segment = await repo.create({
    organizationId,
    name: name.trim(),
    filters,
    createdBy: session.user.id,
  });

  return ctx.json({ data: segment }, 201);
}

export async function listSavedSegments(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const organizationId = ctx.req.query('organizationId');
  if (!organizationId) {
    return ctx.json({ error: 'organizationId query parameter is required' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SavedSegmentRepository(db);

  const segments = await repo.list(organizationId);
  return ctx.json({ data: segments }, 200);
}

export async function deleteSavedSegment(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const id = ctx.req.param('id')!;
  const organizationId = ctx.req.query('organizationId');
  if (!organizationId) {
    return ctx.json({ error: 'organizationId query parameter is required' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SavedSegmentRepository(db);

  await repo.delete(id, organizationId);
  return ctx.json({ success: true }, 200);
}
