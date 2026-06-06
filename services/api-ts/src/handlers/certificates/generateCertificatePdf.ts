import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { CertificatesRepository } from './repos/certificates.repo';
import { NotFoundError, ForbiddenError } from '@/core/errors';
import { auditAction } from '@/core/audit/audit-action';
import {
  renderCertificatePdf,
  validateTemplateData,
  type CertificateTemplateData,
  type OrgBranding,
} from './utils/certificate-template';
import { domainEvents } from '@/core/domain-events';

/**
 * generateCertificatePdf
 *
 * Renders a certificate as a downloadable PDF. Supports org-specific
 * branding (colors, signatory) and multiple certificate types.
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

  const pdfBytes = await renderCertificatePdf(templateData, branding);

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'certificate',
    resourceId: cert.id,
    description: `Certificate PDF generated: ${cert.certificateNumber}`,
    eventSubType: 'content.certificate-generated',
    details: { certificateNumber: cert.certificateNumber, certificateType: templateData.certificateType },
  });

  // EM-M11-d1e34f90: emit CredentialGenerated domain event.
  domainEvents.emit('credential.generated', {
    credentialId: cert.id,
    credentialNumber: cert.certificateNumber,
    personId: cert.personId,
    credentialType: 'certificate',
    generatedBy: user.id,
  }).catch(() => {});

  const safeFileName = `${cert.certificateNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
      'Content-Length': pdfBytes.byteLength.toString(),
      'Cache-Control': 'no-store',
      'X-Certificate-Id': cert.id,
      'X-Certificate-Number': cert.certificateNumber,
    },
  });
}
