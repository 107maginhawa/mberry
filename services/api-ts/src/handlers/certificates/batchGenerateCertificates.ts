import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { CertificatesRepository } from './repos/certificates.repo';
import {
  renderCertificateHtml,
  validateTemplateData,
  type CertificateTemplateData,
  type OrgBranding,
} from './utils/certificate-template';
import { requireOfficerTerm } from '@/utils/officer-check';

/**
 * batchGenerateCertificates
 *
 * Generate certificate HTML for multiple certificates at once.
 * Used for bulk PDF generation after a training event.
 *
 * Accepts an array of certificate IDs + shared template config.
 * Returns per-certificate results with success/error status.
 */

interface BatchCertificateRequest {
  certificateIds: string[];
  /** Shared template settings applied to all certificates */
  template: {
    trainingTitle: string;
    organizationName: string;
    certificateType: 'attendance' | 'completion' | 'speaker';
    creditAmount?: number;
    creditCategory?: string;
  };
  branding?: Partial<OrgBranding>;
  /** Map of personId -> recipientName for name resolution */
  recipientNames?: Record<string, string>;
}

interface BatchResultItem {
  certificateId: string;
  certificateNumber: string;
  status: 'success' | 'error';
  html?: string;
  error?: string;
}

export async function batchGenerateCertificates(
  ctx: ValidatedContext<any, never, never>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  // P1: Officer restriction — batch certificate generation is an admin action
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const body: BatchCertificateRequest = ctx.req.valid('json');

  if (!body.certificateIds || body.certificateIds.length === 0) {
    return ctx.json({ error: 'certificateIds array is required and must not be empty' }, 400);
  }

  // Cap batch size to prevent abuse
  const MAX_BATCH_SIZE = 100;
  if (body.certificateIds.length > MAX_BATCH_SIZE) {
    return ctx.json({ error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CertificatesRepository(db);

  const results: BatchResultItem[] = [];

  for (const certId of body.certificateIds) {
    try {
      const cert = await repo.get(certId);
      if (!cert) {
        results.push({ certificateId: certId, certificateNumber: '', status: 'error', error: 'Certificate not found' });
        continue;
      }

      // Verify certificate belongs to this org
      if (cert.organizationId !== orgId) {
        results.push({ certificateId: certId, certificateNumber: cert.certificateNumber, status: 'error', error: 'Certificate belongs to different organization' });
        continue;
      }

      const recipientName = body.recipientNames?.[cert.personId] ?? 'Member';

      const templateData: CertificateTemplateData = {
        certificateNumber: cert.certificateNumber,
        recipientName,
        trainingTitle: body.template.trainingTitle,
        issuedAt: cert.issuedAt,
        organizationName: body.template.organizationName,
        certificateType: body.template.certificateType,
        creditAmount: body.template.creditAmount,
        creditCategory: body.template.creditCategory,
      };

      const errors = validateTemplateData(templateData);
      if (errors.length > 0) {
        results.push({ certificateId: certId, certificateNumber: cert.certificateNumber, status: 'error', error: errors.join(', ') });
        continue;
      }

      const html = renderCertificateHtml(templateData, body.branding);
      results.push({ certificateId: certId, certificateNumber: cert.certificateNumber, status: 'success', html });
    } catch (err: any) {
      results.push({ certificateId: certId, certificateNumber: '', status: 'error', error: err.message ?? 'Unknown error' });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return ctx.json({
    results,
    summary: { total: results.length, success: successCount, errors: errorCount },
  }, 200);
}
