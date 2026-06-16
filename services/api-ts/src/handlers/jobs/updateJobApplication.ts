import type { Context } from 'hono';
import { JobApplicationRepository, JobPostingRepository } from './repos/jobs.repo';
import type { Session } from '@/types/auth';

export async function updateJobApplication(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const organizationId = ctx.get('organizationId');
  const applicationId = ctx.req.param('applicationId')!;
  const body = await ctx.req.json();
  const repo = new JobApplicationRepository(db);

  const existing = await repo.get(applicationId);
  if (!existing) {
    return ctx.json({ error: 'Application not found' }, 404);
  }

  // Org-scope: applications carry no org column — derive it from the parent
  // posting. An application whose posting is outside the caller's org is
  // treated as missing (cross-org IDOR guard).
  const postingRepo = new JobPostingRepository(db);
  const posting = await postingRepo.get(existing.postingId);
  if (!posting || posting.organizationId !== organizationId) {
    return ctx.json({ error: 'Application not found' }, 404);
  }

  const updates: Record<string, any> = { updatedBy: session.user.id };
  if (body.status !== undefined) updates['status'] = body.status;
  if (body.resumeRef !== undefined) updates['resumeRef'] = body.resumeRef;
  if (body.coverLetter !== undefined) updates['coverLetter'] = body.coverLetter;

  const updated = await repo.update(applicationId, updates);
  return ctx.json({ data: updated }, 200);
}
