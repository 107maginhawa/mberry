/**
 * updateTicketStatus — characterization tests (AHA FIX-002 backfill)
 *
 * Path: PUT /admin/tickets/:id
 * Access: platformAdmin only. Enforces a status state machine and sets
 * firstRespondedAt / resolvedAt / closedAt timestamps.
 *
 * Honest-baseline note (FIX-012 / G12): the handler does NOT emit any reply /
 * status-change notification. These tests assert the real current behavior
 * (status mutation only, no notify). Notification wiring is gated (Batch B).
 */
import { describe, test, expect, spyOn } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { updateTicketStatus } from './updateTicketStatus';
import { ValidationError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
const ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

function fakeTicket(overrides: Record<string, any> = {}) {
  return { id: 'ticket-1', status: 'open', firstRespondedAt: null, reportedBy: 'officer-7', organizationId: 'org-1', subject: 'Help', ...overrides };
}

function makeDb(ticket: any, capture?: { set?: any }) {
  return {
    select: () => ({ from: () => ({ where: async () => (ticket ? [ticket] : []) }) }),
    update: () => ({
      set: (data: any) => {
        if (capture) capture.set = data;
        return { where: () => ({ returning: async () => [{ ...ticket, ...data }] }) };
      },
    }),
  };
}

describe('updateTicketStatus (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { id: 'ticket-1' }, _body: { status: 'in_progress' } });
    const res = await updateTicketStatus(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without platformAdmin', async () => {
    const ctx = makeCtx({ user: { id: 'user-1', role: 'member' }, _params: { id: 'ticket-1' }, _body: { status: 'in_progress' } });
    const res = await updateTicketStatus(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 404 when ticket not found', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'nope' },
      _body: { status: 'in_progress' },
      database: makeDb(null),
      logger: FAKE_LOGGER,
    });
    const res = await updateTicketStatus(ctx);
    expect(res.status).toBe(404);
  });

  test('throws ValidationError on an invalid transition (open → waiting_customer)', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'ticket-1' },
      _body: { status: 'waiting_customer' },
      database: makeDb(fakeTicket({ status: 'open' })),
      logger: FAKE_LOGGER,
    });
    await expect(updateTicketStatus(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('valid transition (open → in_progress) sets firstRespondedAt', async () => {
    const capture: { set?: any } = {};
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'ticket-1' },
      _body: { status: 'in_progress' },
      database: makeDb(fakeTicket({ status: 'open' }), capture),
      logger: FAKE_LOGGER,
    });
    const res = await updateTicketStatus(ctx);
    expect((res as any).body?.data?.status).toBe('in_progress');
    expect(capture.set?.firstRespondedAt).toBeInstanceOf(Date);
  });

  test('transition to resolved sets resolvedAt', async () => {
    const capture: { set?: any } = {};
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      _params: { id: 'ticket-1' },
      _body: { status: 'resolved' },
      database: makeDb(fakeTicket({ status: 'in_progress' }), capture),
      logger: FAKE_LOGGER,
    });
    await updateTicketStatus(ctx);
    expect(capture.set?.resolvedAt).toBeInstanceOf(Date);
  });

  // FIX-012 (G12 / PA-8): "Success outcome: Ticket resolved. Officer notified."
  // A status change emits ticket.status.changed so the reporter is notified.
  test('FIX-012: emits ticket.status.changed to notify the reporter on a status change', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    try {
      const ctx = makeCtx({
        user: { id: 'admin-1', role: 'platform_admin' },
        platformAdmin: ADMIN,
        _params: { id: 'ticket-1' },
        _body: { status: 'resolved' },
        database: makeDb(fakeTicket({ status: 'in_progress', reportedBy: 'officer-7', organizationId: 'org-1', subject: 'Login broken' })),
        logger: FAKE_LOGGER,
      });
      await updateTicketStatus(ctx);
      const call = emitSpy.mock.calls.find((c) => c[0] === 'ticket.status.changed');
      expect(call).toBeDefined();
      expect(call?.[1]).toMatchObject({
        ticketId: 'ticket-1',
        reportedBy: 'officer-7',
        status: 'resolved',
      });
    } finally {
      emitSpy.mockRestore();
    }
  });

  // No status field in the body → no status-change notification.
  test('FIX-012: does NOT emit ticket.status.changed when status is unchanged (assignee-only update)', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    try {
      const ctx = makeCtx({
        user: { id: 'admin-1', role: 'platform_admin' },
        platformAdmin: ADMIN,
        _params: { id: 'ticket-1' },
        _body: { assignedTo: 'admin-2' },
        database: makeDb(fakeTicket({ status: 'in_progress' })),
        logger: FAKE_LOGGER,
      });
      await updateTicketStatus(ctx);
      expect(emitSpy.mock.calls.find((c) => c[0] === 'ticket.status.changed')).toBeUndefined();
    } finally {
      emitSpy.mockRestore();
    }
  });
});
