/**
 * exportSurveyResponses
 *
 * Path: GET /surveys/:survey/export
 * Hand-wired (not in TypeSpec) — returns CSV, not JSON.
 *
 * Exports all completed responses for a survey as CSV.
 * Officer/admin only. Anonymous surveys omit respondent column.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/core/errors';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import type { SurveyQuestion, QuestionAnswer } from './repos/survey.schema';
import { hasRole } from '@/utils/auth';

/**
 * Escape a CSV field: wrap in quotes if it contains comma, quote, or newline.
 */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format an answer value as a display string for CSV.
 */
function formatAnswer(value: string | string[] | number | boolean | undefined): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join('; ');
  return String(value);
}

export async function exportSurveyResponses(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const userId = session.user.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  // Officer/admin gate
  if (!hasRole(session.user, 'admin')) {
    const officerRepo = new OfficerTermRepository(db, logger);
    const terms = await officerRepo.findActiveByPersonAndOrg(userId, organizationId);
    if (terms.length === 0) {
      throw new ForbiddenError('Only officers or admins can export survey responses');
    }
  }

  const surveyId = ctx.req.param('survey')!;

  const surveyRepo = new SurveyRepository(db, logger);
  const survey = await surveyRepo.findById(surveyId);
  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  const responseRepo = new SurveyResponseRepository(db, logger);
  const responses = await responseRepo.findAllBySurveyId(surveyId);

  const questions = (survey.questions ?? []) as SurveyQuestion[];
  const isAnonymous = survey.settings?.anonymous === true;

  // Build header row
  const headers: string[] = [];
  if (!isAnonymous) {
    headers.push('Respondent ID');
  }
  headers.push('Completed At');
  for (const q of questions) {
    headers.push(escapeCsv(q.text));
  }

  // Build data rows
  const rows: string[] = [headers.join(',')];

  for (const resp of responses) {
    const cells: string[] = [];

    if (!isAnonymous) {
      cells.push(resp.responderId ?? '');
    }

    cells.push(resp.completedAt ? resp.completedAt.toISOString() : '');

    const answers = (resp.answers ?? []) as QuestionAnswer[];
    for (const q of questions) {
      const answer = answers.find((a) => a.questionId === q.id);
      cells.push(escapeCsv(formatAnswer(answer?.value)));
    }

    rows.push(cells.join(','));
  }

  // Check format param — accreditation format adds structured headers
  let format = 'csv';
  try {
    const url = new URL(ctx.req.url);
    format = url.searchParams.get('format') ?? 'csv';
  } catch {
    // Test environment may not have full URL — default to csv
  }

  if (format === 'accreditation') {
    // ACCME/PRC structured format with metadata header
    const meta = [
      `# Survey Export — Accreditation Format`,
      `# Title: ${survey.title}`,
      `# Type: ${survey.surveyType}`,
      `# Organization: ${organizationId}`,
      `# Status: ${survey.status}`,
      `# Total Responses: ${responses.length}`,
      `# Export Date: ${new Date().toISOString()}`,
      `# Completion Rate: ${survey.analyticsSnapshot?.completionRate ?? 'N/A'}%`,
      `# NPS Score: ${survey.analyticsSnapshot?.npsScore ?? 'N/A'}`,
      '',
    ];

    // Add satisfaction metrics summary
    const summaryHeaders = ['Question', 'Type', 'Responses', 'Avg Rating/Score', 'Distribution'];
    const summaryRows = [summaryHeaders.join(',')];

    for (const q of questions) {
      const breakdown = survey.analyticsSnapshot?.questionBreakdown?.find(
        (b: any) => b.questionId === q.id
      );
      const avgScore = breakdown?.average ?? breakdown?.npsScore ?? '';
      const dist = breakdown?.distribution ? JSON.stringify(breakdown.distribution) : '';
      summaryRows.push([
        escapeCsv(q.text),
        q.type,
        String(breakdown?.count ?? responses.length),
        String(avgScore),
        escapeCsv(dist),
      ].join(','));
    }

    const accreditationCsv = [...meta, '# SUMMARY', ...summaryRows, '', '# INDIVIDUAL RESPONSES', ...rows].join('\n');
    const safeTitle = survey.title.replace(/[^a-zA-Z0-9_-]/g, '_');

    logger?.info({ surveyId, responseCount: responses.length, format: 'accreditation', action: 'export_survey_responses' }, 'Survey responses exported (accreditation format)');

    return new Response(accreditationCsv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="accreditation-${safeTitle}.csv"`,
      },
    });
  }

  const csv = rows.join('\n');
  const safeTitle = survey.title.replace(/[^a-zA-Z0-9_-]/g, '_');

  logger?.info({ surveyId, responseCount: responses.length, action: 'export_survey_responses' }, 'Survey responses exported');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="survey-${safeTitle}.csv"`,
    },
  });
}
