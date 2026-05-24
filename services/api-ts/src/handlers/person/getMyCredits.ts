import type { Context } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { creditEntries, orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';

export async function getMyCredits(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();
  const personId = session.user.id;
  const organizationId = ctx.get('organizationId') as string | undefined;
  const db = ctx.get('database') as DatabaseInstance;
  let requiredCredits = 60, sdlCapPercent = 40;
  if (organizationId) { const config = await db.select().from(orgCpdConfig).where(eq(orgCpdConfig.organizationId, organizationId)).limit(1); if (config[0]) { requiredCredits = config[0].requiredCredits; sdlCapPercent = config[0].sdlCapPercent; } }
  const conditions = [eq(creditEntries.personId, personId), eq(creditEntries.status, 'active')];
  if (organizationId) conditions.push(eq(creditEntries.organizationId, organizationId));
  const credits = await db.select({ totalCredits: sql<number>`COALESCE(SUM(${creditEntries.creditAmount}), 0)`, generalCredits: sql<number>`COALESCE(SUM(${creditEntries.creditAmount}) FILTER (WHERE ${creditEntries.category} = 'General'), 0)`, majorCredits: sql<number>`COALESCE(SUM(${creditEntries.creditAmount}) FILTER (WHERE ${creditEntries.category} = 'Major'), 0)`, sdlCredits: sql<number>`COALESCE(SUM(${creditEntries.creditAmount}) FILTER (WHERE ${creditEntries.category} = 'Self-Directed'), 0)`, entryCount: sql<number>`COUNT(*)` }).from(creditEntries).where(and(...conditions));
  const row = credits[0] ?? { totalCredits: 0, generalCredits: 0, majorCredits: 0, sdlCredits: 0, entryCount: 0 };
  const total = Number(row.totalCredits); const sdlMax = Math.floor((sdlCapPercent / 100) * requiredCredits); const sdlCredits = Number(row.sdlCredits);
  const history = await db.select().from(creditEntries).where(and(...conditions));
  return ctx.json({ data: { totalCredits: total, requiredCredits, compliancePercent: requiredCredits > 0 ? Math.min(Math.round((total / requiredCredits) * 100), 100) : 100, categoryBreakdown: { general: Number(row.generalCredits), major: Number(row.majorCredits), selfDirected: sdlCredits }, sdlCap: { max: sdlMax, used: sdlCredits, exceeded: sdlCredits > sdlMax }, entryCount: Number(row.entryCount), history: history.map(e => ({ id: e.id, activityName: e.activityName, provider: e.provider, activityDate: e.activityDate, creditAmount: e.creditAmount, category: e.category, sourceType: e.sourceType, verificationStatus: e.verificationStatus, status: e.status, createdAt: e.createdAt })) } });
}
