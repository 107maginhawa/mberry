/**
 * Shared test helper for creating mock handler contexts.
 *
 * Usage:
 *   const ctx = makeCtx({ _body: { name: 'Test' }, tenantId: 'tenant-1' });
 *   const response = await someHandler(ctx);
 *   expect(response.status).toBe(201);
 */

export function makeCtx(overrides: Record<string, any> = {}) {
  const vars: Record<string, any> = {
    user: { id: 'user-1', role: 'user' },
    session: { id: 'session-1', userId: 'user-1', user: { id: 'user-1' } },
    tenantId: 'tenant-1',
    orgId: 'org-1',
    database: {},
    logger: null,
    audit: null,
    ...overrides,
  };

  const jsonBody: any = overrides['_body'] || {};
  const paramValues: any = overrides['_params'] || {};
  const queryValues: any = overrides['_query'] || {};

  return {
    get: (key: string) => vars[key],
    set: (key: string, val: any) => { vars[key] = val; },
    req: {
      valid: (target: string) => {
        if (target === 'json') return jsonBody;
        if (target === 'param') return paramValues;
        if (target === 'query') return queryValues;
        return {};
      },
      param: (key: string) => paramValues[key] || '',
      header: () => null,
    },
    json: (body: any, status: number) => ({ status, body }) as any as Response,
    body: (body: any, status: number) => ({ status, body }) as any as Response,
  } as any;
}
