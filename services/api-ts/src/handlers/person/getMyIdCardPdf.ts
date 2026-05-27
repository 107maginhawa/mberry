/**
 * GET /persons/me/id-card/:orgId/pdf
 * Generates and returns a downloadable PDF ID card for the authenticated member.
 */

import type { Context } from 'hono';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { getIdCardData } from './utils/id-card-data';

// Credit-card ratio landscape: 612 × 396 pts (standard 3.375" × 2.125" at 72dpi)
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 396;

const STATUS_COLORS: Record<string, [number, number, number]> = {
  active: [0.18, 0.65, 0.35],
  gracePeriod: [0.85, 0.55, 0.1],
  lapsed: [0.8, 0.2, 0.2],
  suspended: [0.45, 0.45, 0.45],
  pendingPayment: [0.2, 0.5, 0.85],
};

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Active',
    gracePeriod: 'Grace Period',
    lapsed: 'Lapsed',
    suspended: 'Suspended',
    pendingPayment: 'Pending Payment',
  };
  return map[status] ?? status;
}

export async function getMyIdCardPdf(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const personId = session.user.id;
  const orgId = ctx.req.param('orgId') ?? '';
  const db = ctx.get('database') as DatabaseInstance;

  if (!orgId) return new Response('orgId is required', { status: 400 });

  const card = await getIdCardData(db, personId, orgId);
  if (!card) throw new NotFoundError('Person not found');

  // Build PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(0.97, 0.97, 0.98),
  });

  // Top accent bar
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 48,
    width: PAGE_WIDTH,
    height: 48,
    color: rgb(0.11, 0.22, 0.42), // dark navy
  });

  // Org name (top bar, centered, white)
  const orgText = card.organizationName.slice(0, 60);
  const orgFontSize = 13;
  const orgTextWidth = boldFont.widthOfTextAtSize(orgText, orgFontSize);
  page.drawText(orgText, {
    x: (PAGE_WIDTH - orgTextWidth) / 2,
    y: PAGE_HEIGHT - 31,
    size: orgFontSize,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  // Member name (large, dark)
  const fullName = [card.firstName, card.lastName].filter(Boolean).join(' ');
  const nameFontSize = 22;
  const nameTextWidth = boldFont.widthOfTextAtSize(fullName, nameFontSize);
  page.drawText(fullName, {
    x: Math.max(24, (PAGE_WIDTH - nameTextWidth) / 2),
    y: PAGE_HEIGHT - 90,
    size: nameFontSize,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.15),
  });

  // License number
  if (card.licenseNumber) {
    const licText = `License No.: ${card.licenseNumber}`;
    const licFontSize = 11;
    const licWidth = regularFont.widthOfTextAtSize(licText, licFontSize);
    page.drawText(licText, {
      x: (PAGE_WIDTH - licWidth) / 2,
      y: PAGE_HEIGHT - 113,
      size: licFontSize,
      font: regularFont,
      color: rgb(0.35, 0.35, 0.4),
    });
  }

  // Divider line
  page.drawLine({
    start: { x: 40, y: PAGE_HEIGHT - 128 },
    end: { x: PAGE_WIDTH - 40, y: PAGE_HEIGHT - 128 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.85),
  });

  // Status badge
  const stLabel = statusLabel(card.membershipStatus);
  const stColor = STATUS_COLORS[card.membershipStatus] ?? [0.45, 0.45, 0.45];
  const badgeFontSize = 10;
  const badgeText = stLabel;
  const badgeTextWidth = boldFont.widthOfTextAtSize(badgeText, badgeFontSize);
  const badgePadX = 10;
  const badgePadY = 4;
  const badgeX = 40;
  const badgeY = PAGE_HEIGHT - 160;

  page.drawRectangle({
    x: badgeX,
    y: badgeY - badgePadY,
    width: badgeTextWidth + badgePadX * 2,
    height: badgeFontSize + badgePadY * 2,
    color: rgb(stColor[0]! * 0.15 + 0.85, stColor[1]! * 0.15 + 0.85, stColor[2]! * 0.15 + 0.85),
    borderColor: rgb(stColor[0]!, stColor[1]!, stColor[2]!),
    borderWidth: 1,
  });
  page.drawText(badgeText, {
    x: badgeX + badgePadX,
    y: badgeY,
    size: badgeFontSize,
    font: boldFont,
    color: rgb(stColor[0]!, stColor[1]!, stColor[2]!),
  });

  // Valid Until
  const validLabel = card.validUntil
    ? `Valid Until: ${new Date(card.validUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
    : 'Valid Until: —';
  page.drawText(validLabel, {
    x: 40,
    y: PAGE_HEIGHT - 185,
    size: 10,
    font: regularFont,
    color: rgb(0.35, 0.35, 0.4),
  });

  // Verification block (right side)
  const verifyX = PAGE_WIDTH - 200;
  const verifyY = PAGE_HEIGHT - 160;

  page.drawRectangle({
    x: verifyX,
    y: verifyY - 70,
    width: 160,
    height: 80,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.75, 0.75, 0.8),
    borderWidth: 0.75,
  });

  page.drawText('Verify at:', {
    x: verifyX + 8,
    y: verifyY - 12,
    size: 8,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.55),
  });

  // Truncate qrPayload so it fits in the box
  const verifyUrl = `memberry.app/verify?p=${card.qrPayload.slice(0, 40)}`;
  page.drawText(verifyUrl, {
    x: verifyX + 8,
    y: verifyY - 26,
    size: 6.5,
    font: regularFont,
    color: rgb(0.2, 0.35, 0.65),
  });

  page.drawText(`Sig: ${card.qrSignature.slice(0, 16)}...`, {
    x: verifyX + 8,
    y: verifyY - 40,
    size: 6,
    font: regularFont,
    color: rgb(0.6, 0.6, 0.65),
  });

  page.drawText('Powered by Memberry', {
    x: verifyX + 8,
    y: verifyY - 58,
    size: 7,
    font: regularFont,
    color: rgb(0.7, 0.7, 0.75),
  });

  // Footer
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: 28,
    color: rgb(0.11, 0.22, 0.42),
  });

  page.drawText('MEMBER IDENTIFICATION CARD', {
    x: 40,
    y: 9,
    size: 8,
    font: boldFont,
    color: rgb(0.75, 0.82, 0.95),
  });

  page.drawText('This card is non-transferable', {
    x: PAGE_WIDTH - 185,
    y: 9,
    size: 8,
    font: regularFont,
    color: rgb(0.65, 0.72, 0.88),
  });

  const pdfBytes = await pdfDoc.save();

  const safeFileName = `${fullName.replace(/[^a-zA-Z0-9]/g, '_')}_id_card.pdf`;

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
      'Content-Length': pdfBytes.byteLength.toString(),
      'Cache-Control': 'no-store',
    },
  });
}
