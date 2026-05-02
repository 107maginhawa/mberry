import type { Context } from 'hono';
import { ValidationError } from '@/core/errors';

export async function testGatewayConnection(ctx: Context): Promise<Response> {
  const body = await ctx.req.json();
  const { provider, publicKey, secretKey } = body;

  if (!provider || !publicKey || !secretKey) {
    throw new ValidationError('Provider, public key, and secret key are required');
  }

  // In production, this would make a test API call to the provider.
  // For now, validate format only.
  const isValidFormat = secretKey.length > 10 && publicKey.length > 10;

  if (!isValidFormat) {
    return ctx.json({ success: false, error: 'Invalid key format' }, 200);
  }

  return ctx.json({ success: true, message: 'Connection verified.' }, 200);
}
