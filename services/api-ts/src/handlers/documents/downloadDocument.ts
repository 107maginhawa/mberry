import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { StorageProvider } from '@/core/storage';
import type { Session } from '@/types/auth';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getMembershipPort, getPlatformAdminPort } from '@/core/ports';
import { DocumentRepository, DocumentAccessLogRepository } from './repos/documents.repo';
import { auditAction } from '@/core/audit/audit-action';

/**
 * downloadDocument
 *
 * Path: GET /documents/{documentId}/download
 *
 * Hand-wired (not in TypeSpec): browser <a>/<iframe> GETs cannot send the
 * x-org-id header that /association/* org-context middleware requires, and the
 * documentId UUID in the path would be mis-read as an org id. Mounted outside
 * /association/* and self-enforces org membership, then 302-redirects to a
 * short-lived presigned storage URL so the browser streams the bytes directly.
 */
export async function downloadDocument(ctx: Context): Promise<Response> {
  const session = ctx.get('session') as Session;
  if (!session) throw new UnauthorizedError();

  const documentId = ctx.req.param('documentId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const storage = ctx.get('storage') as StorageProvider;
  const logger = ctx.get('logger');

  const repo = new DocumentRepository(db, logger);
  const document = await repo.findOneById(documentId);
  if (!document) throw new NotFoundError('Document');

  // Access: platform admin or active member of the document's org.
  const adminPort = await getPlatformAdminPort(db);
  const admin = await adminPort.findByUserId(session.user.id);
  if (!admin) {
    const membershipPort = await getMembershipPort(db);
    const membership = await membershipPort.findActiveMembershipByPersonAndOrg(
      session.user.id,
      document.organizationId,
    );
    if (!membership) {
      throw new ForbiddenError('Access denied to this document');
    }
  }

  const downloadUrl = await storage.generateDownloadUrl(document.storageKey);

  // FIX-003 (M11-R5 / AC-M11-005): persist a module-owned access-log row for
  // every download so the officer-facing access-log UI/API has real data.
  // Best-effort: a logging failure must never break the download redirect.
  try {
    const accessLogRepo = new DocumentAccessLogRepository(db, logger);
    await accessLogRepo.createOne({
      documentId,
      personId: session.user.id,
      action: 'download',
      accessedAt: new Date(),
      ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip') || null,
      organizationId: document.organizationId,
    });
  } catch {
    logger?.warn?.(
      { action: 'downloadDocument.accessLog', documentId },
      'Failed to record document download access log',
    );
  }

  await auditAction(ctx, {
    action: 'read',
    resourceType: 'document',
    resourceId: documentId,
    description: `Document downloaded: ${document.title ?? documentId}`,
    eventSubType: 'data.document-downloaded',
    eventType: 'data-access',
  });

  return ctx.redirect(downloadUrl, 302);
}
