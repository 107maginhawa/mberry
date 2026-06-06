/**
 * scheduleAnnouncement handler tests — RED phase
 *
 * Business rules:
 * - Only draft announcements can be scheduled
 * - Must provide a future scheduledAt timestamp
 * - Sets status to 'scheduled' and scheduledAt
 * - Officer authorization required (president/secretary)
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { BusinessLogicError } from '@/core/errors';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

// ─── Fixtures ───────────────────────────────────────────

const draftAnnouncement = {
  id: 'ann-1',
  organizationId: 'org-1',
  title: 'Test Announcement',
  status: 'draft',
  authorId: 'user-1',
};

const sentAnnouncement = { ...draftAnnouncement, status: 'sent' };
const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
const pastDate = new Date(Date.now() - 86400000).toISOString(); // -1 day

// ─── Tests ──────────────────────────────────────────────

describe('scheduleAnnouncement', () => {
  let scheduleAnnouncement: typeof import('./scheduleAnnouncement').scheduleAnnouncement;

  beforeEach(async () => {
    restoreRepo(CommunicationsRepository);
    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    scheduleAnnouncement = (await import('./scheduleAnnouncement')).scheduleAnnouncement;
  });

  afterEach(() => {
    restoreRepo(CommunicationsRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('schedules draft announcement and returns 200', async () => {
    let capturedStatus: string | null = null;
    let capturedExtra: any = null;
    stubRepo(CommunicationsRepository, {
      get: async () => draftAnnouncement,
      updateStatus: async (_id: string, status: string, extra: any) => {
        capturedStatus = status;
        capturedExtra = extra;
        return { ...draftAnnouncement, status, ...extra };
      },
    });

    const ctx = makeCtx({
      _params: { id: 'ann-1' },
      _body: { scheduledAt: futureDate },
    });
    const response = await scheduleAnnouncement(ctx);

    expect(response.status).toBe(200);
    expect(capturedStatus).toBe('scheduled');
    expect(capturedExtra.scheduledAt).toBeDefined();
  });

  test('throws ANNOUNCEMENT_NOT_DRAFT when status is sent', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => sentAnnouncement,
    });

    const ctx = makeCtx({
      _params: { id: 'ann-1' },
      _body: { scheduledAt: futureDate },
    });
    const err = await scheduleAnnouncement(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('ANNOUNCEMENT_NOT_DRAFT');
  });

  test('throws SCHEDULE_IN_PAST when scheduledAt is in the past', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => draftAnnouncement,
    });

    const ctx = makeCtx({
      _params: { id: 'ann-1' },
      _body: { scheduledAt: pastDate },
    });
    const err = await scheduleAnnouncement(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('SCHEDULE_IN_PAST');
  });

  test('throws NotFoundError when announcement does not exist', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { id: 'missing' },
      _body: { scheduledAt: futureDate },
    });
    await expect(scheduleAnnouncement(ctx)).rejects.toThrow('Announcement');
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
      _body: { scheduledAt: futureDate },
    });
    await expect(scheduleAnnouncement(ctx)).rejects.toThrow('Unauthorized');
  });
});
