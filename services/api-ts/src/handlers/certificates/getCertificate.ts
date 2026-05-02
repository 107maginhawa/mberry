import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { CertificatesRepository } from './repos/certificates.repo';

export async function getCertificate(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new CertificatesRepository(db);
  const cert = await repo.get(id);
  if (!cert) throw new NotFoundError('Certificate not found');
  return ctx.json({ data: cert }, 200);
}
