import { sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { orgCertificateSeq } from '../repos/certificates.schema';

/**
 * Allocate the next certificate sequence number for an (organization, year).
 *
 * Uses an atomic ON CONFLICT upsert against the unique
 * `org_cert_seq_org_year_unique` constraint on (organization_id, year). This is
 * gap-free under concurrency: the very first issuance of a (org, year) inserts
 * `last_seq = 1`; every concurrent or subsequent issuance bumps `last_seq` by 1
 * via the DO UPDATE branch. There is no read-then-write window and no
 * first-of-year gap (the old `SELECT ... FOR UPDATE` could not lock a row that
 * did not yet exist, so two first-issuances could both miss it and race).
 *
 * Format preserved: `${orgCode}-${year}-${4-digit-zero-padded-seq}`.
 */
export async function getNextCertificateNumber(db: DatabaseInstance, organizationId: string, orgCode: string, year?: number): Promise<{ certificateNumber: string; seq: number }> {
  const currentYear = year ?? new Date().getFullYear();
  const [row] = await db
    .insert(orgCertificateSeq)
    .values({ organizationId, year: currentYear, lastSeq: 1, orgCode })
    .onConflictDoUpdate({
      target: [orgCertificateSeq.organizationId, orgCertificateSeq.year],
      set: { lastSeq: sql`${orgCertificateSeq.lastSeq} + 1`, updatedAt: new Date() },
    })
    .returning({ lastSeq: orgCertificateSeq.lastSeq });
  const nextSeq = Number(row!.lastSeq);
  return { certificateNumber: `${orgCode}-${currentYear}-${String(nextSeq).padStart(4, '0')}`, seq: nextSeq };
}

/**
 * Reserve a contiguous range of certificate sequence numbers in one atomic query.
 * Used by bulkIssueCertificates to avoid N+1 getNextCertificateNumber calls.
 *
 * Same ON CONFLICT strategy as getNextCertificateNumber, but bumps `last_seq` by
 * `count` in a single statement and derives the start of the reserved block from
 * the returned (post-increment) value. Gap-free and race-free: the first
 * issuance inserts `last_seq = count` (start = 1); concurrent batches each get a
 * disjoint, contiguous block.
 */
export async function reserveCertificateRange(
  db: DatabaseInstance,
  organizationId: string,
  orgCode: string,
  count: number,
  year?: number,
): Promise<{ startSeq: number; year: number; orgCode: string }> {
  const currentYear = year ?? new Date().getFullYear();
  const [row] = await db
    .insert(orgCertificateSeq)
    .values({ organizationId, year: currentYear, lastSeq: count, orgCode })
    .onConflictDoUpdate({
      target: [orgCertificateSeq.organizationId, orgCertificateSeq.year],
      set: { lastSeq: sql`${orgCertificateSeq.lastSeq} + ${count}`, updatedAt: new Date() },
    })
    .returning({ lastSeq: orgCertificateSeq.lastSeq });
  const endSeq = Number(row!.lastSeq);
  const startSeq = endSeq - count + 1;
  return { startSeq, year: currentYear, orgCode };
}
