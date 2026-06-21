import type { ValidatedContext } from '@/types/app';
import type { DuesConfig } from '@/handlers/association:member/repos/dues.schema';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { UpdateDuesConfigBody, UpdateDuesConfigParams } from '@/generated/openapi/validators';
import { DuesConfigRepository } from '@/handlers/association:member/repos/dues.repo';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

/**
 * updateDuesConfig
 *
 * Path: PATCH /association/member/dues-configs/{duesConfigId}
 * OperationId: updateDuesConfig
 *
 * Resolution mirrors getDuesConfig: the frontend passes the ORG ID as the path
 * param (the dues config form is org-scoped, one config per org). We first try
 * the legacy `dues_config` table by id; if that misses, we fall back to the
 * org-level `dues_org_config` table (the table getDuesConfig reads from) and
 * upsert it by organizationId.
 *
 * This fallback is what makes officer edits to currency / billing frequency /
 * amount / grace period actually persist — previously the handler only looked in
 * `dues_config` by id (which never matches the org-id the form sends) and 404'd,
 * so every update was silently lost.
 */
export async function updateDuesConfig(
  ctx: ValidatedContext<UpdateDuesConfigBody, never, UpdateDuesConfigParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { duesConfigId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const orgId = ctx.get('organizationId');
  const repo = new DuesConfigRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(duesConfigId);

  // ── Path A: legacy dues_config row found by id ──────────────────────────
  if (existing) {
    // Cross-org tenant guard: findOneById is unscoped (by id only), so an officer
    // of org A must not be able to mutate org B's dues config by supplying its id.
    // Mirrors confirmPaymentProof / refundDuesPayment / updateDunningTemplate.
    if (existing.organizationId !== orgId) {
      throw new ForbiddenError('Dues config does not belong to this organization');
    }

    const updated = await repo.updateOneById(duesConfigId, body as Partial<DuesConfig>);

    ctx.set('auditResourceId', duesConfigId);
    ctx.set('auditDescription', 'Dues config updated');

    return ctx.json(updated, 200);
  }

  // ── Path B: org-level dues_org_config (the table the form reads) ─────────
  // The form passes orgId as duesConfigId. Resolve by organizationId and upsert.
  const targetOrgId = orgId ?? duesConfigId;
  if (orgId && duesConfigId !== orgId) {
    // The path id is neither a known dues_config id nor this org's id.
    throw new ForbiddenError('Dues config does not belong to this organization');
  }

  const duesRepo = new DuesRepository(db);
  const current = await duesRepo.getConfig(targetOrgId);
  if (!current) throw new NotFoundError('DuesConfig');

  // Merge only the provided PATCH fields onto the current row. `annualAmount`
  // (TypeSpec name) maps to the org-config `defaultAmount` column.
  const merged = {
    defaultAmount: body.annualAmount ?? current.defaultAmount,
    currency: body.currency ?? current.currency,
    billingFrequency: body.billingFrequency ?? current.billingFrequency,
    dueDateMonth: current.dueDateMonth,
    dueDateDay: current.dueDateDay,
    gracePeriodDays: body.gracePeriodDays ?? current.gracePeriodDays,
  };

  const saved = await duesRepo.upsertConfig(targetOrgId, merged);

  ctx.set('auditResourceId', saved.id);
  ctx.set('auditDescription', 'Dues config updated');

  // Echo TypeSpec field names so the SDK response transformer is happy.
  return ctx.json(
    { ...saved, annualAmount: saved.defaultAmount },
    200
  );
}
