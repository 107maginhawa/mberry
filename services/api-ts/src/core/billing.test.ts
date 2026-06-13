/**
 * Tests for core/billing.ts BillingService.
 *
 * Focus (AHA FIX-001): the Stripe SDK initialization path must NEVER log the
 * plaintext secret key. This is a security regression guard — a leaked secret
 * key in any log sink is exfiltratable and affects every module that uses the
 * shared billing service (dues, events, booking).
 */

import { describe, test, expect } from 'bun:test';
import type { Logger } from 'pino';
import { BillingService } from './billing';
import type { BillingConfig } from './billing-types';

const SECRET_KEY = 'sk_test_THISMUSTNEVERBELOGGED_0123456789abcdef';

/**
 * Build a logger that records every argument passed to info/debug/warn/error
 * so we can assert the secret never appears anywhere in the log stream.
 */
function makeCapturingLogger(): { logger: Logger; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const record = (...args: unknown[]) => { calls.push(args); };
  const logger = {
    info: record,
    debug: record,
    warn: record,
    error: record,
    trace: record,
    fatal: record,
    // BillingService calls logger.child({ service: 'billing' }) in the ctor.
    child: () => logger,
  } as unknown as Logger;
  return { logger, calls };
}

function makeBillingConfig(): BillingConfig {
  return {
    provider: 'stripe',
    stripe: { secretKey: SECRET_KEY },
  };
}

describe('BillingService — secret key redaction (FIX-001)', () => {
  test('does not log the plaintext Stripe secret key on SDK initialization', () => {
    const { logger, calls } = makeCapturingLogger();
    const service = new BillingService(makeBillingConfig(), {} as any, logger);

    // Trigger lazy Stripe SDK initialization (private method — runtime-callable).
    // Constructing the Stripe client makes no network call.
    (service as any).ensureStripeInitialized();

    // Flatten every logged argument to a single searchable string.
    const allLogged = JSON.stringify(calls);
    expect(allLogged).not.toContain(SECRET_KEY);
  });
});
