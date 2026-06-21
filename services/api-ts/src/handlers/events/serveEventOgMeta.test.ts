/**
 * Handler test for serveEventOgMeta (handlers/events/serveEventOgMeta.ts) — a
 * PUBLIC, unauthenticated OG/share endpoint that had ZERO tests.
 *
 * Driven through a real Hono app (app.request) because the handler returns HTML
 * via ctx.html()/ctx.text() — makeCtx doesn't model those. We assert the actual
 * rendered values + headers + status, and the load-bearing XSS escaping of a
 * public endpoint. The repo's findBySlug is stubbed so no DB is needed.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { stubRepo } from '@/test-utils/make-ctx';
import { serveEventOgMeta } from './serveEventOgMeta';
import { EventsRepository } from './repos/events.repo';

function appWithEvent(event: Record<string, unknown> | undefined) {
  const mocks = stubRepo(EventsRepository, { findBySlug: async () => event });
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('database', {} as never); await next(); });
  app.get('/og/events/:slug', (c) => serveEventOgMeta(c));
  return { app, mocks };
}

const publishedEvent = {
  id: 'evt-1',
  status: 'published',
  title: 'Spring Gala',
  description: 'A wonderful evening of dentistry.',
  coverImageUrl: 'https://cdn.example.com/cover.png',
  creditBearing: true,
  creditAmount: 2,
  startDate: new Date('2030-05-01T09:00:00Z'),
  location: 'Manila',
  eventSlug: 'spring-gala',
};

let active: ReturnType<typeof stubRepo> | undefined;
afterEach(() => { if (active) Object.values(active).forEach((m) => m.mockRestore()); active = undefined; });

describe('serveEventOgMeta', () => {
  test('published event → text/html with real og:title, og:image, and CPD badge', async () => {
    const { app, mocks } = appWithEvent(publishedEvent);
    active = mocks;
    const res = await app.request('/og/events/spring-gala');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('<meta property="og:title" content="Spring Gala" />');
    expect(html).toContain('<meta property="og:image" content="https://cdn.example.com/cover.png" />');
    expect(html).toContain('<meta name="twitter:image" content="https://cdn.example.com/cover.png" />');
    // CPD badge is appended to the og:description.
    expect(html).toContain('2 CPD hours');
    // Refresh redirect points at the SPA event page for the same slug.
    expect(html).toContain('content="0;url=/events/spring-gala"');
  });

  test('XSS guard: a malicious title is HTML-escaped (no raw <script>)', async () => {
    const { app, mocks } = appWithEvent({ ...publishedEvent, title: '"><script>alert(1)</script>' });
    active = mocks;
    const res = await app.request('/og/events/spring-gala');
    expect(res.status).toBe(200);
    const html = await res.text();
    // The injected script tag must NOT appear raw...
    expect(html).not.toContain('<script>');
    // ...it must be escaped instead.
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;&gt;'); // the leading "> is escaped too
  });

  test('draft event → 404 Not found', async () => {
    const { app, mocks } = appWithEvent({ ...publishedEvent, status: 'draft' });
    active = mocks;
    const res = await app.request('/og/events/spring-gala');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
  });

  test('cancelled event → 404 Not found', async () => {
    const { app, mocks } = appWithEvent({ ...publishedEvent, status: 'cancelled' });
    active = mocks;
    const res = await app.request('/og/events/spring-gala');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
  });

  test('absent slug (no event) → 404 Not found', async () => {
    const { app, mocks } = appWithEvent(undefined);
    active = mocks;
    const res = await app.request('/og/events/missing');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
  });

  test('missing cover image → no og:image / twitter:image meta tags emitted', async () => {
    const { app, mocks } = appWithEvent({ ...publishedEvent, coverImageUrl: null });
    active = mocks;
    const res = await app.request('/og/events/spring-gala');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('og:image');
    expect(html).not.toContain('twitter:image');
    // The rest of the card still renders.
    expect(html).toContain('og:title');
  });

  test('non-credit-bearing event → no CPD badge in the description', async () => {
    const { app, mocks } = appWithEvent({ ...publishedEvent, creditBearing: false, creditAmount: 0 });
    active = mocks;
    const res = await app.request('/og/events/spring-gala');
    const html = await res.text();
    expect(html).not.toContain('CPD hours');
  });
});
