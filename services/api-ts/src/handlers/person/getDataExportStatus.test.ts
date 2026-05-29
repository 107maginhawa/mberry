import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getDataExportStatus } from './getDataExportStatus';

function makeStatusDb(row: any) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: async () => (row ? [row] : []),
  };
  return { select: () => chain };
}

describe('getDataExportStatus', () => {
  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(getDataExportStatus(ctx)).rejects.toThrow('Unauthorized');
  });

  test('throws NotFound when export belongs to another person', async () => {
    const ctx = makeCtx({
      _params: { id: 'exp-1' },
      database: makeStatusDb({ id: 'exp-1', personId: 'someone-else', status: 'ready' }),
    });
    await expect(getDataExportStatus(ctx)).rejects.toThrow(/not found/i);
  });

  test('returns ready status with download url', async () => {
    const ctx = makeCtx({
      _params: { id: 'exp-1' },
      database: makeStatusDb({
        id: 'exp-1',
        personId: 'user-1',
        status: 'ready',
        downloadUrl: '/persons/me/data-export/exp-1/download',
        expiresAt: new Date(Date.now() + 86400000),
        requestedAt: new Date(),
      }),
    });
    const res = await getDataExportStatus(ctx) as any;
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.downloadUrl).toContain('/download');
  });

  test('reports expired once past TTL', async () => {
    const ctx = makeCtx({
      _params: { id: 'exp-1' },
      database: makeStatusDb({
        id: 'exp-1',
        personId: 'user-1',
        status: 'ready',
        downloadUrl: '/persons/me/data-export/exp-1/download',
        expiresAt: new Date(Date.now() - 1000),
        requestedAt: new Date(),
      }),
    });
    const res = await getDataExportStatus(ctx) as any;
    expect(res.body.status).toBe('expired');
    expect(res.body.downloadUrl).toBeNull();
  });
});
