import { describe, test, expect, mock } from 'bun:test';
import { searchChatMessages } from './searchChatMessages';
import { ValidationError } from '@/core/errors';

function makeDb(rows: any[], onWhere?: (w: any) => void) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: (w: any) => { onWhere?.(w); return chain; },
    orderBy: () => chain,
    limit: async () => rows,
  };
  return chain;
}

// Circular-safe collector of param values / string chunks / column names from a
// drizzle SQL object, so FIX-008 can assert the org-scope clause was appended.
function sqlCollect(node: any, acc: string[] = [], seen = new WeakSet()): string[] {
  if (node == null) return acc;
  if (typeof node === 'string') { acc.push(node); return acc; }
  if (typeof node !== 'object') { acc.push(String(node)); return acc; }
  if (seen.has(node)) return acc;
  seen.add(node);
  if (Array.isArray(node)) { for (const n of node) sqlCollect(n, acc, seen); return acc; }
  if (node.queryChunks) { sqlCollect(node.queryChunks, acc, seen); return acc; }
  if (Array.isArray(node.value)) { for (const v of node.value) sqlCollect(v, acc, seen); return acc; }
  if (node.value !== undefined && typeof node.value !== 'object') acc.push(String(node.value));
  if (node.name) acc.push(String(node.name));
  return acc;
}

function makeCtx(opts: {
  userId?: string | null;
  q?: string;
  db?: any;
  organizationId?: string;
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
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
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

  // FIX-008 (G4 read-path): when the caller's org context is known, the search
  // is scoped to messages in that org's rooms OR DM rooms (org-agnostic, PD-2).
  test('[FIX-008] org-scopes the search to (caller org OR dm) when org context is set', async () => {
    let where: any;
    const db = makeDb([], (w) => { where = w; });
    const ctx = makeCtx({ q: 'hello', db, organizationId: 'org-1' });
    await searchChatMessages(ctx);

    const text = sqlCollect(where).join(' ');
    expect(text).toContain('org-1');
    expect(text.toLowerCase()).toContain('dm');
  });

  // FIX-008: without org context, no org filter is appended (existing behavior).
  test('[FIX-008] does not org-scope when no org context is present', async () => {
    let where: any;
    const db = makeDb([], (w) => { where = w; });
    const ctx = makeCtx({ q: 'hello', db });
    await searchChatMessages(ctx);

    const text = sqlCollect(where).join(' ');
    expect(text).not.toContain('org-1');
  });
});
