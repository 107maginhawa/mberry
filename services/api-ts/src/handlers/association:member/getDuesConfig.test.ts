import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeDuesConfig as createFakeDuesConfig } from '@/test-utils/factories';
import { getDuesConfig } from './getDuesConfig';
import { DuesConfigRepository } from './repos/dues.repo';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeConfig = createFakeDuesConfig({
  id: 'config-1',
  defaultAmount: 5000,
  annualAmount: 5000,
  currency: 'PHP',
  billingFrequency: 'annual',
  effectiveDate: '2026-01-01',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

// ─── Tests ──────────────────────────────────────────────

describe('getDuesConfig (association:member)', () => {
  let configMocks: ReturnType<typeof stubRepo>;
  let duesMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (configMocks) Object.values(configMocks).forEach((m) => m.mockRestore());
    if (duesMocks) Object.values(duesMocks).forEach((m) => m.mockRestore());
  });

  test('returns config when found by ID', async () => {
    configMocks = stubRepo(DuesConfigRepository, {
      findOneById: async () => fakeConfig,
    });

    const ctx = makeCtx({ _params: { duesConfigId: 'config-1' } });
    const response = await getDuesConfig(ctx);

    expect(response.status).toBe(200);
    const body = response.body as any;
    expect(body.annualAmount).toBeDefined();
  });

  test('GUARDRAIL: returns 404 (not 200 with empty body) when no config exists', async () => {
    // This test prevents regression to ctx.json({}, 200) which crashes the SDK
    // response transformer and causes 7.5s load time from retry backoff.
    configMocks = stubRepo(DuesConfigRepository, {
      findOneById: async () => undefined,
    });
    duesMocks = stubRepo(DuesRepository, {
      getConfig: async () => undefined,
    });

    const ctx = makeCtx({ _params: { duesConfigId: 'org-no-config' } });
    const response = await getDuesConfig(ctx);

    // MUST be 404, NOT 200. A 200 with {} crashes the SDK transformer:
    // BigInt({}.annualAmount.toString()) → TypeError → 3 retries → 7.5s delay
    expect(response.status).toBe(404);
  });

  test('GUARDRAIL: never returns empty object {} as response body', async () => {
    configMocks = stubRepo(DuesConfigRepository, {
      findOneById: async () => undefined,
    });
    duesMocks = stubRepo(DuesRepository, {
      getConfig: async () => undefined,
    });

    const ctx = makeCtx({ _params: { duesConfigId: 'org-no-config' } });
    const response = await getDuesConfig(ctx);
    const body = response.body;

    // Response body must NOT be {} — that shape crashes SDK transformers
    const isEmptyObject = typeof body === 'object' && body !== null && Object.keys(body).length === 0;
    expect(isEmptyObject).toBe(false);
  });

  test('requires authentication', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { duesConfigId: 'config-1' },
    });

    try {
      await getDuesConfig(ctx);
      expect(true).toBe(false); // should have thrown
    } catch (err: any) {
      expect(err.message || err.code).toMatch(/unauthorized|auth/i);
    }
  });
});
