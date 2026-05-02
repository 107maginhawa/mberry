import type { Context } from 'hono';
import { CertificatesRepository } from './repos/certificates.repo';
import type { Session } from '@/types/auth';

export async function listCertificates(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const repo = new CertificatesRepository(db);
  const certs = await repo.listByPerson(session.user.id);
  return ctx.json({ data: certs }, 200);
}
