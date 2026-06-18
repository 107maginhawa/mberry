import type { Context } from 'hono';
import { JobPostingRepository, JobApplicationRepository } from './repos/jobs.repo';
import type { Session } from '@/types/auth';

export async function createJobApplication(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const organizationId = ctx.get('organizationId');
  const body = await ctx.req.json();
  const postingRepo = new JobPostingRepository(db);
  const appRepo = new JobApplicationRepository(db);

  if (!body.postingId) {
    return ctx.json({ error: 'postingId is required' }, 400);
  }

  // Verify posting exists and is active. Org-scope: a posting outside the
  // caller's org is treated as missing — prevents applying to another org's
  // posting by UUID (cross-org IDOR guard).
  const posting = await postingRepo.get(body.postingId);
  if (!posting || posting.organizationId !== organizationId) {
    return ctx.json({ error: 'Job posting not found' }, 404);
  }
  if (posting.status !== 'active') {
    return ctx.json({ error: 'Job posting is not accepting applications' }, 409);
  }

  // Check for expired posting
  if (posting.expiresAt && new Date() >= posting.expiresAt) {
    return ctx.json({ error: 'Job posting has expired' }, 409);
  }

  // Prevent duplicate applications
  const existing = await appRepo.findByPersonAndPosting(session.user.id, body.postingId);
  if (existing) {
    return ctx.json({ error: 'You have already applied to this posting' }, 409);
  }

  const application = await appRepo.create({
    postingId: body.postingId,
    personId: session.user.id,
    resumeRef: body.resumeRef,
    coverLetter: body.coverLetter,
    appliedAt: new Date(),
    status: 'applied',
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: application }, 201);
}
