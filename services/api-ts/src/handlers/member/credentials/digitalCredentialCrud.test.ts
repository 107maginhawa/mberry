// FIX-008 (Batch D): per-handler unit suite for digital-credential read/list/update/delete.
// (issue/revoke/verify covered in their own focused suites.)
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getDigitalCredential } from './getDigitalCredential';
import { listDigitalCredentials } from './listDigitalCredentials';
import { updateDigitalCredential } from './updateDigitalCredential';
import { deleteDigitalCredential } from './deleteDigitalCredential';
import { DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';

afterEach(() => restoreRepo(DigitalCredentialRepository));

describe('getDigitalCredential', () => {
  test('throws Unauthorized without a session', async () => {
    const ctx = makeCtx({ session: null, _params: { credentialId: 'c1' } });
    await expect(getDigitalCredential(ctx)).rejects.toThrow();
  });

  test('throws NotFound for an unknown credential', async () => {
    stubRepo(DigitalCredentialRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { credentialId: 'missing' } });
    await expect(getDigitalCredential(ctx)).rejects.toThrow(/Digital credential/i);
  });

  test('returns the credential on happy path', async () => {
    stubRepo(DigitalCredentialRepository, { findOneById: async () => ({ id: 'c1', credentialNumber: 'CN-001' }) });
    const ctx = makeCtx({ _params: { credentialId: 'c1' } });
    const res = await getDigitalCredential(ctx) as any;
    expect(res.status).toBe(200);
    expect(res.body.credentialNumber).toBe('CN-001');
  });
});

describe('listDigitalCredentials', () => {
  test('throws Unauthorized without a session', async () => {
    const ctx = makeCtx({ session: null, _query: {} });
    await expect(listDigitalCredentials(ctx)).rejects.toThrow();
  });

  test('returns paginated credentials scoped to the org', async () => {
    let filters: any = null;
    stubRepo(DigitalCredentialRepository, {
      findManyWithPagination: async (f: any) => { filters = f; return { data: [{ id: 'c1' }], totalCount: 1 }; },
    });
    const ctx = makeCtx({ _query: { status: 'active', personId: 'p1' } });
    const res = await listDigitalCredentials(ctx) as any;
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(filters.organizationId).toBe('tenant-1');
    expect(filters.status).toBe('active');
  });
});

describe('updateDigitalCredential', () => {
  test('throws Unauthorized without a session', async () => {
    const ctx = makeCtx({ session: null, _params: { credentialId: 'c1' }, _body: {} });
    await expect(updateDigitalCredential(ctx)).rejects.toThrow();
  });

  test('throws NotFound when updating a missing credential', async () => {
    stubRepo(DigitalCredentialRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { credentialId: 'missing' }, _body: { status: 'suspended' } });
    await expect(updateDigitalCredential(ctx)).rejects.toThrow(/Digital credential/i);
  });

  test('applies the patch on happy path', async () => {
    stubRepo(DigitalCredentialRepository, {
      findOneById: async () => ({ id: 'c1', status: 'active' }),
      updateOneById: async (_id: string, patch: any) => ({ id: 'c1', ...patch }),
    });
    const ctx = makeCtx({ _params: { credentialId: 'c1' }, _body: { status: 'suspended' } });
    const res = await updateDigitalCredential(ctx) as any;
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');
  });
});

describe('deleteDigitalCredential', () => {
  test('throws Unauthorized without a session', async () => {
    const ctx = makeCtx({ session: null, _params: { credentialId: 'c1' } });
    await expect(deleteDigitalCredential(ctx)).rejects.toThrow();
  });

  test('throws NotFound when deleting a missing credential', async () => {
    stubRepo(DigitalCredentialRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { credentialId: 'missing' } });
    await expect(deleteDigitalCredential(ctx)).rejects.toThrow(/Digital credential/i);
  });

  test('deletes and returns 204 on happy path', async () => {
    let deletedId: string | null = null;
    stubRepo(DigitalCredentialRepository, {
      findOneById: async () => ({ id: 'c1' }),
      deleteOneById: async (id: string) => { deletedId = id; },
    });
    const ctx = makeCtx({ _params: { credentialId: 'c1' } });
    const res = await deleteDigitalCredential(ctx);
    expect(res.status).toBe(204);
    expect(deletedId).toBe('c1');
  });
});
