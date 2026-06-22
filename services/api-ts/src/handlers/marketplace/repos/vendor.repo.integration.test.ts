/**
 * VendorRepository — real-Postgres integration coverage (createScratch harness).
 *
 * Drives the actual Drizzle repo (filters, org-scoping, FSM transitions)
 * against an isolated scratch schema copied `LIKE public.* INCLUDING ALL`, so
 * the live column types / NOT NULL / defaults / CHECKs are reproduced faithfully
 * and the suite is parallel-safe with zero cross-file mock bleed. FKs are dropped
 * by `LIKE`, so vendor rows seed directly without standing up org/person parents.
 *
 * Migrated (W3 marketplace S1) off the prior transaction-rollback-on-`public`
 * harness + the brittle capturePristine/restorePristine prototype-mock
 * restoration machinery — createScratch isolates the schema with the genuine
 * prototype, so no restoration is needed.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { ConflictError, NotFoundError } from '@/core/errors';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { VendorRepository } from './vendor.repo';
import type { NewVendor } from './marketplace.schema';

let H: ScratchDb;
beforeAll(async () => {
  H = await createScratch(['vendor', 'marketplace_listing', 'marketplace_order']);
});
afterAll(async () => {
  await H?.teardown();
});

function newVendor(orgId: string, overrides: Partial<NewVendor> = {}): NewVendor {
  return {
    organizationId: orgId,
    companyName: 'Acme Medical',
    category: 'supplies',
    description: 'Medical supplies vendor',
    verificationStatus: 'pending',
    contactEmail: `vendor-${crypto.randomUUID()}@acme.test`,
    createdBy: crypto.randomUUID(),
    updatedBy: crypto.randomUUID(),
    ...overrides,
  } as NewVendor;
}

describe('VendorRepository (real-PG / createScratch)', () => {
  test('createOne round-trips: default status applied, org persisted, version=1', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const orgId = crypto.randomUUID();
    // omit verificationStatus → DB default 'pending' must apply
    const v = await repo.createOne(newVendor(orgId, { verificationStatus: undefined }));

    const { rows } = await H.scopedPool.query(
      `SELECT verification_status, organization_id, version FROM "${H.schema}".vendor WHERE id = $1`,
      [v.id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].verification_status).toBe('pending');
    expect(rows[0].organization_id).toBe(orgId);
    expect(rows[0].version).toBe(1);
  });

  test('buildWhereConditions: filters by org, category, status, email + org-scoping isolation', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const uniqueEmail = `a-${crypto.randomUUID()}@x.test`;
    const a = await repo.createOne(newVendor(orgA, { category: 'emr', contactEmail: uniqueEmail }));
    await repo.createOne(newVendor(orgA, { category: 'supplies', verificationStatus: 'verified' }));
    await repo.createOne(newVendor(orgB, { category: 'emr' })); // foreign org

    // undefined filters → no conditions branch
    expect(await repo.findMany()).not.toBeUndefined();

    // org-scoping: orgA sees only its 2 rows on real PG, never orgB's
    const orgAList = await repo.findMany({ organizationId: orgA });
    expect(orgAList.length).toBe(2);
    expect(orgAList.every((v) => v.organizationId === orgA)).toBe(true);
    expect(orgAList.some((v) => v.organizationId === orgB)).toBe(false);

    // category + status + email branches
    expect((await repo.findMany({ organizationId: orgA, category: 'emr' })).length).toBe(1);
    expect((await repo.findMany({ organizationId: orgA, verificationStatus: 'verified' })).length).toBe(1);
    expect((await repo.findMany({ contactEmail: uniqueEmail })).length).toBe(1);
    expect((await repo.findOne({ organizationId: orgA, category: 'emr' }))?.id).toBe(a.id);
  });

  test('findVerifiedVendors returns only verified for the org', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
    await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
    const verified = await repo.findVerifiedVendors(org);
    expect(verified.length).toBe(1);
    expect(verified[0]!.verificationStatus).toBe('verified');
  });

  test('verifyVendor: pending→verified sets verifiedAt/By; NotFound when missing', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const v = await repo.createOne(newVendor(org));
    const admin = crypto.randomUUID();
    const verified = await repo.verifyVendor(v.id, admin);
    expect(verified.verificationStatus).toBe('verified');
    expect(verified.verifiedBy).toBe(admin);
    expect(verified.verifiedAt).not.toBeNull();
    await expect(repo.verifyVendor(crypto.randomUUID(), admin)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('verifyVendor rejects invalid FSM transition (rejected→verified)', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const v = await repo.createOne(newVendor(org, { verificationStatus: 'rejected' }));
    await expect(repo.verifyVendor(v.id, crypto.randomUUID())).rejects.toBeInstanceOf(ConflictError);
  });

  test('suspendVendor: verified→suspended; invalid from pending throws', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const ver = await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
    expect((await repo.suspendVendor(ver.id, crypto.randomUUID())).verificationStatus).toBe('suspended');

    const pend = await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
    await expect(repo.suspendVendor(pend.id, crypto.randomUUID())).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.suspendVendor(crypto.randomUUID(), crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });

  test('rejectVendor: pending→rejected; verified cannot be rejected', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const pend = await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
    expect((await repo.rejectVendor(pend.id, crypto.randomUUID())).verificationStatus).toBe('rejected');

    const ver = await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
    await expect(repo.rejectVendor(ver.id, crypto.randomUUID())).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.rejectVendor(crypto.randomUUID(), crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });
});
