# 05 — Form / Modal / Table Action Audit: SDK/API Layer

**Module**: SDK/API Layer (Module 12)  
**Scope**: SDK validation patterns, mutation error display, optimistic updates

---

## 1. Request Validation Architecture

**Server-side** (canonical source of truth):
- Generated Zod schemas in `services/api-ts/src/generated/openapi/validators.ts`
- Applied automatically by generated `routes.ts` before handlers execute
- Validation failures → `ValidationError(400)` with Zod error details

**Client-side** (SDK layer):
- No client-side Zod validation built into SDK
- Types from `packages/sdk-ts/src/generated/types.gen.ts` provide TypeScript compile-time safety only
- Runtime validation of request payloads is not performed before HTTP call

**Gap**: If a form submits invalid data, the round-trip to the server is required to surface the validation error. No pre-flight validation in SDK.

---

## 2. Mutation Pattern (Generated Hooks)

Generated mutations from `@tanstack/react-query.gen.ts` follow hey-api pattern:

```typescript
// Example generated mutation
export const createPersonMutation = () => ({
  mutationFn: (data: CreatePersonData) => createPerson({ body: data }),
})

// Usage in component
const mutation = useMutation({
  ...createPersonMutation(),
  meta: { toast: { success: 'Created', error: 'Failed to create' } },
})

mutation.mutate(formData)
// mutation.isError → true on failure
// mutation.error   → SdkError instance
```

---

## 3. Optimistic Update Support

**File**: `packages/sdk-ts/src/react/use-optimistic-mutation.ts`

Hand-written hook providing optimistic update pattern:

```typescript
useOptimisticMutation<TData, TError, TVars>({
  mutationFn,
  queryKey,          // query to update optimistically
  getOptimisticData, // produce optimistic snapshot
  // on error: automatically rolls back via queryClient.setQueryData(queryKey, snapshot)
})
```

- Uses `TanStack useMutation` with `onMutate` / `onError` / `onSettled`
- On error: snapshot restored via `queryClient.setQueryData`
- On settle: `queryClient.invalidateQueries({ queryKey })`
- Error propagated to `mutation.error` as `SdkError`

---

## 4. Error Display Conventions

| Error Source | Representation | Display Path |
|---|---|---|
| 400 Validation | `SdkError{status:400, body: ZodError}` | Manual — component reads `mutation.error` |
| 401 Unauthorized | `SdkError{status:401}` | `onSessionExpired` callback (redirect) |
| 403 Forbidden | `SdkError{status:403}` | No convention — component must handle |
| 404 Not Found | `SdkError{status:404}` | No convention |
| 422 Business Error | `SdkError{status:422, body: {error, code}}` | Manual |
| 5xx Server | `SdkError{status:5xx}` | Retry then surface via `mutation.error` |
| Toast | `mutation.meta.toast.error` | Via `MutationCache.onError` → `SdkNotifier` |

**No SDK-level form field error extraction** — if a 400 Zod error body contains field-level errors, the component must parse `(mutation.error as SdkError).body` manually to display per-field errors.

---

## 5. Table / Infinite Query Pattern

SDK generates infinite query variants for list endpoints:

```typescript
// Generated
export const useListMembersInfiniteQuery = (options: ...) => 
  useInfiniteQuery({ queryKey: [...], queryFn: ..., ... })
```

Pagination cursor/offset passed via `queryPageParamKey` (hey-api convention). No SDK-level abstraction for pagination UI — consuming components implement pagination controls directly.

---

## 6. Modal Action Flow

No SDK-level modal management. Typical pattern in consuming apps:
1. Open modal → local state
2. Submit → `mutation.mutate(data)`
3. `mutation.isPending` → disable submit button
4. `mutation.isSuccess` → close modal + toast via `meta.toast`
5. `mutation.isError` → display `mutation.error` in modal

**Risk**: Mutation success/error handling is duplicated per component unless `meta.toast` convention is adopted consistently.

---

## 7. Gaps & Risks

| ID | Severity | Finding |
|---|---|---|
| V-01 | P2 | No client-side pre-validation — all validation errors require server round-trip. Forms with complex validation degrade UX on slow networks. |
| V-02 | P2 | **400 Zod error body structure not standardized in SDK** — each component must manually extract field errors from `SdkError.body`. No helper utility provided. |
| V-03 | P2 | 403 / 404 have no SDK-level display convention. Components must individually check `error.status` to differentiate. Risk of generic "error" messages for permission failures. |
| V-04 | P3 | `mutation.meta.toast` convention is opt-in — inconsistent adoption means some mutations silently fail from user perspective. |
| V-05 | P3 | `useOptimisticMutation` performs `invalidateQueries` on settle but does not handle the case where `queryKey` doesn't exist yet (first load) — silent no-op, not a bug but worth noting. |
