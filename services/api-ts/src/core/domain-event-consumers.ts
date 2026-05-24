/**
 * Domain Event Consumers
 *
 * Registers all cross-module event handlers. Called once during app startup.
 * Each consumer is a thin glue layer — heavy logic stays in repos/services.
 */

import { domainEvents } from './domain-events';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import type { DatabaseInstance } from './database';
import type { Logger } from '@/types/logger';

/**
 * Register all domain event consumers.
 * Call this once during app initialization (in initializeApp).
 */
export function registerDomainEventConsumers(
  db: DatabaseInstance,
  logger: Logger,
): void {
  domainEvents.setLogger(logger);

  // -----------------------------------------------------------------------
  // dues.payment.recorded → update membership duesExpiryDate
  // -----------------------------------------------------------------------
  domainEvents.on('dues.payment.recorded', async (payload) => {
    if (!payload.newExpiryDate) {
      logger.debug(
        { paymentId: payload.paymentId },
        'Payment recorded without new expiry date — skipping membership update',
      );
      return;
    }

    const memberRepo = new MembershipRepository(db, logger);
    const membership = await memberRepo.findByPersonAndOrg(
      payload.personId,
      payload.organizationId,
    );

    if (!membership) {
      logger.warn(
        { personId: payload.personId, organizationId: payload.organizationId },
        'dues.payment.recorded: no membership found for person+org — cannot update expiry',
      );
      return;
    }

    await memberRepo.updateOneById(membership.id, {
      duesExpiryDate: payload.newExpiryDate,
    } as any);

    logger.info(
      {
        membershipId: membership.id,
        newExpiryDate: payload.newExpiryDate,
        paymentId: payload.paymentId,
      },
      'Membership duesExpiryDate updated via domain event',
    );
  });
}
