/**
 * getPublicEvent — characterization tests
 *
 * Path: GET /public/events/{slug}
 * Public endpoint — no auth required.
 * Only published/registration_open/in_progress/completed events are visible;
 * draft and cancelled events return 404.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EventsRepository } from './repos/events.repo';
import { getPublicEvent } from './getPublicEvent';
import { NotFoundError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

function makeEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'event-1',
    slug: 'annual-conference',
    title: 'Annual Conference 2026',
    organizationId: 'org-1',
    status: 'published',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-03'),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('getPublicEvent', () => {
  afterEach(() => {
    restoreRepo(EventsRepository);
  });

  // ── 404 paths ───────────────────────────────────────

  test('throws NotFoundError when event slug not found', async () => {
    stubRepo(EventsRepository, {
      findBySlug: async () => undefined,
    });
    const ctx = makeCtx({ _params: { slug: 'nonexistent' } });
    await expect(getPublicEvent(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError for draft events', async () => {
    stubRepo(EventsRepository, {
      findBySlug: async () => makeEvent({ status: 'draft' }),
    });
    const ctx = makeCtx({ _params: { slug: 'annual-conference' } });
    await expect(getPublicEvent(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError for cancelled events', async () => {
    stubRepo(EventsRepository, {
      findBySlug: async () => makeEvent({ status: 'cancelled' }),
    });
    const ctx = makeCtx({ _params: { slug: 'annual-conference' } });
    await expect(getPublicEvent(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  // ── Happy paths — all public statuses ───────────────

  test('returns 200 for published event', async () => {
    const event = makeEvent({ status: 'published' });
    stubRepo(EventsRepository, {
      findBySlug: async () => event,
    });
    const ctx = makeCtx({ _params: { slug: 'annual-conference' } });
    const res = await getPublicEvent(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.id).toBe('event-1');
  });

  test('returns 200 for registration_open event', async () => {
    const event = makeEvent({ status: 'registration_open' });
    stubRepo(EventsRepository, {
      findBySlug: async () => event,
    });
    const ctx = makeCtx({ _params: { slug: 'annual-conference' } });
    const res = await getPublicEvent(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.status).toBe('registration_open');
  });

  test('returns 200 for in_progress event', async () => {
    const event = makeEvent({ status: 'in_progress' });
    stubRepo(EventsRepository, {
      findBySlug: async () => event,
    });
    const ctx = makeCtx({ _params: { slug: 'annual-conference' } });
    const res = await getPublicEvent(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.status).toBe('in_progress');
  });

  test('returns 200 for completed event', async () => {
    const event = makeEvent({ status: 'completed' });
    stubRepo(EventsRepository, {
      findBySlug: async () => event,
    });
    const ctx = makeCtx({ _params: { slug: 'annual-conference' } });
    const res = await getPublicEvent(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.status).toBe('completed');
  });

  test('response body contains full event data', async () => {
    const event = makeEvent({ title: 'Dental Congress 2026', status: 'published' });
    stubRepo(EventsRepository, {
      findBySlug: async () => event,
    });
    const ctx = makeCtx({ _params: { slug: 'annual-conference' } });
    const res = await getPublicEvent(ctx);
    expect((res as any).body.data.title).toBe('Dental Congress 2026');
    expect((res as any).body.data.slug).toBe('annual-conference');
  });

  test('no auth required — unauthenticated context succeeds for published event', async () => {
    const event = makeEvent({ status: 'published' });
    stubRepo(EventsRepository, {
      findBySlug: async () => event,
    });
    // user: null simulates an unauthenticated request
    const ctx = makeCtx({ user: null, session: null, _params: { slug: 'annual-conference' } });
    const res = await getPublicEvent(ctx);
    expect(res.status).toBe(200);
  });
});
