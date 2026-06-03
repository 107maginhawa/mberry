import { describe, test, expect, mock } from 'bun:test';
import { searchChatMessages } from './searchChatMessages';
import { ValidationError } from '@/core/errors';

function makeDb(rows: any[]) {
  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
  };
  return chain;
}

function makeCtx(opts: {
  userId?: string | null;
  q?: string;
  db?: any;
} = {}) {
  const userId = opts.userId === undefined ? 'user-1' : opts.userId;
  const q = opts.q ?? '';
  const db = opts.db ?? makeDb([]);

  let captured: { data: any; status: number } = { data: null, status: 0 };

  return {
    get: (key: string) => {
      const store: Record<string, any> = {
        user: userId ? { id: userId, name: 'Test' } : null,
        database: db,
        logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      };
      return store[key];
    },
    req: {
      valid: (t: string) => (t === 'query' ? { q } : {}),
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  } as any;
}

describe('searchChatMessages', () => {
  test('[AC-SEARCH-001] throws ValidationError when user has no id', async () => {
    const ctx = makeCtx({ userId: null });
    await expect(searchChatMessages(ctx)).rejects.toThrow(ValidationError);
  });

  test('[AC-SEARCH-002] returns empty data when q < 2 chars', async () => {
    const ctx = makeCtx({ q: 'a' });
    const res = await searchChatMessages(ctx);
    expect(res.status).toBe(200);
    expect(ctx._captured().data).toEqual({ data: [] });
  });

  test('[AC-SEARCH-003] returns empty data when q is whitespace', async () => {
    const ctx = makeCtx({ q: '   ' });
    const res = await searchChatMessages(ctx);
    expect(res.status).toBe(200);
    expect(ctx._captured().data).toEqual({ data: [] });
  });

  test('[AC-SEARCH-004] returns mapped rows when query has matches', async () => {
    const ts = new Date('2026-06-03T00:00:00Z');
    const db = makeDb([
      { id: 'msg-1', message: 'hello world', sender: 'user-2', chatRoom: 'room-1', timestamp: ts },
      { id: 'msg-2', message: 'hi there', sender: 'user-3', chatRoom: 'room-2', timestamp: ts },
    ]);
    const ctx = makeCtx({ q: 'hello', db });
    const res = await searchChatMessages(ctx);
    expect(res.status).toBe(200);
    const out = ctx._captured().data.data;
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: 'msg-1', message: 'hello world', chatRoom: 'room-1' });
    expect(out[0].timestamp).toBe(ts.toISOString());
  });

  test('[BR-SEARCH-001] truncates message text to 200 chars', async () => {
    const long = 'x'.repeat(500);
    const db = makeDb([
      { id: 'msg-1', message: long, sender: 'u', chatRoom: 'r', timestamp: new Date() },
    ]);
    const ctx = makeCtx({ q: 'xx', db });
    await searchChatMessages(ctx);
    const out = ctx._captured().data.data;
    expect(out[0].message).toHaveLength(200);
  });

  test('[BR-SEARCH-002] tolerates null message field', async () => {
    const db = makeDb([
      { id: 'msg-1', message: null, sender: 'u', chatRoom: 'r', timestamp: new Date() },
    ]);
    const ctx = makeCtx({ q: 'xx', db });
    await searchChatMessages(ctx);
    const out = ctx._captured().data.data;
    expect(out[0].message).toBe('');
  });
});
