/**
 * Tests for processLicenseRenewalAlerts (FIX-007 / G7).
 *
 * The producer for `license_renewal_alert` rows. Before this job existed the
 * table was only ever written by the seed, so the "nudge before license
 * expiry" credential feature silently did nothing in production.
 *
 * Mirrors the dues.reminderProcessor job test pattern: a stubbed db returns
 * the rows the processor scans, and inserts are captured for assertion.
 */

import { describe, test, expect, mock } from 'bun:test';
import { processLicenseRenewalAlerts } from './licenseRenewalProcessor';
import {
  professionalLicenses,
  licenseRenewalAlerts,
} from '@/handlers/association:member/repos/credentials.schema';

// Mock-Classification: APPROPRIATE — background job scan/insert glue layer

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}

/**
 * Stub db: the processor runs two selects (active licenses, then existing
 * alerts for those licenses) followed by per-row inserts. Branch the SELECT
 * result on the table reference; capture every insert.
 */
function makeDb(opts: { licenses: any[]; existingAlerts?: any[]; inserted: any[] }) {
  return {
    select: () => ({
      from: (table: any) => ({
        where: () =>
          Promise.resolve(
            table === professionalLicenses ? opts.licenses : (opts.existingAlerts ?? []),
          ),
      }),
    }),
    insert: (table: any) => ({
      values: async (v: any) => {
        opts.inserted.push({ table, values: v });
      },
    }),
  } as any;
}

// Fixed "today" so target windows are deterministic.
const NOW = new Date('2026-06-12T00:00:00.000Z');

describe('processLicenseRenewalAlerts', () => {
  test('inserts an idempotent renewal alert for a license expiring within a window', async () => {
    const inserted: any[] = [];
    // 2026-07-12 is exactly 30 days after 2026-06-12.
    const licenses = [
      { id: 'lic-1', organizationId: 'org-1', personId: 'p-1', expirationDate: '2026-07-12' },
    ];
    const db = makeDb({ licenses, existingAlerts: [], inserted });

    const res = await processLicenseRenewalAlerts({ db, logger: makeLogger(), now: NOW });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].table).toBe(licenseRenewalAlerts);
    expect(inserted[0].values).toMatchObject({
      organizationId: 'org-1',
      licenseId: 'lic-1',
      personId: 'p-1',
      daysUntilExpiry: 30,
      alertDate: '2026-06-12',
      status: 'pending',
    });
    expect(res.created).toBe(1);
  });

  test('is idempotent — re-running with an existing alert inserts no duplicate', async () => {
    const inserted: any[] = [];
    const licenses = [
      { id: 'lic-1', organizationId: 'org-1', personId: 'p-1', expirationDate: '2026-07-12' },
    ];
    // The 30-day alert for lic-1 already exists.
    const existingAlerts = [{ licenseId: 'lic-1', daysUntilExpiry: 30 }];
    const db = makeDb({ licenses, existingAlerts, inserted });

    const res = await processLicenseRenewalAlerts({ db, logger: makeLogger(), now: NOW });

    expect(inserted).toHaveLength(0);
    expect(res.created).toBe(0);
    expect(res.skipped).toBe(1);
  });

  test('does not alert for a license expiring beyond the largest window', async () => {
    const inserted: any[] = [];
    // ~365 days out — past the 90-day max window.
    const licenses = [
      { id: 'lic-2', organizationId: 'org-1', personId: 'p-2', expirationDate: '2027-06-12' },
    ];
    const db = makeDb({ licenses, existingAlerts: [], inserted });

    const res = await processLicenseRenewalAlerts({ db, logger: makeLogger(), now: NOW });

    expect(inserted).toHaveLength(0);
    expect(res.created).toBe(0);
  });
});
