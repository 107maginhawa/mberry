/**
 * updateDuesConfig.test.ts
 *
 * PATCH /association/member/dues-configs/{duesConfigId}
 *
 * The handler resolves a dues config in two ways (mirroring getDuesConfig):
 *   Path A — a legacy `dues_config` row exists for the path id
 *            (DuesConfigRepository.findOneById hit). Cross-org guard +
 *            updateOneById with the mapped PATCH fields.
 *   Path B — no legacy row; the form passed the ORG id as the path param.
 *            Resolve the org-level `dues_org_config` via DuesRepository.getConfig
 *            and upsertConfig with the merged fields (annualAmount→defaultAmount,
 *            currency, billingFrequency, gracePeriodDays). NotFoundError when no
 *            current org config exists.
 *
 * Both repos are registered in src/test-utils/preload-pristine.ts
 * (DuesConfigRepository from dues.repo, DuesRepository from dues-payments.repo),
 * so stubRepo is safe — no mock.module needed.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateDuesConfig } from './updateDuesConfig';
import { DuesConfigRepository } from '@/handlers/association:member/repos/dues.repo';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG_ID = 'org-1';

/** Legacy dues_config row (Path A). */
const fakeLegacyConfig = {
  id: 'cfg-1',
  organizationId: ORG_ID,
  annualAmount: 5000,
  currency: 'PHP',
  billingFrequency: 'annual',
  gracePeriodDays: 30,
};

/** Org-level dues_org_config row (Path B — the table the form reads). */
const fakeOrgConfig = {
  id: 'orgcfg-1',
  organizationId: ORG_ID,
  defaultAmount: 5000,
  currency: 'PHP',
  billingFrequency: 'annual',
  dueDateMonth: 1,
  dueDateDay: 15,
  gracePeriodDays: 30,
};

describe('updateDuesConfig', () => {
  beforeEach(() => {
    restoreRepo(DuesConfigRepository);
    restoreRepo(DuesRepository);
  });

  afterEach(() => {
    restoreRepo(DuesConfigRepository);
    restoreRepo(DuesRepository);
  });

  // ─── Auth guard ───────────────────────────────────────

  test('throws UnauthorizedError when no session/user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      organizationId: ORG_ID,
      _params: { duesConfigId: 'cfg-1' },
      _body: {},
    });
    await expect(updateDuesConfig(ctx as any)).rejects.toThrow();
  });

  // ─── Path A: legacy dues_config row found by id ───────

  test('Path A: legacy row found → updateOneById called with mapped fields, returns 200 + body', async () => {
    let updateId: string | undefined;
    let updatePatch: Record<string, any> | undefined;

    stubRepo(DuesConfigRepository, {
      findOneById: async () => ({ ...fakeLegacyConfig }),
      updateOneById: async (id: string, patch: Record<string, any>) => {
        updateId = id;
        updatePatch = patch;
        return { ...fakeLegacyConfig, ...patch };
      },
    });
    // DuesRepository must NOT be touched on Path A.
    let duesGetConfigCalled = false;
    let duesUpsertCalled = false;
    stubRepo(DuesRepository, {
      getConfig: async () => { duesGetConfigCalled = true; return undefined; },
      upsertConfig: async () => { duesUpsertCalled = true; return { ...fakeOrgConfig }; },
    });

    const body = { annualAmount: 7500, currency: 'USD', billingFrequency: 'monthly', gracePeriodDays: 45 };
    const ctx = makeCtx({
      organizationId: ORG_ID,
      _params: { duesConfigId: 'cfg-1' },
      _body: body,
    });

    const res: any = await updateDuesConfig(ctx as any);
    expect(res.status).toBe(200);
    // updateOneById called with the path id and the PATCH body forwarded through.
    expect(updateId).toBe('cfg-1');
    expect(updatePatch).toEqual(body);
    // Returned body reflects the persisted (merged) row.
    expect(res.body.annualAmount).toBe(7500);
    expect(res.body.currency).toBe('USD');
    // Path A never falls through to the org-level repo.
    expect(duesGetConfigCalled).toBe(false);
    expect(duesUpsertCalled).toBe(false);
    // Audit dynamic fields set.
    expect(ctx.get('auditResourceId')).toBe('cfg-1');
    expect(ctx.get('auditDescription')).toBe('Dues config updated');
  });

  test('Path A: cross-org guard — legacy row from a different org → ForbiddenError (403)', async () => {
    let updateCalled = false;
    stubRepo(DuesConfigRepository, {
      // Row belongs to org-2 but the caller is org-1.
      findOneById: async () => ({ ...fakeLegacyConfig, organizationId: 'org-2' }),
      updateOneById: async () => { updateCalled = true; return { ...fakeLegacyConfig }; },
    });

    const ctx = makeCtx({
      organizationId: ORG_ID,
      _params: { duesConfigId: 'cfg-1' },
      _body: { annualAmount: 9999 },
    });

    await expect(updateDuesConfig(ctx as any)).rejects.toMatchObject({ statusCode: 403 });
    // Guard fires before any write.
    expect(updateCalled).toBe(false);
  });

  // ─── Path B: org-level dues_org_config fallback ───────

  test('Path B: no legacy row, path id == orgId → resolves org config + upsertConfig with merged fields, returns 200', async () => {
    let upsertOrgId: string | undefined;
    let upsertData: Record<string, any> | undefined;

    stubRepo(DuesConfigRepository, {
      // No legacy dues_config row for this id → fall through to Path B.
      findOneById: async () => null,
    });
    stubRepo(DuesRepository, {
      getConfig: async () => ({ ...fakeOrgConfig }),
      upsertConfig: async (orgId: string, data: Record<string, any>) => {
        upsertOrgId = orgId;
        upsertData = data;
        return { ...fakeOrgConfig, ...data };
      },
    });

    // The form passes the ORG id as the path param.
    const body = { annualAmount: 8000, currency: 'EUR', billingFrequency: 'quarterly', gracePeriodDays: 60 };
    const ctx = makeCtx({
      organizationId: ORG_ID,
      _params: { duesConfigId: ORG_ID },
      _body: body,
    });

    const res: any = await updateDuesConfig(ctx as any);
    expect(res.status).toBe(200);
    // upsert targets this org.
    expect(upsertOrgId).toBe(ORG_ID);
    // annualAmount (TypeSpec) maps to defaultAmount column; other PATCH fields merged through.
    expect(upsertData).toMatchObject({
      defaultAmount: 8000,
      currency: 'EUR',
      billingFrequency: 'quarterly',
      gracePeriodDays: 60,
      // dueDate fields are carried over from the current row (not in PATCH body).
      dueDateMonth: fakeOrgConfig.dueDateMonth,
      dueDateDay: fakeOrgConfig.dueDateDay,
    });
    // Response echoes the TypeSpec field name annualAmount mirrored from defaultAmount.
    expect(res.body.annualAmount).toBe(8000);
    expect(res.body.defaultAmount).toBe(8000);
    // Audit fields set from the saved row id.
    expect(ctx.get('auditResourceId')).toBe(fakeOrgConfig.id);
    expect(ctx.get('auditDescription')).toBe('Dues config updated');
  });

  test('Path B: partial PATCH merges only provided fields onto the current org config', async () => {
    let upsertData: Record<string, any> | undefined;

    stubRepo(DuesConfigRepository, { findOneById: async () => null });
    stubRepo(DuesRepository, {
      getConfig: async () => ({ ...fakeOrgConfig }),
      upsertConfig: async (_orgId: string, data: Record<string, any>) => {
        upsertData = data;
        return { ...fakeOrgConfig, ...data };
      },
    });

    // Only currency provided — everything else falls back to the current row.
    const ctx = makeCtx({
      organizationId: ORG_ID,
      _params: { duesConfigId: ORG_ID },
      _body: { currency: 'SGD' },
    });

    const res: any = await updateDuesConfig(ctx as any);
    expect(res.status).toBe(200);
    expect(upsertData).toMatchObject({
      currency: 'SGD',
      defaultAmount: fakeOrgConfig.defaultAmount,
      billingFrequency: fakeOrgConfig.billingFrequency,
      gracePeriodDays: fakeOrgConfig.gracePeriodDays,
    });
  });

  test('Path B: NotFoundError when no current org config exists', async () => {
    let upsertCalled = false;
    stubRepo(DuesConfigRepository, { findOneById: async () => null });
    stubRepo(DuesRepository, {
      getConfig: async () => undefined,
      upsertConfig: async () => { upsertCalled = true; return { ...fakeOrgConfig }; },
    });

    const ctx = makeCtx({
      organizationId: ORG_ID,
      _params: { duesConfigId: ORG_ID },
      _body: { annualAmount: 1000 },
    });

    await expect(updateDuesConfig(ctx as any)).rejects.toMatchObject({ statusCode: 404 });
    expect(upsertCalled).toBe(false);
  });

  test('Path B: path id is neither a legacy config id nor this org id → ForbiddenError (403)', async () => {
    let getConfigCalled = false;
    stubRepo(DuesConfigRepository, { findOneById: async () => null });
    stubRepo(DuesRepository, {
      getConfig: async () => { getConfigCalled = true; return { ...fakeOrgConfig }; },
      upsertConfig: async () => ({ ...fakeOrgConfig }),
    });

    const ctx = makeCtx({
      organizationId: ORG_ID,
      // path id != orgId and not a known dues_config id.
      _params: { duesConfigId: 'some-other-id' },
      _body: { annualAmount: 1000 },
    });

    await expect(updateDuesConfig(ctx as any)).rejects.toMatchObject({ statusCode: 403 });
    // Guard fires before resolving / writing the org config.
    expect(getConfigCalled).toBe(false);
  });
});
