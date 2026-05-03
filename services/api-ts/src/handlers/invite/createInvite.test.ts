import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { createInvite } from './createInvite';
import { InviteRepository } from './repos/invite.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeInvite = {
  id: 'invite-1',
  orgId: 'tenant-1',
  personId: null,
  tokenHash: 'hashed-token-abc',
  type: 'invite',
  status: 'pending',
  email: 'member@example.com',
  message: null,
  metadata: null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdByOfficer: 'user-1',
  claimedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('createInvite', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
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

  test('returns 403 when no tenantId in context', async () => {
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => ({ ...fakeInvite, ...data }),
    });

    const ctx = makeCtx({
      tenantId: null,
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

  test('uses tenantId as orgId for the invite record', async () => {
    let capturedData: any = null;
    mocks = stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (data: any) => {
        capturedData = data;
        return { ...fakeInvite, ...data };
      },
    });

    const ctx = makeCtx({
      tenantId: 'tenant-XYZ',
      _body: { email: 'new@example.com' },
    });

    await createInvite(ctx);
    expect(capturedData.orgId).toBe('tenant-XYZ');
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
