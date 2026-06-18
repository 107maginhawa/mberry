/**
 * Integration test for the per-spec isolated-fixture endpoint.
 *
 * Focus: the `memberEmail` option (CONTINUE-60) — when supplied, the
 * fixture must give the seeded member an ACTIVE membership on the fresh
 * org so member-persona e2e specs can target `fx().orgId` instead of the
 * shared seeded org.
 *
 * Requires: API on localhost:7213 + `bun run db:seed`. Skips otherwise.
 */

import { describe, expect, it, afterAll } from 'bun:test';
import { API_AVAILABLE } from '@/tests/helpers/api-available';
import { apiAs } from '@/tests/helpers/api-as';

const API_URL = process.env['API_URL'] || 'http://localhost:7213';
const SEED_MEMBER_EMAIL = 'member@memberry.ph';

const d = API_AVAILABLE ? describe : describe.skip; // allow-skip: integration test needs live API on :7213 + seeded DB

async function createFixture(body: Record<string, unknown>): Promise<{
  orgId: string;
  slug: string;
  memberPersonId?: string;
  personIds: string[];
}> {
  const res = await fetch(`${API_URL}/test/isolated-fixture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as never;
}

async function deleteFixture(orgId: string): Promise<void> {
  await fetch(`${API_URL}/test/isolated-fixture/${orgId}`, {
    method: 'DELETE',
    headers: { Origin: 'http://localhost:3004' },
  }).catch(() => {});
}

d('POST /test/isolated-fixture — memberEmail option', () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) await deleteFixture(id);
  });

  it('grants the seeded member an ACTIVE membership on the fresh org', async () => {
    const fx = await createFixture({
      memberCount: 0,
      memberEmail: SEED_MEMBER_EMAIL,
    });
    created.push(fx.orgId);

    // The handler must surface the resolved member person id.
    expect(fx.memberPersonId).toBeTruthy();

    // The seeded member, when signed in, must see an active membership on
    // the brand-new org.
    const member = await apiAs(SEED_MEMBER_EMAIL);
    const res = await member.get('/persons/me/memberships');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data?: Array<{ organizationId: string; status: string }>;
    } | Array<{ organizationId: string; status: string }>;
    const rows = Array.isArray(body) ? body : (body.data ?? []);
    const onNewOrg = rows.find((m) => m.organizationId === fx.orgId);
    expect(onNewOrg).toBeTruthy();
    expect(onNewOrg?.status).toBe('active');
  });

  it('omits member membership when memberEmail not supplied (back-compat)', async () => {
    const fx = await createFixture({ memberCount: 0 });
    created.push(fx.orgId);
    expect(fx.memberPersonId).toBeUndefined();
  });
});
