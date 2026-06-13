/**
 * License Renewal Alert Processor (FIX-007 / G7)
 *
 * Runs daily. Scans active professional licenses approaching expiry and
 * inserts `license_renewal_alert` rows so the "nudge before license expiry"
 * credential feature has a producer (previously only the seed wrote the
 * table, so it silently did nothing in production). The read/ack handlers
 * (listLicenseRenewalAlerts / acknowledgeLicenseRenewalAlert) already exist.
 *
 * Idempotent — one alert per (licenseId, window). Mirrors the
 * dues.reminderProcessor scan/insert + dedupe-via-existing-rows pattern.
 *
 * Q7 (whether alerts surface in a UI) only affects presentation; the alert
 * rows produced here are the unblocked unit of work.
 */

import type { DatabaseInstance } from '@/core/database';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import {
  professionalLicenses,
  licenseRenewalAlerts,
} from '@/handlers/association:member/repos/credentials.schema';

/** Days-before-expiry thresholds, ascending. A license is alerted once per window it enters. */
const ALERT_WINDOWS = [7, 14, 30, 60, 90] as const;

interface LicenseRenewalContext {
  db: DatabaseInstance;
  logger?: any;
  /** Injectable "today" for deterministic tests; defaults to now. */
  now?: Date;
}

export interface LicenseRenewalResult {
  processed: number;
  created: number;
  skipped: number;
  errors: number;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function daysUntil(today: Date, expiration: string): number {
  const exp = new Date(`${expiration}T00:00:00.000Z`).getTime();
  const start = new Date(`${toDateStr(today)}T00:00:00.000Z`).getTime();
  return Math.round((exp - start) / 86_400_000);
}

/**
 * Generate renewal alerts for all licenses nearing expiry.
 * Called by the job scheduler (daily).
 */
export async function processLicenseRenewalAlerts(
  ctx: LicenseRenewalContext,
): Promise<LicenseRenewalResult> {
  const { db, logger } = ctx;
  const today = ctx.now ?? new Date();
  const result: LicenseRenewalResult = { processed: 0, created: 0, skipped: 0, errors: 0 };
  const maxWindow = Math.max(...ALERT_WINDOWS);

  try {
    const todayStr = toDateStr(today);
    const horizon = toDateStr(addDays(today, maxWindow));

    // Active licenses expiring within the largest alert window.
    const expiring = await db
      .select({
        id: professionalLicenses.id,
        organizationId: professionalLicenses.organizationId,
        personId: professionalLicenses.personId,
        expirationDate: professionalLicenses.expirationDate,
      })
      .from(professionalLicenses)
      .where(
        and(
          eq(professionalLicenses.status, 'active'),
          gte(professionalLicenses.expirationDate, todayStr),
          lte(professionalLicenses.expirationDate, horizon),
        ),
      );

    if (expiring.length === 0) return result;

    // Existing alerts for these licenses → idempotency key (licenseId, window).
    const licenseIds = expiring.map((l) => l.id);
    const existing = await db
      .select({
        licenseId: licenseRenewalAlerts.licenseId,
        daysUntilExpiry: licenseRenewalAlerts.daysUntilExpiry,
      })
      .from(licenseRenewalAlerts)
      .where(inArray(licenseRenewalAlerts.licenseId, licenseIds));
    const sent = new Set(existing.map((a) => `${a.licenseId}:${a.daysUntilExpiry}`));

    for (const lic of expiring) {
      result.processed++;

      const days = daysUntil(today, lic.expirationDate as unknown as string);
      // Smallest window the license now falls within (e.g. 30 days out → 30-day alert).
      const window = ALERT_WINDOWS.find((w) => days <= w);
      if (window == null) {
        result.skipped++;
        continue;
      }

      const key = `${lic.id}:${window}`;
      if (sent.has(key)) {
        result.skipped++;
        continue;
      }

      try {
        await db.insert(licenseRenewalAlerts).values({
          organizationId: lic.organizationId,
          licenseId: lic.id,
          personId: lic.personId,
          alertDate: todayStr,
          daysUntilExpiry: window,
          status: 'pending',
        });
        sent.add(key);
        result.created++;
      } catch (insErr) {
        result.errors++;
        logger?.error({ msg: 'Failed to insert license renewal alert', err: insErr, licenseId: lic.id });
      }
    }
  } catch (err) {
    logger?.error({ msg: 'License renewal alert processor failed', err });
    throw err;
  }

  return result;
}
