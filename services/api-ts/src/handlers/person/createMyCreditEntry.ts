import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { CreateMyCreditEntryBody } from '@/generated/openapi/validators';
import { CreditService } from '@/handlers/association:member/services/credit.service';
import { DocumentRepository } from '@/handlers/documents/repos/documents.repo';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { and, eq, inArray } from 'drizzle-orm';
import { domainEvents } from '@/core/domain-events';
import { auditAction } from '@/utils/audit';

// M10-R5: supporting documents must be PDF or image, max 5MB.
const MAX_SUPPORTING_DOC_BYTES = 5 * 1024 * 1024;
function isAllowedSupportingDocMime(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/');
}

/**
 * createMyCreditEntry
 *
 * Path: POST /credit-entries
 * OperationId: createMyCreditEntry
 */
export async function createMyCreditEntry(
  ctx: ValidatedContext<CreateMyCreditEntryBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const body = ctx.req.valid('json');
  const personId = session.user.id;

  const b = body as Record<string, unknown>;

  if (!b['activityName'] || (b['creditAmount'] as number) <= 0) {
    throw new ValidationError('activityName required and creditAmount must be positive');
  }

  // G13: organizationId is optional from /my/credits/log (member doesn't
  // pick an org in the UI). Default to the user's first active/grace
  // membership. CreditService.createEntry requires an orgId to compute
  // the cycle window — without this fallback the call throws and the
  // form toasts "Failed to add credit entry".
  if (!b['organizationId']) {
    const [m] = await db
      .select({ orgId: memberships.organizationId })
      .from(memberships)
      .where(
        and(
          eq(memberships.personId, personId),
          inArray(memberships.status, ['active', 'gracePeriod', 'pendingPayment']),
        ),
      )
      .limit(1);
    if (!m) {
      throw new ValidationError(
        'No active membership found — credit entries require an organization context',
      );
    }
    b['organizationId'] = m.orgId;
  }

  // [M10-R5] Validate supporting document: PDF/image only, max 5MB.
  const supportingDocumentId = b['supportingDocumentId'] as string | undefined;
  if (supportingDocumentId) {
    const docRepo = new DocumentRepository(db, logger);
    const doc = await docRepo.findOneById(supportingDocumentId);
    if (!doc) {
      throw new ValidationError('Supporting document not found');
    }
    const mime = (doc as { mimeType?: string }).mimeType ?? '';
    const size = (doc as { size?: number }).size ?? 0;
    if (!isAllowedSupportingDocMime(mime)) {
      throw new ValidationError('Supporting document must be a PDF or image file');
    }
    if (size > MAX_SUPPORTING_DOC_BYTES) {
      throw new ValidationError('Supporting document exceeds the 5MB size limit');
    }
  }

  const creditService = new CreditService(db, logger);

  const entry = await creditService.createEntry({
    organizationId: b['organizationId'] as string,
    personId,
    type: 'manual',
    activityName: b['activityName'] as string,
    provider: b['provider'] as string,
    activityDate: new Date(b['activityDate'] as string),
    creditAmount: b['creditAmount'] as number,
    registrationDate: b['registrationDate'] ? new Date(b['registrationDate'] as string) : undefined,
    cyclePeriodYears: (b['cyclePeriodYears'] as number) ?? undefined,
    supportingDocumentId: b['supportingDocumentId'] as string,
  });

  // [EM-M10-15ad42e8] Emit credit.awarded for the self-service creation path
  // so the credit-awarded consumer notifies the member (parity with the
  // training auto-credit and officer-award paths).
  domainEvents
    .emit('credit.awarded', {
      personId,
      organizationId: b['organizationId'] as string,
      creditEntryId: entry.id,
      creditAmount: b['creditAmount'] as number,
      activityName: b['activityName'] as string,
    })
    .catch(() => {});

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'credit-entry',
    resourceId: entry.id,
    description: `Self-service credit entry: ${b['activityName']} (${b['creditAmount']} credits)`,
  });

  return ctx.json(entry, 201);
}
