/**
 * Inter-module seam: register-and-pay → settle → refund, end-to-end on the
 * operations-owned event_registration row.
 *
 * Existing register-and-pay tests assert only that a checkoutUrl + registrationId
 * come back; the Wave-1 event-registration-settlement.integration.test.ts proves
 * the settle branch but RAW-INSERTS the row. This suite closes the seam: it drives
 * the REAL registerAndPayForEvent (real EventRegistrationRepository insert) then
 * feeds the metadata IT produced into the REAL createProcessPayment event_registration
 * branch, and asserts the SAME row settles. Real-PG; skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import type { Logger } from 'pino';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { registerAndPayForEvent } from './registerAndPayForEvent';
import { refundEventRegistration } from './refundEventRegistration';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';
import { MerchantAccountRepository } from '@/handlers/billing/repos/billing.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { createProcessPayment } from '@/handlers/member/duesspecialassessments/jobs/processStripePayment';
import { BusinessLogicError } from '@/core/errors';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let eventRepo: EventRepository;
let regRepo: EventRegistrationRepository;
const ORG = '00000000-0000-4000-8000-0000000000a1';
const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger;

let activeMocks: { mockRestore: () => void }[] = [];
afterEach(() => { activeMocks.forEach((m) => m.mockRestore()); activeMocks = []; });

/** Stub the cross-module deps; capture the Stripe metadata registerAndPay builds. */
function stubDeps(opts: { merchant?: Record<string, unknown> | null; active?: boolean } = {}) {
  const captured: { metadata?: Record<string, string> } = {};
  const billing = {
    createPaymentIntent: async (args: { metadata: Record<string, string> }) => {
      captured.metadata = args.metadata;
      return { checkoutUrl: 'https://checkout.example/abc' };
    },
  };
  const merchantList = opts.merchant === null ? [] : [opts.merchant ?? { metadata: { stripeAccountId: 'acct_test' } }];
  activeMocks.push(...Object.values(stubRepo(MerchantAccountRepository, { findMany: async () => merchantList })));
  activeMocks.push(...Object.values(stubRepo(MembershipRepository, {
    findByPersonAndOrg: async () => (opts.active === false ? null : { status: 'active' }),
  })));
  return { billing, captured };
}

async function seedEvent(o: Partial<Record<string, unknown>> = {}) {
  return eventRepo.createOne({
    organizationId: ORG, title: 'Paid Gala', startDate: new Date('2030-05-01T09:00:00Z'),
    endDate: new Date('2030-05-01T17:00:00Z'), status: 'published', registrationFee: 5000,
    currency: 'PHP', capacity: 10, ...o,
  } as never);
}

function ctxFor(eventId: string, billing: unknown, person = crypto.randomUUID()) {
  return makeCtx({ user: { id: person }, database: H.db, billing, _params: { eventId } });
}

async function readReg(id: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT status, paid_at, version FROM "${H.schema}".event_registration WHERE id = $1`, [id]);
  return rows[0];
}

beforeAll(async () => {
  H = await createScratch(['event', 'event_registration']);
  if (!H.dbReachable) return;
  eventRepo = new EventRepository(H.db as never);
  regRepo = new EventRegistrationRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('registerAndPayForEvent → settle → refund (real-PG seam)', () => {
  test('inserts a real confirmed/unpaid registration with correct Stripe metadata, then settles it', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const { billing, captured } = stubDeps();

    const res = await registerAndPayForEvent(ctxFor(ev.id, billing)) as unknown as { status: number; body: { data: { checkoutUrl: string; registrationId: string } } };
    expect(res.status).toBe(201);
    const regId = res.body.data.registrationId;
    expect(res.body.data.checkoutUrl).toContain('checkout');

    // Real row: confirmed, not yet paid.
    const before = await readReg(regId);
    expect(before.status).toBe('confirmed');
    expect(before.paid_at).toBeNull();

    // Metadata carries the dead-letter-guard keys (both orgId + organizationId) + the real row id.
    expect(captured.metadata).toMatchObject({
      type: 'event_registration', registrationId: regId, orgId: ORG, organizationId: ORG,
    });

    // Feed THAT metadata into the real settle branch → the SAME row settles.
    const explode = (async () => { throw new Error('must not be called on the event_registration branch'); }) as never;
    const processPayment = createProcessPayment({ capturePaymentIntent: explode, createPaymentIntent: explode } as never, H.db as never, noopLogger, explode);
    const result = await processPayment({ id: 'pi_1', status: 'succeeded', metadata: captured.metadata } as never);
    expect(result).toEqual({ success: true });

    const after = await readReg(regId);
    expect(after.paid_at).not.toBeNull();
    expect(after.version).toBe(2); // updateOneById bumped it
  });

  test('guards: FREE_EVENT, EVENT_FULL (no row), NO_MERCHANT_ACCOUNT, STRIPE_NOT_ONBOARDED', async () => {
    if (!H.dbReachable) return;

    // FREE_EVENT — fires before membership/merchant lookups.
    const free = await seedEvent({ registrationFee: 0 });
    const d1 = stubDeps();
    await expect(registerAndPayForEvent(ctxFor(free.id, d1.billing))).rejects.toMatchObject({ code: 'FREE_EVENT' });

    // EVENT_FULL — at capacity, no new row inserted.
    const full = await seedEvent({ capacity: 1 });
    await regRepo.createOne({ organizationId: ORG, eventId: full.id, personId: crypto.randomUUID(), status: 'confirmed' } as never);
    const d2 = stubDeps();
    await expect(registerAndPayForEvent(ctxFor(full.id, d2.billing))).rejects.toMatchObject({ code: 'EVENT_FULL' });
    expect(await regRepo.count({ eventId: full.id } as never)).toBe(1); // no extra row

    // NO_MERCHANT_ACCOUNT.
    const ev3 = await seedEvent();
    const d3 = stubDeps({ merchant: null });
    await expect(registerAndPayForEvent(ctxFor(ev3.id, d3.billing))).rejects.toMatchObject({ code: 'NO_MERCHANT_ACCOUNT' });

    // STRIPE_NOT_ONBOARDED — merchant exists but no stripeAccountId.
    const ev4 = await seedEvent();
    const d4 = stubDeps({ merchant: { metadata: {} } });
    await expect(registerAndPayForEvent(ctxFor(ev4.id, d4.billing))).rejects.toMatchObject({ code: 'STRIPE_NOT_ONBOARDED' });
  });

  test('refundEventRegistration on a paid row → refunded + refundedAt; a second refund → ALREADY_REFUNDED', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent();
    const { billing, captured } = stubDeps();
    const res = await registerAndPayForEvent(ctxFor(ev.id, billing)) as unknown as { body: { data: { registrationId: string } } };
    const regId = res.body.data.registrationId;

    // settle it first
    const explode = (async () => { throw new Error('x'); }) as never;
    const processPayment = createProcessPayment({ capturePaymentIntent: explode, createPaymentIntent: explode } as never, H.db as never, noopLogger, explode);
    await processPayment({ id: 'pi_2', status: 'succeeded', metadata: captured.metadata } as never);

    const refundCtx = makeCtx({ user: { id: 'officer-1' }, database: H.db, _params: { registrationId: regId } });
    const refunded = await refundEventRegistration(refundCtx) as unknown as { status: number; body: { status: string; refundedAt: Date } };
    expect(refunded.status).toBe(200);
    expect(refunded.body.status).toBe('refunded');
    expect(refunded.body.refundedAt).toBeTruthy();

    const refundCtx2 = makeCtx({ user: { id: 'officer-1' }, database: H.db, _params: { registrationId: regId } });
    let err: unknown;
    try { await refundEventRegistration(refundCtx2); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as { code?: string }).code).toBe('ALREADY_REFUNDED');
  });
});
