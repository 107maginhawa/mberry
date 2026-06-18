import { eq, desc, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { certificates, type Certificate, type NewCertificate } from './certificates.schema';

export class CertificatesRepository {
  constructor(private db: DatabaseInstance) {}

  async listByPerson(personId: string, pagination?: { limit: number; offset: number }) {
    const query = this.db.select().from(certificates)
      .where(eq(certificates.personId, personId))
      .orderBy(desc(certificates.issuedAt));
    if (pagination) {
      return query.limit(pagination.limit).offset(pagination.offset);
    }
    return query.limit(100);
  }

  async get(id: string): Promise<Certificate | undefined> {
    const [cert] = await this.db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
    return cert;
  }

  async getMany(ids: string[]): Promise<Certificate[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(certificates).where(inArray(certificates.id, ids)).limit(200);
  }

  async create(data: NewCertificate): Promise<Certificate> {
    const [result] = await this.db.insert(certificates).values(data).returning();
    return result!;
  }
}
