/**
 * Trust signal enrichment for directory profiles
 *
 * Batch-loads trust data (membership, credentials, CE credits, licenses)
 * for a set of person IDs, then merges with privacy settings to produce
 * privacy-gated trust signals per profile.
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { memberships } from '../repos/membership.schema';
import { digitalCredentials } from '../repos/credentials.schema';
import { creditEntries } from '../repos/credits.schema';
import { professionalLicenses } from '../repos/credentials.schema';
import { personPrivacySettings } from '@/handlers/person/repos/privacy-settings.schema';

export interface TrustSignals {
  duesStatus: 'current' | null;
  credentialCount: number;
  ceCreditsEarned: number;
  hasVerifiedLicense: boolean;
}

/**
 * Batch-load trust signals for a set of person IDs within an org.
 * Returns a map of personId → privacy-gated trust signals.
 */
export async function batchLoadTrustSignals(
  db: DatabaseInstance,
  personIds: string[],
  organizationId: string,
  isAdmin = false,
): Promise<Map<string, TrustSignals>> {
  if (personIds.length === 0) return new Map();

  const [membershipRows, credentialCounts, ceCreditSums, licenseRows, privacyRows] = await Promise.all([
    db.select({ personId: memberships.personId, status: memberships.status })
      .from(memberships)
      .where(and(eq(memberships.organizationId, organizationId), inArray(memberships.personId, personIds))),

    db.select({ personId: digitalCredentials.personId, count: sql<number>`count(*)::int` })
      .from(digitalCredentials)
      .where(and(eq(digitalCredentials.organizationId, organizationId), inArray(digitalCredentials.personId, personIds), eq(digitalCredentials.status, 'active')))
      .groupBy(digitalCredentials.personId),

    db.select({ personId: creditEntries.personId, total: sql<number>`coalesce(sum(${creditEntries.creditAmount}), 0)::int` })
      .from(creditEntries)
      .where(and(eq(creditEntries.organizationId, organizationId), inArray(creditEntries.personId, personIds)))
      .groupBy(creditEntries.personId),

    db.select({ personId: professionalLicenses.personId })
      .from(professionalLicenses)
      .where(and(eq(professionalLicenses.organizationId, organizationId), inArray(professionalLicenses.personId, personIds), eq(professionalLicenses.status, 'active'), sql`${professionalLicenses.verifiedAt} IS NOT NULL`)),

    db.select().from(personPrivacySettings)
      .where(and(eq(personPrivacySettings.organizationId, organizationId), inArray(personPrivacySettings.personId, personIds)))
      .limit(1000),
  ]);

  const membershipMap = new Map(membershipRows.map(r => [r.personId, r.status]));
  const credCountMap = new Map(credentialCounts.map(r => [r.personId, r.count]));
  const ceMap = new Map(ceCreditSums.map(r => [r.personId, r.total]));
  const licenseSet = new Set(licenseRows.map(r => r.personId));
  const privacyMap = new Map(privacyRows.map(r => [r.personId, r]));

  const result = new Map<string, TrustSignals>();

  for (const personId of personIds) {
    const privacy = privacyMap.get(personId);
    const status = membershipMap.get(personId);
    const isPositiveDues = status === 'active' || status === 'gracePeriod';
    const showDues = isAdmin || (privacy?.duesStatusVisible ?? false);
    const showCredentials = isAdmin || (privacy?.credentialsVisible ?? false);
    const showCe = isAdmin || (privacy?.ceComplianceVisible ?? false);

    result.set(personId, {
      duesStatus: showDues && isPositiveDues ? 'current' : null,
      credentialCount: showCredentials ? (credCountMap.get(personId) ?? 0) : 0,
      ceCreditsEarned: showCe ? (ceMap.get(personId) ?? 0) : 0,
      hasVerifiedLicense: showCredentials ? licenseSet.has(personId) : false,
    });
  }

  return result;
}
