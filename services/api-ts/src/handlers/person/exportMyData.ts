import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { PersonRepository } from './repos/person.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';

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

  return ctx.json({
    exportedAt: new Date().toISOString(),
    personId,
    person: safePerson,
    memberships,
    creditEntries,
  }, 200);
}
