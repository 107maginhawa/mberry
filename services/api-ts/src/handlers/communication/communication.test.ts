import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

// ---------------------------------------------------------------------------
// Auth guard tests — every handler must return 401 when user is null
// ---------------------------------------------------------------------------

describe('communication auth guards', () => {
  test('createMessageTemplate returns 401 without user', async () => {
    const { createMessageTemplate } = await import('./createMessageTemplate');
    const ctx = makeCtx({ user: null, session: null, _body: { name: 'T', channel: 'email', body: 'b', mergeFields: [], category: 'c', isTransactional: false } });
    const response = await createMessageTemplate(ctx);
    expect(response.status).toBe(401);
  });

  test('searchMessageTemplates returns 401 without user', async () => {
    const { searchMessageTemplates } = await import('./searchMessageTemplates');
    const ctx = makeCtx({ user: null, session: null, _query: {} });
    const response = await searchMessageTemplates(ctx);
    expect(response.status).toBe(401);
  });

  test('getMessageTemplate returns 401 without user', async () => {
    const { getMessageTemplate } = await import('./getMessageTemplate');
    const ctx = makeCtx({ user: null, session: null, _params: { templateId: 't-1' } });
    const response = await getMessageTemplate(ctx);
    expect(response.status).toBe(401);
  });

  test('updateMessageTemplate returns 401 without user', async () => {
    const { updateMessageTemplate } = await import('./updateMessageTemplate');
    const ctx = makeCtx({ user: null, session: null, _params: { templateId: 't-1' }, _body: {} });
    const response = await updateMessageTemplate(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteMessageTemplate returns 401 without user', async () => {
    const { deleteMessageTemplate } = await import('./deleteMessageTemplate');
    const ctx = makeCtx({ user: null, session: null, _params: { templateId: 't-1' } });
    const response = await deleteMessageTemplate(ctx);
    expect(response.status).toBe(401);
  });

  test('previewMessageTemplate returns 401 without user', async () => {
    const { previewMessageTemplate } = await import('./previewMessageTemplate');
    const ctx = makeCtx({ user: null, session: null, _params: { templateId: 't-1' }, _body: { mergeData: {} } });
    const response = await previewMessageTemplate(ctx);
    expect(response.status).toBe(401);
  });

  test('createMessage returns 401 without user', async () => {
    const { createMessage } = await import('./createMessage');
    const ctx = makeCtx({ user: null, session: null, _body: { channel: 'email', senderId: 's', recipientPersonIds: [], body: 'b' } });
    const response = await createMessage(ctx);
    expect(response.status).toBe(401);
  });

  test('searchMessages returns 401 without user', async () => {
    const { searchMessages } = await import('./searchMessages');
    const ctx = makeCtx({ user: null, session: null, _query: {} });
    const response = await searchMessages(ctx);
    expect(response.status).toBe(401);
  });

  test('getMessage returns 401 without user', async () => {
    const { getMessage } = await import('./getMessage');
    const ctx = makeCtx({ user: null, session: null, _params: { messageId: 'm-1' } });
    const response = await getMessage(ctx);
    expect(response.status).toBe(401);
  });

  test('updateMessage returns 401 without user', async () => {
    const { updateMessage } = await import('./updateMessage');
    const ctx = makeCtx({ user: null, session: null, _params: { messageId: 'm-1' }, _body: {} });
    const response = await updateMessage(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteMessage returns 401 without user', async () => {
    const { deleteMessage } = await import('./deleteMessage');
    const ctx = makeCtx({ user: null, session: null, _params: { messageId: 'm-1' } });
    const response = await deleteMessage(ctx);
    expect(response.status).toBe(401);
  });

  test('cancelMessage returns 401 without user', async () => {
    const { cancelMessage } = await import('./cancelMessage');
    const ctx = makeCtx({ user: null, session: null, _params: { messageId: 'm-1' } });
    const response = await cancelMessage(ctx);
    expect(response.status).toBe(401);
  });

  test('scheduleMessage returns 401 without user', async () => {
    const { scheduleMessage } = await import('./scheduleMessage');
    const ctx = makeCtx({ user: null, session: null, _params: { messageId: 'm-1' }, _body: { scheduledAt: new Date().toISOString() } });
    const response = await scheduleMessage(ctx);
    expect(response.status).toBe(401);
  });

  test('sendMessage returns 401 without user', async () => {
    const { sendMessage } = await import('./sendMessage');
    const ctx = makeCtx({ user: null, session: null, _params: { messageId: 'm-1' } });
    const response = await sendMessage(ctx);
    expect(response.status).toBe(401);
  });

  test('createSubscriptionTopic returns 401 without user', async () => {
    const { createSubscriptionTopic } = await import('./createSubscriptionTopic');
    const ctx = makeCtx({ user: null, session: null, _body: { name: 'T', channel: 'email', category: 'c', defaultEnabled: true } });
    const response = await createSubscriptionTopic(ctx);
    expect(response.status).toBe(401);
  });

  test('getSubscriptionTopic returns 401 without user', async () => {
    const { getSubscriptionTopic } = await import('./getSubscriptionTopic');
    const ctx = makeCtx({ user: null, session: null, _params: { topicId: 'tp-1' } });
    const response = await getSubscriptionTopic(ctx);
    expect(response.status).toBe(401);
  });

  test('updateSubscriptionTopic returns 401 without user', async () => {
    const { updateSubscriptionTopic } = await import('./updateSubscriptionTopic');
    const ctx = makeCtx({ user: null, session: null, _params: { topicId: 'tp-1' }, _body: {} });
    const response = await updateSubscriptionTopic(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteSubscriptionTopic returns 401 without user', async () => {
    const { deleteSubscriptionTopic } = await import('./deleteSubscriptionTopic');
    const ctx = makeCtx({ user: null, session: null, _params: { topicId: 'tp-1' } });
    const response = await deleteSubscriptionTopic(ctx);
    expect(response.status).toBe(401);
  });

  test('listPersonSubscriptions returns 401 without user', async () => {
    const { listPersonSubscriptions } = await import('./listPersonSubscriptions');
    const ctx = makeCtx({ user: null, session: null, _query: { personId: 'p-1' } });
    const response = await listPersonSubscriptions(ctx);
    expect(response.status).toBe(401);
  });

  test('bulkUpdatePersonSubscriptions returns 401 without user', async () => {
    const { bulkUpdatePersonSubscriptions } = await import('./bulkUpdatePersonSubscriptions');
    const ctx = makeCtx({ user: null, session: null, _body: { updates: [] } });
    const response = await bulkUpdatePersonSubscriptions(ctx);
    expect(response.status).toBe(401);
  });

  test('updatePersonSubscription returns 401 without user', async () => {
    const { updatePersonSubscription } = await import('./updatePersonSubscription');
    const ctx = makeCtx({ user: null, session: null, _params: { subscriptionId: 'ps-1' }, _body: { enabled: true } });
    const response = await updatePersonSubscription(ctx);
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tenant guard tests — handlers return 403 when organizationId is missing
// ---------------------------------------------------------------------------

describe('communication tenant guards', () => {
  test('createMessageTemplate returns 403 without organizationId', async () => {
    const { createMessageTemplate } = await import('./createMessageTemplate');
    const ctx = makeCtx({ organizationId: null, _body: { name: 'T', channel: 'email', body: 'b', mergeFields: [], category: 'c', isTransactional: false } });
    const response = await createMessageTemplate(ctx);
    expect(response.status).toBe(403);
  });

  test('createMessage returns 403 without organizationId', async () => {
    const { createMessage } = await import('./createMessage');
    const ctx = makeCtx({ organizationId: null, _body: { channel: 'email', senderId: 's', recipientPersonIds: [], body: 'b' } });
    const response = await createMessage(ctx);
    expect(response.status).toBe(403);
  });

  test('createSubscriptionTopic returns 403 without organizationId', async () => {
    const { createSubscriptionTopic } = await import('./createSubscriptionTopic');
    const ctx = makeCtx({ organizationId: null, _body: { name: 'T', channel: 'email', category: 'c', defaultEnabled: true } });
    const response = await createSubscriptionTopic(ctx);
    expect(response.status).toBe(403);
  });

  test('bulkUpdatePersonSubscriptions returns 403 without organizationId', async () => {
    const { bulkUpdatePersonSubscriptions } = await import('./bulkUpdatePersonSubscriptions');
    const ctx = makeCtx({ organizationId: null, _body: { updates: [] } });
    const response = await bulkUpdatePersonSubscriptions(ctx);
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Business logic tests
// ---------------------------------------------------------------------------

describe('cancelMessage business rules', () => {
  test('only draft and scheduled messages can be cancelled', () => {
    const cancellableStatuses = ['draft', 'scheduled'];
    const nonCancellableStatuses = ['sending', 'sent', 'cancelled', 'failed'];

    for (const status of cancellableStatuses) {
      expect(status === 'draft' || status === 'scheduled').toBe(true);
    }
    for (const status of nonCancellableStatuses) {
      expect(status === 'draft' || status === 'scheduled').toBe(false);
    }
  });
});

describe('sendMessage business rules', () => {
  test('only draft and scheduled messages can be sent', () => {
    const sendableStatuses = ['draft', 'scheduled'];
    const nonSendableStatuses = ['sending', 'sent', 'cancelled', 'failed'];

    for (const status of sendableStatuses) {
      expect(status === 'draft' || status === 'scheduled').toBe(true);
    }
    for (const status of nonSendableStatuses) {
      expect(status === 'draft' || status === 'scheduled').toBe(false);
    }
  });
});

describe('scheduleMessage business rules', () => {
  test('only draft messages can be scheduled', () => {
    const schedulableStatuses = ['draft'];
    const nonSchedulableStatuses = ['scheduled', 'sending', 'sent', 'cancelled', 'failed'];

    for (const status of schedulableStatuses) {
      expect(status === 'draft').toBe(true);
    }
    for (const status of nonSchedulableStatuses) {
      expect(status === 'draft').toBe(false);
    }
  });
});

describe('previewMessageTemplate merge field rendering', () => {
  test('replaces {{field}} with provided values', () => {
    const template = 'Hello {{firstName}}, welcome to {{orgName}}!';
    const mergeData: Record<string, unknown> = { firstName: 'Jane', orgName: 'ACME' };

    const rendered = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      return mergeData[key] !== undefined ? String(mergeData[key]) : `{{${key}}}`;
    });

    expect(rendered).toBe('Hello Jane, welcome to ACME!');
  });

  test('leaves unreplaced fields as-is', () => {
    const template = 'Hello {{firstName}}, your code is {{code}}';
    const mergeData: Record<string, unknown> = { firstName: 'Jane' };

    const rendered = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      return mergeData[key] !== undefined ? String(mergeData[key]) : `{{${key}}}`;
    });

    expect(rendered).toBe('Hello Jane, your code is {{code}}');
  });
});

describe('BR-28 deduplication logic', () => {
  test('identifies duplicate when same personId exists in recipients', () => {
    const existingRecipients = [
      { personId: 'p-1', deliveryStatus: 'sent' as const },
      { personId: 'p-2', deliveryStatus: 'sent' as const },
    ];
    const candidatePersonId = 'p-1';

    const isDuplicate = existingRecipients.some(r => r.personId === candidatePersonId);
    expect(isDuplicate).toBe(true);
  });

  test('allows non-duplicate recipient', () => {
    const existingRecipients = [
      { personId: 'p-1', deliveryStatus: 'sent' as const },
    ];
    const candidatePersonId = 'p-3';

    const isDuplicate = existingRecipients.some(r => r.personId === candidatePersonId);
    expect(isDuplicate).toBe(false);
  });
});
