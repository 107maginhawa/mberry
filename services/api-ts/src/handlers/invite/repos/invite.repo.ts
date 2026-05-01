/**
 * Repository for invitation token CRUD operations.
 */

import { eq, and, lt, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '@/types/logger';
import { invitationTokens, type NewInvitationToken, type InvitationToken } from './invite.schema';

export class InviteRepository {
  constructor(
    private db: NodePgDatabase,
    private logger?: Logger,
  ) {}

  async create(data: NewInvitationToken): Promise<InvitationToken> {
    const [row] = await this.db
      .insert(invitationTokens)
      .values(data)
      .returning();
    return row!;
  }

  async findByTokenHash(tokenHash: string): Promise<InvitationToken | undefined> {
    const [row] = await this.db
      .select()
      .from(invitationTokens)
      .where(eq(invitationTokens.tokenHash, tokenHash))
      .limit(1);
    return row;
  }

  async findPendingByEmail(email: string, orgId: string): Promise<InvitationToken | undefined> {
    const [row] = await this.db
      .select()
      .from(invitationTokens)
      .where(
        and(
          eq(invitationTokens.email, email.toLowerCase()),
          eq(invitationTokens.orgId, orgId),
          eq(invitationTokens.status, 'pending'),
          gt(invitationTokens.expiresAt, new Date()),
        )
      )
      .limit(1);
    return row;
  }

  async markClaimed(id: string): Promise<InvitationToken | undefined> {
    const [row] = await this.db
      .update(invitationTokens)
      .set({
        status: 'claimed',
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitationTokens.id, id))
      .returning();
    return row;
  }

  async markRevoked(id: string): Promise<InvitationToken | undefined> {
    const [row] = await this.db
      .update(invitationTokens)
      .set({
        status: 'revoked',
        updatedAt: new Date(),
      })
      .where(eq(invitationTokens.id, id))
      .returning();
    return row;
  }

  async updateForResend(id: string, newTokenHash: string, newExpiresAt: Date, resendCount: number): Promise<InvitationToken | undefined> {
    const [row] = await this.db
      .update(invitationTokens)
      .set({
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        metadata: {
          resendCount,
          lastResentAt: new Date().toISOString(),
        } satisfies import('./invite.schema').InviteMetadata,
        updatedAt: new Date(),
      })
      .where(eq(invitationTokens.id, id))
      .returning();
    return row;
  }

  async listByOrg(orgId: string, status?: string): Promise<InvitationToken[]> {
    const conditions = [eq(invitationTokens.orgId, orgId)];
    if (status) {
      conditions.push(eq(invitationTokens.status, status as typeof invitationTokens.status.enumValues[number]));
    }
    return this.db
      .select()
      .from(invitationTokens)
      .where(and(...conditions));
  }
}
