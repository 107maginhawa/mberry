/**
 * listPublicEvents.test.ts
 *
 * Public endpoint — no auth required.
 * Covers:
 *   - Happy path without filters
 *   - Pagination defaults (limit=20, offset=0)
 *   - Limit clamp to 50
 *   - Offset parsing
 *   - Repo receives correct filter args (eventType, dateFrom, dateTo, pricing, search)
 *   - Empty result returns empty data + total=0
 *   - Pagination envelope shape
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeEvent } from '@/test-utils/factories';
import { listPublicEvents } from './listPublicEvents';
import { EventsRepository } from './repos/events.repo';

const FAKE_EVENT = fakeEvent({
  id: 'evt-1',
  title: 'Annual Summit',
  status: 'published',
  visibility: 'network',
});

describe('listPublicEvents', () => {
  beforeEach(() => {
    restoreRepo(EventsRepository);
  });

  afterEach(() => {
    restoreRepo(EventsRepository);
  });

  test('no auth required — works with null session', async () => {
    stubRepo(EventsRepository, {
      listPublic: async () => ({ data: [{ ...FAKE_EVENT }], total: 1 }),
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      session: null,
      user: null,
      _query: {},
    });
    // listPublicEvents accesses ctx.req.query() not ctx.req.valid('query')
    // Patch query() to return empty obj
    ctx.req.query = () => ({} as any);

    const res = await listPublicEvents(ctx as any);
    expect(res.status).toBe(200);
  });

  test('happy path — returns data and pagination envelope', async () => {
    stubRepo(EventsRepository, {
      listPublic: async () => ({ data: [{ ...FAKE_EVENT }], total: 1 }),
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({} as any);

    const res = await listPublicEvents(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('evt-1');
    expect(body.pagination.total).toBe(1);
    expect(body.pagination.limit).toBe(20);
    expect(body.pagination.offset).toBe(0);
  });

  test('pagination defaults: limit=20, offset=0', async () => {
    let captured: any;
    stubRepo(EventsRepository, {
      listPublic: async (filters: any) => { captured = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({} as any);

    await listPublicEvents(ctx as any);
    expect(captured.limit).toBe(20);
    expect(captured.offset).toBe(0);
  });

  test('limit is clamped to 50 when query passes 100', async () => {
    let captured: any;
    stubRepo(EventsRepository, {
      listPublic: async (filters: any) => { captured = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({ limit: '100', offset: '0' } as any);

    await listPublicEvents(ctx as any);
    expect(captured.limit).toBe(50);
  });

  test('offset is parsed from query string', async () => {
    let captured: any;
    stubRepo(EventsRepository, {
      listPublic: async (filters: any) => { captured = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({ limit: '10', offset: '30' } as any);

    await listPublicEvents(ctx as any);
    expect(captured.offset).toBe(30);
  });

  test('eventType filter is forwarded to repo', async () => {
    let captured: any;
    stubRepo(EventsRepository, {
      listPublic: async (filters: any) => { captured = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({ eventType: 'conference' } as any);

    await listPublicEvents(ctx as any);
    expect(captured.eventType).toBe('conference');
  });

  test('search query (q) forwarded to repo as search', async () => {
    let captured: any;
    stubRepo(EventsRepository, {
      listPublic: async (filters: any) => { captured = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({ q: 'dental summit' } as any);

    await listPublicEvents(ctx as any);
    expect(captured.search).toBe('dental summit');
  });

  test('pricing filter forwarded to repo', async () => {
    let captured: any;
    stubRepo(EventsRepository, {
      listPublic: async (filters: any) => { captured = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({ pricing: 'free' } as any);

    await listPublicEvents(ctx as any);
    expect(captured.pricing).toBe('free');
  });

  test('dateFrom is parsed to Date object', async () => {
    let captured: any;
    stubRepo(EventsRepository, {
      listPublic: async (filters: any) => { captured = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({ dateFrom: '2026-01-01' } as any);

    await listPublicEvents(ctx as any);
    expect(captured.dateFrom).toBeInstanceOf(Date);
    expect(captured.dateFrom.toISOString().startsWith('2026-01-01')).toBe(true);
  });

  test('dateTo is parsed to Date object', async () => {
    let captured: any;
    stubRepo(EventsRepository, {
      listPublic: async (filters: any) => { captured = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({ dateTo: '2026-12-31' } as any);

    await listPublicEvents(ctx as any);
    expect(captured.dateTo).toBeInstanceOf(Date);
  });

  test('empty result returns 200 with empty data and total=0', async () => {
    stubRepo(EventsRepository, {
      listPublic: async () => ({ data: [], total: 0 }),
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({} as any);

    const res = await listPublicEvents(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });

  test('invalid limit string falls back to 20', async () => {
    let captured: any;
    stubRepo(EventsRepository, {
      listPublic: async (filters: any) => { captured = filters; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({ database: makeMockDb() });
    ctx.req.query = () => ({ limit: 'not-a-number' } as any);

    await listPublicEvents(ctx as any);
    expect(captured.limit).toBe(20);
  });
});
