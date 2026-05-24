import type { Context } from 'hono';
import { EventsRepository } from './repos/events.repo';

/**
 * Serves HTML with OG meta tags for social media crawlers (WhatsApp, Facebook, Twitter).
 * Browsers get redirected to the SPA event page.
 *
 * Route: GET /og/events/:slug
 */
export async function serveEventOgMeta(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const slug = ctx.req.param('slug')!;
  const repo = new EventsRepository(db);
  const event = await repo.findBySlug(slug);

  if (!event || event.status === 'draft' || event.status === 'cancelled') {
    return ctx.text('Not found', 404);
  }

  const title = event.title;
  const description = event.description
    ? event.description.substring(0, 200)
    : `Event on ${event.startDate.toLocaleDateString()}`;
  const image = event.coverImageUrl ?? '';
  const url = `${ctx.req.url.split('/og/')[0]}/events/${slug}`;

  const dateStr = event.startDate.toISOString();
  const locationStr = event.location ?? 'Online';
  const cpdBadge = event.creditBearing && event.creditAmount
    ? ` | ${event.creditAmount} CPD hours`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(`${locationStr} | ${dateStr.split('T')[0]}${cpdBadge}`)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}
  <meta http-equiv="refresh" content="0;url=/events/${escapeHtml(slug)}" />
</head>
<body>
  <p>Redirecting to <a href="/events/${escapeHtml(slug)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

  return ctx.html(html);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
