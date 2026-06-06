# 04 — Frontend Interaction Integrity: SDK/API Layer

**Module**: SDK/API Layer (Module 12)  
**Scope**: SDK client error handling, retry policy, timeout, 401/403 propagation

---

## 1. Transport Layer

**File**: `packages/sdk-ts/src/transport.ts`

`HttpTransport` is the hand-written transport abstraction (used by non-generated code). Key behavior:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);  // 30s hard timeout

// On AbortError:
return { status: 408, body: JSON.stringify({ message: 'Request timeout' }), headers: {} };

// All other network errors are re-thrown
```

**Observation**: `HttpTransport` returns a synthetic 408 response on timeout rather than throwing. Consumers must check `status === 408` explicitly.

---

## 2. Generated Client Layer

**File**: `packages/sdk-ts/src/generated/client.gen.ts`

Uses `@hey-api/client-fetch`. Configured via `createClientConfig()` from `client.ts`:
- `baseUrl`: runtime-configurable via `setSdkBaseUrl()` or env var `MONOBASE_API_BASE_URL`
- `fetch`: custom fetch that forces `credentials: 'include'` (session cookie)
- `throwOnError: true` (hey-api default when error interceptor registered)

**Session cookie**: No `Authorization: Bearer` header. Auth relies entirely on `credentials: 'include'` + session cookie. Server-side Better-Auth reads this cookie via `auth.api.getSession({ headers })`.

---

## 3. Error Interceptor

**File**: `packages/sdk-ts/src/client.ts` — `wrapError()` / `errorInterceptor`

Every non-2xx response from the generated client is wrapped into `SdkError`:

```typescript
class SdkError extends Error {
  readonly status: number;   // HTTP status code
  readonly url: string | undefined;
  readonly method: string | undefined;
  readonly body: unknown;    // parsed response body
}
```

**Registration**: Installed once in `provider.tsx` via `generatedClient.interceptors.error.use(errorInterceptor)`. Uses `useRef` guard to prevent duplicate registration.

**Abort errors**: `AbortError` is NOT wrapped in `SdkError` — passed through as-is. Consumers must handle both `SdkError` and `AbortError`.

---

## 4. Retry Policy

**File**: `packages/sdk-ts/src/react/provider.tsx` — `shouldRetry()`

```typescript
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false            // max 3 attempts
  if (error instanceof SdkError) {
    if (error.status >= 400 && error.status < 500 && error.status !== 408) return false
    return true  // 408, 5xx retry
  }
  return true    // network errors retry
}
```

**Retry delay**: Exponential backoff — `Math.min(1000 * 2^attempt, 30_000)` ms

| Status | Retried? | Notes |
|---|---|---|
| 4xx (except 408) | No | 401, 403, 404, 422 never retried |
| 408 (timeout) | Yes | Up to 3 attempts |
| 5xx | Yes | Up to 3 attempts |
| AbortError | Yes | Network failure |

---

## 5. Session Expiry (401) Handling

**File**: `packages/sdk-ts/src/react/provider.tsx` — `createSessionExpiredHandler()`

```typescript
// Debounced — fires once per 2000ms window
if (error instanceof SdkError && error.status === 401) {
  onSessionExpired()  // caller-provided callback
}
```

- Attached to both `QueryCache.onError` and `MutationCache.onError`
- Debounce prevents redirect storm on simultaneous 401s
- **`onSessionExpired` is optional** — if not provided, 401 is swallowed silently at the cache level (component still sees the error via `isError`)

---

## 6. TanStack Query Defaults

**File**: `packages/sdk-ts/src/react/provider.tsx` — `createDefaultQueryClient()`

| Setting | Value | Implication |
|---|---|---|
| `staleTime` | 5 min | Data considered fresh for 5 min — no refetch |
| `gcTime` | 30 min | Cached 30 min after unmount |
| `refetchOnWindowFocus` | true | Refetches when tab regains focus |
| `refetchOnReconnect` | true | Refetches on network reconnect |
| Query retry | `shouldRetry` | Max 3, exponential backoff |
| Mutation retry | `shouldRetry` | Same policy |
| Mutation gcTime | 5s | Mutations cleared from cache quickly |

---

## 7. Toast / Error Display Convention

Mutations support `meta.toast` convention:
```ts
useMutation({
  meta: { toast: { success: 'Done', error: 'Failed' } }
})
```
Routed through `MutationCache.onSuccess/onError` to `SdkNotifier` (app-provided). Without `notifier`, toasts are silently skipped. No built-in error UI fallback.

---

## 8. Gaps & Risks

| ID | Severity | Finding |
|---|---|---|
| F-01 | P1 | **`onSessionExpired` is optional** — if not wired by app, 401 is silently dropped at cache level. User stays on the page with stale/failed data and no redirect to sign-in. |
| F-02 | P2 | `AbortError` not wrapped in `SdkError` — bypasses retry policy check and `shouldRetry` falls to `return true` for all network errors. AbortErrors from intentional cancellation retry unnecessarily. |
| F-03 | P2 | `HttpTransport` (hand-written) returns `{ status: 408 }` on timeout rather than throwing. If consumers check `response.ok` they miss the timeout. Only `status === 408` reveals it. |
| F-04 | P2 | `baseUrl` defaults to `http://localhost:7213` (hardcoded). If env var not set in production, all SDK calls hit localhost. No runtime assertion that baseUrl is configured. |
| F-05 | P3 | 403 responses are not specially handled — treated same as 404, no redirect or user-facing message convention. Handlers return `ForbiddenError` but SDK surfaces it only as `SdkError{status:403}`. |
| F-06 | P3 | Toast notifier is optional with no default — silent failures if consuming app forgets to wire `notifier`. |
