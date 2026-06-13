import { eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { CertificatesRepository } from './repos/certificates.repo';
import type { Certificate } from './repos/certificates.schema';
import { NotFoundError, ForbiddenError } from '@/core/errors';
import { auditAction } from '@/core/audit/audit-action';
import {
  renderCertificatePdf,
  validateTemplateData,
  type CertificateTemplateData,
} from './utils/certificate-template';
import { signCertificateQR } from './utils/certificate-qr';
import { domainEvents } from '@/core/domain-events';
import { persons } from '@/handlers/person/repos/person.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { trainings } from '@/handlers/association:operations/repos/training.schema';

const VALID_CERT_TYPES = ['attendance', 'completion', 'speaker'] as const;
type CertType = (typeof VALID_CERT_TYPES)[number];

/**
 * FIX-005 (G5): resolve all certificate display data SERVER-SIDE from the DB —
 * recipient name (person), org name (organization), training title (training),
 * plus the persisted certificate type and credits — and build the signed verify
 * URL. Takes NO request body, so a client cannot forge the identity printed on a
 * genuinely-numbered certificate. Exported for unit testing.
 */
export async function resolveCertificatePdfData(
  db: DatabaseInstance,
  cert: Pick<Certificate, 'certificateNumber' | 'personId' | 'organizationId' | 'trainingId' | 'issuedAt' | 'certificateType' | 'creditHours' | 'cpdActivityType'>,
  recipientFallbackName: string,
  secret: string,
): Promise<{ templateData: CertificateTemplateData; verifyUrl: string | null }> {
  const [person] = await db
    .select({ firstName: persons.firstName, lastName: persons.lastName })
    .from(persons)
    .where(eq(persons.id, cert.personId))
    .limit(1);
  const recipientName =
    person ? [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || recipientFallbackName : recipientFallbackName;

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, cert.organizationId))
    .limit(1);
  const organizationName = org?.name ?? 'Organization';

  let trainingTitle = 'Training Activity';
  if (cert.trainingId) {
    const [training] = await db
      .select({ title: trainings.title })
      .from(trainings)
      .where(eq(trainings.id, cert.trainingId))
      .limit(1);
    if (training?.title) trainingTitle = training.title;
  }

  const certificateType: CertType = VALID_CERT_TYPES.includes(cert.certificateType as CertType)
    ? (cert.certificateType as CertType)
    : 'attendance';

  const templateData: CertificateTemplateData = {
    certificateNumber: cert.certificateNumber,
    recipientName,
    trainingTitle,
    issuedAt: cert.issuedAt,
    organizationName,
    certificateType,
    creditAmount: cert.creditHours ?? undefined,
    creditCategory: cert.cpdActivityType ?? undefined,
  };

  const verifyUrl = secret
    ? `https://memberry.app/verify/${encodeURIComponent(cert.certificateNumber)}?signature=${signCertificateQR(cert.certificateNumber, secret)}`
    : null;

  return { templateData, verifyUrl };
}

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

  // FIX-005 (G5): resolve ALL display data server-side from the DB. The GET route
  // no longer trusts a client body — identity fields on a genuinely-numbered cert
  // were a forgery surface. The signed verify QR points scanners at the public
  // verify endpoint.
  const qrSecret =
    (ctx.get('config') as { certificates?: { qrSecret?: string } } | undefined)?.certificates?.qrSecret
    ?? process.env['CERTIFICATE_QR_SECRET']
    ?? '';

  const { templateData, verifyUrl } = await resolveCertificatePdfData(
    db,
    cert,
    user.name ?? 'Member',
    qrSecret,
  );

  const errors = validateTemplateData(templateData);
  if (errors.length > 0) {
    return ctx.json({ error: 'Invalid template data', details: errors }, 400);
  }

  const pdfBytes = await renderCertificatePdf(
    templateData,
    { orgName: templateData.organizationName },
    { verifyUrl },
  );

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
