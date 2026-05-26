import type { Context } from 'hono';
import { ValidationError, NotFoundError, ForbiddenError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { generateEventSlug } from './utils/event-slug';
import type { Session } from '@/types/auth';

const MAX_OCCURRENCES = 52;

export async function bulkCreateEventSeries(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId')!;
  const body = await ctx.req.json();
  const repo = new EventsRepository(db);

  // Officer authorization — only officers can bulk-create events
  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required to create event series');
  }

  if (!body.templateEventId) throw new ValidationError('templateEventId required');
  if (!Array.isArray(body.dates) || body.dates.length === 0) throw new ValidationError('dates[] required');
  if (body.dates.length > MAX_OCCURRENCES) throw new ValidationError(`Max ${MAX_OCCURRENCES} occurrences`);

  const template = await repo.get(body.templateEventId);
  if (!template) throw new NotFoundError('Template event not found');
  if (template.organizationId !== orgId) throw new NotFoundError('Template event not found');

  const duration = new Date(template.endDate).getTime() - new Date(template.startDate).getTime();
  const baseSlug = generateEventSlug(template.title);

  // Batch-check existing slugs to avoid N+1
  const slugCandidates = body.dates.map((_: string, i: number) => `${baseSlug}-${i + 2}`);
  const existingSlugs = new Set<string>();
  for (const candidate of [baseSlug, ...slugCandidates]) {
    const found = await repo.findBySlug(candidate);
    if (found) existingSlugs.add(candidate);
  }

  const createdEvents = [];
  for (let i = 0; i < body.dates.length; i++) {
    const startDate = new Date(body.dates[i]);
    if (isNaN(startDate.getTime())) throw new ValidationError(`Invalid date at index ${i}`);
    const endDate = new Date(startDate.getTime() + duration);

    // Generate unique slug
    let slug = `${baseSlug}-${i + 2}`;
    let suffix = i + 2;
    while (existingSlugs.has(slug)) {
      suffix++;
      slug = `${baseSlug}-${suffix}`;
    }
    existingSlugs.add(slug);

    const event = await repo.create({
      organizationId: orgId,
      title: template.title,
      eventType: template.eventType,
      description: template.description,
      location: template.location,
      startDate,
      endDate,
      capacity: template.capacity,
      registrationFee: template.registrationFee,
      currency: template.currency,
      creditBearing: template.creditBearing,
      creditAmount: template.creditAmount,
      cpdActivityType: template.cpdActivityType,
      eventSlug: slug,
      coverImageUrl: template.coverImageUrl,
      status: 'draft',
      visibility: template.visibility,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });

    createdEvents.push(event);
  }

  return ctx.json({ data: createdEvents, count: createdEvents.length }, 201);
}
