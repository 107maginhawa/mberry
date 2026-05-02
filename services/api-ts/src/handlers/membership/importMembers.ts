import type { Context } from 'hono';
import { MembershipRepository } from './repos/membership.repo';
import type { Session } from '@/types/auth';

export async function importMembers(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();

  const members: Array<{ personId: string; categoryId?: string; licenseNumber?: string }> = body.members;
  const repo = new MembershipRepository(db);

  const imported = await repo.bulkImportMembers(
    members.map((m) => ({
      organizationId: orgId,
      personId: m.personId,
      categoryId: m.categoryId,
      licenseNumber: m.licenseNumber,
      status: 'active' as const,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    }))
  );

  return ctx.json({ data: { imported: imported.length } }, 201);
}
