import type { Context } from 'hono';
import { CertificatesRepository } from './repos/certificates.repo';
import type { Session } from '@/types/auth';

export async function listCertificates(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const repo = new CertificatesRepository(db);

  const limit = Math.min(parseInt(ctx.req.query('limit') ?? '25', 10), 100);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);

  const certs = await repo.listByPerson(session.user.id, { limit, offset });
  return ctx.json({ data: certs, meta: { limit, offset } }, 200);
}
