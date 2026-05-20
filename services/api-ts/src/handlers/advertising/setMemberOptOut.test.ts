/**
 * Tests for setMemberOptOut handler
 * Slice 046: Advertising Campaigns (M16)
 * AC-M16-004: Member opt-out respected immediately
 */

import { describe, test, expect } from 'bun:test';
import { setMemberOptOut } from './setMemberOptOut';
import { ValidationError } from '@/core/errors';

function makeCtx(opts: { userId?: string; body?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1' })[key],
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
  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { optOut: true } });
    await expect(setMemberOptOut(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('AC-M16-004: returns opt-out confirmation with immediate effect', async () => {
    const ctx = makeCtx({ body: { optOut: true } });
    await setMemberOptOut(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.optedOut).toBe(true);
    expect(data.effectiveImmediately).toBe(true);
  });

  test('AC-M16-004: allows opting back in', async () => {
    const ctx = makeCtx({ body: { optOut: false } });
    await setMemberOptOut(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.optedOut).toBe(false);
  });

  test('defaults to opt-out when body is empty', async () => {
    const ctx = makeCtx({ body: {} });
    await setMemberOptOut(ctx);
    const { data } = ctx._captured();
    expect(data.optedOut).toBe(true);
  });
});
