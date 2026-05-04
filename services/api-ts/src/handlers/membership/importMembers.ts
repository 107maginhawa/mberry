import type { Context } from 'hono';
import { MembershipRepository } from './repos/membership.repo';
import type { Session } from '@/types/auth';

export async function importMembers(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();

  const members: Array<{
    personId: string;
    tierId: string;
    categoryId?: string;
    memberNumber?: string;
    licenseNumber?: string;
    startDate?: string;
    duesExpiryDate?: string;
  }> = body.members;

  const repo = new MembershipRepository(db);
  const now = new Date();
  const nextYear = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const imported = await repo.bulkImportMembers(
    members.map((m: any) => ({
      tenantId: orgId,
      orgId,
      personId: m.personId,
      tierId: m.tierId,
      categoryId: m.categoryId,
      memberNumber: m.memberNumber ?? m.licenseNumber,
      startDate: m.startDate ?? today,
      duesExpiryDate: m.duesExpiryDate ?? nextYear,
      gracePeriodDays: 30,
      status: 'active' as const,
      joinedAt: new Date(),
      createdBy: session.user.id,
      updatedBy: session.user.id,
    }))
  );

  return ctx.json({ data: { imported: imported.length } }, 201);
}
