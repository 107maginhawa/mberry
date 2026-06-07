import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { eq, and } from 'drizzle-orm';
import { directoryProfiles } from '@/handlers/association:member/repos/directory.schema';
import { persons } from '@/handlers/person/repos/person.schema';

/**
 * publishMyDirectoryProfile
 *
 * Path: PATCH /association/member/directory/profiles/mine/publish
 * Body: { visibility: 'public' | 'memberOnly' | 'hidden' }
 *
 * Sets the authenticated user's directory profile visibility.
 * If no profile exists, creates one from person data (same as auto-populate).
 */
export async function publishMyDirectoryProfile(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const personId = session.user.id;
  const orgId = ctx.get('organizationId') as string;
  if (!orgId) throw new ValidationError('Organization context required');

  const body = ctx.req.valid('json') as { visibility?: string };
  const visibility = body.visibility ?? 'public';

  if (!['public', 'memberOnly', 'hidden'].includes(visibility)) {
    throw new ValidationError('visibility must be public, memberOnly, or hidden');
  }

  const db = ctx.get('database') as DatabaseInstance;

  // Find existing profile
  const [existing] = await db
    .select()
    .from(directoryProfiles)
    .where(and(
      eq(directoryProfiles.personId, personId),
      eq(directoryProfiles.organizationId, orgId),
    ))
    .limit(1);

  if (existing) {
    // Update visibility
    const [updated] = await db
      .update(directoryProfiles)
      .set({
        visibility: visibility as 'public' | 'memberOnly' | 'hidden',
        publishedAt: visibility !== 'hidden' ? new Date() : null,
        lastUpdatedAt: new Date(),
      })
      .where(eq(directoryProfiles.id, existing.id))
      .returning();

    return ctx.json(updated, 200);
  }

  // No profile exists — create from person data (like auto-populate)
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

  const displayName = person
    ? [person.firstName, person.lastName].filter(Boolean).join(' ')
    : 'Member';

  const contactInfo = person?.contactInfo as Record<string, string> | null;
  const address = person?.primaryAddress as Record<string, string> | null;
  const locationParts = [address?.['city'], address?.['state'], address?.['country']].filter(Boolean);

  const [created] = await db
    .insert(directoryProfiles)
    .values({
      organizationId: orgId,
      personId,
      displayName,
      specialty: person?.specialization ?? null,
      contactEmail: contactInfo?.['email'] ?? null,
      location: locationParts.length > 0 ? locationParts.join(', ') : null,
      visibility: visibility as 'public' | 'memberOnly' | 'hidden',
      publishedAt: visibility !== 'hidden' ? new Date() : null,
    })
    .returning();

  return ctx.json(created, 201);
}
