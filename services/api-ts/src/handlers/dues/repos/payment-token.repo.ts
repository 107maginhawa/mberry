/**
 * Repository for payment token CRUD operations.
 * Follows the same pattern as InviteRepository.
 */

import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
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

  /** Look up a token by primary-key id (used by officer revoke for org-scope check). */
  async findById(id: string): Promise<PaymentToken | undefined> {
    const [row] = await this.db
      .select()
      .from(paymentTokens)
      .where(eq(paymentTokens.id, id))
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

  /**
   * Single-winner checkout mutex. Atomically claims the token for a checkout
   * attempt iff it is active (unused, unrevoked, unexpired), has no session yet,
   * and is unclaimed OR its claim is stale (>2 min old with no session). Returns
   * the claimed row, or null if not claimable. The whole guard lives in one
   * UPDATE…WHERE…RETURNING so two concurrent claims serialize on the row lock and
   * exactly one wins.
   */
  async claimForCheckout(id: string, idempotencyKey: string): Promise<PaymentToken | null> {
    const staleCutoff = sql`now() - interval '2 minutes'`;
    const [row] = await this.db
      .update(paymentTokens)
      .set({ checkoutStartedAt: new Date(), idempotencyKey })
      .where(and(
        eq(paymentTokens.id, id),
        isNull(paymentTokens.usedAt),
        isNull(paymentTokens.revokedAt),
        gt(paymentTokens.expiresAt, sql`now()`),
        isNull(paymentTokens.paymongoSessionId),
        or(isNull(paymentTokens.checkoutStartedAt), lt(paymentTokens.checkoutStartedAt, staleCutoff)),
      ))
      .returning();
    return row ?? null;
  }

  /** Attach the PayMongo checkout session id to the token's active attempt. */
  async attachSession(id: string, sessionId: string): Promise<void> {
    await this.db.update(paymentTokens).set({ paymongoSessionId: sessionId }).where(eq(paymentTokens.id, id));
  }

  /**
   * Release an expired checkout session so the token can be reclaimed. No-op
   * unless the currently-attached session matches expiredSessionId (guards against
   * clobbering a session a newer attempt may have attached).
   */
  async releaseExpiredSession(id: string, expiredSessionId: string): Promise<void> {
    await this.db
      .update(paymentTokens)
      .set({ paymongoSessionId: null, checkoutStartedAt: null })
      .where(and(eq(paymentTokens.id, id), eq(paymentTokens.paymongoSessionId, expiredSessionId)));
  }

  /** Clear a checkout claim (lease) iff no session was attached to it. */
  async clearCheckoutClaim(id: string): Promise<void> {
    await this.db
      .update(paymentTokens)
      .set({ checkoutStartedAt: null })
      .where(and(eq(paymentTokens.id, id), isNull(paymentTokens.paymongoSessionId)));
  }

  /** Compare-and-set used_at: true iff THIS call stamped it (i.e. it was unused). */
  async markUsedCas(id: string): Promise<boolean> {
    const [row] = await this.db
      .update(paymentTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(paymentTokens.id, id), isNull(paymentTokens.usedAt)))
      .returning({ id: paymentTokens.id });
    return !!row;
  }

  /** Officer revoke: stamps revoked_at iff the token is still unused and unrevoked. */
  async revoke(id: string): Promise<boolean> {
    const [row] = await this.db
      .update(paymentTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(paymentTokens.id, id), isNull(paymentTokens.usedAt), isNull(paymentTokens.revokedAt)))
      .returning({ id: paymentTokens.id });
    return !!row;
  }
}
