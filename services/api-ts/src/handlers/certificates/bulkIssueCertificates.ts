import type { Context } from 'hono';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { JobScheduler } from '@/core/jobs';
import { certificates } from './repos/certificates.schema';
import { getNextCertificateNumber, reserveCertificateRange } from './utils/certificate-numbering';
import { renderCertificateHtml, type CertificateTemplateData, type OrgBranding } from './utils/certificate-template';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

interface BulkIssueBody { organizationId: string; personIds: string[]; trainingTitle: string; certificateType: 'attendance' | 'completion' | 'speaker'; cpdActivityType?: string; creditHours?: number; templateId?: string; signingOfficerId: string; orgCode: string; orgBranding?: Partial<OrgBranding>; signatoryName?: string; signatoryTitle?: string; }

export async function bulkIssueCertificates(ctx: Context): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY]);
  if (denied) return denied;
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();
  const body = (await ctx.req.json()) as BulkIssueBody;
  const db = ctx.get('database') as DatabaseInstance;
  // personIds presence + min(1) guaranteed by zValidator in app.ts (defense-in-depth for direct calls)
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
  const count = body.personIds.length;

  // Wrap in transaction so FOR UPDATE in reserveCertificateRange actually locks the row
  return await db.transaction(async (tx) => {
    // Reserve a contiguous range of certificate sequence numbers in one query (fixes N+1)
    const { startSeq, year, orgCode } = await reserveCertificateRange(tx, body.organizationId, body.orgCode, count);

    const now = new Date();
    const certRows: Array<typeof certificates.$inferInsert> = [];

    for (let i = 0; i < count; i++) {
      const personId = body.personIds[i];
      const seq = startSeq + i;
      const certificateNumber = `${orgCode}-${year}-${String(seq).padStart(4, '0')}`;

      try {
        const templateData: CertificateTemplateData = { certificateNumber, recipientName: personId ?? '', trainingTitle: body.trainingTitle ?? '', issuedAt: now, organizationName: (body.orgBranding as OrgBranding | undefined)?.orgName ?? 'Organization', certificateType: body.certificateType ?? 'attendance', creditAmount: body.creditHours, creditCategory: body.cpdActivityType };
        renderCertificateHtml(templateData, { ...body.orgBranding, signatoryName: body.signatoryName ?? '', signatoryTitle: body.signatoryTitle ?? '' } as OrgBranding);
        certRows.push({ organizationId: body.organizationId, personId: personId!, trainingId: body.organizationId, certificateNumber, issuedAt: now, templateId: body.templateId ?? null, signingOfficerId: body.signingOfficerId, creditHours: body.creditHours ?? null, cpdActivityType: (body.cpdActivityType ?? null) as typeof certificates.$inferInsert['cpdActivityType'], status: 'issued' as const, pdfUrl: null, createdBy: requestedBy, updatedBy: requestedBy });
        results.push({ personId: personId ?? '', certificateNumber, pdfUrl: null });
      } catch (err) {
        logger?.error({ error: err, personId }, 'Failed to prepare cert');
        results.push({ personId: personId ?? '', certificateNumber: 'ERROR', pdfUrl: null });
      }
    }

    // Batch-insert all certificates in one query instead of N individual inserts
    if (certRows.length > 0) {
      try {
        await tx.insert(certificates).values(certRows);
      } catch (err) {
        logger?.error({ error: err }, 'Batch certificate insert failed, falling back to individual inserts');
        // Fallback: insert one-by-one so partial success is possible
        for (const row of certRows) {
          try {
            await tx.insert(certificates).values(row);
          } catch (individualErr) {
            logger?.error({ error: individualErr, personId: row.personId }, 'Individual cert insert failed');
            const idx = results.findIndex(r => r.personId === row.personId && r.certificateNumber !== 'ERROR');
            if (idx >= 0) results[idx]!.certificateNumber = 'ERROR';
          }
        }
      }
    }

    return results;
  });
}
