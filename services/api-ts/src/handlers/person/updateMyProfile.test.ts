import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { domainEvents } from '@/core/domain-events';
import { updateMyProfile } from './updateMyProfile';
import { PersonMeUpdateRequestSchema } from '@/generated/openapi/validators';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

/**
 * FIX-006: feed the handler a body parsed through the generated Zod validator,
 * exactly like the route. The validator strips fields not in PersonMeUpdateRequest
 * (contactInfo, primaryAddress, languagesSpoken, licenseNumber, prcId, avatar),
 * so any handler mapping for those is dead code — and `phone` is the real
 * contract field that must round-trip (G-05).
 */
function validatedProfileBody(input: Record<string, unknown>): Record<string, unknown> {
  return PersonMeUpdateRequestSchema.parse(input) as Record<string, unknown>;
}

describe('updateMyProfile', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(updateMyProfile(ctx)).rejects.toThrow();
  });

  test('returns 200 on happy path', async () => {
    const person = { id: 'user-1', firstName: 'Test' };
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async () => ({ ...person, firstName: 'Updated' }),
    });
    const ctx = makeCtx({ _body: { firstName: 'Updated' } });
    const res = await updateMyProfile(ctx);
    expect(res.status).toBe(200);
  });

  // ── EM-M02-m3n4o5p6: profile change emits person.updated ──
  test('emits person.updated with changedFields', async () => {
    const person = { id: 'user-1', firstName: 'Test' };
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async () => ({ ...person, firstName: 'Updated' }),
    });
    const emitSpy = spyOn(domainEvents, 'emit');
    try {
      const ctx = makeCtx({ _body: { firstName: 'Updated', specialization: 'Cardiology' } });
      await updateMyProfile(ctx);
      const emit = emitSpy.mock.calls.find((c) => c[0] === 'person.updated');
      expect(emit).toBeDefined();
      expect(emit![1]).toMatchObject({ personId: 'user-1', updatedBy: 'user-1' });
      expect((emit![1] as any).updatedFields).toEqual(
        expect.arrayContaining(['firstName', 'specialization']),
      );
      expect((emit![1] as any).updatedFields).not.toContain('updatedBy');
    } finally {
      emitSpy.mockRestore();
    }
  });

  // ── FIX-005 (G-05): the contract field `phone` must round-trip into
  //    contactInfo.phone instead of being silently dropped. ──
  test('maps contract `phone` to contactInfo.phone (validator-inclusive)', async () => {
    const person = { id: 'user-1', firstName: 'Test', contactInfo: { email: 'a@b.com' } };
    let captured: Record<string, unknown> | undefined;
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async (_id: string, data: Record<string, unknown>) => {
        captured = data;
        return { ...person, ...data };
      },
    });
    const ctx = makeCtx({ _body: validatedProfileBody({ phone: '+639171234567' }) });
    const res = await updateMyProfile(ctx);
    expect(res.status).toBe(200);
    // phone lands inside contactInfo, preserving the existing email
    expect(captured!['contactInfo']).toEqual({ email: 'a@b.com', phone: '+639171234567' });
  });

  test('does not write dead/validator-stripped fields', async () => {
    const person = { id: 'user-1', firstName: 'Test' };
    let captured: Record<string, unknown> | undefined;
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async (_id: string, data: Record<string, unknown>) => {
        captured = data;
        return { ...person, ...data };
      },
    });
    // These keys are NOT in PersonMeUpdateRequest; the validator strips them,
    // so a real request can never carry them. Send them raw (bypassing the
    // validator) to prove the handler no longer maps them even if present.
    const ctx = makeCtx({
      _body: {
        firstName: 'Updated',
        contactInfo: { email: 'evil@x.com' },
        primaryAddress: { street1: 'x' },
        languagesSpoken: ['en'],
        licenseNumber: 'LIC',
        prcId: 'PRC',
        avatar: { url: 'http://x' },
      },
    });
    await updateMyProfile(ctx);
    expect(captured!['firstName']).toBe('Updated');
    // Dead mappings removed: these must not be persisted from a raw body.
    expect(captured).not.toHaveProperty('primaryAddress');
    expect(captured).not.toHaveProperty('languagesSpoken');
    expect(captured).not.toHaveProperty('licenseNumber');
    expect(captured).not.toHaveProperty('prcId');
    expect(captured).not.toHaveProperty('avatar');
    // contactInfo is only written when `phone` is present (G-05 mapping), never
    // from a raw passthrough.
    expect(captured).not.toHaveProperty('contactInfo');
  });
});
