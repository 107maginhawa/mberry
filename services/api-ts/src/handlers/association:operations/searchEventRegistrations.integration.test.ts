/**
 * searchEventRegistrations org isolation (real-PG; skips when DB unreachable).
 * A person can belong to several chapters; an officer of one must never see another chapter's
 * registrations. The search is always scoped to the caller's org.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { searchEventRegistrations } from './searchEventRegistrations';
import { EventRegistrationRepository } from './repos/events.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let regRepo: EventRegistrationRepository;
const ORG_A = '00000000-0000-4000-8000-0000000000e1';
const ORG_B = '00000000-0000-4000-8000-0000000000e2';
const PERSON = '00000000-0000-4000-8000-0000000000ef';

function ctx(org: string, query: Record<string, unknown>) {
  return makeCtx({ user: { id: 'officer-1' }, organizationId: org, database: H.db, _query: query });
}

beforeAll(async () => {
  H = await createScratch(['event_registration']);
  if (!H.dbReachable) return;
  regRepo = new EventRegistrationRepository(H.db as never);
  await regRepo.createOne({ organizationId: ORG_A, eventId: crypto.randomUUID(), personId: PERSON, status: 'confirmed' } as never);
  await regRepo.createOne({ organizationId: ORG_B, eventId: crypto.randomUUID(), personId: PERSON, status: 'confirmed' } as never);
});
afterAll(async () => { await H?.teardown(); });

describe('searchEventRegistrations (real-PG)', () => {
  test('returns only the caller-org registrations for a multi-chapter person', async () => {
    if (!H.dbReachable) return;
    const res = await searchEventRegistrations(ctx(ORG_A, { personId: PERSON }) as never);
    const body = (res as any).body;
    expect(body.totalCount).toBe(1);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].organizationId).toBe(ORG_A);
  });

  test('the other chapter sees only its own', async () => {
    if (!H.dbReachable) return;
    const res = await searchEventRegistrations(ctx(ORG_B, { personId: PERSON }) as never);
    const body = (res as any).body;
    expect(body.totalCount).toBe(1);
    expect(body.data[0].organizationId).toBe(ORG_B);
  });
});
