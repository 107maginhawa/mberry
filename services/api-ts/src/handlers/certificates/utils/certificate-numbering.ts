import { eq, and, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { orgCertificateSeq } from '../repos/certificates.schema';

export async function getNextCertificateNumber(db: DatabaseInstance, organizationId: string, orgCode: string, year?: number): Promise<{ certificateNumber: string; seq: number }> {
  const currentYear = year ?? new Date().getFullYear();
  const existing = await db.execute(sql`SELECT id, last_seq FROM org_certificate_seq WHERE organization_id = ${organizationId} AND year = ${currentYear} FOR UPDATE`);
  // node-postgres returns { rows }, postgres-js returns the array directly.
  // structural: driver-shape varies — narrowed to a uniform array shape below.
  const rawRows = existing as unknown as { rows?: Array<{ last_seq: unknown }> } | Array<{ last_seq: unknown }>;
  const rows: Array<{ last_seq: unknown }> = Array.isArray(rawRows) ? rawRows : (rawRows.rows ?? []);
  let nextSeq: number;
  if (rows.length > 0) { nextSeq = Number(rows[0]!.last_seq) + 1; await db.update(orgCertificateSeq).set({ lastSeq: nextSeq, updatedAt: new Date() }).where(and(eq(orgCertificateSeq.organizationId, organizationId), eq(orgCertificateSeq.year, currentYear))); }
  else { nextSeq = 1; await db.insert(orgCertificateSeq).values({ organizationId, year: currentYear, lastSeq: 1, orgCode }); }
  return { certificateNumber: `${orgCode}-${currentYear}-${String(nextSeq).padStart(4, '0')}`, seq: nextSeq };
}

/**
 * Reserve a contiguous range of certificate sequence numbers in one query.
 * Used by bulkIssueCertificates to avoid N+1 getNextCertificateNumber calls.
 */
export async function reserveCertificateRange(
  db: DatabaseInstance,
  organizationId: string,
  orgCode: string,
  count: number,
  year?: number,
): Promise<{ startSeq: number; year: number; orgCode: string }> {
  const currentYear = year ?? new Date().getFullYear();
  const existing = await db.execute(
    sql`SELECT id, last_seq FROM org_certificate_seq WHERE organization_id = ${organizationId} AND year = ${currentYear} FOR UPDATE`
  );
  // node-postgres returns { rows }, postgres-js returns the array directly.
  // structural: driver-shape varies — narrowed to a uniform array shape below.
  const rawRows = existing as unknown as { rows?: Array<{ last_seq: unknown }> } | Array<{ last_seq: unknown }>;
  const rows: Array<{ last_seq: unknown }> = Array.isArray(rawRows) ? rawRows : (rawRows.rows ?? []);

  let startSeq: number;
  if (rows.length > 0) {
    startSeq = Number(rows[0]!.last_seq) + 1;
    await db.update(orgCertificateSeq)
      .set({ lastSeq: startSeq + count - 1, updatedAt: new Date() })
      .where(and(eq(orgCertificateSeq.organizationId, organizationId), eq(orgCertificateSeq.year, currentYear)));
  } else {
    startSeq = 1;
    await db.insert(orgCertificateSeq).values({ organizationId, year: currentYear, lastSeq: count, orgCode });
  }

  return { startSeq, year: currentYear, orgCode };
}
