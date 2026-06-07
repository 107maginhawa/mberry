import { describe, test, expect, beforeEach } from 'bun:test';
import { DomainEventBus } from './domain-events';

describe('DomainEventBus', () => {
  let bus: DomainEventBus;

  beforeEach(() => {
    bus = new DomainEventBus();
  });

  test('emitted event calls handler with correct payload', async () => {
    const received: any[] = [];

    bus.on('dues.payment.recorded', async (payload) => {
      received.push(payload);
    });

    const payload = {
      paymentId: 'pay-1',
      personId: 'person-1',
      organizationId: 'org-1',
      amount: 500,
      newExpiryDate: '2027-01-01',
    };

    await bus.emit('dues.payment.recorded', payload);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(payload);
  });

  test('multiple handlers on same event are all called', async () => {
    const calls: string[] = [];

    bus.on('membership.status.changed', async () => {
      calls.push('handler-1');
    });

    bus.on('membership.status.changed', async () => {
      calls.push('handler-2');
    });

    await bus.emit('membership.status.changed', {
      membershipId: 'm-1',
      personId: 'p-1',
      organizationId: 'o-1',
      oldStatus: 'pending',
      newStatus: 'active',
    });

    expect(calls).toContain('handler-1');
    expect(calls).toContain('handler-2');
    expect(calls).toHaveLength(2);
  });

  test('handler error does not block other handlers', async () => {
    const calls: string[] = [];

    bus.on('invite.claimed', async () => {
      throw new Error('handler-1 exploded');
    });

    bus.on('invite.claimed', async () => {
      calls.push('handler-2-ok');
    });

    // Should not throw
    await bus.emit('invite.claimed', {
      inviteId: 'inv-1',
      personId: 'p-1',
      organizationId: 'o-1',
      membershipId: 'm-1',
    });

    expect(calls).toEqual(['handler-2-ok']);
  });

  test('emitting unregistered event causes no error', async () => {
    // No handlers registered — emit must resolve without throwing
    await expect(
      bus.emit('dues.payment.recorded', {
        paymentId: 'pay-1',
        personId: 'person-1',
        organizationId: 'org-1',
        amount: 100,
        newExpiryDate: null,
      }),
    ).resolves.toBeUndefined();
  });

  test('off() removes a specific handler', async () => {
    const calls: string[] = [];

    const handler = async () => {
      calls.push('should-not-be-called');
    };

    bus.on('dues.payment.recorded', handler);
    bus.off('dues.payment.recorded', handler);

    await bus.emit('dues.payment.recorded', {
      paymentId: 'pay-1',
      personId: 'person-1',
      organizationId: 'org-1',
      amount: 100,
      newExpiryDate: null,
    });

    expect(calls).toHaveLength(0);
  });

  test('reset() removes all handlers', async () => {
    const calls: string[] = [];

    bus.on('dues.payment.recorded', async () => {
      calls.push('a');
    });
    bus.on('membership.status.changed', async () => {
      calls.push('b');
    });

    bus.reset();

    await bus.emit('dues.payment.recorded', {
      paymentId: 'pay-1',
      personId: 'person-1',
      organizationId: 'org-1',
      amount: 100,
      newExpiryDate: null,
    });

    await bus.emit('membership.status.changed', {
      membershipId: 'm-1',
      personId: 'p-1',
      organizationId: 'o-1',
      oldStatus: 'active',
      newStatus: 'suspended',
    });

    expect(calls).toHaveLength(0);
  });
});
