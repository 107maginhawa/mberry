import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
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
  email: 'member@example.com',
  message: null,
  metadata: null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdByOfficer: 'user-1',
  claimedAt: null,
  updatedAt: new Date(),
});

// ─── Tests ──────────────────────────────────────────────

describe('createInvite', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    // FIX-003 (G4): createInvite now requires an active officer term. Default
    // the caller to a (non-privileged) officer so the existing happy-path tests
    // continue to exercise invite creation; tests that assert the officer gate
    // override this stub explicitly.
    restoreRepo(OfficerTermRepository);
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Society Officer' }],
    });
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });

  // ─── FIX-003 (G4): only officers may issue invitations ────────────────
  // m01 §6: send invite = president/secretary/officer. A plain active member
  // (no officer term) must be rejected with 403.
  test('returns 403 when caller has no active officer term (member)', async () => {
    restoreRepo(OfficerTermRepository);
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => ({ ...fakeInvite, ...data }),
    });

    const ctx = makeCtx({
      user: { id: 'member-1', role: 'member', twoFactorEnabled: true },
      _body: { email: 'invitee@example.com' },
    });

    const response = await createInvite(ctx);
    expect(response.status).toBe(403);
  });

  test('allows an officer with an active term to create an invite (201)', async () => {
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => ({ ...fakeInvite, ...data }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'officer', twoFactorEnabled: true },
      _body: { email: 'invitee@example.com' },
    });

    const response = await createInvite(ctx);
    expect(response.status).toBe(201);
  });

  test('creates invite and returns 201 with token and invite details', async () => {
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => ({ ...fakeInvite, ...data }),
    });

    const ctx = makeCtx({
      _body: {
        email: 'member@example.com',
        type: 'invite',
      },
    });

    const response = await createInvite(ctx);
    expect(response.status).toBe(201);
    expect(response.body.id).toBeTruthy();
    expect(response.body.token).toBeTruthy(); // raw token — must be present
    expect(response.body.email).toBe('member@example.com');
    expect(response.body.status).toBe('pending');
  });

  test('normalizes email to lowercase and trims whitespace', async () => {
    let capturedData: any = null;
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => {
        capturedData = data;
        return { ...fakeInvite, ...data };
      },
    });

    const ctx = makeCtx({
      _body: {
        email: '  MEMBER@EXAMPLE.COM  ',
      },
    });

    await createInvite(ctx);
    expect(capturedData.email).toBe('member@example.com');
  });

  test('returns 401 when no user in session', async () => {
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => ({ ...fakeInvite, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _body: { email: 'member@example.com' },
    });

    const response = await createInvite(ctx);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
  });

  test('returns 403 when no organizationId in context', async () => {
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => ({ ...fakeInvite, ...data }),
    });

    const ctx = makeCtx({
      organizationId: null,
      _body: { email: 'member@example.com' },
    });

    const response = await createInvite(ctx);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Organization context required');
  });

  test('throws ValidationError when email is missing', async () => {
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => ({ ...fakeInvite, ...data }),
    });

    const ctx = makeCtx({
      _body: {}, // no email
    });

    const { ValidationError } = await import('@/core/errors');
    await expect(createInvite(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError when email is empty string', async () => {
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => ({ ...fakeInvite, ...data }),
    });

    const ctx = makeCtx({
      _body: { email: '   ' }, // whitespace only
    });

    const { ValidationError } = await import('@/core/errors');
    await expect(createInvite(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ConflictError when pending invite already exists for email+org', async () => {
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => fakeInvite, // existing invite found
      create: async (data: any) => ({ ...fakeInvite, ...data }),
    });

    const ctx = makeCtx({
      _body: { email: 'member@example.com' },
    });

    const { ConflictError } = await import('@/core/errors');
    await expect(createInvite(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('sets createdByOfficer from session user id', async () => {
    let capturedData: any = null;
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => {
        capturedData = data;
        return { ...fakeInvite, ...data };
      },
    });

    const ctx = makeCtx({
      user: { id: 'officer-99', role: 'officer' },
      _body: { email: 'new@example.com' },
    });

    await createInvite(ctx);
    expect(capturedData.createdByOfficer).toBe('officer-99');
  });

  test('defaults type to "invite" when not provided', async () => {
    let capturedData: any = null;
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => {
        capturedData = data;
        return { ...fakeInvite, ...data };
      },
    });

    const ctx = makeCtx({
      _body: { email: 'new@example.com' },
    });

    await createInvite(ctx);
    expect(capturedData.type).toBe('invite');
  });

  test('uses organizationId as orgId for the invite record', async () => {
    let capturedData: any = null;
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => {
        capturedData = data;
        return { ...fakeInvite, ...data };
      },
    });

    const ctx = makeCtx({
      organizationId: 'tenant-XYZ',
      _body: { email: 'new@example.com' },
    });

    await createInvite(ctx);
    expect(capturedData.organizationId).toBe('tenant-XYZ');
  });

  test('persists optional fields: personId, message, metadata', async () => {
    let capturedData: any = null;
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => {
        capturedData = data;
        return { ...fakeInvite, ...data };
      },
    });

    const ctx = makeCtx({
      _body: {
        email: 'new@example.com',
        personId: 'person-42',
        message: 'Welcome to the association!',
        metadata: { role: 'member' },
      },
    });

    await createInvite(ctx);
    expect(capturedData.personId).toBe('person-42');
    expect(capturedData.message).toBe('Welcome to the association!');
    expect(capturedData.metadata).toEqual({ role: 'member' });
  });
});
