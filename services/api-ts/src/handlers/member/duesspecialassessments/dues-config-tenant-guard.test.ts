/**
 * dues-config-tenant-guard.test.ts
 *
 * Cross-org tenant guard for updateDuesConfig / deleteDuesConfig.
 *
 * Both handlers fetch a DuesConfig by id and mutate / soft-delete it without
 * verifying `existing.organizationId === ctx.organizationId`. A Treasurer /
 * President of org A (passing their own x-org-id) could update or delete
 * org B's dues config simply by supplying its id.
 *
 * Sibling mutations (confirmPaymentProof, refundDuesPayment, updateDunningTemplate)
 * already enforce this tenant check. These tests reproduce the gap (RED) and
 * lock in the fix (GREEN).
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateDuesConfig } from './updateDuesConfig';
import { deleteDuesConfig } from './deleteDuesConfig';
import { DuesConfigRepository } from '@/handlers/association:member/repos/dues.repo';

describe('[FIX dues-settle-seam] updateDuesConfig — cross-org tenant guard', () => {
  beforeEach(() => {
    restoreRepo(DuesConfigRepository);
  });
  afterEach(() => {
    restoreRepo(DuesConfigRepository);
  });

  test('rejects update of another org\'s config (org-A caller, org-B config) [RED]', async () => {
    let mutated = false;
    stubRepo(DuesConfigRepository, {
      findOneById: async () => ({
        id: 'cfg-orgB',
        organizationId: 'org-B', // config belongs to a DIFFERENT org
        defaultAmount: 5000,
        version: 1,
      }),
      updateOneById: async (_id: string, data: any) => {
        mutated = true;
        return { id: 'cfg-orgB', ...data };
      },
    });

    const ctx = makeCtx({
      _params: { duesConfigId: 'cfg-orgB' },
      _body: { defaultAmount: 99999 }, // attacker tries to change another org's amount
      organizationId: 'org-A', // caller's verified tenant
    });

    // Must reject (403/404) and must NOT mutate the org-B config.
    try {
      const res = await updateDuesConfig(ctx as any);
      expect([403, 404]).toContain(res.status);
    } catch (e: any) {
      expect([403, 404]).toContain(e.statusCode ?? e.status ?? 403);
    }
    expect(mutated).toBe(false);
  });

  test('allows update of own org\'s config (org-A caller, org-A config)', async () => {
    let mutatedWith: any;
    stubRepo(DuesConfigRepository, {
      findOneById: async () => ({
        id: 'cfg-orgA',
        organizationId: 'org-A',
        defaultAmount: 5000,
        version: 1,
      }),
      updateOneById: async (_id: string, data: any) => {
        mutatedWith = data;
        return { id: 'cfg-orgA', organizationId: 'org-A', ...data };
      },
    });

    const ctx = makeCtx({
      _params: { duesConfigId: 'cfg-orgA' },
      _body: { defaultAmount: 60000 },
      organizationId: 'org-A',
    });

    const res = await updateDuesConfig(ctx as any);
    expect(res.status).toBe(200);
    expect(mutatedWith?.defaultAmount).toBe(60000);
  });
});

describe('[FIX dues-settle-seam] deleteDuesConfig — cross-org tenant guard', () => {
  beforeEach(() => {
    restoreRepo(DuesConfigRepository);
  });
  afterEach(() => {
    restoreRepo(DuesConfigRepository);
  });

  test('rejects delete of another org\'s config (org-A caller, org-B config) [RED]', async () => {
    let deleted = false;
    stubRepo(DuesConfigRepository, {
      findOneById: async () => ({
        id: 'cfg-orgB',
        organizationId: 'org-B',
        defaultAmount: 5000,
        version: 1,
      }),
      deleteOneById: async () => {
        deleted = true;
      },
    });

    const ctx = makeCtx({
      _params: { duesConfigId: 'cfg-orgB' },
      organizationId: 'org-A',
    });

    try {
      const res = await deleteDuesConfig(ctx as any);
      expect([403, 404]).toContain(res.status);
    } catch (e: any) {
      expect([403, 404]).toContain(e.statusCode ?? e.status ?? 403);
    }
    expect(deleted).toBe(false);
  });

  test('allows delete of own org\'s config (org-A caller, org-A config)', async () => {
    let deleted = false;
    stubRepo(DuesConfigRepository, {
      findOneById: async () => ({
        id: 'cfg-orgA',
        organizationId: 'org-A',
        defaultAmount: 5000,
        version: 1,
      }),
      deleteOneById: async () => {
        deleted = true;
      },
    });

    const ctx = makeCtx({
      _params: { duesConfigId: 'cfg-orgA' },
      organizationId: 'org-A',
    });

    const res = await deleteDuesConfig(ctx as any);
    expect(res.status).toBe(204);
    expect(deleted).toBe(true);
  });
});
