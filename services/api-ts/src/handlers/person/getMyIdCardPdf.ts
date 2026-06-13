/**
 * GET /persons/me/id-card/:orgId/pdf
 * Generates and returns a downloadable PDF ID card for the authenticated member.
 */

import type { Context } from 'hono';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { getIdCardData } from './utils/id-card-data';
import { renderIdCardPdf } from './utils/id-card-pdf';

export async function getMyIdCardPdf(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const personId = session.user.id;
  const orgId = ctx.req.param('orgId') ?? '';
  const db = ctx.get('database') as DatabaseInstance;

  if (!orgId) return new Response('orgId is required', { status: 400 });

  const card = await getIdCardData(db, personId, orgId, ctx.get('logger'));
  if (!card) throw new NotFoundError('Person not found');

  const pdfBytes = await renderIdCardPdf(card);

  const fullName = [card.firstName, card.lastName].filter(Boolean).join(' ');
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
