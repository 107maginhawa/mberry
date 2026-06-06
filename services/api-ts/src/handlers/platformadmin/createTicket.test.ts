/**
 * createTicket — characterization tests
 *
 * Path: POST /admin/tickets
 * Auth: session required (any authenticated user can create a ticket)
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { createTicket } from './createTicket';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

const fakeTicket = {
  id: 'ticket-1',
  organizationId: 'org-1',
  reportedBy: 'user-1',
  subject: 'Cannot access membership portal',
  description: 'I get a 500 error when logging in.',
  category: 'technical',
  priority: 'medium',
  status: 'open',
  slaFirstResponseDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000),
  slaResolutionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeTicketDb(ticket: any) {
  return {
    insert: () => ({
      values: () => ({
        returning: async () => [ticket],
      }),
    }),
  };
}

describe('createTicket (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: { subject: 'Test', description: 'Desc' } });
    const res = await createTicket(ctx);
    expect(res.status).toBe(401);
  });

  // NOTE: subject/description validation is performed by zValidator middleware in app.ts
  // The handler itself does NOT validate their presence — it relies on the middleware gate.
  // Characterization: handler passes through without subject/description (missing fields
  // result in undefined values passed to db.insert).
  test('proceeds to db insert even without subject (validation is middleware concern)', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      _body: { description: 'No subject here' },
      database: makeTicketDb(fakeTicket),
      logger: FAKE_LOGGER,
    });
    const res = await createTicket(ctx);
    // Handler reaches db.insert — returns 201 (subject validation is upstream middleware)
    expect(res.status).toBe(201);
  });

  test('returns 201 with ticket data on successful creation', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      _body: { subject: 'Cannot access membership portal', description: 'I get a 500 error when logging in.' },
      database: makeTicketDb(fakeTicket),
      logger: FAKE_LOGGER,
    });
    const res = await createTicket(ctx);
    expect(res.status).toBe(201);
    const body = (res as any).body;
    expect(body?.data?.id).toBe('ticket-1');
    expect(body?.data?.status).toBe('open');
  });

  test('silently defaults invalid priority to standard (no 400)', async () => {
    // Characterization: handler uses isPriority guard and defaults to 'standard'
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      _body: { subject: 'Test', description: 'Desc', priority: 'urgent_now' },
      database: makeTicketDb({ ...fakeTicket, priority: 'standard' }),
      logger: FAKE_LOGGER,
    });
    const res = await createTicket(ctx);
    // Does NOT return 400 — defaults to 'standard'
    expect(res.status).toBe(201);
  });

  test('silently defaults invalid category to general (no 400)', async () => {
    // Characterization: handler uses isCategory guard and defaults to 'general'
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      _body: { subject: 'Test', description: 'Desc', category: 'random_category' },
      database: makeTicketDb({ ...fakeTicket, category: 'general' }),
      logger: FAKE_LOGGER,
    });
    const res = await createTicket(ctx);
    // Does NOT return 400 — defaults to 'general'
    expect(res.status).toBe(201);
  });
});
