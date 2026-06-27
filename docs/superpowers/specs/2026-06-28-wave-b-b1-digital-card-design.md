# Wave B / B1 — Member digital membership card

**Date:** 2026-06-28 · **App:** apps/member · **Version:** v0.1.10.0
**Engine status:** FROZEN (zero changes to `services/api-ts/src`, `specs/`, `packages/sdk-ts/src/generated`)

## Goal

Close the unbuilt locked-PRD member tile 1 enhancement: a **digital membership
card** with a scannable QR. Member opens it from the dashboard, shows it at a
chapter desk; a verifier scans the QR to confirm membership validity.

## What exists (recon, verified against handler source)

- `GET /persons/me/id-card/:orgId` → `getMyIdCard` (services/api-ts/src/handlers/person/getMyIdCard.ts).
  Auth: `authMiddleware()` (session required, no role). orgId from path param (400 if missing,
  404 NotFound if person/card absent). **No response transformer.** Returns:

  ```ts
  // { data: IdCardData }
  interface IdCardData {
    personId: string
    firstName: string
    lastName: string | null
    licenseNumber: string | null
    organizationName: string
    membershipStatus: string
    photoUrl: string | null
    qrPayload: string          // base64 JSON
    qrSignature: string        // HMAC-SHA256 hex (BR-18)
    validUntil: string | null  // ISO date string
    verifyCredentialNumber: string | null
  }
  ```

- **This endpoint is wired in `app.ts` but is NOT in OpenAPI/SDK.** So the FE
  consumes it via a raw `fetch` (same idiom as slice-3 `features/auth/sign-in.ts`),
  inheriting `credentials: 'include'`. This is what keeps the engine FROZEN — no
  spec/sdk regen.
- A `/pdf` variant exists; out of scope (user chose on-screen card + QR lib).
- `verifyCredentialPublic` (public) accepts a QR payload — the verifier side.
  No verifier UI is in scope this slice (YAGNI).

## Approach (chosen)

On-screen card on a new **authed** route, raw-fetch the un-SDK'd endpoint, render
the QR client-side with one small dep (`qrcode.react`). Rejected: embedding the
server PDF (uglier, user rejected) and exposing the endpoint in the SDK (additive
spec change — breaks FROZEN, unnecessary).

## Components

```
apps/member/src/
  routes/card.tsx                    NEW — authed route (NOT /pay public); renders <IdCardView/>
  features/card/
    use-id-card.ts                   NEW — useQuery; raw GET /persons/me/id-card/:orgId; cast to IdCardData
    IdCardView.tsx                   NEW — full card: org, name, license, status, photo, validUntil, QR, credential no.
  features/dashboard/MembershipTile.tsx   EDIT — add "View digital card" link → /card
```

- **use-id-card.ts**: `useQuery({ queryKey: ['id-card', orgId], enabled: !!orgId, retry: false })`.
  orgId from `useMemberOrg()`. Raw `fetch(`${API_BASE}/persons/me/id-card/${orgId}`, { credentials:'include' })`;
  on `!response.ok` throw; return `(await res.json()).data as IdCardData`. (No CSRF header — GET is not
  a mutating method, not in the CSRF allowlist.) Export `API_BASE` from `lib/api.ts` if not already.
- **IdCardView.tsx**: Card with member identity + `StatusBadge` for membershipStatus + photo (`<img>` with
  alt, fallback to initials/Avatar when `photoUrl` null) + `validUntil` formatted (`new Date(...)`, guard null)
  + `verifyCredentialNumber` as monospace text + `<QRCodeSVG value={qrData}/>`. Loading→Skeleton,
  error→ErrorState, no-card→EmptyState. Built on `@monobase/ui` Card/StatusBadge/Skeleton/Avatar.
- **QR content**: `qrData = `${idCard.qrPayload}.${idCard.qrSignature}`` (JWT-like, self-contained: a future
  verifier splits on `.` and POSTs the payload to `verifyCredentialPublic`). `// ponytail:` comment marks the
  forward-looking encoding; verifier UI is out of scope.
- **MembershipTile**: add a `<Link to="/card">View digital card</Link>` (Button, ≥48px tap). Only show the
  link when a membership exists (don't link to an empty card).

## Data flow

dashboard → MembershipTile "View digital card" → `/card` route → `useIdCard()` →
raw GET id-card (session cookie) → render card + QR. orgId resolved from
`useMemberOrg()` (selectedOrgId / first membership).

## Money / drift / a11y

- No money on this card → no centavos handling needed.
- No SDK type for id-card → define `IdCardData` locally (mirrors handler), cast the parsed JSON. No "lying
  type" to bind to. Drift risk is nil (we own the shape; verify against handler source — done above).
- a11y (DESIGN.md): 18px base, ≥48px tap on the dashboard link + any card action, status via labeled
  `StatusBadge` (not color-only), photo `<img>` has `alt`, QR has an accessible label / caption
  ("Scan to verify membership"). One primary task on `/card` (show the card).

## Error / edge cases

- No session → `/card` guarded by `__root` (non-public) → redirect to `/sign-in`. ✓ existing.
- `orgId` null (no membership) → query disabled → EmptyState ("No active membership").
- 404 from endpoint (no card yet — note: backend lazily creates memberCard credential on first view, so
  404 means no person/membership) → EmptyState.
- 500 (e.g. `ID_CARD_HMAC_SECRET` unset in env) → ErrorState ("Couldn't load your card. Please refresh.").
- `photoUrl` null → Avatar initials fallback. `validUntil` null → omit the "Valid until" line.

## Testing (anti-false-green)

- **use-id-card.test.ts**: stub global `fetch` (raw, not SDK) returning the REAL handler envelope
  `{ data: IdCardData }`; assert hook maps to `IdCardData`, throws on non-ok, disabled when orgId null.
- **IdCardView.test.tsx**: render with a handler-shape fixture; assert org/name/status/credential render,
  QR element present (`<svg>`), `photoUrl=null` → initials, `validUntil=null` → no "Valid until" line,
  loading/error/empty states. `expect(container.textContent).not.toMatch(/NaN|undefined|null/)`.
- **Typecheck includes test files** (`tsconfig.test.json` already present) — wrong field on `IdCardData`
  fixture = compile error.
- **e2e (card-flow.spec.ts)**: load `/card` against running stack (auth-gated; controller runs it
  independently). Assert card heading + a QR `<svg>` present. Stubbed-pass acceptable when stack/seed
  unavailable, but the spec must exist and the controller verifies it runs.
- Dep add: `bun add qrcode.react` in apps/member (one runtime dep, justified — no third-party QR image
  service for member credential data = security boundary).

## Out of scope (flagged, not silently cut)

- Verifier/scan UI (public verify page) — future; `verifyCredentialPublic` exists server-side.
- PDF download — user chose on-screen.
- Wallet (Apple/Google) passes — post-PMF.
- Exposing id-card in the SDK — would break FROZEN; not needed.

## Engine FROZEN invariant

`git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` MUST be EMPTY at PR time.
