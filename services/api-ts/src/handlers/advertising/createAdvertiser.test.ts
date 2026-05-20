/**
 * Tests for createAdvertiser handler
 * Slice 046: Advertising Campaigns (M16)
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createAdvertiser } from './createAdvertiser';
import { AdvertiserRepository } from './repos/advertiser.repo';
import { ValidationError } from '@/core/errors';
import type { Advertiser } from './repos/advertising.schema';

function makeAdvertiser(overrides: Partial<Advertiser> = {}): Advertiser {
  return {
    id: 'adv-1',
    organizationId: 'org-1',
    companyName: 'AdCorp',
    contactEmail: 'ads@corp.com',
    contactPersonId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    version: 1,
    ...overrides,
  } as unknown as Advertiser;
}

function makeCtx(opts: { userId?: string; body?: Record<string, any>; organizationId?: string } = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const organizationId = opts.organizationId ?? 'org-1';
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        user: userId ? { id: userId, name: 'Test User' } : null,
        database: {},
        logger,
        organizationId,
      };
      return store[key];
    },
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

describe('createAdvertiser', () => {
  beforeEach(() => {
    AdvertiserRepository.prototype.createOne = mock(async (data: any) =>
      makeAdvertiser({ id: 'adv-new', ...data })
    ) as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ body: { companyName: 'X', contactEmail: 'x@x.com' } });
    await expect(createAdvertiser(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns 201 with advertiser data when valid', async () => {
    const ctx = makeCtx({ body: { companyName: 'AdCorp', contactEmail: 'ads@corp.com' } });
    await createAdvertiser(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(201);
    expect(data.companyName).toBe('AdCorp');
    expect(data.isActive).toBe(true);
  });

  test('throws ValidationError when companyName is missing', async () => {
    const ctx = makeCtx({ body: { contactEmail: 'x@x.com' } });
    await expect(createAdvertiser(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when contactEmail is missing', async () => {
    const ctx = makeCtx({ body: { companyName: 'X' } });
    await expect(createAdvertiser(ctx)).rejects.toBeInstanceOf(ValidationError);
  });
});
