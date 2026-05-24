import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { CertificatesRepository } from './repos/certificates.repo';
import { NotFoundError, ForbiddenError } from '@/core/errors';
import {
  renderCertificateHtml,
  validateTemplateData,
  type CertificateTemplateData,
  type OrgBranding,
} from './utils/certificate-template';

/**
 * generateCertificatePdf
 *
 * Renders a certificate as HTML for PDF conversion. Supports org-specific
 * branding (logo, colors, signatory) and multiple certificate types.
 *
 * Returns HTML content that can be converted to PDF by the client or
 * a downstream PDF service.
 */
export async function generateCertificatePdf(
  ctx: ValidatedContext<any, never, never>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const certId = ctx.req.param('id')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CertificatesRepository(db);

  const cert = await repo.get(certId);
  if (!cert) throw new NotFoundError('Certificate not found');

  // IDOR prevention: only the certificate owner can generate PDF
  if (cert.personId !== user.id) {
    throw new ForbiddenError('Access denied');
  }

  // Build template data from certificate record + request body overrides
  const body = ctx.req.valid('json') ?? {};

  const templateData: CertificateTemplateData = {
    certificateNumber: cert.certificateNumber,
    recipientName: body.recipientName ?? user.name ?? 'Member',
    trainingTitle: body.trainingTitle ?? 'Training Event',
    issuedAt: cert.issuedAt,
    organizationName: body.organizationName ?? 'Organization',
    certificateType: body.certificateType ?? 'attendance',
    creditAmount: body.creditAmount,
    creditCategory: body.creditCategory,
  };

  const errors = validateTemplateData(templateData);
  if (errors.length > 0) {
    return ctx.json({ error: 'Invalid template data', details: errors }, 400);
  }

  const branding: Partial<OrgBranding> = {
    logoUrl: body.logoUrl,
    primaryColor: body.primaryColor,
    signatoryName: body.signatoryName,
    signatoryTitle: body.signatoryTitle,
    orgName: body.organizationName,
  };

  const html = renderCertificateHtml(templateData, branding);

  return ctx.json({
    certificateId: cert.id,
    certificateNumber: cert.certificateNumber,
    html,
    contentType: 'text/html',
  }, 200);
}
