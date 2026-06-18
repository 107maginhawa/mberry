/**
 * processStripePayment.test.ts
 *
 * Regression test for Plan 006:
 *   When webhook metadata org/person DISAGREE with the loaded ledger row,
 *   settle() must use the ROW's organizationId/personId — not the metadata.
 */
import { describe, test, expect, spyOn, afterEach, mock } from 'bun:test';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { createProcessPayment } from './processStripePayment';

// status:'completed' → skips updatePaymentStatus; invoiceId:null → skips markPaid
const ROW = {
  id: 'PAYMENT-ROW-ID',
  organizationId: 'ORG-REAL',
  personId: 'PERSON-REAL',
  amount: 5000,
  status: 'completed',
  invoiceId: null,
};

describe('createProcessPayment — authoritative row org/person', () => {
  afterEach(() => {
    mock.restore();
  });

  test('settle() uses payment row organizationId/personId, not metadata values', async () => {
    const getPaymentSpy = spyOn(DuesRepository.prototype, 'getPayment').mockResolvedValue(
      ROW as any,
    );
    const settleSpy = mock(async () => ({
      fundAllocations: [],
      membershipExtendedFrom: null,
      membershipExtendedTo: null,
    }));
    const billing = {} as any;
    const db = {} as any;
    const logger = { info: () => {}, warn: () => {} } as any;
    const processPayment = createProcessPayment(billing, db, logger, settleSpy as any);
    const payload = {
      id: 'pi_test',
      status: 'succeeded',
      amount: 5000,
      metadata: { orgId: 'ORG-EVIL', personId: 'PERSON-EVIL', paymentId: 'PAYMENT-ROW-ID' },
    };
    await processPayment(payload as any);
    expect(settleSpy).toHaveBeenCalledTimes(1);
    expect(settleSpy.mock.calls[0][0]).toMatchObject({ orgId: 'ORG-REAL', personId: 'PERSON-REAL' });
    getPaymentSpy.mockRestore();
  });
});
