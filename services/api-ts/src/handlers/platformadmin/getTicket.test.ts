/**
 * getTicket — characterization tests (AHA FIX-002 backfill)
 *
 * Path: GET /admin/tickets/:id
 * Access: platformAdmin OR the ticket's creator. Internal notes hidden from
 * non-admins. Returns an SLA countdown (seconds remaining, floored at 0).
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getTicket } from './getTicket';

const ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

function fakeTicket(overrides: Record<string, any> = {}) {
  return {
    id: 'ticket-1',
    reportedBy: 'creator-1',
    status: 'open',
    slaFirstResponseDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000),
    slaResolutionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

function makeDb(ticket: any, comments: any[]) {
  return {
    select: () => ({
      from: (table: any) => ({
        // First call: ticket lookup (.where -> array). Second call: comments (.where -> .orderBy)
        where: () => {
          const arr: any = ticket ? [ticket] : [];
          arr.orderBy = async () => comments;
          // make it awaitable AND chainable
          return Object.assign(Promise.resolve(ticket ? [ticket] : []), {
            orderBy: async () => comments,
          });
        },
      }),
    }),
  };
}

describe('getTicket (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { id: 'ticket-1' } });
    const res = await getTicket(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 404 when ticket not found', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'nope' },
      database: makeDb(null, []),
    });
    const res = await getTicket(ctx);
    expect(res.status).toBe(404);
  });

  test('returns 403 for a non-admin who is not the creator', async () => {
    const ctx = makeCtx({
      user: { id: 'other-1', role: 'member' },
      // no platformAdmin in context
      _params: { id: 'ticket-1' },
      database: makeDb(fakeTicket({ reportedBy: 'creator-1' }), []),
    });
    const res = await getTicket(ctx);
    expect(res.status).toBe(403);
  });

  test('admin sees the ticket with comments and SLA countdown', async () => {
    const comments = [{ id: 'c1', isInternal: true }, { id: 'c2', isInternal: false }];
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'ticket-1' },
      database: makeDb(fakeTicket(), comments),
    });
    const res = await getTicket(ctx);
    const body = (res as any).body;
    expect(body?.data?.id).toBe('ticket-1');
    expect(body?.data?.comments.length).toBe(2);
    expect(body?.data?.slaCountdown?.firstResponseSecondsRemaining).toBeGreaterThan(0);
  });

  test('SLA countdown floors at 0 for an overdue ticket', async () => {
    const overdue = fakeTicket({
      slaFirstResponseDeadline: new Date(Date.now() - 60 * 60 * 1000),
      slaResolutionDeadline: new Date(Date.now() - 30 * 60 * 1000),
    });
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'ticket-1' },
      database: makeDb(overdue, []),
    });
    const res = await getTicket(ctx);
    const sla = (res as any).body?.data?.slaCountdown;
    expect(sla.firstResponseSecondsRemaining).toBe(0);
    expect(sla.resolutionSecondsRemaining).toBe(0);
  });
});
