import { eq, and, gte, desc } from 'drizzle-orm';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { PersonRepository } from './repos/person.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { duesPayments } from '@/handlers/association:member/repos/dues-payments.schema';
import { dataExports } from './repos/data-export.schema';
import { domainEvents } from '@/core/domain-events';
import { auditAction } from '@/utils/audit';

const EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * requestDataExport
 *
 * Path: POST /persons/me/data-export
 *
 * WF-014 async DPA data-portability export. Creates a DataExport record,
 * aggregates the member's personal data, marks it ready with a 7-day TTL,
 * and emits data-export.ready. Rate limited to 1 per 24h (M2-R4).
 */
export async function requestDataExport(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  // M2-R4: rate limit — 1 export per 24h per person
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

  const now = new Date();
  const [created] = await db
    .insert(dataExports)
    .values({ personId, status: 'processing', requestedAt: now, createdBy: personId })
    .returning({ id: dataExports.id });
  const exportId = created!.id;

  try {
    const personRepo = new PersonRepository(db, logger);
    const membershipRepo = new MembershipRepository(db, logger);
    const creditRepo = new CreditEntryRepository(db, logger);

    const [person, memberships, creditEntries, payments] = await Promise.all([
      personRepo.findOneById(personId),
      membershipRepo.findAllByPerson(personId),
      creditRepo.findMany({ personId }),
      db.select().from(duesPayments).where(eq(duesPayments.personId, personId)),
    ]);

    // EF-M01: GDPR-appropriate fields only — exclude internal IDs and system metadata.
    const safePerson = person
      ? {
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
        }
      : null;

    const payload = {
      exportedAt: now.toISOString(),
      personId,
      person: safePerson,
      memberships,
      creditEntries,
      payments,
    };

    const expiresAt = new Date(now.getTime() + EXPORT_TTL_MS);
    const downloadUrl = `/persons/me/data-export/${exportId}/download`;

    await db
      .update(dataExports)
      .set({ status: 'ready', payload, downloadUrl, expiresAt, updatedBy: personId })
      .where(eq(dataExports.id, exportId));

    await auditAction(ctx, {
      action: 'export',
      resourceType: 'person',
      resourceId: personId,
      description: 'Data export generated',
      details: { exportId },
    });

    domainEvents
      .emit('data-export.ready', { personId, exportId, downloadUrl })
      .catch(() => {});

    return ctx.json({ exportId, status: 'ready', downloadUrl, expiresAt: expiresAt.toISOString() }, 202);
  } catch (err) {
    logger?.error({ error: err, exportId }, 'Data export generation failed');
    await db
      .update(dataExports)
      .set({ status: 'failed', updatedBy: personId })
      .where(eq(dataExports.id, exportId));
    return ctx.json({ exportId, status: 'failed', error: 'Export could not be completed. Try again.' }, 500);
  }
}
