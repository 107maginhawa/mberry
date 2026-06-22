import type { ValidatedContext } from '@/types/app';
import type { ExtendJobPostingParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { JobPostingRepository } from './repos/jobs.repo';

/**
 * extendJobPosting
 *
 * Path: POST /association/jobs/postings/{postingId}/extend
 * OperationId: extendJobPosting
 *
 * BR-37: extend a posting's expiry by another 30 days. The new expiry is
 * computed from the CURRENT expiry (not today), and an expired posting is
 * reactivated. Officer-only (route-gated). Tenant-scoped to the caller's org.
 */
export async function extendJobPosting(
  ctx: ValidatedContext<never, never, ExtendJobPostingParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const db = ctx.get('database');
  const organizationId = ctx.get('organizationId') as string | undefined;
  if (!organizationId) {
    return ctx.json({ error: 'Organization context required' }, 403);
  }

  const postingId = ctx.req.param('postingId')!;
  const repo = new JobPostingRepository(db);

  // Tenant boundary: never extend a posting outside the caller's org.
  const posting = await repo.get(postingId);
  if (!posting || posting.organizationId !== organizationId) {
    throw new NotFoundError('Job posting not found');
  }

  const extended = await repo.extendPosting(postingId);

  // x-audit middleware composes the audit event after this returns.
  ctx.set('auditResourceId', postingId);

  return ctx.json({ data: extended }, 200);
}
