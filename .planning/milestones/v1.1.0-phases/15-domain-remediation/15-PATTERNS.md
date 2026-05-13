# Phase 15: Domain Design Remediation — Patterns

## Test Infrastructure Pattern

All handler tests use the shared test infra from `services/api-ts/src/test-utils/make-ctx.ts`:

```typescript
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';

// Fake DB with transaction support
const txDb = {
  transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
};

describe('[BR-XX] handlerName', () => {
  beforeEach(() => {
    restoreRepo(RepoClass1);
    restoreRepo(RepoClass2);
  });
  afterEach(() => {
    restoreRepo(RepoClass1);
    restoreRepo(RepoClass2);
  });

  test('description', async () => {
    stubRepo(RepoClass, {
      methodName: async () => returnValue,
    });

    const ctx = makeCtx({
      database: txDb,  // REQUIRED for handlers using db.transaction()
      _params: { id: 'x' },
      _body: { field: 'value' },
    });

    const response = await handler(ctx);
    expect(response.status).toBe(200);
  });
});
```

## Transaction Pattern

Handlers performing multiple writes wrap in `db.transaction()`:

```typescript
const result = await db.transaction(async (tx: DatabaseInstance) => {
  const repo1 = new Repo1(tx);  // Use tx, not db
  const repo2 = new Repo2(tx);
  // All writes via tx-backed repos — atomic
  return result;
});
```

## TDD Protocol

1. RED: Write failing tests proving the bug exists
2. GREEN: Fix the code to pass tests
3. Verify: `bun test` — all tests pass, 0 fail
4. Update existing test fixtures if needed (e.g., add `database: txDb` to `makeCtx`)
