/**
 * Tests for setMemberOptOut handler
 * Slice 046: Advertising Campaigns (M16)
 * AC-M16-004: Member opt-out respected immediately + PERSISTED (AHA FIX-008 / G-02)
 *
 * RED-first: the previous version of this test blessed a no-op handler that
 * returned a misleading success without writing anything. These tests require
 * the opt-out preference to actually be persisted via MemberAdOptOutRepository,
 * and to read the contract field `optedOut` (not the handler-internal `optOut`).
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { setMemberOptOut } from './setMemberOptOut';
import { MemberAdOptOutRepository } from './repos/optOut.repo';
import { ValidationError } from '@/core/errors';

function makeCtx(opts: { userId?: string; orgId?: string | undefined; body?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const orgId = 'orgId' in opts ? opts.orgId : 'org-1';
  const body = opts.body ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => logger };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: orgId, requestId: 'trace-1' })[key],
    req: { valid: (type: string) => type === 'json' ? body : {} },
    json: (data: any, status: number) => { captured = { data, status }; return new Response(JSON.stringify(data), { status }); },
    _captured: () => captured,
  };
  return ctx as any;
}

function makeNoUserCtx(opts: Record<string, any> = {}) {
  const ctx = makeCtx({ ...opts, userId: 'placeholder' });
  const origGet = ctx.get;
  ctx.get = (key: string) => key === 'user' ? { id: '', name: '' } : origGet(key);
  return ctx;
}

describe('setMemberOptOut', () => {
  let optOut: ReturnType<typeof mock>;
  let optIn: ReturnType<typeof mock>;

  beforeEach(() => {
    optOut = mock(async () => {});
    optIn = mock(async () => {});
    MemberAdOptOutRepository.prototype.optOut = optOut as any;
    MemberAdOptOutRepository.prototype.optIn = optIn as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { optedOut: true } });
    await expect(setMemberOptOut(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-004: PERSISTS the opt-out for the caller org + person', async () => {
    const ctx = makeCtx({ body: { optedOut: true } });
    await setMemberOptOut(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.optedOut).toBe(true);
    expect(data.effectiveImmediately).toBe(true);
    // Real persistence — not a no-op
    expect(optOut).toHaveBeenCalledTimes(1);
    expect(optOut.mock.calls[0][0]).toBe('org-1'); // organizationId
    expect(optOut.mock.calls[0][1]).toBe('user-1'); // personId
    expect(optIn).not.toHaveBeenCalled();
  });

  test('AC-M16-004: opting back in DELETES the opt-out row', async () => {
    const ctx = makeCtx({ body: { optedOut: false } });
    await setMemberOptOut(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.optedOut).toBe(false);
    expect(optIn).toHaveBeenCalledTimes(1);
    expect(optIn.mock.calls[0][0]).toBe('org-1');
    expect(optIn.mock.calls[0][1]).toBe('user-1');
    expect(optOut).not.toHaveBeenCalled();
  });

  test('defaults to opt-out (persisted) when body is empty', async () => {
    const ctx = makeCtx({ body: {} });
    await setMemberOptOut(ctx);
    const { data } = ctx._captured();
    expect(data.optedOut).toBe(true);
    expect(optOut).toHaveBeenCalledTimes(1);
  });

  test('fails closed when org context is missing (cannot persist preference)', async () => {
    const ctx = makeCtx({ orgId: undefined, body: { optedOut: true } });
    await expect(setMemberOptOut(ctx)).rejects.toBeInstanceOf(ValidationError);
    expect(optOut).not.toHaveBeenCalled();
  });
});
