# 06 — Backend API Contract Alignment: SDK/API Layer

**Module**: SDK/API Layer (Module 12)  
**Scope**: Generated types vs handler types, OpenAPI spec fidelity, dual error path inconsistency

---

## 1. Type Generation Chain

```
specs/api/src/modules/*.tsp
  ↓ TypeSpec compiler
specs/api/dist/openapi/openapi.json  (single source of truth)
  ↓ @hey-api/openapi-ts
packages/sdk-ts/src/generated/types.gen.ts   (frontend types)
  ↓ (re-export from @monobase/api-spec)
services/api-ts/src/generated/openapi/types.ts  (backend types)
  ↓
services/api-ts/src/generated/openapi/validators.ts  (Zod schemas)
```

Both frontend SDK and backend validators derive from the same OpenAPI document. Type alignment is structurally guaranteed **if** generation is kept current.

---

## 2. Known Contract Coverage Gaps

| Gap | Modules | Risk |
|---|---|---|
| **No TypeSpec** (hand-wired) | membership, dues, training, elections, communications | No generated types on either side — contracts exist only as runtime behavior |
| **No Hurl contract tests** | 33 routes (9 by-design, 24 pre-migration) | See ROADMAP.md |
| **notifs partial** | Some handlers hand-wired | Mixed coverage — SDK types exist for TypeSpec portion only |

---

## 3. Dual Error Response Pattern

**Critical finding**: Two response shapes coexist for error responses.

**Pattern A — throw (structured)**:
```typescript
throw new BusinessLogicError('Membership already active');
// → error handler produces: { error: string, code: string, statusCode: number }
```

**Pattern B — direct c.json() (unstructured)**:
```typescript
return ctx.json({ error: 'Unauthorized' }, 401);
// → produces: { error: string } only — no code, no statusCode in body
```

**Count** (from prior audit):
- Pattern A (throw): 129 `ValidationError`, 159 `BusinessLogicError`, 171 `UnauthorizedError`, 104 `ForbiddenError`, 37 `ConflictError`, 295 `NotFoundError`
- Pattern B (direct json): 170×401, 101×403, 21×400, 18×404, 5×409, 4×500, 3×410, 1×503

**Impact on SDK**: `SdkError.body` shape is inconsistent. Consumers checking `(error.body as {code: string}).code` will get `undefined` for Pattern B responses.

---

## 4. 200-Status Error Anomalies

2 handlers return `HTTP 200` with error content in body. These responses reach `SdkError.body` never — hey-api treats 200 as success. Components receive malformed "success" data.

**Risk**: P1 if consumer acts on the data (e.g., treating a "success" response with error body as a completed action).

---

## 5. Handler Type Enforcement

Generated validators apply `ctx.req.valid('json')` for request body type safety. However:

- **Handler return types** are not enforced by generated routes — handlers call `ctx.json(data)` with `data` being any shape
- TypeSpec defines response schema but Hono doesn't validate the response body against it
- A handler returning extra/missing fields will pass silently

**Example risk**: Handler returns `{ id, name }` but TypeSpec defines `{ id, name, status }`. Client type expects `status` but it's missing. TypeScript won't catch this at handler level.

---

## 6. Auth Contract

Better-Auth endpoints (`/api/auth/*`) are **outside** the OpenAPI spec:
- No TypeSpec definition
- No SDK types
- No Zod validators
- No contract tests

Auth flows use `better-auth/client` package directly, which has its own types and error shapes not aligned with `SdkError`.

---

## 7. Gaps & Risks

| ID | Severity | Finding |
|---|---|---|
| C-01 | P0 | **2 handlers return 200 with error body** — SDK treats these as success, components act on bad data |
| C-02 | P1 | **Dual error response shapes** (Pattern A vs B) — `SdkError.body.code` unreliable. 325 Pattern B responses coexist with typed error classes |
| C-03 | P1 | **5 hand-wired modules have no type contract** — membership, dues, training, elections, communications operate entirely outside type safety |
| C-04 | P2 | Handler response body not validated against TypeSpec schema — silently drifting response shapes possible |
| C-05 | P2 | Auth routes outside OpenAPI spec — no type contract, no SDK alignment, separate error format |
| C-06 | P2 | No CI check verifying generated files match current spec — drift can go undetected between code generation runs |
| C-07 | P3 | 24 pre-migration routes without TypeSpec definitions — these will never have generated types until migration completes |
