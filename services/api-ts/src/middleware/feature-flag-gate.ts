/**
 * Feature-flag enforcement gate (AHA FIX-009 / G2).
 *
 * Today the DB `feature_flag` table is WRITTEN (setFeatureFlag) but never
 * ENFORCED — PA-5 / M3-R9 is a no-op. This middleware is the enforcement
 * point. It is OPT-IN and keyed by module name: mount it on the router of a
 * module whose access should be gated by the product feature-flag system.
 *
 * Behavior:
 * - Reads the org id from context (`organizationId`, set by org-context
 *   middleware). If absent, the gate cannot scope a decision → fail-open.
 * - Resolves the relevant flag rows for that org + module via an injected
 *   port (no direct handler import).
 * - Applies precedence (see resolveFlagDecision): org override > org default
 *   > association default > tier default.
 * - If the resolved decision is `false` (explicitly disabled) → 403 with
 *   `{ error, moduleName }`. Otherwise (enabled OR no flag row) → pass.
 *
 * Fail-open / fail-closed contract:
 * - FAIL-OPEN when no flag row exists for the module (a module with no flag
 *   is simply not gated) and when org context is missing.
 * - FAIL-CLOSED only when a flag row explicitly resolves to disabled.
 *
 * Q2 decision applied: opt-in API middleware keyed by module name. This is
 * the API-side half; frontend module visibility is the complementary half
 * (out of scope for this middleware).
 *
 * Rollout note: this gate is wired onto ONE representative module router as
 * proof-of-enforcement. Rolling it onto every module router is a later staged
 * step — opt in per-router by adding `featureFlagGate('<module>')` to that
 * router's middleware chain.
 *
 * NOTE: this enforces the product DB `feature_flag` table, NOT the env-var
 * `FF_*` system in core/feature-flags.ts. Do not conflate the two.
 */

import { createMiddleware } from 'hono/factory';
import type { Variables } from '@/types/app';
import { getFeatureFlagPort, type FeatureFlagPort } from '@/core/ports';
import type { FeatureFlagRow } from '@/core/ports/feature-flag.port';

/** Re-export so consumers/tests can build fixtures from one import. */
export type FeatureFlagRecord = FeatureFlagRow;

export interface FeatureFlagGateDeps {
  /**
   * Optional override for the feature-flag port. When omitted, the gate
   * resolves the production adapter from `core/ports`.
   */
  port?: FeatureFlagPort;
}

/**
 * Precedence-ordered priority for a flag row. Higher wins.
 *
 *   org override  (4) — an explicit per-org override beats everything
 *   org default   (3)
 *   association   (2)
 *   tier default  (1)
 *
 * Unknown target types sort lowest (0) so they never silently override.
 */
function flagPriority(row: FeatureFlagRow): number {
  if (row.targetType === 'org') return row.isOverride ? 4 : 3;
  if (row.targetType === 'association') return 2;
  if (row.targetType === 'tier') return 1;
  return 0;
}

/**
 * Resolve the effective enabled/disabled decision from a set of flag rows
 * (all for the same module). Returns:
 * - `undefined` when there are no rows → caller treats as fail-open.
 * - `true` / `false` from the highest-precedence row otherwise.
 *
 * Pure function — unit-tested in isolation from Hono/DB.
 */
export function resolveFlagDecision(rows: FeatureFlagRow[]): boolean | undefined {
  if (rows.length === 0) return undefined;

  let winner = rows[0]!;
  let best = flagPriority(winner);
  for (const row of rows.slice(1)) {
    const p = flagPriority(row);
    if (p > best) {
      best = p;
      winner = row;
    }
  }
  return winner.enabled;
}

/**
 * Build an opt-in enforcement gate for `moduleName`.
 *
 * Mount on a module router AFTER auth + org-context middleware so
 * `ctx.var.organizationId` is populated.
 */
export function featureFlagGate(moduleName: string, deps: FeatureFlagGateDeps = {}) {
  return createMiddleware<{ Variables: Variables }>(async (ctx, next): Promise<void | Response> => {
    const orgId = ctx.get('organizationId');

    // No org context → the gate cannot scope a decision. Fail-open.
    if (!orgId) {
      await next();
      return;
    }

    const db = ctx.get('database');
    const port = deps.port ?? (await getFeatureFlagPort(db));
    const rows = await port.findEnforcementFlags(orgId, moduleName);
    const decision = resolveFlagDecision(rows);

    // Explicitly disabled → gated. Enabled or no flag row → pass (fail-open).
    if (decision === false) {
      return ctx.json(
        {
          error: `The "${moduleName}" module is not enabled for this organization.`,
          moduleName,
        },
        403,
      );
    }

    await next();
  });
}
