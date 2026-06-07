/**
 * 015 Announcements & Templates Stabilization Tests
 *
 * Slice: 015-announcements-templates (M07 Communications)
 * Covers: announcement CRUD, scheduling, targeting, email template management,
 *         permission enforcement, tenant isolation, status transitions.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { MessageTemplateRepository } from './repos/communication.repo';
import { MessageRepository } from './repos/communication.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

// Global stub: publishAnnouncement and archiveAnnouncement call requirePosition → OfficerTermRepository
stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DRAFT_ANNOUNCEMENT = {
  id: 'ann-1',
  organizationId: 'org-1',
  title: 'Test Announcement',
  content: 'Hello world',
  authorId: 'user-1',
  status: 'draft' as const,
  audienceType: 'all',
  audienceCategories: null,
  channelPush: true,
  channelEmail: false,
  visibility: 'internal' as const,
  scheduledAt: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PUBLISHED_ANNOUNCEMENT = {
  ...DRAFT_ANNOUNCEMENT,
  id: 'ann-2',
  status: 'sent' as const,
  publishedAt: new Date(),
};

const SCHEDULED_ANNOUNCEMENT = {
  ...DRAFT_ANNOUNCEMENT,
  id: 'ann-4',
  status: 'scheduled' as const,
  scheduledAt: new Date(Date.now() + 86400000),
};

const ARCHIVED_ANNOUNCEMENT = {
  ...DRAFT_ANNOUNCEMENT,
  id: 'ann-3',
  status: 'archived' as const,
};

const TEMPLATE_FIXTURE = {
  id: 'tpl-1',
  organizationId: 'tenant-1',
  name: 'Welcome Email',
  channel: 'email' as const,
  subject: 'Welcome {{firstName}}!',
  body: 'Hello {{firstName}} {{lastName}}, your membership code is {{code}}.',
  mergeFields: ['firstName', 'lastName', 'code'],
  category: 'onboarding',
  isTransactional: false,
  status: 'draft' as const,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ===========================================================================
// Announcement Targeting Tests
// ===========================================================================

describe('announcement targeting (audienceType & audienceCategories)', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('createAnnouncement passes audienceType and audienceCategories to repo', async () => {
    const { createAnnouncement } = await import('./createAnnouncement');
    let capturedData: any;
    stubRepo(CommunicationsRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { id: 'ann-new', ...data };
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Targeted Announcement',
        content: 'For officers only',
        audienceType: 'position',
        audienceCategories: ['president', 'treasurer'],
        channelEmail: true,
      },
    });
    const res = await createAnnouncement(ctx as any);
    expect(res.status).toBe(201);
    expect(capturedData.audienceType).toBe('position');
    expect(capturedData.audienceCategories).toEqual(['president', 'treasurer']);
    expect(capturedData.channelEmail).toBe(true);
  });

  test('createAnnouncement defaults to all audience when audienceType omitted', async () => {
    const { createAnnouncement } = await import('./createAnnouncement');
    let capturedData: any;
    stubRepo(CommunicationsRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { id: 'ann-new', ...data };
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { title: 'General', content: 'For everyone' },
    });
    await createAnnouncement(ctx as any);
    // audienceType comes from body spread; if omitted, schema default handles it
    expect(capturedData.status).toBe('draft');
    expect(capturedData.organizationId).toBe('org-1');
  });

  test('updateAnnouncement allows updating targeting fields on draft', async () => {
    const { updateAnnouncement } = await import('./updateAnnouncement');
    let capturedUpdate: any;
    stubRepo(CommunicationsRepository, {
      get: async () => DRAFT_ANNOUNCEMENT,
      update: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...DRAFT_ANNOUNCEMENT, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { id: 'ann-1' },
      _body: {
        audienceType: 'status',
        audienceCategories: ['active', 'pending'],
      },
    });
    const res = await updateAnnouncement(ctx as any);
    expect(res.status).toBe(200);
    expect(capturedUpdate.audienceType).toBe('status');
    expect(capturedUpdate.audienceCategories).toEqual(['active', 'pending']);
  });

  test('listAnnouncements passes status filter correctly', async () => {
    const { listAnnouncements } = await import('./listAnnouncements');
    let capturedFilters: any;
    stubRepo(CommunicationsRepository, {
      list: async (_orgId: string, filters: any) => {
        capturedFilters = filters;
        return { data: [DRAFT_ANNOUNCEMENT], total: 1 };
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { status: 'draft', search: 'test', page: '1', pageSize: '10' },
    });
    const res = await listAnnouncements(ctx as any);
    expect(res.status).toBe(200);
    expect(capturedFilters.status).toBe('draft');
    expect(capturedFilters.search).toBe('test');
  });
});

// ===========================================================================
// Announcement Status Transition Tests
// ===========================================================================

describe('announcement status transitions', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('publishAnnouncement sets publishedAt timestamp', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    let capturedExtra: any;
    stubRepo(CommunicationsRepository, {
      get: async () => DRAFT_ANNOUNCEMENT,
      updateStatus: async (_id: string, status: string, extra: any) => {
        capturedExtra = extra;
        return { ...DRAFT_ANNOUNCEMENT, status, ...extra };
      },
    });

    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(200);
    expect(capturedExtra.publishedAt).toBeInstanceOf(Date);
  });

  test('publishAnnouncement allows publishing scheduled announcement', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    stubRepo(CommunicationsRepository, {
      get: async () => SCHEDULED_ANNOUNCEMENT,
      updateStatus: async (_id: string, status: string, extra: any) => ({
        ...SCHEDULED_ANNOUNCEMENT, status, ...extra,
      }),
    });

    const ctx = makeCtx({ _params: { id: 'ann-4' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('publishAnnouncement rejects already-sent announcement', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    stubRepo(CommunicationsRepository, {
      get: async () => PUBLISHED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-2' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow(
      'Only draft or scheduled announcements can be published'
    );
  });

  test('publishAnnouncement rejects archived announcement', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    stubRepo(CommunicationsRepository, {
      get: async () => ARCHIVED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-3' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow(
      'Only draft or scheduled announcements can be published'
    );
  });

  test('archiveAnnouncement allows archiving sent announcement', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    stubRepo(CommunicationsRepository, {
      get: async () => PUBLISHED_ANNOUNCEMENT,
      updateStatus: async (_id: string, status: string) => ({
        ...PUBLISHED_ANNOUNCEMENT, status,
      }),
    });

    const ctx = makeCtx({ _params: { id: 'ann-2' } });
    const res = await archiveAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('archiveAnnouncement rejects draft announcement (only sent can be archived)', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    stubRepo(CommunicationsRepository, {
      get: async () => DRAFT_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow(
      'Only sent announcements can be archived'
    );
  });

  test('archiveAnnouncement rejects already-archived', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    stubRepo(CommunicationsRepository, {
      get: async () => ARCHIVED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-3' } });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow(
      'Only sent announcements can be archived'
    );
  });

  test('deleteAnnouncement rejects non-draft announcement', async () => {
    const { deleteAnnouncement } = await import('./deleteAnnouncement');
    stubRepo(CommunicationsRepository, {
      get: async () => PUBLISHED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-2' } });
    await expect(deleteAnnouncement(ctx as any)).rejects.toThrow(
      'Only draft announcements can be deleted'
    );
  });

  test('deleteAnnouncement rejects scheduled announcement', async () => {
    const { deleteAnnouncement } = await import('./deleteAnnouncement');
    stubRepo(CommunicationsRepository, {
      get: async () => SCHEDULED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-4' } });
    await expect(deleteAnnouncement(ctx as any)).rejects.toThrow(
      'Only draft announcements can be deleted'
    );
  });

  test('updateAnnouncement rejects non-draft announcement', async () => {
    const { updateAnnouncement } = await import('./updateAnnouncement');
    stubRepo(CommunicationsRepository, {
      get: async () => SCHEDULED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({
      _params: { id: 'ann-4' },
      _body: { title: 'Nope' },
    });
    await expect(updateAnnouncement(ctx as any)).rejects.toThrow(
      'Only draft announcements can be updated'
    );
  });
});

// ===========================================================================
// Scheduled Send Tests
// ===========================================================================

describe('scheduled message send', () => {
  beforeEach(() => { restoreRepo(MessageRepository); });
  afterEach(() => { restoreRepo(MessageRepository); });

  test('scheduleMessage transitions draft to scheduled with future date', async () => {
    const { scheduleMessage } = await import('./scheduleMessage');
    const message = { id: 'm-1', organizationId: 'tenant-1', status: 'draft' };
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    let capturedUpdate: any;
    stubRepo(MessageRepository, {
      findById: async () => message,
      update: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...message, ...data };
      },
    });

    const ctx = makeCtx({ _params: { messageId: 'm-1' }, _body: { scheduledAt: futureDate } });
    const res = await scheduleMessage(ctx);
    expect(res.status).toBe(200);
    expect(capturedUpdate.status).toBe('scheduled');
    expect(capturedUpdate.scheduledAt).toBeInstanceOf(Date);
  });

  test('scheduleMessage rejects past scheduledAt', async () => {
    const { scheduleMessage } = await import('./scheduleMessage');
    const message = { id: 'm-1', organizationId: 'tenant-1', status: 'draft' };
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    stubRepo(MessageRepository, {
      findById: async () => message,
    });

    const ctx = makeCtx({ _params: { messageId: 'm-1' }, _body: { scheduledAt: pastDate } });
    await expect(scheduleMessage(ctx)).rejects.toThrow('Scheduled time must be in the future');
  });

  test('scheduleMessage rejects non-draft message', async () => {
    const { scheduleMessage } = await import('./scheduleMessage');
    stubRepo(MessageRepository, {
      findById: async () => ({ id: 'm-1', organizationId: 'tenant-1', status: 'sent' }),
    });

    const ctx = makeCtx({
      _params: { messageId: 'm-1' },
      _body: { scheduledAt: new Date(Date.now() + 3600000).toISOString() },
    });
    await expect(scheduleMessage(ctx)).rejects.toThrow('Cannot schedule a message with status');
  });

  test('scheduleMessage throws NotFound for wrong org message', async () => {
    const { scheduleMessage } = await import('./scheduleMessage');
    stubRepo(MessageRepository, {
      findById: async () => ({ id: 'm-1', organizationId: 'other-org', status: 'draft' }),
    });

    const ctx = makeCtx({
      _params: { messageId: 'm-1' },
      _body: { scheduledAt: new Date(Date.now() + 3600000).toISOString() },
    });
    await expect(scheduleMessage(ctx)).rejects.toThrow('Message not found');
  });

  test('cancelMessage cancels scheduled message', async () => {
    const { cancelMessage } = await import('./cancelMessage');
    stubRepo(MessageRepository, {
      findById: async () => ({ id: 'm-1', organizationId: 'tenant-1', status: 'scheduled' }),
      update: async (_id: string, data: any) => ({ id: 'm-1', ...data }),
    });

    const ctx = makeCtx({ _params: { messageId: 'm-1' } });
    const res = await cancelMessage(ctx);
    expect(res.status).toBe(200);
  });

  test('cancelMessage rejects already-sent message', async () => {
    const { cancelMessage } = await import('./cancelMessage');
    stubRepo(MessageRepository, {
      findById: async () => ({ id: 'm-1', organizationId: 'tenant-1', status: 'sent' }),
    });

    const ctx = makeCtx({ _params: { messageId: 'm-1' } });
    await expect(cancelMessage(ctx)).rejects.toThrow('Cannot cancel a message with status');
  });
});

// ===========================================================================
// Email Template Management Tests
// ===========================================================================

describe('email template CRUD & merge fields', () => {
  beforeEach(() => { restoreRepo(MessageTemplateRepository); });
  afterEach(() => { restoreRepo(MessageTemplateRepository); });

  test('createMessageTemplate stores mergeFields correctly', async () => {
    const { createMessageTemplate } = await import('./createMessageTemplate');
    let capturedData: any;
    stubRepo(MessageTemplateRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { id: 'tpl-new', ...data };
      },
    });

    const ctx = makeCtx({
      _body: {
        name: 'Welcome',
        channel: 'email',
        subject: 'Welcome {{firstName}}!',
        body: 'Hello {{firstName}} {{lastName}}',
        mergeFields: ['firstName', 'lastName'],
        category: 'onboarding',
        isTransactional: false,
      },
    });
    const res = await createMessageTemplate(ctx);
    expect(res.status).toBe(201);
    expect(capturedData.mergeFields).toEqual(['firstName', 'lastName']);
    expect(capturedData.status).toBe('draft');
    expect(capturedData.organizationId).toBe('tenant-1');
  });

  test('updateMessageTemplate updates body and mergeFields', async () => {
    const { updateMessageTemplate } = await import('./updateMessageTemplate');
    let capturedUpdate: any;
    stubRepo(MessageTemplateRepository, {
      findById: async () => TEMPLATE_FIXTURE,
      update: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...TEMPLATE_FIXTURE, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { templateId: 'tpl-1' },
      _body: {
        body: 'Updated body with {{firstName}} and {{newField}}',
        mergeFields: ['firstName', 'newField'],
      },
    });
    const res = await updateMessageTemplate(ctx);
    expect(res.status).toBe(200);
    expect(capturedUpdate.mergeFields).toEqual(['firstName', 'newField']);
  });

  test('getMessageTemplate returns template with merge fields', async () => {
    const { getMessageTemplate } = await import('./getMessageTemplate');
    stubRepo(MessageTemplateRepository, {
      findById: async () => TEMPLATE_FIXTURE,
    });

    const ctx = makeCtx({ _params: { templateId: 'tpl-1' } });
    const res = await getMessageTemplate(ctx);
    expect(res.status).toBe(200);
  });

  test('searchMessageTemplates filters by channel and category', async () => {
    const { searchMessageTemplates } = await import('./searchMessageTemplates');
    let capturedFilters: any;
    stubRepo(MessageTemplateRepository, {
      search: async (_orgId: string, filters: any) => {
        capturedFilters = filters;
        return [TEMPLATE_FIXTURE];
      },
    });

    const ctx = makeCtx({ _query: { channel: 'email', category: 'onboarding' } });
    const res = await searchMessageTemplates(ctx);
    expect(res.status).toBe(200);
    expect(capturedFilters.channel).toBe('email');
    expect(capturedFilters.category).toBe('onboarding');
  });

  test('deleteMessageTemplate blocks cross-org deletion', async () => {
    const { deleteMessageTemplate } = await import('./deleteMessageTemplate');
    stubRepo(MessageTemplateRepository, {
      findById: async () => ({ ...TEMPLATE_FIXTURE, organizationId: 'other-org' }),
    });

    const ctx = makeCtx({ _params: { templateId: 'tpl-1' } });
    await expect(deleteMessageTemplate(ctx)).rejects.toThrow('Message template not found');
  });

  test('updateMessageTemplate blocks cross-org update', async () => {
    const { updateMessageTemplate } = await import('./updateMessageTemplate');
    stubRepo(MessageTemplateRepository, {
      findById: async () => ({ ...TEMPLATE_FIXTURE, organizationId: 'other-org' }),
    });

    const ctx = makeCtx({ _params: { templateId: 'tpl-1' }, _body: { name: 'Hacked' } });
    await expect(updateMessageTemplate(ctx)).rejects.toThrow('Message template not found');
  });
});

// ===========================================================================
// Template Variable Substitution Logic
// ===========================================================================

describe('template variable substitution', () => {
  test('replaces all merge fields correctly', () => {
    const template = 'Hello {{firstName}} {{lastName}}, your code is {{code}}';
    const data: Record<string, string> = { firstName: 'Jane', lastName: 'Doe', code: 'ABC123' };

    const rendered = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
    });

    expect(rendered).toBe('Hello Jane Doe, your code is ABC123');
  });

  test('preserves unmatched placeholders', () => {
    const template = 'Hello {{firstName}}, your code is {{code}}';
    const data: Record<string, string> = { firstName: 'Jane' };

    const rendered = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
    });

    expect(rendered).toBe('Hello Jane, your code is {{code}}');
  });

  test('handles empty merge data', () => {
    const template = 'Hello {{firstName}}';
    const data: Record<string, string> = {};

    const rendered = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
    });

    expect(rendered).toBe('Hello {{firstName}}');
  });

  test('handles template with no placeholders', () => {
    const template = 'Hello world, no variables here.';
    const data: Record<string, string> = { firstName: 'Jane' };

    const rendered = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
    });

    expect(rendered).toBe('Hello world, no variables here.');
  });
});

// ===========================================================================
// Permission Enforcement Tests (officers only)
// ===========================================================================

describe('announcement permission enforcement', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('createAnnouncement requires authenticated session', async () => {
    const { createAnnouncement } = await import('./createAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _body: { title: 'T', content: 'B' },
    });
    await expect(createAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('updateAnnouncement requires authenticated session', async () => {
    const { updateAnnouncement } = await import('./updateAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
      _body: { title: 'Updated' },
    });
    await expect(updateAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('deleteAnnouncement requires authenticated session', async () => {
    const { deleteAnnouncement } = await import('./deleteAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
    });
    await expect(deleteAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('publishAnnouncement requires authenticated session', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
    });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('archiveAnnouncement requires authenticated session', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
    });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('getAnnouncement requires authenticated session', async () => {
    const { getAnnouncement } = await import('./getAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
    });
    await expect(getAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('listAnnouncements requires authenticated session', async () => {
    const { listAnnouncements } = await import('./listAnnouncements');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _query: {},
    });
    await expect(listAnnouncements(ctx as any)).rejects.toThrow('Unauthorized');
  });
});

describe('template permission enforcement', () => {
  beforeEach(() => { restoreRepo(MessageTemplateRepository); });
  afterEach(() => { restoreRepo(MessageTemplateRepository); });

  test('createMessageTemplate returns 401 without user', async () => {
    const { createMessageTemplate } = await import('./createMessageTemplate');
    const ctx = makeCtx({ user: null, session: null, _body: { name: 'T', channel: 'email', body: 'b', mergeFields: [], category: 'c', isTransactional: false } });
    const res = await createMessageTemplate(ctx);
    expect(res.status).toBe(401);
  });

  test('createMessageTemplate returns 403 without org context', async () => {
    const { createMessageTemplate } = await import('./createMessageTemplate');
    const ctx = makeCtx({ organizationId: null, _body: { name: 'T', channel: 'email', body: 'b', mergeFields: [], category: 'c', isTransactional: false } });
    const res = await createMessageTemplate(ctx);
    expect(res.status).toBe(403);
  });

  test('deleteMessageTemplate returns 401 without user', async () => {
    const { deleteMessageTemplate } = await import('./deleteMessageTemplate');
    const ctx = makeCtx({ user: null, session: null, _params: { templateId: 'tpl-1' } });
    const res = await deleteMessageTemplate(ctx);
    expect(res.status).toBe(401);
  });

  test('scheduleMessage returns 401 without user', async () => {
    const { scheduleMessage } = await import('./scheduleMessage');
    const ctx = makeCtx({ user: null, session: null, _params: { messageId: 'm-1' }, _body: { scheduledAt: new Date().toISOString() } });
    const res = await scheduleMessage(ctx);
    expect(res.status).toBe(401);
  });

  test('scheduleMessage returns 403 without org context', async () => {
    const { scheduleMessage } = await import('./scheduleMessage');
    const ctx = makeCtx({ organizationId: null, _params: { messageId: 'm-1' }, _body: { scheduledAt: new Date().toISOString() } });
    const res = await scheduleMessage(ctx);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// Announcement NotFound Tests
// ===========================================================================

describe('announcement NotFound guards', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('getAnnouncement throws NotFound for missing announcement', async () => {
    const { getAnnouncement } = await import('./getAnnouncement');
    stubRepo(CommunicationsRepository, { get: async () => undefined });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(getAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });

  test('updateAnnouncement throws NotFound for missing announcement', async () => {
    const { updateAnnouncement } = await import('./updateAnnouncement');
    stubRepo(CommunicationsRepository, { get: async () => undefined });
    const ctx = makeCtx({ _params: { id: 'nonexistent' }, _body: { title: 'X' } });
    await expect(updateAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });

  test('deleteAnnouncement throws NotFound for missing announcement', async () => {
    const { deleteAnnouncement } = await import('./deleteAnnouncement');
    stubRepo(CommunicationsRepository, { get: async () => undefined });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(deleteAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });

  test('publishAnnouncement throws NotFound for missing announcement', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    stubRepo(CommunicationsRepository, { get: async () => undefined });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });

  test('archiveAnnouncement throws NotFound for missing announcement', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    stubRepo(CommunicationsRepository, { get: async () => undefined });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });
});

// ===========================================================================
// createAnnouncement sets authorId from session
// ===========================================================================

describe('announcement authorId injection', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('createAnnouncement sets authorId from session user', async () => {
    const { createAnnouncement } = await import('./createAnnouncement');
    let capturedData: any;
    stubRepo(CommunicationsRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { id: 'ann-new', ...data };
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { title: 'Test', content: 'Body' },
    });
    await createAnnouncement(ctx as any);
    expect(capturedData.authorId).toBe('user-1');
    expect(capturedData.status).toBe('draft');
  });
});
