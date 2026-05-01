import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

describe('position handlers', () => {
  test('createPosition requires auth', async () => {
    const { createPosition } = await import('./createPosition');
    const ctx = makeCtx({ user: null });
    const response = await createPosition(ctx);
    expect(response.status).toBe(401);
  });

  test('createPosition requires tenantId', async () => {
    const { createPosition } = await import('./createPosition');
    const ctx = makeCtx({ user: { id: 'u1' }, tenantId: null });
    const response = await createPosition(ctx);
    expect(response.status).toBe(403);
  });

  test('listPositions requires auth', async () => {
    const { listPositions } = await import('./listPositions');
    const ctx = makeCtx({ user: null });
    const response = await listPositions(ctx);
    expect(response.status).toBe(401);
  });

  test('getPosition requires auth', async () => {
    const { getPosition } = await import('./getPosition');
    const ctx = makeCtx({ user: null });
    const response = await getPosition(ctx);
    expect(response.status).toBe(401);
  });

  test('deletePosition requires auth', async () => {
    const { deletePosition } = await import('./deletePosition');
    const ctx = makeCtx({ user: null });
    const response = await deletePosition(ctx);
    expect(response.status).toBe(401);
  });
});

describe('officer term handlers', () => {
  test('createOfficerTerm requires auth', async () => {
    const { createOfficerTerm } = await import('./createOfficerTerm');
    const ctx = makeCtx({ user: null });
    const response = await createOfficerTerm(ctx);
    expect(response.status).toBe(401);
  });

  test('createOfficerTerm requires tenantId', async () => {
    const { createOfficerTerm } = await import('./createOfficerTerm');
    const ctx = makeCtx({ user: { id: 'u1' }, tenantId: null });
    const response = await createOfficerTerm(ctx);
    expect(response.status).toBe(403);
  });

  test('listOfficerTerms requires auth', async () => {
    const { listOfficerTerms } = await import('./listOfficerTerms');
    const ctx = makeCtx({ user: null });
    const response = await listOfficerTerms(ctx);
    expect(response.status).toBe(401);
  });

  test('getOfficerTerm requires auth', async () => {
    const { getOfficerTerm } = await import('./getOfficerTerm');
    const ctx = makeCtx({ user: null });
    const response = await getOfficerTerm(ctx);
    expect(response.status).toBe(401);
  });
});
