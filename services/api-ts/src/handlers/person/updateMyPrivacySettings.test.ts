import { describe, test, expect, mock } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { updateMyPrivacySettings } from './updateMyPrivacySettings';
import { UpdatePrivacySettingsRequestSchema } from '@/generated/openapi/validators';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

/**
 * G-01 (FIX-001): the contract/validator/frontend all carry `orgId`, but the
 * handler historically read `organizationId`. To kill the fake-green class
 * (gap plan §19/§20), the happy-path tests below feed the handler a body that
 * has FIRST been parsed through the generated Zod validator, exactly like the
 * route does. The validator strips unknown keys, so a body that only carries
 * `organizationId` becomes `{}` — reproducing the real 400.
 */
function validatedBody(input: Record<string, unknown>): Record<string, unknown> {
  // Mirrors the route: ctx.req.valid('json') === validator.parse(rawBody)
  return UpdatePrivacySettingsRequestSchema.parse(input) as Record<string, unknown>;
}

function membershipThenExistingDb(opts: { existing?: any } = {}) {
  const calls: string[] = [];
  const captured: { insertValues?: any; updateSet?: any } = {};
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            calls.push('select');
            if (calls.length === 1) return [{ id: 'mem-1' }]; // membership lookup
            return opts.existing ? [opts.existing] : []; // existing privacy row
          },
        }),
      }),
    }),
    insert: () => ({
      values: (v: any) => {
        captured.insertValues = v;
        return { returning: async () => [{ id: 'ps-1', ...v }] };
      },
    }),
    update: () => ({
      set: (v: any) => {
        captured.updateSet = v;
        return { where: () => ({ returning: async () => [{ id: 'ps-1', ...v }] }) };
      },
    }),
  };
  return { db, captured };
}

describe('updateMyPrivacySettings', () => {
  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(updateMyPrivacySettings(ctx)).rejects.toThrow('Unauthorized');
  });

  test('throws ValidationError when orgId missing (validator-stripped body)', async () => {
    // A request that only carried `organizationId` is stripped to {} by the validator.
    const ctx = makeCtx({ _body: validatedBody({ organizationId: 'org-1' } as any) });
    await expect(updateMyPrivacySettings(ctx)).rejects.toThrow('orgId is required');
  });

  test('throws ForbiddenError when not a member', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
    const ctx = makeCtx({
      database: mockDb,
      _body: validatedBody({ orgId: '11111111-1111-4111-8111-111111111111' }),
    });
    await expect(updateMyPrivacySettings(ctx)).rejects.toThrow('Not a member of this organization');
  });

  test('persists privacy flags from an `orgId` body and returns 201', async () => {
    const orgId = '11111111-1111-4111-8111-111111111111';
    const { db, captured } = membershipThenExistingDb();
    const ctx = makeCtx({
      database: db,
      _body: validatedBody({ orgId, emailVisible: true, photoVisible: false }),
    });
    const res = await updateMyPrivacySettings(ctx);
    expect(res.status).toBe(201);
    // Proves the org was resolved from `orgId` (not `organizationId`) and the
    // flipped flags were written to the row.
    expect(captured.insertValues.organizationId).toBe(orgId);
    expect(captured.insertValues.emailVisible).toBe(true);
    expect(captured.insertValues.photoVisible).toBe(false);
  });

  test('updates existing privacy row from an `orgId` body and returns 200', async () => {
    const orgId = '22222222-2222-4222-8222-222222222222';
    const existing = {
      id: 'ps-1',
      personId: 'user-1',
      organizationId: orgId,
      emailVisible: false,
      phoneVisible: false,
      photoVisible: true,
      addressVisible: false,
      credentialsVisible: false,
      duesStatusVisible: false,
      ceComplianceVisible: false,
    };
    const { db, captured } = membershipThenExistingDb({ existing });
    const ctx = makeCtx({
      database: db,
      _body: validatedBody({ orgId, photoVisible: false }),
    });
    const res = await updateMyPrivacySettings(ctx);
    expect(res.status).toBe(200);
    expect(captured.updateSet.photoVisible).toBe(false);
  });
});
