/**
 * Repository for payment token CRUD operations.
 * Follows the same pattern as InviteRepository.
 */

import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { paymentTokens, type NewPaymentToken, type PaymentToken } from './payment-token.schema';
import { persons } from '../../person/repos/person.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';

export class PaymentTokenRepository {
  constructor(
    private db: NodePgDatabase,
  ) {}

  async create(data: NewPaymentToken): Promise<PaymentToken> {
    const [row] = await this.db
      .insert(paymentTokens)
      .values(data)
      .returning();
    return row!;
  }

  async findByTokenHash(hash: string): Promise<PaymentToken | undefined> {
    const [row] = await this.db
      .select()
      .from(paymentTokens)
      .where(eq(paymentTokens.tokenHash, hash))
      .limit(1);
    return row;
  }

  /**
   * Find token by hash with joined person and org names for validation response.
   */
  async findByTokenHashWithDetails(hash: string): Promise<{
    token: PaymentToken;
    memberName: string;
    orgName: string;
  } | undefined> {
    const rows = await this.db
      .select({
        token: paymentTokens,
        firstName: persons.firstName,
        lastName: persons.lastName,
        orgName: organizations.name,
      })
      .from(paymentTokens)
      .innerJoin(persons, eq(paymentTokens.personId, persons.id))
      .innerJoin(organizations, eq(paymentTokens.organizationId, organizations.id))
      .where(eq(paymentTokens.tokenHash, hash))
      .limit(1);

    const row = rows[0];
    if (!row) return undefined;

    return {
      token: row.token,
      memberName: [row.firstName, row.lastName].filter(Boolean).join(' '),
      orgName: row.orgName,
    };
  }

  async markUsed(id: string): Promise<PaymentToken | undefined> {
    const [row] = await this.db
      .update(paymentTokens)
      .set({
        usedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentTokens.id, id))
      .returning();
    return row;
  }
}
