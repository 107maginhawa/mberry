import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { positions } from '@/handlers/association:member/repos/governance.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * listOfficerTerms
 *
 * Path: GET /association/member/officer-terms
 * OperationId: listOfficerTerms
 */
export async function listOfficerTerms(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OfficerTermRepository(db, logger);

  const terms = await repo.findByOrg(orgId);

  // Enrich with position title + person name
  const positionIds = [...new Set(terms.map((t: any) => t.positionId).filter(Boolean))];
  const personIds = [...new Set(terms.map((t: any) => t.personId).filter(Boolean))];

  const positionMap: Record<string, string> = {};
  if (positionIds.length > 0) {
    const posRows = await db.select({ id: positions.id, title: positions.title }).from(positions).where(inArray(positions.id, positionIds));
    for (const p of posRows) positionMap[p.id] = p.title;
  }

  const personMap: Record<string, string> = {};
  if (personIds.length > 0) {
    const perRows = await db.select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName }).from(persons).where(inArray(persons.id, personIds));
    for (const p of perRows) personMap[p.id] = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  }

  const enriched = terms.map((t: any) => ({
    ...t,
    positionTitle: positionMap[t.positionId] || 'Officer',
    personName: personMap[t.personId] || 'Unknown',
  }));

  return ctx.json({ items: enriched });
}
