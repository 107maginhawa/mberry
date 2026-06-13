/**
 * Certificate template rendering utilities.
 *
 * Supports org-specific branding (logo, colors, signatory) and
 * multiple certificate types (attendance, completion, speaker).
 */

import { PDFDocument, rgb, StandardFonts, type RGB } from 'pdf-lib';
import { drawQrCode } from '@/core/pdf/qr';

/** Optional render-time extras for the PDF (FIX-005). */
export interface CertificatePdfOptions {
  /** Full public verify URL to encode as a scannable QR (e.g. memberry.app/verify/<num>?signature=<hmac>). */
  verifyUrl?: string | null;
}

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

/** Validate color is a safe hex or rgb/rgba value for CSS context. */
function sanitizeColor(color: string | undefined, fallback: string = '#1a365d'): string {
  if (!color) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*[\d.]+)?\s*\)$/.test(color)) return color;
  return fallback;
}

/** Escape user-controlled strings for safe HTML embedding. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Validate URL is safe for src attribute. */
function sanitizeUrl(url: string): string {
  const lower = url.toLowerCase().trim();
  if (lower.startsWith('javascript:') || lower.startsWith('data:text/html')) {
    return '';
  }
  return escapeHtml(url);
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
      ? `<p class="credits">${data.creditAmount} CPD Credit${data.creditAmount !== 1 ? 's' : ''}${data.creditCategory ? ` (${escapeHtml(data.creditCategory)})` : ''}</p>`
      : '';

  const logoHtml = brand.logoUrl
    ? `<img src="${sanitizeUrl(brand.logoUrl)}" alt="${escapeHtml(brand.orgName)}" class="logo" />`
    : '';

  const safeTitle = (brand.signatoryTitle ?? '').slice(0, 100);
  const signatoryHtml =
    brand.signatoryName
      ? `<div class="signatory">
          <p class="sig-name">${escapeHtml(brand.signatoryName)}</p>
          <p class="sig-title">${escapeHtml(safeTitle)}</p>
        </div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Georgia, serif; text-align: center; padding: 60px; color: #333; }
  .header { margin-bottom: 40px; }
  .logo { max-height: 80px; margin-bottom: 20px; }
  .title { font-size: 28px; color: ${sanitizeColor(brand.primaryColor)}; margin-bottom: 10px; }
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
    <h1 class="title">${escapeHtml(typeLabel)}</h1>
    <p class="org-name">${escapeHtml(brand.orgName)}</p>
  </div>
  <p>This certifies that</p>
  <p class="recipient">${escapeHtml(data.recipientName)}</p>
  <p class="training">has ${data.certificateType === 'speaker' ? 'presented at' : 'completed'}</p>
  <p class="training"><em>${escapeHtml(data.trainingTitle)}</em></p>
  ${creditLine}
  <p class="date">${dateStr}</p>
  <p class="cert-number">${escapeHtml(data.certificateNumber)}</p>
  ${signatoryHtml}
</body>
</html>`;
}

/** Parse a hex color (#rgb / #rrggbb) into a pdf-lib RGB, falling back to navy. */
function hexToRgb(color: string | undefined, fallback: RGB = rgb(0.1, 0.21, 0.36)): RGB {
  if (!color) return fallback;
  let hex = color.trim().replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Render a certificate as a real PDF (US Letter landscape, 792×612 pts).
 * Returns the PDF bytes. Text is drawn with embedded standard fonts; org
 * branding controls the accent color and signatory block.
 *
 * EM-M11-83a8b9c0: spec WF-074 requires PDF output, not HTML.
 */
export async function renderCertificatePdf(
  data: CertificateTemplateData,
  branding?: Partial<OrgBranding>,
  options?: CertificatePdfOptions,
): Promise<Uint8Array> {
  const brand = { ...DEFAULT_BRANDING, ...branding };
  const typeLabel = TYPE_LABELS[data.certificateType] ?? 'Certificate';
  const dateStr = data.issuedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const accent = hexToRgb(brand.primaryColor);

  const PAGE_WIDTH = 792;
  const PAGE_HEIGHT = 612;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${typeLabel} — ${data.certificateNumber}`);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const serif = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const center = (text: string, font: typeof serif, size: number, y: number, color = rgb(0.2, 0.2, 0.2)) => {
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y, size, font, color });
  };

  // Background + decorative border
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });
  page.drawRectangle({
    x: 24, y: 24, width: PAGE_WIDTH - 48, height: PAGE_HEIGHT - 48,
    borderColor: accent, borderWidth: 3,
  });
  page.drawRectangle({
    x: 34, y: 34, width: PAGE_WIDTH - 68, height: PAGE_HEIGHT - 68,
    borderColor: accent, borderWidth: 0.75,
  });

  // Heading
  center(typeLabel, serifBold, 34, PAGE_HEIGHT - 130, accent);
  center(brand.orgName, serif, 16, PAGE_HEIGHT - 162, rgb(0.4, 0.4, 0.4));

  // Body
  center('This certifies that', serif, 14, PAGE_HEIGHT - 230);
  center(data.recipientName, serifBold, 30, PAGE_HEIGHT - 272, rgb(0.1, 0.1, 0.12));
  center(
    data.certificateType === 'speaker' ? 'has presented at' : 'has completed',
    serif, 14, PAGE_HEIGHT - 306,
  );
  center(data.trainingTitle, serifItalic, 20, PAGE_HEIGHT - 340, rgb(0.15, 0.15, 0.18));

  if (data.creditAmount != null) {
    const creditText = `${data.creditAmount} CPD Credit${data.creditAmount !== 1 ? 's' : ''}${data.creditCategory ? ` (${data.creditCategory})` : ''}`;
    center(creditText, serif, 13, PAGE_HEIGHT - 372, rgb(0.33, 0.33, 0.33));
  }

  // Footer: date (left) + certificate number (left) + signatory (right)
  page.drawText(dateStr, { x: 80, y: 110, size: 12, font: serif, color: rgb(0.4, 0.4, 0.4) });
  page.drawLine({ start: { x: 80, y: 128 }, end: { x: 260, y: 128 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
  page.drawText('Date Issued', { x: 80, y: 96, size: 9, font: serif, color: rgb(0.55, 0.55, 0.55) });

  page.drawText(`Certificate No. ${data.certificateNumber}`, {
    x: 80, y: 64, size: 9, font: serif, color: rgb(0.6, 0.6, 0.6),
  });

  if (brand.signatoryName) {
    const sigX = PAGE_WIDTH - 280;
    page.drawText(brand.signatoryName, { x: sigX, y: 110, size: 13, font: serifBold, color: rgb(0.15, 0.15, 0.18) });
    page.drawLine({ start: { x: sigX, y: 128 }, end: { x: sigX + 200, y: 128 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    const sigTitle = (brand.signatoryTitle ?? '').slice(0, 100);
    if (sigTitle) {
      page.drawText(sigTitle, { x: sigX, y: 96, size: 9, font: serif, color: rgb(0.55, 0.55, 0.55) });
    }
  }

  // FIX-005: scannable verify QR (bottom-center) when a signed verify URL is provided.
  if (options?.verifyUrl) {
    const qrSize = 64;
    const qrX = (PAGE_WIDTH - qrSize) / 2;
    const qrY = 56;
    drawQrCode(page, { x: qrX, y: qrY, size: qrSize, data: options.verifyUrl });
    const scanText = 'Scan to verify';
    const scanWidth = serif.widthOfTextAtSize(scanText, 8);
    page.drawText(scanText, { x: (PAGE_WIDTH - scanWidth) / 2, y: qrY - 12, size: 8, font: serif, color: rgb(0.5, 0.5, 0.5) });
  }

  // FIX-015 (PRD 11.7): non-removable platform branding footer.
  const brandText = 'Verified by Memberry';
  const brandWidth = serif.widthOfTextAtSize(brandText, 8);
  page.drawText(brandText, { x: (PAGE_WIDTH - brandWidth) / 2, y: 30, size: 8, font: serif, color: rgb(0.6, 0.6, 0.65) });

  return pdfDoc.save();
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
