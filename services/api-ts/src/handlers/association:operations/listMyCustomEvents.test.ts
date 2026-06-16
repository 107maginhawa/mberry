import { describe, test, expect } from 'bun:test';
import { makeCtx, makeMockDb } from '@/test-utils/make-ctx';
import { listMyCustomEvents } from './listMyCustomEvents';

/**
 * listMyCustomEvents uses ctx.get('auth').api.getSession() directly
 * (the route has no auth middleware). We mock the 'auth' key on the context.
 */
function makeAuthMock(userId: string | null) {
  if (!userId) {
    return { api: { getSession: async () => null } };
  }
  return {
    api: {
      getSession: async () => ({ user: { id: userId } }),
    },
  };
}

/**
 * Build a mock db whose select chain returns the given rows.
 * The handler issues: db.select({...}).from(t).innerJoin(...).where(...).orderBy(...).limit(n).offset(n)
 * The makeMockDb select chain resolves .then() to [] but NOT .limit()/.offset() as awaitable.
 * We override the select chain to handle the full method chain used by the handler.
 */
function makeMockDbWithRows(rows: any[]) {
  const base = makeMockDb();
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: (_n: number) => ({
      offset: async (_o: number) => rows,
    }),
    offset: async (_o: number) => rows,
    then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
  };
  return {
    ...base,
    select: (..._a: any[]) => chain,
  };
}

describe('listMyCustomEvents — auth guards', () => {
  test('returns 401 when auth is null (no auth context)', async () => {
    const ctx = makeCtx({ user: null });
    // No 'auth' key set — ctx.get('auth') returns undefined → session is null
    const response = await listMyCustomEvents(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 401 when session has no user', async () => {
    const ctx = makeCtx({
      user: null,
      auth: { api: { getSession: async () => null } },
    });
    const response = await listMyCustomEvents(ctx);
    expect(response.status).toBe(401);
  });
});

describe('listMyCustomEvents — happy path', () => {
  test('returns empty data when user has no registrations', async () => {
    const db = makeMockDbWithRows([]);
    const ctx = makeCtx({
      auth: makeAuthMock('user-1'),
      database: db,
      _query: { limit: '20', offset: '0' },
    });
    const response = await listMyCustomEvents(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toHaveLength(0);
  });

  test('shapes rows into registration+event pairs', async () => {
    const rows = [
      {
        regId: 'reg-1',
        regStatus: 'confirmed',
        regPersonId: 'user-5',
        regEventId: 'evt-1',
        eventId: 'evt-1',
        eventTitle: 'Annual Summit',
        eventType: 'conference',
        eventDescription: 'Big event',
        eventLocation: 'Manila',
        eventStartDate: new Date('2026-07-01'),
        eventEndDate: new Date('2026-07-02'),
        eventCapacity: 100,
        eventRegistrationFee: 500,
        eventCurrency: 'PHP',
        eventCreditBearing: true,
        eventCreditAmount: 4,
        eventStatus: 'published',
        eventVisibility: 'public',
        eventOrganizationId: 'org-1',
      },
    ];
    const db = makeMockDbWithRows(rows);
    const ctx = makeCtx({
      auth: makeAuthMock('user-5'),
      database: db,
      _query: {},
    });
    const response = await listMyCustomEvents(ctx);
    expect(response.status).toBe(200);
    const data = (response as any).body.data;
    expect(data).toHaveLength(1);
    expect(data[0].registration.id).toBe('reg-1');
    expect(data[0].registration.status).toBe('confirmed');
    expect(data[0].registration.personId).toBe('user-5');
    expect(data[0].event.id).toBe('evt-1');
    expect(data[0].event.title).toBe('Annual Summit');
    expect(data[0].event.creditAmount).toBe(4);
  });

  test('uses default limit=20 and offset=0 when query params absent', async () => {
    const db = makeMockDbWithRows([]);
    const ctx = makeCtx({
      auth: makeAuthMock('user-1'),
      database: db,
      _query: {},
    });
    const response = await listMyCustomEvents(ctx);
    // Should not throw; returns empty data
    expect(response.status).toBe(200);
    expect((response as any).body.limit).toBe(20);
    expect((response as any).body.offset).toBe(0);
  });

  test('respects custom limit and offset', async () => {
    const db = makeMockDbWithRows([]);
    const ctx = makeCtx({
      auth: makeAuthMock('user-1'),
      database: db,
      _query: { limit: '5', offset: '10' },
    });
    const response = await listMyCustomEvents(ctx);
    expect((response as any).body.limit).toBe(5);
    expect((response as any).body.offset).toBe(10);
  });
});
