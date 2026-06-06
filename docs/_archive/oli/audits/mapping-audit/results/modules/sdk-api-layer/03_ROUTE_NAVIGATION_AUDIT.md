# 03 — Route Navigation Audit: SDK/API Layer

**Module**: SDK/API Layer (Module 12)  
**Scope**: SDK generated hooks → API route mapping fidelity

---

## 1. Generation Pipeline

```
TypeSpec (.tsp)
  ↓ bun run build  (specs/api)
OpenAPI JSON  (specs/api/dist/openapi/openapi.json)
  ↓ @hey-api/openapi-ts
packages/sdk-ts/src/generated/
  ├── sdk.gen.ts           — typed fetch functions
  ├── @tanstack/react-query.gen.ts  — TanStack Query hooks
  ├── types.gen.ts         — request/response types
  └── client.gen.ts        — hey-api client instance
  ↓ bun run generate  (services/api-ts)
services/api-ts/src/generated/openapi/
  ├── routes.ts            — Hono route registration
  ├── validators.ts        — Zod schemas
  └── registry.ts          — operationId → handler mapping
```

All three artifacts (SDK, routes, validators) derive from the same OpenAPI document. Drift can only occur if generation is run against a stale spec.

---

## 2. SDK Hook Naming Convention

Generated hooks follow `@hey-api/openapi-ts` convention:

| Pattern | Example |
|---|---|
| Query (GET) | `useGetPersonQuery()` |
| Mutation (POST/PATCH/DELETE) | `useCreatePersonMutation()` |
| Infinite query | `useListPersonsInfiniteQuery()` |

Hooks are wired to `sdk.gen.ts` functions (typed fetch) via the generated `queryOptions` / `mutationOptions` factories.

---

## 3. Route → Handler Mapping

Routes registered by `registerRoutes()` from `services/api-ts/src/generated/openapi/routes.ts`. Each route:
1. Attaches Zod validation middleware for body/params/query
2. Looks up handler from `registry.ts` by `operationId`
3. Wraps handler call with error boundary

**Registry pattern** (`registry.ts`):
```ts
// Maps operationId → handler function
// Handlers imported from services/api-ts/src/handlers/{module}/
const registry: Record<string, Handler> = { ... }
```

---

## 4. Coverage Assessment

| Module | TypeSpec Coverage | SDK Hooks | Routes |
|---|---|---|---|
| person | Yes | Generated | Generated |
| association:member | Yes | Generated | Generated |
| association:operations | Yes | Generated | Generated |
| platformadmin | Yes | Generated | Generated |
| billing | Yes | Generated | Generated |
| booking | Yes | Generated | Generated |
| events | Yes | Generated | Generated |
| comms | Yes | Generated | Generated |
| communication | Yes | Generated | Generated |
| documents | Yes | Generated | Generated |
| certificates | Yes | Generated | Generated |
| storage | Yes | Generated | Generated |
| reviews | Yes | Generated | Generated |
| audit | Yes | Generated | Generated |
| email | Yes | Generated | Generated |
| notifs | Mixed | Partial | Partial |
| membership | Hand-wired | None | Manual |
| dues | Hand-wired | None | Manual |
| training | Hand-wired | None | Manual |
| elections | Hand-wired | None | Manual |
| communications | Hand-wired | None | Manual |
| invite | TypeSpec | Generated | Generated |

**~58% of modules** have full SDK hook coverage. The 5 hand-wired modules (membership, dues, training, elections, communications) have **zero SDK-generated hooks** — frontends consuming these must use raw fetch or handwritten SDK wrappers.

---

## 5. Auth Route Integration

Better-Auth routes registered separately via `registerAuthRoutes()` from `services/api-ts/src/core/auth.ts`. These are **not** in the OpenAPI spec and therefore **not** in the generated SDK. The SDK uses `better-auth/client` (`packages/sdk-ts/src/react/auth.ts`) to call these routes directly.

**Auth endpoints outside OpenAPI spec**:
- `/api/auth/sign-in`
- `/api/auth/sign-out`
- `/api/auth/session`
- `/api/auth/sign-up`

---

## 6. Gaps & Risks

| ID | Severity | Finding |
|---|---|---|
| N-01 | P1 | **5 hand-wired modules have no generated SDK hooks**. Any frontend feature using membership, dues, training, elections, or communications bypasses type safety. |
| N-02 | P2 | Auth routes not in OpenAPI → not in SDK types → callers use `better-auth` client with its own error shapes, inconsistent with `SdkError`. |
| N-03 | P2 | No drift detection: if `specs/api` is updated without re-running `generate`, routes.ts and sdk.gen.ts diverge silently. No CI gate verifies the generated files are current. |
| N-04 | P3 | `notifs` module is "mixed" — some handlers hand-wired, some TypeSpec. SDK hooks exist for TypeSpec portion only; callers must know which to use. |
