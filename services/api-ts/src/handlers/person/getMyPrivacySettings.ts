import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GetMyPrivacySettingsQuery } from '@/generated/openapi/validators';
import { eq, and } from 'drizzle-orm';
import { personPrivacySettings } from './repos/privacy-settings.schema';

/**
 * getMyPrivacySettings
 *
 * Path: GET /privacy
 * OperationId: getMyPrivacySettings
 */
export async function getMyPrivacySettings(
  ctx: ValidatedContext<never, GetMyPrivacySettingsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const personId = session.user.id;
  const query = ctx.req.valid('query');
  const orgId = query['orgId'] ?? null;

  if (orgId) {
    const [row] = await db
      .select()
      .from(personPrivacySettings)
      .where(and(
        eq(personPrivacySettings.personId, personId),
        eq(personPrivacySettings.organizationId, orgId),
      ))
      .limit(1);

    return ctx.json(row ?? {
      personId,
      organizationId: orgId,
      emailVisible: false,
      phoneVisible: false,
      photoVisible: true,
      addressVisible: false,
      credentialsVisible: false,
      duesStatusVisible: false,
      ceComplianceVisible: false,
    }, 200);
  }

  const rows = await db
    .select()
    .from(personPrivacySettings)
    .where(eq(personPrivacySettings.personId, personId));

  return ctx.json(rows, 200);
}
