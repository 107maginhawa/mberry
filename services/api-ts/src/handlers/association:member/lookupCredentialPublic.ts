import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import { digitalCredentials } from './repos/credentials.schema';
import { directoryProfiles } from './repos/directory.schema';
import { personPrivacySettings } from '@/handlers/person/repos/privacy-settings.schema';
import { memberships } from './repos/membership.schema';

/**
 * lookupCredentialPublic
 *
 * Path: GET /association/member/credentials/lookup/:credentialNumber
 * PUBLIC endpoint — NO auth required.
 *
 * Looks up a digital credential by its credential number and returns
 * verification status + privacy-gated trust summary.
 */
export async function lookupCredentialPublic(ctx: HandlerContext): Promise<Response> {
  const credentialNumber = ctx.req.param('credentialNumber');
  if (!credentialNumber) {
    return ctx.json({ result: 'notFound', credential: null }, 200);
  }

  const db = ctx.get('database') as DatabaseInstance;

  const [credential] = await db
    .select()
    .from(digitalCredentials)
    .where(eq(digitalCredentials.credentialNumber, credentialNumber))
    .limit(1);

  if (!credential) {
    return ctx.json({ result: 'notFound', credential: null }, 200);
  }

  let result: 'valid' | 'expired' | 'revoked' | 'notFound';
  if (credential.status === 'revoked') {
    result = 'revoked';
  } else if (credential.status === 'expired' || (credential.expiresAt && credential.expiresAt < new Date())) {
    result = 'expired';
  } else if (credential.status === 'active') {
    result = 'valid';
  } else {
    result = 'revoked';
  }

  const [profile] = await db
    .select({ displayName: directoryProfiles.displayName, photoUrl: directoryProfiles.photoUrl, specialty: directoryProfiles.specialty })
    .from(directoryProfiles)
    .where(eq(directoryProfiles.personId, credential.personId))
    .limit(1);

  const [privacy] = await db
    .select()
    .from(personPrivacySettings)
    .where(eq(personPrivacySettings.personId, credential.personId))
    .limit(1);

  const [membership] = await db
    .select({ status: memberships.status })
    .from(memberships)
    .where(eq(memberships.personId, credential.personId))
    .limit(1);

  const isPositiveDues = membership?.status === 'active' || membership?.status === 'gracePeriod';

  return ctx.json({
    result,
    credential: {
      credentialNumber: credential.credentialNumber,
      status: credential.status,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
    },
    holder: {
      displayName: profile?.displayName ?? 'Unknown',
      photoUrl: profile?.photoUrl ?? null,
      specialty: profile?.specialty ?? null,
      membershipStatus: (privacy?.duesStatusVisible ?? false) && isPositiveDues ? 'current' : null,
    },
  }, 200);
}
