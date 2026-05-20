/**
 * Certificate template rendering utilities.
 *
 * Supports org-specific branding (logo, colors, signatory) and
 * multiple certificate types (attendance, completion, speaker).
 */

export interface CertificateTemplateData {
  certificateNumber: string;
  recipientName: string;
  trainingTitle: string;
  issuedAt: Date;
  organizationName: string;
  certificateType: 'attendance' | 'completion' | 'speaker';
  creditAmount?: number;
  creditCategory?: string;
}

export interface OrgBranding {
  logoUrl?: string;
  primaryColor?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  orgName: string;
}

const DEFAULT_BRANDING: OrgBranding = {
  primaryColor: '#1a365d',
  orgName: 'Organization',
};

const TYPE_LABELS: Record<string, string> = {
  attendance: 'Certificate of Attendance',
  completion: 'Certificate of Completion',
  speaker: 'Certificate of Recognition as Speaker',
};

/**
 * Render certificate HTML from template data + optional org branding.
 * Returns an HTML string suitable for PDF conversion.
 */
export function renderCertificateHtml(
  data: CertificateTemplateData,
  branding?: Partial<OrgBranding>,
): string {
  const brand = { ...DEFAULT_BRANDING, ...branding };
  const typeLabel = TYPE_LABELS[data.certificateType] ?? 'Certificate';
  const dateStr = data.issuedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const creditLine =
    data.creditAmount != null
      ? `<p class="credits">${data.creditAmount} CPD Credit${data.creditAmount !== 1 ? 's' : ''}${data.creditCategory ? ` (${data.creditCategory})` : ''}</p>`
      : '';

  const logoHtml = brand.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${brand.orgName}" class="logo" />`
    : '';

  const signatoryHtml =
    brand.signatoryName
      ? `<div class="signatory">
          <p class="sig-name">${brand.signatoryName}</p>
          <p class="sig-title">${brand.signatoryTitle ?? ''}</p>
        </div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Georgia, serif; text-align: center; padding: 60px; color: #333; }
  .header { margin-bottom: 40px; }
  .logo { max-height: 80px; margin-bottom: 20px; }
  .title { font-size: 28px; color: ${brand.primaryColor}; margin-bottom: 10px; }
  .org-name { font-size: 16px; color: #666; margin-bottom: 30px; }
  .recipient { font-size: 24px; font-weight: bold; margin: 20px 0; }
  .training { font-size: 18px; margin: 10px 0; }
  .credits { font-size: 14px; color: #555; margin: 10px 0; }
  .date { font-size: 14px; color: #888; margin-top: 30px; }
  .cert-number { font-size: 12px; color: #aaa; margin-top: 10px; }
  .signatory { margin-top: 50px; }
  .sig-name { font-weight: bold; border-top: 1px solid #333; display: inline-block; padding-top: 5px; min-width: 200px; }
  .sig-title { font-size: 13px; color: #666; }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <h1 class="title">${typeLabel}</h1>
    <p class="org-name">${brand.orgName}</p>
  </div>
  <p>This certifies that</p>
  <p class="recipient">${data.recipientName}</p>
  <p class="training">has ${data.certificateType === 'speaker' ? 'presented at' : 'completed'}</p>
  <p class="training"><em>${data.trainingTitle}</em></p>
  ${creditLine}
  <p class="date">${dateStr}</p>
  <p class="cert-number">${data.certificateNumber}</p>
  ${signatoryHtml}
</body>
</html>`;
}

/**
 * Validate template data before rendering.
 * Returns an array of error messages (empty = valid).
 */
export function validateTemplateData(data: Partial<CertificateTemplateData>): string[] {
  const errors: string[] = [];
  if (!data.certificateNumber) errors.push('certificateNumber is required');
  if (!data.recipientName) errors.push('recipientName is required');
  if (!data.trainingTitle) errors.push('trainingTitle is required');
  if (!data.issuedAt) errors.push('issuedAt is required');
  if (!data.organizationName) errors.push('organizationName is required');
  if (!data.certificateType) errors.push('certificateType is required');
  if (data.certificateType && !TYPE_LABELS[data.certificateType]) {
    errors.push(`Invalid certificateType: ${data.certificateType}`);
  }
  return errors;
}
