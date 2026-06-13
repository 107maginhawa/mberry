/**
 * FeatureFlagPort — minimal slice of feature-flag behavior consumed by the
 * feature-flag enforcement gate (AHA FIX-009 / G2).
 *
 * The gate (middleware/feature-flag-gate.ts) reads the DB `feature_flag`
 * table to decide whether a module is enabled for the caller's org. It must
 * not import handler-owned repos directly, so the lookup goes through this
 * port (adapter in handlers/platformadmin/repos/platform-admin.repo.ts,
 * wired in core/ports/index.ts).
 *
 * NOTE: this is the product DB feature-flag system (the `feature_flag` table
 * written by setFeatureFlag), NOT the env-var `FF_*` system in
 * core/feature-flags.ts — they are intentionally separate.
 */

export interface FeatureFlagRow {
  targetType: string; // 'org' | 'association' | 'tier'
  targetId: string;
  moduleName: string;
  enabled: boolean;
  isOverride: boolean;
}

export interface FeatureFlagPort {
  /**
   * Return every flag row that could decide enforcement of `moduleName` for
   * the given org — i.e. the org's own rows plus any association/tier rows
   * the adapter can resolve for that org. The gate applies precedence over
   * the returned set; the port only fetches.
   */
  findEnforcementFlags(orgId: string, moduleName: string): Promise<FeatureFlagRow[]>;
}
