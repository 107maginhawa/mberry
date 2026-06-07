import type { Context } from 'hono';
import { CertificatesRepository } from './repos/certificates.repo';
import type { Session } from '@/types/auth';

/**
 * Pre-Phase-35 service-helper. NOT a registered route.
 *
 * The live `GET /association/member/certificates` route is served by
 * `listMyCertificates.ts` (TypeSpec-generated, uses DigitalCredentialRepository).
 * This handler reads from CertificatesRepository — the legacy storage
 * model — and exists only to back three cross-module tests that stub
 * CertificatesRepository directly:
 *   - listCertificates.test.ts
 *   - flow-09.certificate-retrieval.test.ts
 *   - documents/slice-023-documents-credentials.test.ts (dynamic import)
 *
 * Do not wire this into a route. See .audits/PRODUCTION_AUDIT.md P0.1 +
 * slice-023's `getCertificate` note for the same legacy-duplicate pattern.
 */
export async function listCertificates(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const repo = new CertificatesRepository(db);

  const limit = Math.min(parseInt(ctx.req.query('limit') ?? '25', 10), 100);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);

  const certs = await repo.listByPerson(session.user.id, { limit, offset });
  return ctx.json({ data: certs, meta: { limit, offset } }, 200);
}
