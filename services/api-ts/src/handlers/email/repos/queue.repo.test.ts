/**
 * Tests for EmailQueueRepository
 *
 * Tests queue operations, status transitions, retry logic, and validation.
 * DB calls are mocked at the class level — we test business logic, not SQL.
 */

import { describe, test, expect, it, mock, beforeEach, spyOn } from 'bun:test';
import { EmailQueueRepository } from './queue.repo';
import { ValidationError, NotFoundError, BusinessLogicError, ConflictError } from '@/core/errors';
import type { EmailQueueItem, QueueEmailRequest } from './email.schema';

// Mock-Classification: APPROPRIATE — external email/SMTP service boundary
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}

/** Minimal mock DB — enough to construct the repo */
function makeMockDb() {
  return {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          orderBy: mock(() => ({
            limit: mock(() => Promise.resolve([])),
          })),
          limit: mock(() => Promise.resolve([])),
          groupBy: mock(() => Promise.resolve([])),
        })),
        orderBy: mock(() => ({
          limit: mock(() => Promise.resolve([])),
        })),
        groupBy: mock(() => Promise.resolve([])),
      })),
    })),
    insert: mock(() => ({
      values: mock(() => ({
        returning: mock(() => Promise.resolve([])),
      })),
    })),
    update: mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          returning: mock(() => Promise.resolve([])),
        })),
      })),
    })),
    delete: mock(() => ({
      where: mock(() => Promise.resolve({ rowCount: 0 })),
    })),
  } as any;
}

function makeRepo(dbOverride?: any, loggerOverride?: any) {
  const db = dbOverride ?? makeMockDb();
  const logger = loggerOverride ?? makeLogger();
  return new EmailQueueRepository(db, logger);
}

function makeQueueItem(overrides: Partial<EmailQueueItem> = {}): EmailQueueItem {
  return {
    id: 'queue-item-1',
    organizationId: null,
    template: 'tpl-1',
    templateTags: null,
    recipientEmail: 'test@example.com',
    recipientName: 'Test User',
    variables: { name: 'Test' },
    metadata: null,
    status: 'pending',
    priority: 5,
    scheduledAt: null,
    attempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    lastError: null,
    sentAt: null,
    provider: null,
    providerMessageId: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as EmailQueueItem;
}

// ---------------------------------------------------------------------------
// queueEmail
// ---------------------------------------------------------------------------

describe('EmailQueueRepository', () => {
  describe('queueEmail', () => {
    test('throws ValidationError when neither template nor templateTags provided', async () => {
      const repo = makeRepo();

      const request: QueueEmailRequest = {
        recipient: 'test@example.com',
        variables: { name: 'Test' },
      };

      await expect(repo.queueEmail(request)).rejects.toBeInstanceOf(ValidationError);
      await expect(repo.queueEmail(request)).rejects.toThrow(
        'Either template ID or templateTags must be provided'
      );
    });

    test('accepts request with template ID', async () => {
      const repo = makeRepo();
      const created = makeQueueItem({ template: 'tpl-1' });

      // Mock createOne (inherited from DatabaseRepository)
      spyOn(repo, 'createOne' as any).mockResolvedValue(created);

      const result = await repo.queueEmail({
        template: 'tpl-1',
        recipient: 'test@example.com',
        variables: { name: 'Test' },
      });

      expect(result).toEqual(created);
    });

    test('accepts request with templateTags', async () => {
      const repo = makeRepo();
      const created = makeQueueItem({ templateTags: ['auth.welcome'] });

      spyOn(repo, 'createOne' as any).mockResolvedValue(created);

      const result = await repo.queueEmail({
        templateTags: ['auth.welcome'],
        recipient: 'test@example.com',
        variables: { name: 'Test' },
      });

      expect(result).toEqual(created);
    });

    test('sets default priority to 5 when not provided', async () => {
      const repo = makeRepo();
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(makeQueueItem());

      await repo.queueEmail({
        template: 'tpl-1',
        recipient: 'test@example.com',
        variables: {},
      });

      const callArgs = createOneSpy.mock.calls[0][0] as any;
      expect(callArgs.priority).toBe(5);
    });

    test('uses provided priority', async () => {
      const repo = makeRepo();
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(makeQueueItem());

      await repo.queueEmail({
        template: 'tpl-1',
        recipient: 'test@example.com',
        variables: {},
        priority: 1,
      });

      const callArgs = createOneSpy.mock.calls[0][0] as any;
      expect(callArgs.priority).toBe(1);
    });

    test('sets status to pending and attempts to 0', async () => {
      const repo = makeRepo();
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(makeQueueItem());

      await repo.queueEmail({
        template: 'tpl-1',
        recipient: 'test@example.com',
        variables: {},
      });

      const callArgs = createOneSpy.mock.calls[0][0] as any;
      expect(callArgs.status).toBe('pending');
      expect(callArgs.attempts).toBe(0);
    });

    test('defaults organizationId to SYSTEM_ORG_ID when not provided (better-auth signup path)', async () => {
      const repo = makeRepo();
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(makeQueueItem());

      await repo.queueEmail({
        templateTags: ['auth.email-verify'],
        recipient: 'signup@example.com',
        variables: {},
      });

      const callArgs = createOneSpy.mock.calls[0][0] as any;
      expect(callArgs.organizationId).toBe('00000000-0000-0000-0000-000000000000');
    });

    test('defaults organizationId to SYSTEM_ORG_ID when empty string supplied (regression: B-01/B-02)', async () => {
      const repo = makeRepo();
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(makeQueueItem());

      await repo.queueEmail({
        templateTags: ['auth.password-reset'],
        recipient: 'reset@example.com',
        variables: {},
        organizationId: '',
      });

      const callArgs = createOneSpy.mock.calls[0][0] as any;
      expect(callArgs.organizationId).toBe('00000000-0000-0000-0000-000000000000');
    });

    test('preserves caller-supplied organizationId when set', async () => {
      const repo = makeRepo();
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(makeQueueItem());
      const orgId = '11111111-2222-3333-4444-555555555555';

      await repo.queueEmail({
        templateTags: ['announcements.org-broadcast'],
        recipient: 'member@example.com',
        variables: {},
        organizationId: orgId,
      });

      const callArgs = createOneSpy.mock.calls[0][0] as any;
      expect(callArgs.organizationId).toBe(orgId);
    });

    test('sets scheduledAt to null when not provided', async () => {
      const repo = makeRepo();
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(makeQueueItem());

      await repo.queueEmail({
        template: 'tpl-1',
        recipient: 'test@example.com',
        variables: {},
      });

      const callArgs = createOneSpy.mock.calls[0][0] as any;
      expect(callArgs.scheduledAt).toBeNull();
    });

    test('passes scheduledAt when provided', async () => {
      const repo = makeRepo();
      const scheduledAt = new Date('2026-06-01T12:00:00Z');
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(
        makeQueueItem({ scheduledAt })
      );

      await repo.queueEmail({
        template: 'tpl-1',
        recipient: 'test@example.com',
        variables: {},
        scheduledAt,
      });

      const callArgs = createOneSpy.mock.calls[0][0] as any;
      expect(callArgs.scheduledAt).toEqual(scheduledAt);
    });

    test('passes metadata and recipientName', async () => {
      const repo = makeRepo();
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(makeQueueItem());

      await repo.queueEmail({
        template: 'tpl-1',
        recipient: 'test@example.com',
        recipientName: 'Dr. Smith',
        variables: { name: 'Smith' },
        metadata: { bookingId: 'bk-1' },
      });

      const callArgs = createOneSpy.mock.calls[0][0] as any;
      expect(callArgs.recipientName).toBe('Dr. Smith');
      expect(callArgs.metadata).toEqual({ bookingId: 'bk-1' });
    });

    test('generates a UUID for id', async () => {
      const repo = makeRepo();
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(makeQueueItem());

      await repo.queueEmail({
        template: 'tpl-1',
        recipient: 'test@example.com',
        variables: {},
      });

      const callArgs = createOneSpy.mock.calls[0][0] as any;
      // UUID v4 format
      expect(callArgs.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });

  // ---------------------------------------------------------------------------
  // markAsProcessing
  // ---------------------------------------------------------------------------

  describe('markAsProcessing', () => {
    test('calls updateOneById with processing status', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'pending' }));
      const updated = makeQueueItem({ status: 'processing' });
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(updated);

      const result = await repo.markAsProcessing('queue-item-1');

      expect(result.status).toBe('processing');
      expect(updateSpy).toHaveBeenCalledTimes(1);
      const [id, data] = updateSpy.mock.calls[0] as any;
      expect(id).toBe('queue-item-1');
      expect(data.status).toBe('processing');
      expect(data.lastAttemptAt).toBeInstanceOf(Date);
    });

    test('throws NotFoundError when email queue item does not exist', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(null);

      await expect(repo.markAsProcessing('nonexistent')).rejects.toBeInstanceOf(NotFoundError);
    });

    test('allows failed → processing for job-runner auto-retry path', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'failed' }));
      spyOn(repo, 'updateOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));

      const result = await repo.markAsProcessing('queue-item-1');
      expect(result.status).toBe('processing');
    });

    test('throws ConflictError when current status is sent (terminal)', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'sent' }));

      await expect(repo.markAsProcessing('queue-item-1')).rejects.toBeInstanceOf(ConflictError);
    });
  });

  // ---------------------------------------------------------------------------
  // markAsSent
  // ---------------------------------------------------------------------------

  describe('markAsSent', () => {
    test('updates status, sentAt, provider, and providerMessageId', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      const updated = makeQueueItem({ status: 'sent', provider: 'smtp' });
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(updated);

      const result = await repo.markAsSent('queue-item-1', 'smtp', 'msg-123');

      expect(result.status).toBe('sent');
      const [id, data] = updateSpy.mock.calls[0] as any;
      expect(id).toBe('queue-item-1');
      expect(data.status).toBe('sent');
      expect(data.sentAt).toBeInstanceOf(Date);
      expect(data.provider).toBe('smtp');
      expect(data.providerMessageId).toBe('msg-123');
    });

    test('accepts postmark provider', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'sent', provider: 'postmark' })
      );

      await repo.markAsSent('queue-item-1', 'postmark', 'pm-456');

      const [, data] = updateSpy.mock.calls[0] as any;
      expect(data.provider).toBe('postmark');
    });

    test('accepts onesignal provider', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'sent', provider: 'onesignal' })
      );

      const result = await repo.markAsSent('queue-item-1', 'onesignal', 'os-789');
      expect(result.provider).toBe('onesignal');
    });

    test('throws NotFoundError when email queue item does not exist', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(null);

      await expect(repo.markAsSent('nonexistent', 'smtp', 'msg-1')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // markAsFailed — also tests calculateNextRetryTime indirectly
  // ---------------------------------------------------------------------------

  describe('markAsFailed', () => {
    test('increments attempts by 1', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed', attempts: 1 })
      );

      await repo.markAsFailed('queue-item-1', 'SMTP timeout', 0);

      const [, data] = updateSpy.mock.calls[0] as any;
      expect(data.attempts).toBe(1); // 0 + 1
    });

    test('sets lastError message', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed' })
      );

      await repo.markAsFailed('queue-item-1', 'Connection refused', 0);

      const [, data] = updateSpy.mock.calls[0] as any;
      expect(data.lastError).toBe('Connection refused');
    });

    test('sets lastAttemptAt to current time', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed' })
      );

      const before = Date.now();
      await repo.markAsFailed('queue-item-1', 'error', 0);
      const after = Date.now();

      const [, data] = updateSpy.mock.calls[0] as any;
      const attemptTime = data.lastAttemptAt.getTime();
      expect(attemptTime).toBeGreaterThanOrEqual(before);
      expect(attemptTime).toBeLessThanOrEqual(after);
    });

    test('first failure (attempts=0): nextRetryAt ~5 minutes in future', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed' })
      );

      const before = Date.now();
      await repo.markAsFailed('queue-item-1', 'error', 0);

      const [, data] = updateSpy.mock.calls[0] as any;
      const retryTime = data.nextRetryAt.getTime();
      const fiveMinMs = 5 * 60 * 1000;

      // Should be approximately 5 minutes from now (allow 2s tolerance)
      expect(retryTime).toBeGreaterThanOrEqual(before + fiveMinMs - 2000);
      expect(retryTime).toBeLessThanOrEqual(before + fiveMinMs + 2000);
    });

    test('second failure (attempts=1): nextRetryAt ~30 minutes in future', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed' })
      );

      const before = Date.now();
      await repo.markAsFailed('queue-item-1', 'error', 1);

      const [, data] = updateSpy.mock.calls[0] as any;
      const retryTime = data.nextRetryAt.getTime();
      const thirtyMinMs = 30 * 60 * 1000;

      expect(retryTime).toBeGreaterThanOrEqual(before + thirtyMinMs - 2000);
      expect(retryTime).toBeLessThanOrEqual(before + thirtyMinMs + 2000);
    });

    test('third failure (attempts=2): nextRetryAt ~2 hours in future', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed' })
      );

      const before = Date.now();
      await repo.markAsFailed('queue-item-1', 'error', 2);

      const [, data] = updateSpy.mock.calls[0] as any;
      const retryTime = data.nextRetryAt.getTime();
      const twoHoursMs = 2 * 60 * 60 * 1000;

      expect(retryTime).toBeGreaterThanOrEqual(before + twoHoursMs - 2000);
      expect(retryTime).toBeLessThanOrEqual(before + twoHoursMs + 2000);
    });

    test('fourth failure (attempts=3): nextRetryAt is null (no more retries)', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed', attempts: 4 })
      );

      await repo.markAsFailed('queue-item-1', 'error', 3);

      const [, data] = updateSpy.mock.calls[0] as any;
      expect(data.nextRetryAt).toBeNull();
    });

    test('attempts beyond 3 also get null nextRetryAt', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'processing' }));
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed' })
      );

      await repo.markAsFailed('queue-item-1', 'error', 5);

      const [, data] = updateSpy.mock.calls[0] as any;
      expect(data.nextRetryAt).toBeNull();
    });

    test('throws NotFoundError when email queue item does not exist', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(null);

      await expect(repo.markAsFailed('nonexistent', 'err', 0)).rejects.toBeInstanceOf(NotFoundError);
    });

    test('throws ConflictError when current status is sent (terminal)', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeQueueItem({ status: 'sent' }));

      await expect(repo.markAsFailed('queue-item-1', 'err', 0)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  // ---------------------------------------------------------------------------
  // cancelEmail
  // ---------------------------------------------------------------------------

  describe('cancelEmail', () => {
    test('cancels a pending email', async () => {
      const repo = makeRepo();
      const pendingEmail = makeQueueItem({ status: 'pending' });
      spyOn(repo, 'findOneById' as any).mockResolvedValue(pendingEmail);
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'cancelled' })
      );

      const result = await repo.cancelEmail('queue-item-1', 'user-1', 'No longer needed');

      expect(result.status).toBe('cancelled');
      const [, data] = updateSpy.mock.calls[0] as any;
      expect(data.status).toBe('cancelled');
      expect(data.cancelledBy).toBe('user-1');
      expect(data.cancellationReason).toBe('No longer needed');
      expect(data.cancelledAt).toBeInstanceOf(Date);
    });

    test('throws ConflictError when cancelling a failed email (no longer valid per guard)', async () => {
      // Semantics tightened by EMAIL_QUEUE_VALID_TRANSITIONS: cancellation is
      // only valid from `pending`. failed → cancelled is now blocked.
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed' })
      );

      await expect(
        repo.cancelEmail('queue-item-1', 'user-1', 'Giving up')
      ).rejects.toBeInstanceOf(ConflictError);
    });

    test('throws ConflictError when cancelling a processing email (in-flight)', async () => {
      // Semantics tightened by EMAIL_QUEUE_VALID_TRANSITIONS: processing items
      // are mid-send by the job runner; cancellation is not permitted.
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'processing' })
      );

      await expect(
        repo.cancelEmail('queue-item-1', 'user-1', 'Cancel it')
      ).rejects.toBeInstanceOf(ConflictError);
    });

    test('throws NotFoundError when email does not exist', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(null);

      await expect(
        repo.cancelEmail('nonexistent', 'user-1', 'reason')
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    test('throws ConflictError when email is already sent (terminal)', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'sent' })
      );

      await expect(
        repo.cancelEmail('queue-item-1', 'user-1', 'too late')
      ).rejects.toBeInstanceOf(ConflictError);
    });

    test('throws ConflictError when email is already cancelled (terminal)', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'cancelled' })
      );

      await expect(
        repo.cancelEmail('queue-item-1', 'user-1', 'again')
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  // ---------------------------------------------------------------------------
  // retryEmail
  // ---------------------------------------------------------------------------

  describe('retryEmail', () => {
    test('resets a failed email to pending', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed', attempts: 1 })
      );
      const updateSpy = spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'pending' })
      );

      const result = await repo.retryEmail('queue-item-1');

      expect(result.status).toBe('pending');
      const [, data] = updateSpy.mock.calls[0] as any;
      expect(data.status).toBe('pending');
      expect(data.nextRetryAt).toBeNull();
      expect(data.lastError).toBeNull();
    });

    test('throws NotFoundError when email does not exist', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(null);

      await expect(repo.retryEmail('nonexistent')).rejects.toBeInstanceOf(NotFoundError);
    });

    test('throws ConflictError when email is not failed (pending source)', async () => {
      // Replaces prior BusinessLogicError check — guard supersedes ad-hoc check.
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'pending' })
      );

      await expect(repo.retryEmail('queue-item-1')).rejects.toBeInstanceOf(ConflictError);
    });

    test('throws ConflictError when status is sent (terminal)', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'sent' })
      );

      await expect(repo.retryEmail('queue-item-1')).rejects.toBeInstanceOf(ConflictError);
    });

    test('throws BusinessLogicError when attempts >= 3', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed', attempts: 3 })
      );

      await expect(repo.retryEmail('queue-item-1')).rejects.toBeInstanceOf(BusinessLogicError);

      try {
        await repo.retryEmail('queue-item-1');
      } catch (e: any) {
        expect(e.code).toBe('MAX_RETRIES_EXCEEDED');
      }
    });

    test('allows retry when attempts is 2 (below max)', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'failed', attempts: 2 })
      );
      spyOn(repo, 'updateOneById' as any).mockResolvedValue(
        makeQueueItem({ status: 'pending' })
      );

      const result = await repo.retryEmail('queue-item-1');
      expect(result.status).toBe('pending');
    });
  });

  // ---------------------------------------------------------------------------
  // getPendingEmails
  // ---------------------------------------------------------------------------

  describe('getPendingEmails', () => {
    test('returns empty array when no pending emails', async () => {
      const repo = makeRepo();
      // Default mock returns []
      const result = await repo.getPendingEmails();
      expect(result).toEqual([]);
    });

    test('defaults limit to 50', async () => {
      const db = makeMockDb();
      const limitMock = mock(() => Promise.resolve([]));
      db.select = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            orderBy: mock(() => ({
              limit: limitMock,
            })),
          })),
        })),
      }));

      const repo = makeRepo(db);
      await repo.getPendingEmails();

      expect(limitMock).toHaveBeenCalledWith(50);
    });

    test('respects custom limit', async () => {
      const db = makeMockDb();
      const limitMock = mock(() => Promise.resolve([]));
      db.select = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            orderBy: mock(() => ({
              limit: limitMock,
            })),
          })),
        })),
      }));

      const repo = makeRepo(db);
      await repo.getPendingEmails(10);

      expect(limitMock).toHaveBeenCalledWith(10);
    });
  });

  // ---------------------------------------------------------------------------
  // EMAIL_QUEUE_VALID_TRANSITIONS guard (S-G1-06)
  // ---------------------------------------------------------------------------

  describe('EmailQueueRepository — EMAIL_QUEUE_VALID_TRANSITIONS guard', () => {
    it('markAsSent throws ConflictError when current status is cancelled (terminal)', async () => {
      const { EmailQueueRepository } = await import('./queue.repo');
      const { ConflictError } = await import('@/core/errors');
      (EmailQueueRepository.prototype as any).findOneById = mock(async () => makeQueueItem({ status: 'cancelled' }));
      const repo = new EmailQueueRepository({} as any, undefined);
      await expect(repo.markAsSent('e-1', 'smtp', 'msg-1')).rejects.toBeInstanceOf(ConflictError);
    });

    it('retryEmail throws ConflictError when status is sent (no retry from terminal)', async () => {
      const { EmailQueueRepository } = await import('./queue.repo');
      const { ConflictError } = await import('@/core/errors');
      (EmailQueueRepository.prototype as any).findOneById = mock(async () => makeQueueItem({ status: 'sent' }));
      const repo = new EmailQueueRepository({} as any, undefined);
      await expect(repo.retryEmail('e-1')).rejects.toBeInstanceOf(ConflictError);
    });
  });
});
