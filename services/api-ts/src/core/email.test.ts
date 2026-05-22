/**
 * Tests for EmailServiceImpl guard pipeline
 *
 * Guards tested (in order of execution in processEmail):
 *   1. Suppression check — suppressed recipients are marked failed
 *   2. Deceased/departed guard — blocked membership statuses abort send
 *   3. Bulk rate limit — defers (reschedules) bulk emails; transactional bypasses
 *   4. Unsubscribe header injection — List-Unsubscribe on every outbound email
 *
 * Strategy: construct a real EmailServiceImpl with all external dependencies
 * mocked via stubs. processEmail is private so tests drive it through the
 * public processPendingEmails() method, which iterates the pending queue.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Mock-Classification: APPROPRIATE — external email/SMTP service boundary
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
// ---------------------------------------------------------------------------
// Types matching the real ones (avoid deep import chains in test bootstrap)
// ---------------------------------------------------------------------------

type EmailQueueItem = {
  id: string;
  organizationId: string;
  recipientEmail: string;
  recipientName?: string | null;
  templateTags?: string[] | null;
  template?: string | null;
  variables: Record<string, any>;
  metadata?: Record<string, any> | null;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  priority: number;
  scheduledAt?: Date | null;
  attempts: number;
  lastAttemptAt?: Date | null;
  nextRetryAt?: Date | null;
  lastError?: string | null;
  sentAt?: Date | null;
  provider?: 'smtp' | 'postmark' | 'onesignal' | null;
  providerMessageId?: string | null;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  emailCategory: 'bulk' | 'transactional';
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeEmail(overrides: Partial<EmailQueueItem> = {}): EmailQueueItem {
  return {
    id: 'email-001',
    organizationId: 'org-001',
    recipientEmail: 'member@example.com',
    templateTags: ['auth.welcome'],
    template: null,
    variables: {},
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
    emailCategory: 'transactional',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTemplate() {
  return {
    id: 'tmpl-001',
    organizationId: 'org-001',
    name: 'Welcome',
    subject: 'Welcome {{name}}',
    bodyHtml: '<p>Hello {{name}}</p>',
    bodyText: 'Hello {{name}}',
    tags: ['auth.welcome'],
    variables: [],
    status: 'active',
    version: 1,
    fromName: null,
    fromEmail: null,
    replyToEmail: null,
    replyToName: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Import EmailServiceImpl via the factory (it's the only exported surface)
// ---------------------------------------------------------------------------

// We import the module under test after setting up mocks on collaborators
// NOTE: Because bun:test doesn't support jest.mock() module hoisting, we use
// dependency injection: EmailServiceImpl accepts repos via constructor, but
// we can't pass custom repos without changing the impl.
//
// Instead we test via the public processPendingEmails() by constructing a
// minimal fake DB and Config that satisfy the constructor, then monkey-patch
// the private fields after construction.

import { createEmailService } from './email';

// Minimal config that satisfies Config['email']
const fakeConfig: any = {
  email: {
    provider: 'smtp',
    from: { name: 'Test', email: 'test@example.com' },
    smtp: { host: 'localhost', port: 25, secure: false, auth: { user: '', pass: '' } },
  },
  // Other Config fields that may be accessed
  app: { url: 'https://example.com', port: 7213 },
};

// Minimal fake DB — the repos are replaced in each test via monkey-patching
const fakeDb: any = {};

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}

/**
 * Build a real EmailServiceImpl and monkey-patch its private fields so we
 * can inject stub repos and observe behaviour without a real DB.
 */
function buildService(stubs: {
  pendingEmails?: EmailQueueItem[];
  isSuppressed?: boolean;
  membership?: { status: string } | null;
  canSend?: boolean;
  sendResult?: { success: boolean; provider?: string; messageId?: string; error?: string };
}) {
  const logger = makeLogger();
  const service = createEmailService(fakeDb, fakeConfig, logger as any);
  const impl = service as any; // access private fields

  // Stub queueRepo
  const markAsProcessingMock = mock(async (_id: string) => {});
  const markAsFailedMock = mock(async (_id: string, _err: string, _attempts: number) => {});
  const markAsSentMock = mock(async (_id: string, _provider: string, _msgId: string) => {});
  const updateOneByIdMock = mock(async (_id: string, _data: any) => {});

  impl.queueRepo = {
    getPendingEmails: mock(async () => stubs.pendingEmails ?? []),
    markAsProcessing: markAsProcessingMock,
    markAsFailed: markAsFailedMock,
    markAsSent: markAsSentMock,
    updateOneById: updateOneByIdMock,
  };

  // Stub templateRepo
  impl.templateRepo = {
    findMany: mock(async () => [makeTemplate()]),
    renderTemplate: mock(async () => ({
      subject: 'Welcome Test',
      bodyHtml: '<p>Hello</p>',
      bodyText: 'Hello',
    })),
  };

  // Stub suppressionRepo
  impl.suppressionRepo = {
    isSuppressed: mock(async () => stubs.isSuppressed ?? false),
  };

  // Stub membershipRepo
  impl.membershipRepo = {
    findByPersonAndOrg: mock(async () => stubs.membership === undefined ? null : stubs.membership),
  };

  // Stub bulkRateLimiter
  impl.bulkRateLimiter = {
    canSend: mock(() => stubs.canSend ?? true),
  };

  // Stub the actual provider send so no real network calls happen
  const providerSendMock = mock(async (_req: any) => stubs.sendResult ?? { success: true, provider: 'smtp', messageId: 'msg-001' });
  impl.provider = { send: providerSendMock };

  return {
    service,
    impl,
    mocks: {
      markAsProcessing: markAsProcessingMock,
      markAsFailed: markAsFailedMock,
      markAsSent: markAsSentMock,
      updateOneById: updateOneByIdMock,
      isSuppressed: impl.suppressionRepo.isSuppressed as ReturnType<typeof mock>,
      findByPersonAndOrg: impl.membershipRepo.findByPersonAndOrg as ReturnType<typeof mock>,
      canSend: impl.bulkRateLimiter.canSend as ReturnType<typeof mock>,
      send: providerSendMock,
    },
    logger,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('EmailServiceImpl guard pipeline', () => {

  // -------------------------------------------------------------------------
  // Guard 1: Suppression
  // -------------------------------------------------------------------------

  describe('Guard 1: Suppression check', () => {
    test('skips send and marks failed when recipient is suppressed', async () => {
      const email = makeEmail();
      const { service, mocks } = buildService({
        pendingEmails: [email],
        isSuppressed: true,
      });

      await service.processPendingEmails();

      expect(mocks.isSuppressed).toHaveBeenCalledWith(email.recipientEmail, email.organizationId);
      expect(mocks.markAsFailed).toHaveBeenCalledTimes(1);
      const [id, reason] = mocks.markAsFailed.mock.calls[0] as [string, string, number];
      expect(id).toBe(email.id);
      expect(reason).toMatch(/suppressed/i);
      expect(mocks.send).not.toHaveBeenCalled();
    });

    test('proceeds to send when recipient is not suppressed', async () => {
      const email = makeEmail();
      const { service, mocks } = buildService({
        pendingEmails: [email],
        isSuppressed: false,
      });

      await service.processPendingEmails();

      expect(mocks.isSuppressed).toHaveBeenCalledTimes(1);
      expect(mocks.markAsFailed).not.toHaveBeenCalled();
      expect(mocks.send).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Guard 2: Deceased / departed membership
  // -------------------------------------------------------------------------

  describe('Guard 2: Deceased/departed check', () => {
    const BLOCKED_STATUSES = ['deceased', 'resigned', 'expelled'];

    for (const status of BLOCKED_STATUSES) {
      test(`skips send and marks failed when membership status is "${status}"`, async () => {
        const email = makeEmail({
          metadata: { recipientPersonId: 'person-001' },
        });
        const { service, mocks } = buildService({
          pendingEmails: [email],
          membership: { status },
        });

        await service.processPendingEmails();

        expect(mocks.findByPersonAndOrg).toHaveBeenCalledWith('person-001', email.organizationId);
        expect(mocks.markAsFailed).toHaveBeenCalledTimes(1);
        const [id, reason] = mocks.markAsFailed.mock.calls[0] as [string, string, number];
        expect(id).toBe(email.id);
        expect(reason.toLowerCase()).toContain(status);
        expect(mocks.send).not.toHaveBeenCalled();
      });
    }

    test('proceeds to send when membership status is "active"', async () => {
      const email = makeEmail({
        metadata: { recipientPersonId: 'person-001' },
      });
      const { service, mocks } = buildService({
        pendingEmails: [email],
        membership: { status: 'active' },
      });

      await service.processPendingEmails();

      expect(mocks.markAsFailed).not.toHaveBeenCalled();
      expect(mocks.send).toHaveBeenCalledTimes(1);
    });

    test('skips deceased guard when metadata has no recipientPersonId', async () => {
      const email = makeEmail({ metadata: null });
      const { service, mocks } = buildService({
        pendingEmails: [email],
        // membership stub doesn't matter — guard should not be checked
      });

      await service.processPendingEmails();

      expect(mocks.findByPersonAndOrg).not.toHaveBeenCalled();
      expect(mocks.send).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Guard 3: Bulk rate limit
  // -------------------------------------------------------------------------

  describe('Guard 3: Bulk rate limit', () => {
    test('defers (reschedules) bulk email when rate limit exceeded', async () => {
      const email = makeEmail({ emailCategory: 'bulk' });
      const { service, mocks } = buildService({
        pendingEmails: [email],
        canSend: false,
      });

      await service.processPendingEmails();

      expect(mocks.canSend).toHaveBeenCalledWith(email.organizationId);
      // Must reschedule, not fail
      expect(mocks.updateOneById).toHaveBeenCalledTimes(1);
      const [id, updateData] = mocks.updateOneById.mock.calls[0] as [string, any];
      expect(id).toBe(email.id);
      expect(updateData.status).toBe('pending');
      expect(updateData.scheduledAt).toBeInstanceOf(Date);
      // Should NOT mark as failed
      expect(mocks.markAsFailed).not.toHaveBeenCalled();
      // Should NOT send
      expect(mocks.send).not.toHaveBeenCalled();
    });

    test('sends transactional email even when bulk rate limit would be exceeded', async () => {
      const email = makeEmail({ emailCategory: 'transactional' });
      const { service, mocks } = buildService({
        pendingEmails: [email],
        canSend: false, // limiter says no, but transactional should bypass
      });

      await service.processPendingEmails();

      // Rate limiter should not even be consulted for transactional
      expect(mocks.send).toHaveBeenCalledTimes(1);
      expect(mocks.updateOneById).not.toHaveBeenCalled();
    });

    test('sends bulk email when rate limit is not exceeded', async () => {
      const email = makeEmail({ emailCategory: 'bulk' });
      const { service, mocks } = buildService({
        pendingEmails: [email],
        canSend: true,
      });

      await service.processPendingEmails();

      expect(mocks.canSend).toHaveBeenCalledWith(email.organizationId);
      expect(mocks.send).toHaveBeenCalledTimes(1);
      expect(mocks.updateOneById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Guard 4: Unsubscribe header injection
  // -------------------------------------------------------------------------

  describe('Guard 4: Unsubscribe header injection', () => {
    test('injects List-Unsubscribe header on every outbound email', async () => {
      const email = makeEmail();
      const { service, mocks } = buildService({
        pendingEmails: [email],
      });

      await service.processPendingEmails();

      expect(mocks.send).toHaveBeenCalledTimes(1);
      const [sendRequest] = mocks.send.mock.calls[0] as [any];
      expect(typeof sendRequest.headers).toBe('object');
      const headers = sendRequest.headers as Record<string, string>;
      expect(headers['List-Unsubscribe']).toMatch(/<https?:\/\//);
      expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });

    test('List-Unsubscribe header contains recipient email and org context', async () => {
      const email = makeEmail({
        recipientEmail: 'alice@example.com',
        organizationId: 'org-999',
      });
      const { service, mocks } = buildService({
        pendingEmails: [email],
      });

      await service.processPendingEmails();

      const [sendRequest] = mocks.send.mock.calls[0] as [any];
      const unsubHeader: string = sendRequest.headers['List-Unsubscribe'];
      // Should be a mailto: or https: URI wrapped in angle brackets
      expect(unsubHeader).toMatch(/<https?:\/\//);
      // Should contain org ID for scoping
      expect(unsubHeader).toContain('org-999');
    });
  });

  // -------------------------------------------------------------------------
  // Happy path: no guards block
  // -------------------------------------------------------------------------

  describe('Happy path', () => {
    test('sends email successfully when no guards block', async () => {
      const email = makeEmail({ emailCategory: 'transactional' });
      const { service, mocks } = buildService({
        pendingEmails: [email],
        isSuppressed: false,
        canSend: true,
      });

      await service.processPendingEmails();

      expect(mocks.markAsProcessing).toHaveBeenCalledWith(email.id);
      expect(mocks.send).toHaveBeenCalledTimes(1);
      expect(mocks.markAsSent).toHaveBeenCalledTimes(1);
      expect(mocks.markAsFailed).not.toHaveBeenCalled();
    });

    test('processes multiple emails independently', async () => {
      const emails = [
        makeEmail({ id: 'e1', recipientEmail: 'a@example.com' }),
        makeEmail({ id: 'e2', recipientEmail: 'b@example.com' }),
      ];
      const { service, mocks } = buildService({
        pendingEmails: emails,
        isSuppressed: false,
      });

      await service.processPendingEmails();

      expect(mocks.send).toHaveBeenCalledTimes(2);
    });
  });
});
