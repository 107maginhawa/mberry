import type { Context } from 'hono';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { JobScheduler } from '@/core/jobs';
import { certificates } from './repos/certificates.schema';
import { getNextCertificateNumber } from './utils/certificate-numbering';
import { renderCertificateHtml, type CertificateTemplateData, type OrgBranding } from './utils/certificate-template';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

interface BulkIssueBody { organizationId: string; personIds: string[]; trainingTitle: string; certificateType: 'attendance' | 'completion' | 'speaker'; cpdActivityType?: string; creditHours?: number; templateId?: string; signingOfficerId: string; orgCode: string; orgBranding?: Partial<OrgBranding>; signatoryName?: string; signatoryTitle?: string; }

export async function bulkIssueCertificates(ctx: Context): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY]);
  if (denied) return denied;
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();
  const body = (await ctx.req.json()) as BulkIssueBody;
  const db = ctx.get('database') as DatabaseInstance;
  if (!body.personIds?.length) throw new ValidationError('personIds required');
  if (body.personIds.length > 100) throw new ValidationError('Max 100 per batch');
  if (!body.trainingTitle || !body.orgCode || !body.signingOfficerId) throw new ValidationError('trainingTitle, orgCode, signingOfficerId required');
  if (body.personIds.length > 10) { const jobs = ctx.get('jobs') as JobScheduler | undefined; if (jobs) { const jobId = await jobs.trigger('certificate.bulk_generate', { ...body, requestedBy: session.user.id }); return ctx.json({ data: { status: 'queued', jobId, message: `${body.personIds.length} certificates queued` } }, 202); } }
  const results = await generateCertificates(db, body, session.user.id, ctx);
  return ctx.json({ data: results }, 201);
}

export async function generateCertificates(db: DatabaseInstance, body: BulkIssueBody, requestedBy: string, ctx?: Context) {
  const results: Array<{ personId: string; certificateNumber: string; pdfUrl: string | null }> = [];
  const logger = ctx?.get('logger');
  for (const personId of body.personIds) {
    try {
      const { certificateNumber } = await getNextCertificateNumber(db, body.organizationId, body.orgCode);
      const templateData: CertificateTemplateData = { certificateNumber, recipientName: personId, trainingTitle: body.trainingTitle, issuedAt: new Date(), organizationName: body.orgBranding?.orgName ?? 'Organization', certificateType: body.certificateType, creditAmount: body.creditHours, creditCategory: body.cpdActivityType };
      renderCertificateHtml(templateData, { ...body.orgBranding, signatoryName: body.signatoryName, signatoryTitle: body.signatoryTitle });
      await db.insert(certificates).values({ organizationId: body.organizationId, personId, trainingId: body.organizationId, certificateNumber, issuedAt: new Date(), templateId: body.templateId ?? null, signingOfficerId: body.signingOfficerId, creditHours: body.creditHours ?? null, cpdActivityType: body.cpdActivityType as any ?? null, status: 'issued', pdfUrl: null, createdBy: requestedBy, updatedBy: requestedBy });
      results.push({ personId, certificateNumber, pdfUrl: null });
    } catch (err) { logger?.error({ error: err, personId }, 'Failed to issue cert'); results.push({ personId, certificateNumber: 'ERROR', pdfUrl: null }); }
  }
  return results;
}
