/**
 * addTicketComment — characterization tests (AHA FIX-002 backfill)
 *
 * Path: POST /admin/tickets/:id/comments
 * Access: platformAdmin OR the ticket creator. isInternal notes admin-only.
 *
 * Honest-baseline note (FIX-012 / G12): the handler currently only INSERTS a
 * comment. It does NOT reopen a resolved ticket on an officer reply, and emits
 * no notification. These tests assert the REAL current behavior (insert only).
 * The reopen/notify behavior is a separate gated batch (Batch B, FIX-012);
 * see fix report §9.
 */
import { describe, test, expect, spyOn } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { addTicketComment } from './addTicketComment';
import { ValidationError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

const ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

function fakeTicket(overrides: Record<string, any> = {}) {
  return { id: 'ticket-1', reportedBy: 'creator-1', status: 'open', assignedTo: null, organizationId: 'org-1', subject: 'Help', ...overrides };
}

function makeDb(ticket: any, insertedComment: any, capture?: { values?: any; update?: any }) {
  return {
    select: () => ({ from: () => ({ where: async () => (ticket ? [ticket] : []) }) }),
    insert: () => ({
      values: (v: any) => {
        if (capture) capture.values = v;
        return { returning: async () => [{ ...insertedComment, ...v }] };
      },
    }),
    // FIX-012: handler reopens a resolved ticket via db.update(supportTickets)
    update: () => ({
      set: (s: any) => {
        if (capture) capture.update = s;
        return { where: async () => {} };
      },
    }),
  };
}

describe('addTicketComment (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { id: 'ticket-1' } });
    const res = await addTicketComment(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 404 when ticket not found', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'nope' },
      _body: { content: 'hi' },
      database: makeDb(null, null),
    });
    const res = await addTicketComment(ctx);
    expect(res.status).toBe(404);
  });

  test('returns 403 for a non-admin non-creator', async () => {
    const ctx = makeCtx({
      user: { id: 'stranger-1', role: 'member' },
      _params: { id: 'ticket-1' },
      _body: { content: 'hi' },
      database: makeDb(fakeTicket({ reportedBy: 'creator-1' }), null),
    });
    const res = await addTicketComment(ctx);
    expect(res.status).toBe(403);
  });

  test('throws ValidationError when content missing', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'ticket-1' },
      _body: {},
      database: makeDb(fakeTicket(), null),
    });
    await expect(addTicketComment(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('admin posts a public comment → 201', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'ticket-1' },
      _body: { content: 'Looking into it' },
      database: makeDb(fakeTicket(), { id: 'comment-1' }),
    });
    const res = await addTicketComment(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body?.data?.content).toBe('Looking into it');
  });

  test('non-admin creator cannot post an internal note (403)', async () => {
    const ctx = makeCtx({
      user: { id: 'creator-1', role: 'member' },
      _params: { id: 'ticket-1' },
      _body: { content: 'secret', isInternal: true },
      database: makeDb(fakeTicket({ reportedBy: 'creator-1' }), { id: 'comment-1' }),
    });
    const res = await addTicketComment(ctx);
    expect(res.status).toBe(403);
  });

  test('isInternal is coerced to false for non-admins even when omitted', async () => {
    const capture: { values?: any } = {};
    const ctx = makeCtx({
      user: { id: 'creator-1', role: 'member' },
      _params: { id: 'ticket-1' },
      _body: { content: 'a normal reply' },
      database: makeDb(fakeTicket({ reportedBy: 'creator-1' }), { id: 'comment-1' }, capture),
    });
    const res = await addTicketComment(ctx);
    expect(res.status).toBe(201);
    expect(capture.values?.isInternal).toBe(false);
  });

  // FIX-012 (G12 / PA-8): an officer (the reporter, a non-admin) replying to a
  // RESOLVED ticket reopens it automatically and alerts the assignee.
  test('FIX-012: an officer reply to a RESOLVED ticket reopens it (→ open) and emits ticket.reopened', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    try {
      const capture: { values?: any; update?: any } = {};
      const ctx = makeCtx({
        user: { id: 'creator-1', role: 'member' },
        _params: { id: 'ticket-1' },
        _body: { content: 'I am replying again' },
        database: makeDb(
          fakeTicket({ reportedBy: 'creator-1', status: 'resolved', assignedTo: 'admin-9', organizationId: 'org-1', subject: 'Login broken' }),
          { id: 'c2' },
          capture,
        ),
      });
      const res = await addTicketComment(ctx);
      expect(res.status).toBe(201);
      // Ticket reopened back to 'open'.
      expect(capture.update?.status).toBe('open');
      // Assignee alerted via the domain event bus.
      const call = emitSpy.mock.calls.find((c) => c[0] === 'ticket.reopened');
      expect(call).toBeDefined();
      expect(call?.[1]).toMatchObject({
        ticketId: 'ticket-1',
        assignedTo: 'admin-9',
        reopenedBy: 'creator-1',
      });
    } finally {
      emitSpy.mockRestore();
    }
  });

  // An admin's own comment must NOT reopen a resolved ticket — admins drive
  // status through updateTicketStatus, not by commenting.
  test('FIX-012: an admin comment on a RESOLVED ticket does NOT reopen it', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    try {
      const capture: { values?: any; update?: any } = {};
      const ctx = makeCtx({
        user: { id: 'admin-1', role: 'platform_admin' },
        platformAdmin: ADMIN,
        _params: { id: 'ticket-1' },
        _body: { content: 'closing note' },
        database: makeDb(fakeTicket({ status: 'resolved' }), { id: 'c3' }, capture),
      });
      await addTicketComment(ctx);
      expect(capture.update).toBeUndefined();
      expect(emitSpy.mock.calls.find((c) => c[0] === 'ticket.reopened')).toBeUndefined();
    } finally {
      emitSpy.mockRestore();
    }
  });
});
