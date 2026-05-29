import { eq, and, gte, desc } from 'drizzle-orm';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { auditAction } from '@/utils/audit';
import { PersonRepository } from './repos/person.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { dataExports } from './repos/data-export.schema';

const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * exportMyData
 *
 * Path: GET /export
 * OperationId: exportMyData
 *
 * GDPR/DPA data portability: aggregates all user data and returns as JSON.
 */
export async function exportMyData(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  // M2-R4: rate limit — 1 export per 24h per person (shared ledger with the
  // async data-export path so neither endpoint can be used to bypass the other)
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await db
    .select({ id: dataExports.id, status: dataExports.status })
    .from(dataExports)
    .where(and(eq(dataExports.personId, personId), gte(dataExports.requestedAt, since)))
    .orderBy(desc(dataExports.requestedAt))
    .limit(1);
  if (recent.length > 0 && recent[0]!.status !== 'failed') {
    return ctx.json(
      { error: 'You can request one export per 24 hours.', code: 'RATE_LIMITED' },
      429,
    );
  }

  const personRepo = new PersonRepository(db, logger);
  const membershipRepo = new MembershipRepository(db, logger);
  const creditRepo = new CreditEntryRepository(db, logger);

  const [person, memberships, creditEntries] = await Promise.all([
    personRepo.findOneById(personId),
    membershipRepo.findAllByPerson(personId),
    creditRepo.findMany({ personId }),
  ]);

  // EF-M01: Filter to GDPR-appropriate fields only — exclude internal IDs,
  // timestamps, deletion fields, and system metadata.
  const safePerson = person ? {
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName,
    dateOfBirth: person.dateOfBirth,
    gender: person.gender,
    primaryAddress: person.primaryAddress,
    contactInfo: person.contactInfo,
    avatar: person.avatar,
    languagesSpoken: person.languagesSpoken,
    timezone: person.timezone,
    licenseNumber: person.licenseNumber,
    specialization: person.specialization,
    preferredLanguage: person.preferredLanguage,
    bio: person.bio,
  } : null;

  // Record in the shared export ledger so the 24h window applies across both
  // the sync and async export endpoints.
  await db.insert(dataExports).values({
    personId,
    status: 'ready',
    requestedAt: new Date(),
    createdBy: personId,
  });

  await auditAction(ctx, {
    action: 'export',
    resourceType: 'person',
    resourceId: personId,
    description: 'User exported personal data (GDPR/DPA portability)',
    eventSubType: 'data.bulk-export',
    eventType: 'data-access',
  });

  return ctx.json({
    exportedAt: new Date().toISOString(),
    personId,
    person: safePerson,
    memberships,
    creditEntries,
  }, 200);
}
