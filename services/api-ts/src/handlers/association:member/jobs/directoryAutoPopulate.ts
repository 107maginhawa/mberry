/**
 * Auto-populate directory profile on membership creation
 *
 * Creates a hidden directory profile from person data when a membership
 * is created, so the member's profile is ready for them to opt-in to publish.
 *
 * Idempotent: no-op if profile already exists for person+org.
 */

import type { JobContext } from '@/core/jobs';
import { eq, and } from 'drizzle-orm';
import { directoryProfiles } from '../repos/directory.schema';
import { persons } from '@/handlers/person/repos/person.schema';

export interface DirectoryAutoPopulateData {
  personId: string;
  organizationId: string;
}

export async function processDirectoryAutoPopulate(context: JobContext): Promise<void> {
  const { db, logger, data } = context;
  const { personId, organizationId } = data as DirectoryAutoPopulateData;

  if (!personId || !organizationId) {
    logger.warn({ personId, organizationId }, 'Missing personId or organizationId, skipping');
    return;
  }

  // Idempotent check: skip if profile already exists
  const [existing] = await db
    .select({ id: directoryProfiles.id })
    .from(directoryProfiles)
    .where(and(
      eq(directoryProfiles.personId, personId),
      eq(directoryProfiles.organizationId, organizationId),
    ))
    .limit(1);

  if (existing) {
    logger.debug({ personId, organizationId }, 'Directory profile already exists, skipping');
    return;
  }

  // Fetch person data
  const [person] = await db
    .select({
      firstName: persons.firstName,
      lastName: persons.lastName,
      contactInfo: persons.contactInfo,
      specialization: persons.specialization,
      primaryAddress: persons.primaryAddress,
    })
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);

  if (!person) {
    logger.warn({ personId }, 'Person not found, skipping directory auto-populate');
    return;
  }

  // Build display name from person data
  const displayName = [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Member';

  // Extract email from contactInfo JSONB
  const contactInfo = person.contactInfo as Record<string, string> | null;
  const email = contactInfo?.['email'] ?? null;

  // Extract location from primary address if available
  const address = person.primaryAddress as Record<string, string> | null;
  const locationParts = [address?.['city'], address?.['state'], address?.['country']].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : null;

  await db.insert(directoryProfiles).values({
    organizationId,
    personId,
    displayName,
    specialty: person.specialization ?? null,
    contactEmail: email,
    location,
    visibility: 'hidden',
  });

  logger.info({ personId, organizationId, displayName }, 'Auto-populated directory profile');
}
