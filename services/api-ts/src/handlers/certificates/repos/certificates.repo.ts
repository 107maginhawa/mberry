import { eq, and, desc, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { certificates, type Certificate, type NewCertificate } from './certificates.schema';

export class CertificatesRepository {
  constructor(private db: DatabaseInstance) {}

  async listByPerson(personId: string) {
    return this.db.select().from(certificates)
      .where(eq(certificates.personId, personId))
      .orderBy(desc(certificates.issuedAt));
  }

  async get(id: string): Promise<Certificate | undefined> {
    const [cert] = await this.db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
    return cert;
  }

  async create(data: NewCertificate): Promise<Certificate> {
    const [result] = await this.db.insert(certificates).values(data).returning();
    return result!;
  }

  async getNextCertificateNumber(orgId: string, year: number): Promise<string> {
    const pattern = `CERT-${year}-%`;
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(certificates)
      .where(and(eq(certificates.organizationId, orgId), sql`${certificates.certificateNumber} LIKE ${pattern}`));
    const seq = (result?.count ?? 0) + 1;
    return `CERT-${year}-${seq.toString().padStart(6, '0')}`;
  }
}
