import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { eq, and } from 'drizzle-orm';
import { personPrivacySettings } from './repos/privacy-settings.schema';

/**
 * getPrivacySettings
 *
 * Path: GET /persons/me/privacy?orgId=...
 * Returns privacy settings for the authenticated user in a given org.
 * If none exist, returns defaults (email hidden, phone hidden, photo visible, address hidden).
 */
export async function getPrivacySettings(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const targetOrgId = ctx.req.query('organizationId') ?? ctx.req.query('orgId') ?? null;

  const db = ctx.get('database') as DatabaseInstance;

  if (targetOrgId) {
    const [row] = await db
      .select()
      .from(personPrivacySettings)
      .where(and(
        eq(personPrivacySettings.personId, user.id),
        eq(personPrivacySettings.organizationId, targetOrgId),
      ))
      .limit(1);

    return ctx.json(row ?? {
      personId: user.id,
      organizationId: targetOrgId,
      emailVisible: false,
      phoneVisible: false,
      photoVisible: true,
      addressVisible: false,
    }, 200);
  }

  // No orgId: return all privacy settings for this person
  const rows = await db
    .select()
    .from(personPrivacySettings)
    .where(eq(personPrivacySettings.personId, user.id));

  return ctx.json(rows, 200);
}
