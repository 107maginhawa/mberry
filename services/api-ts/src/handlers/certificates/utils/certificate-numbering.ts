import { eq, and, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { orgCertificateSeq } from '../repos/certificates.schema';

export async function getNextCertificateNumber(db: DatabaseInstance, organizationId: string, orgCode: string, year?: number): Promise<{ certificateNumber: string; seq: number }> {
  const currentYear = year ?? new Date().getFullYear();
  const existing = await db.execute(sql`SELECT id, last_seq FROM org_certificate_seq WHERE organization_id = ${organizationId} AND year = ${currentYear} FOR UPDATE`);
  const rows = (existing as any).rows ?? existing;
  let nextSeq: number;
  if (rows.length > 0) { nextSeq = Number(rows[0].last_seq) + 1; await db.update(orgCertificateSeq).set({ lastSeq: nextSeq, updatedAt: new Date() }).where(and(eq(orgCertificateSeq.organizationId, organizationId), eq(orgCertificateSeq.year, currentYear))); }
  else { nextSeq = 1; await db.insert(orgCertificateSeq).values({ organizationId, year: currentYear, lastSeq: 1, orgCode }); }
  return { certificateNumber: `${orgCode}-${currentYear}-${String(nextSeq).padStart(4, '0')}`, seq: nextSeq };
}
