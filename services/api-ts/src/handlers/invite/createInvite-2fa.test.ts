/**
 * AXIS-2 BR / FIX-002 (G2): createInvite enforces 2FA for privileged officer
 * titles in production.
 *
 * ── Coverage note ─────────────────────────────────────────────────────────
 * The 2FA *gate logic itself* (privileged title + no 2FA + production → 403)
 * is generic and already tested directly against the shared check in
 *   src/core/auth/officer-checks.test.ts
 *     › "returns 403 when privileged officer (President) lacks 2FA in production"
 *     › "allows privileged officer (Treasurer) WITH 2FA in production"
 *     › "allows privileged officer (Secretary) without 2FA in development"
 *     › "allows non-privileged officer (Board Member) without 2FA in production"
 * and against the equivalent path-mode middleware in
 *   src/middleware/require-position.test.ts
 *     › "requires 2FA for privileged title in production"
 *     › "skips 2FA gate in non-production"
 *     › "non-privileged title does not gate on 2FA"
 *
 * What was NOT covered: that createInvite is actually *wired* to that gate.
 * createInvite.ts calls `requireOfficerTerm(ctx)` (createInvite.ts:28-29) and
 * returns its 403 Response when it denies. The existing createInvite.test.ts
 * only ever stubs a NON-privileged "Society Officer" term, so its 2FA branch
 * was never exercised through the handler — a regression that removed the
 * `requireOfficerTerm` call (or swapped it for a no-2FA check) would pass that
 * suite. This file closes that gap end-to-end through the createInvite handler:
 *   - privileged officer WITHOUT 2FA, production  → createInvite blocked (403)
 *   - privileged officer WITH 2FA, production      → createInvite allowed (201)
 *   - privileged officer WITHOUT 2FA, development   → createInvite allowed (201)
 *   - non-privileged officer WITHOUT 2FA, production → createInvite allowed (201)
 * To prove the 403 is genuinely the 2FA gate (not the no-term or title-mismatch
 * 403s), we assert on the distinctive 2FA error message in the response body.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeInvite as createFakeInvite } from '@/test-utils/factories';
import { createInvite } from './createInvite';
import { InviteRepository } from './repos/invite.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeInvite = createFakeInvite({
  organizationId: 'tenant-1',
  personId: null,
  tokenHash: 'hashed-token-abc',
  type: 'invite',
  email: 'invitee@example.com',
  message: null,
  metadata: null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdByOfficer: 'officer-1',
  claimedAt: null,
  updatedAt: new Date(),
});

// The exact substring emitted by requireOfficerTerm's 2FA branch
// (core/auth/officer-checks.ts). Distinct from the no-term ("Officer access
// required") and ValidationError messages — proves the 2FA gate fired.
const TWO_FA_MSG = 'Two-factor authentication required';

/** Stub the officer-term lookup to return a term with the given title. */
function stubOfficerTitle(positionTitle: string) {
  restoreRepo(OfficerTermRepository);
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle }],
  });
}

/** Stub InviteRepository so the happy path can reach a 201. */
function stubInviteHappyPath() {
  return stubRepo(InviteRepository, {
    findPendingByEmail: async () => undefined,
    create: async (data: any) => ({ ...fakeInvite, ...data }),
  });
}

describe('createInvite — 2FA gate for privileged officer titles (FIX-002 / AXIS-2)', () => {
  let inviteMocks: ReturnType<typeof stubRepo> | undefined;
  let officerMocks: ReturnType<typeof stubRepo> | undefined;
  let savedNodeEnv: string | undefined;

  beforeEach(() => {
    savedNodeEnv = process.env['NODE_ENV'];
    restoreRepo(OfficerTermRepository);
    restoreRepo(InviteRepository);
  });

  afterEach(() => {
    if (inviteMocks) Object.values(inviteMocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    inviteMocks = undefined;
    officerMocks = undefined;
    restoreRepo(OfficerTermRepository);
    restoreRepo(InviteRepository);
    if (savedNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = savedNodeEnv;
  });

  // ── Wiring proof: createInvite delegates to the officer/2FA gate ──────────

  test('blocks a privileged officer (President) WITHOUT 2FA in production (403)', async () => {
    process.env['NODE_ENV'] = 'production';
    officerMocks = stubOfficerTitle('President');
    inviteMocks = stubInviteHappyPath();

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'officer', twoFactorEnabled: false },
      _body: { email: 'invitee@example.com' },
    });

    const response = await createInvite(ctx);

    // Wired to the gate: handler short-circuits with the gate's 403…
    expect(response.status).toBe(403);
    // …and it is specifically the 2FA branch (not no-term / not title-mismatch).
    expect(String(response.body.error)).toContain(TWO_FA_MSG);
  });

  test('blocks a privileged officer (Treasurer) WITHOUT 2FA in production (403)', async () => {
    process.env['NODE_ENV'] = 'production';
    officerMocks = stubOfficerTitle('Treasurer');
    inviteMocks = stubInviteHappyPath();

    const ctx = makeCtx({
      user: { id: 'officer-2', role: 'officer', twoFactorEnabled: false },
      _body: { email: 'invitee@example.com' },
    });

    const response = await createInvite(ctx);

    expect(response.status).toBe(403);
    expect(String(response.body.error)).toContain(TWO_FA_MSG);
  });

  test('the privileged-no-2FA invite is NOT created (no token issued)', async () => {
    process.env['NODE_ENV'] = 'production';
    officerMocks = stubOfficerTitle('Secretary');

    let createCalled = false;
    inviteMocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => {
        createCalled = true;
        return { ...fakeInvite, ...data };
      },
    });

    const ctx = makeCtx({
      user: { id: 'officer-3', role: 'officer', twoFactorEnabled: false },
      _body: { email: 'invitee@example.com' },
    });

    const response = await createInvite(ctx);

    expect(response.status).toBe(403);
    expect(String(response.body.error)).toContain(TWO_FA_MSG);
    // The gate must short-circuit BEFORE persistence — no invite/token leaks.
    expect(createCalled).toBe(false);
    expect(response.body.token).toBeUndefined();
  });

  // ── The same privileged officer WITH 2FA is allowed (201) ─────────────────

  test('allows a privileged officer (President) WITH 2FA in production (201)', async () => {
    process.env['NODE_ENV'] = 'production';
    officerMocks = stubOfficerTitle('President');
    inviteMocks = stubInviteHappyPath();

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'officer', twoFactorEnabled: true },
      _body: { email: 'invitee@example.com' },
    });

    const response = await createInvite(ctx);

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTruthy(); // raw token issued
    expect(response.body.email).toBe('invitee@example.com');
  });

  test('allows a privileged officer (Treasurer) WITH 2FA in production (201)', async () => {
    process.env['NODE_ENV'] = 'production';
    officerMocks = stubOfficerTitle('Treasurer');
    inviteMocks = stubInviteHappyPath();

    const ctx = makeCtx({
      user: { id: 'officer-2', role: 'officer', twoFactorEnabled: true },
      _body: { email: 'invitee@example.com' },
    });

    const response = await createInvite(ctx);

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTruthy();
  });

  // ── Gate scoping: dev bypass + non-privileged titles still flow through ────

  test('allows a privileged officer (Secretary) WITHOUT 2FA in development (201)', async () => {
    process.env['NODE_ENV'] = 'development';
    officerMocks = stubOfficerTitle('Secretary');
    inviteMocks = stubInviteHappyPath();

    const ctx = makeCtx({
      user: { id: 'officer-3', role: 'officer', twoFactorEnabled: false },
      _body: { email: 'invitee@example.com' },
    });

    const response = await createInvite(ctx);

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTruthy();
  });

  test('allows a NON-privileged officer (Board Member) WITHOUT 2FA in production (201)', async () => {
    process.env['NODE_ENV'] = 'production';
    officerMocks = stubOfficerTitle('Board Member');
    inviteMocks = stubInviteHappyPath();

    const ctx = makeCtx({
      user: { id: 'officer-4', role: 'officer', twoFactorEnabled: false },
      _body: { email: 'invitee@example.com' },
    });

    const response = await createInvite(ctx);

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTruthy();
  });
});
