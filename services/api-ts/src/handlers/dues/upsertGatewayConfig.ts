import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';
import { duesGatewayConfigs } from './repos/dues.types';
import { eq } from 'drizzle-orm';
import type { Session } from '@/types/auth';
import { createCipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  const key = Buffer.from(
    process.env['GATEWAY_ENCRYPTION_KEY'] || 'default-key-for-dev-only-32chars!',
    'utf8',
  ).slice(0, 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export async function upsertGatewayConfig(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();

  const { provider, publicKey, secretKey } = body;
  const encryptedSecret = encrypt(secretKey);

  const existing = await new DuesRepository(db).getGatewayConfig(orgId);

  if (existing) {
    await db
      .update(duesGatewayConfigs)
      .set({
        provider,
        publicKey,
        encryptedSecret,
        connected: true,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(duesGatewayConfigs.organizationId, orgId));
  } else {
    await db.insert(duesGatewayConfigs).values({
      organizationId: orgId,
      provider,
      publicKey,
      encryptedSecret,
      connected: true,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });
  }

  return ctx.json(
    { data: { connected: true, provider, publicKeyLast4: publicKey.slice(-4) } },
    200,
  );
}
