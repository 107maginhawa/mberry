import type { Context } from 'hono';
import { SurveyRepository } from './repos/survey.repo';
import type { Session } from '@/types/auth';

export async function createSurvey(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId');
  const body = await ctx.req.json();

  // Validate required fields
  if (!body.title || String(body.title).trim().length === 0) {
    return ctx.json({ error: 'Survey title is required' }, 400);
  }

  const questions = body.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return ctx.json({ error: 'Survey must have at least one question' }, 400);
  }

  // Poll-specific validation
  if (body.isPoll) {
    if (questions.length > 1) {
      return ctx.json({ error: 'Poll must have exactly one question' }, 400);
    }
    if (questions[0]?.type !== 'multiple_choice') {
      return ctx.json({ error: 'Poll question must be multiple choice' }, 400);
    }
  }

  const repo = new SurveyRepository(db);

  const survey = await repo.create({
    organizationId: orgId,
    title: String(body.title).trim(),
    type: body.type ?? 'anonymous',
    status: 'draft',
    isPoll: body.isPoll ?? false,
    questions,
    distribution: body.distribution ?? 'active_members',
    categoryFilter: body.categoryFilter ?? null,
    deadline: body.deadline ? new Date(body.deadline) : null,
    allowEditBeforeDeadline: body.allowEditBeforeDeadline ?? true,
    showResultsImmediately: body.showResultsImmediately ?? false,
    reminderSchedule: body.reminderSchedule ?? [],
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: survey }, 201);
}
