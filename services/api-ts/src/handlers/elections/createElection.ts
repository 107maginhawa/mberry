import type { Context } from 'hono';
import { sql } from 'drizzle-orm';
import type { Session } from '@/types/auth';

export async function createElection(ctx: Context): Promise<Response> {
  const db = ctx.get('database') as any;
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId');
  const body = await ctx.req.json();

  try {
    const result = await db.execute(sql`
      INSERT INTO election (
        organization_id, title, type, status, voting_mode,
        nominations_open_at, nominations_close_at,
        voting_open_at, voting_close_at,
        positions, created_by, updated_by
      ) VALUES (
        ${orgId},
        ${body.title},
        ${['officer', 'bylaw'].includes(body.type) ? body.type : 'officer'},
        'draft',
        ${body.votingMode ?? 'online'},
        ${body.nominationsOpenAt || null},
        ${body.nominationsCloseAt || null},
        ${body.votingOpenAt || null},
        ${body.votingCloseAt || null},
        ${JSON.stringify(body.positions || [])}::jsonb,
        ${session.user.id},
        ${session.user.id}
      ) RETURNING *
    `);
    const rows = (result as any)?.rows || result;
    return ctx.json({ data: rows[0] || result }, 201);
  } catch (err: any) {
    return ctx.json({ error: err.message || 'Failed to create election' }, 500);
  }
}
