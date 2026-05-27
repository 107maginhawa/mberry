/**
 * Tests for registerDomainEventConsumers
 *
 * The consumer registers a handler for dues.payment.recorded that
 * updates the membership duesExpiryDate when a payment includes a new expiry.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { DomainEventBus, domainEvents } from './domain-events';
import { registerDomainEventConsumers, type DomainEventMembershipRepo } from './domain-event-consumers';

// Mock-Classification: APPROPRIATE — cross-module domain event glue layer

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}

function makeMembershipRepo(overrides: Partial<DomainEventMembershipRepo> = {}): DomainEventMembershipRepo {
  return {
    findByPersonAndOrg: mock(async () => null),
    updateOneById: mock(async () => ({})),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerDomainEventConsumers', () => {
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    logger = makeLogger();
    domainEvents.reset();
  });

  test('registers handler for dues.payment.recorded', async () => {
    const mockFindByPersonAndOrg = mock(async () => null);
    const membershipRepo = makeMembershipRepo({ findByPersonAndOrg: mockFindByPersonAndOrg });

    registerDomainEventConsumers({ membershipRepo }, logger as any);

    await domainEvents.emit('dues.payment.recorded', {
      paymentId: 'pay-1',
      personId: 'person-1',
      organizationId: 'org-1',
      amount: 500,
      newExpiryDate: '2027-01-01',
    });

    expect(mockFindByPersonAndOrg).toHaveBeenCalledWith('person-1', 'org-1');
  });

  test('skips membership update when newExpiryDate is null', async () => {
    const mockFindByPersonAndOrg = mock(async () => null);
    const membershipRepo = makeMembershipRepo({ findByPersonAndOrg: mockFindByPersonAndOrg });

    registerDomainEventConsumers({ membershipRepo }, logger as any);

    await domainEvents.emit('dues.payment.recorded', {
      paymentId: 'pay-2',
      personId: 'person-2',
      organizationId: 'org-2',
      amount: 100,
      newExpiryDate: null,
    });

    expect(mockFindByPersonAndOrg).not.toHaveBeenCalled();
  });

  test('logs warning when membership not found for person+org', async () => {
    const membershipRepo = makeMembershipRepo();

    registerDomainEventConsumers({ membershipRepo }, logger as any);

    await domainEvents.emit('dues.payment.recorded', {
      paymentId: 'pay-3',
      personId: 'person-missing',
      organizationId: 'org-missing',
      amount: 200,
      newExpiryDate: '2027-06-01',
    });

    expect(logger.warn).toHaveBeenCalled();
  });

  test('updates duesExpiryDate when membership found', async () => {
    const mockUpdateOneById = mock(async () => ({}));
    const membershipRepo = makeMembershipRepo({
      findByPersonAndOrg: mock(async () => ({ id: 'mem-1' })),
      updateOneById: mockUpdateOneById,
    });

    registerDomainEventConsumers({ membershipRepo }, logger as any);

    await domainEvents.emit('dues.payment.recorded', {
      paymentId: 'pay-4',
      personId: 'person-4',
      organizationId: 'org-4',
      amount: 1000,
      newExpiryDate: '2028-01-01',
    });

    expect(mockUpdateOneById).toHaveBeenCalledWith('mem-1', expect.objectContaining({
      duesExpiryDate: '2028-01-01',
    }));
    expect(logger.info).toHaveBeenCalled();
  });
});
