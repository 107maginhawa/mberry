import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MerchantAccountRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { createMerchantAccount } from './createMerchantAccount';
import { ConflictError } from '@/core/errors';

const MERCHANT_USER_ID = 'user-1';
const PERSON_ID = 'user-1'; // person.id matches user.id in test

const fakeLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function makeBillingCtx(userId: string, role: string, extraOverrides: Record<string, any> = {}) {
  const user = { id: userId, role };
  return makeCtx({ user, session: { id: 's-1', userId, user }, logger: fakeLogger, ...extraOverrides });
}

const fakePerson = { id: PERSON_ID, userId: MERCHANT_USER_ID, email: 'merch@example.com' };
const newMerchantAccount = { id: 'ma-new', personId: PERSON_ID, stripeAccountId: 'acct_test', status: 'pending' };
const fakeBilling = {
  createConnectAccount: async () => ({ id: 'acct_test', type: 'express' }),
  createAccountLink: async () => ({ url: 'https://stripe.com/onboard' }),
};

describe('createMerchantAccount', () => {
  beforeEach(() => {
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
    stubRepo(PersonRepository, { findOneById: async () => fakePerson });
    stubRepo(MerchantAccountRepository, {
      findByPerson: async () => null,
      createOne: async () => newMerchantAccount,
    });
  });

  afterEach(() => {
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
  });

  test('returns 201 on successful creation', async () => {
    const ctx = makeBillingCtx(MERCHANT_USER_ID, 'provider', {
      billing: fakeBilling,
      _body: { refreshUrl: 'https://app.com/refresh', returnUrl: 'https://app.com/return' },
    });
    const res = await createMerchantAccount(ctx);
    expect(res.status).toBe(201);
  });

  test('throws ConflictError when merchant account already exists', async () => {
    restoreRepo(MerchantAccountRepository);
    stubRepo(MerchantAccountRepository, {
      findByPerson: async () => newMerchantAccount,
      createOne: async () => newMerchantAccount,
    });
    const ctx = makeBillingCtx(MERCHANT_USER_ID, 'provider', {
      billing: fakeBilling,
      _body: { refreshUrl: 'https://app.com/refresh', returnUrl: 'https://app.com/return' },
    });
    await expect(createMerchantAccount(ctx)).rejects.toBeInstanceOf(ConflictError);
  });
});
