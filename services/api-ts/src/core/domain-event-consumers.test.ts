/**
 * Tests for registerDomainEventConsumers
 *
 * The consumer registers a handler for dues.payment.recorded that
 * updates the membership duesExpiryDate when a payment includes a new expiry.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { DomainEventBus } from './domain-events';
import { registerDomainEventConsumers } from './domain-event-consumers';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerDomainEventConsumers', () => {
  let bus: DomainEventBus;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    bus = new DomainEventBus();
    logger = makeLogger();

    // Monkey-patch the module-level singleton so registerDomainEventConsumers
    // wires into our test bus. We do this by replacing the 'on' method.
    // Actually, registerDomainEventConsumers imports the singleton directly,
    // so we need to mock the module.
  });

  test('registers handler for dues.payment.recorded', async () => {
    // We can verify registration by emitting an event and checking side effects.
    // Since the consumer imports MembershipRepository, we need to mock it.
    const mockFindByPersonAndOrg = mock(async () => null);

    mock.module('@/handlers/association:member/repos/membership.repo', () => ({
      MembershipRepository: class {
        findByPersonAndOrg = mockFindByPersonAndOrg;
        updateOneById = mock(async () => ({}));
      },
    }));

    // Re-import to pick up mocks
    const { registerDomainEventConsumers: register } = await import('./domain-event-consumers');
    const { domainEvents } = await import('./domain-events');
    domainEvents.reset();

    const db = {} as any;
    register(db, logger as any);

    // Emit event with newExpiryDate
    await domainEvents.emit('dues.payment.recorded', {
      paymentId: 'pay-1',
      personId: 'person-1',
      organizationId: 'org-1',
      amount: 500,
      newExpiryDate: '2027-01-01',
    });

    // Handler should have tried to find membership
    expect(mockFindByPersonAndOrg).toHaveBeenCalledWith('person-1', 'org-1');
  });

  test('skips membership update when newExpiryDate is null', async () => {
    const mockFindByPersonAndOrg = mock(async () => null);

    mock.module('@/handlers/association:member/repos/membership.repo', () => ({
      MembershipRepository: class {
        findByPersonAndOrg = mockFindByPersonAndOrg;
        updateOneById = mock(async () => ({}));
      },
    }));

    const { registerDomainEventConsumers: register } = await import('./domain-event-consumers');
    const { domainEvents } = await import('./domain-events');
    domainEvents.reset();

    register({} as any, logger as any);

    await domainEvents.emit('dues.payment.recorded', {
      paymentId: 'pay-2',
      personId: 'person-2',
      organizationId: 'org-2',
      amount: 100,
      newExpiryDate: null,
    });

    // Should NOT call findByPersonAndOrg since newExpiryDate is null
    expect(mockFindByPersonAndOrg).not.toHaveBeenCalled();
  });

  test('logs warning when membership not found for person+org', async () => {
    mock.module('@/handlers/association:member/repos/membership.repo', () => ({
      MembershipRepository: class {
        findByPersonAndOrg = mock(async () => null);
        updateOneById = mock(async () => ({}));
      },
    }));

    const { registerDomainEventConsumers: register } = await import('./domain-event-consumers');
    const { domainEvents } = await import('./domain-events');
    domainEvents.reset();

    register({} as any, logger as any);

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

    mock.module('@/handlers/association:member/repos/membership.repo', () => ({
      MembershipRepository: class {
        findByPersonAndOrg = mock(async () => ({ id: 'mem-1' }));
        updateOneById = mockUpdateOneById;
      },
    }));

    const { registerDomainEventConsumers: register } = await import('./domain-event-consumers');
    const { domainEvents } = await import('./domain-events');
    domainEvents.reset();

    register({} as any, logger as any);

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
