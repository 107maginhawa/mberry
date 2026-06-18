/**
 * Regression test for GET /association/member/dues-metrics/:organizationId.
 *
 * The top-unpaid sub-query joined dues_invoice.membership_id (varchar) to
 * person.id (uuid), which Postgres rejected with "operator does not exist:
 * character varying = uuid" → a hard 500 on the officer finances dashboard.
 * Locks the fixed behavior: an org officer gets 200 with the metrics shape.
 *
 * Requires: API on localhost:7213 + `bun run db:seed`. Skips otherwise.
 */

import { describe, expect, it } from 'bun:test';
import { API_AVAILABLE } from '@/tests/helpers/api-available';
import { apiAs } from '@/tests/helpers/api-as';

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562';

const d = API_AVAILABLE ? describe : describe.skip; // allow-skip: integration test needs live API on :7213 + seeded DB

d('GET /association/member/dues-metrics/:organizationId', () => {
  it('returns 200 with trends + top-unpaid for an org officer', async () => {
    const officer = await apiAs('test@memberry.ph');
    const res = await officer.get(`/association/member/dues-metrics/${ORG_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data?: {
        trailingRates?: unknown;
        monthlyBreakdown?: unknown[];
        statusDistribution?: unknown;
        topUnpaid?: unknown[];
      };
    };
    expect(body.data).toBeTruthy();
    expect(body.data?.trailingRates).toBeTruthy();
    expect(Array.isArray(body.data?.monthlyBreakdown)).toBe(true);
    expect(Array.isArray(body.data?.topUnpaid)).toBe(true);
  });
});
