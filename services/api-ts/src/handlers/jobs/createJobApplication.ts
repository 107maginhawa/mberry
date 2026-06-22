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

  // Prevent duplicate applications. The serial check-then-create guard handles
  // the common case without a round-trip, but it races under concurrency (TOCTOU:
  // two requests both read "no existing row" before either inserts). The DB-level
  // UNIQUE INDEX (person_id, posting_id) from migration 0084 is the authoritative
  // backstop — catch its 23505 below and return the SAME 409 so the concurrent
  // loser gets a clean conflict instead of an unhandled 500.
  const existing = await appRepo.findByPersonAndPosting(session.user.id, body.postingId);
  if (existing) {
    return ctx.json({ error: 'You have already applied to this posting' }, 409);
  }

  let application;
  try {
    application = await appRepo.create({
      postingId: body.postingId,
      personId: session.user.id,
      resumeRef: body.resumeRef,
      coverLetter: body.coverLetter,
      appliedAt: new Date(),
      status: 'applied',
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });
  } catch (error) {
    const code =
      (error as { code?: string; cause?: { code?: string } }).code ??
      (error as { cause?: { code?: string } }).cause?.code;
    // 23505 = unique_violation on job_application_person_posting_unique: a
    // concurrent request won the race. Surface the same conflict the serial
    // guard returns (clean 409, not 500).
    if (code === '23505') {
      return ctx.json({ error: 'You have already applied to this posting' }, 409);
    }
    throw error;
  }

  return ctx.json({ data: application }, 201);
}
