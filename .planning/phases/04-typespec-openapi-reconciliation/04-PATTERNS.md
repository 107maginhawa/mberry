# Phase 4: TypeSpec/OpenAPI Reconciliation - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `specs/api/src/association/member/certificates.tsp` | config | CRUD | `specs/api/src/association/member/certification.tsp` | exact |
| `specs/api/src/main.tsp` | config | request-response | itself (additive change) | self |
| `services/api-ts/src/app.ts` | config | request-response | itself (remove 7 route blocks) | self |
| `apps/memberry/src/features/certificates/components/certificate-list.tsx` | component | request-response | `apps/memberry/src/features/elections/components/election-list.tsx` | role-match |
| `apps/memberry/src/features/certificates/components/certificate-preview.tsx` | component | request-response | `apps/memberry/src/features/elections/components/election-detail.tsx` | role-match |
| `apps/memberry/src/features/elections/components/election-list.tsx` | component | request-response | SDK-generated hooks (post-migration pattern) | exact |
| `apps/memberry/src/features/elections/components/election-detail.tsx` | component | request-response | SDK-generated hooks (post-migration pattern) | exact |
| `apps/memberry/src/features/elections/components/election-form.tsx` | component | CRUD | SDK-generated mutation hooks | exact |
| `apps/memberry/src/features/events/components/event-list.tsx` | component | request-response | SDK-generated hooks (post-migration pattern) | exact |

---

## Pattern Assignments

### `specs/api/src/association/member/certificates.tsp` (NEW FILE — TypeSpec module)

**Analog:** `specs/api/src/association/member/certification.tsp` (lines 1–7, 478–547)

**Imports pattern** (from `certification.tsp` lines 1–7):
```typespec
import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;
```

**Namespace declaration pattern** (from `certification.tsp` line 480):
```typespec
@route("/association/member/certification-programs")
@tag("Association:Member")
namespace Association.Member.Certification {
  // interfaces here
}
```
For certificates: use `namespace Association.Member.Certificates` with `@route("/association/member/certificates")`.

**CRUD interface pattern** (from `certification.tsp` lines 482–547):
```typespec
@doc("CRUD and search for certification programs")
interface CertificationProgramManagement {
  @doc("Create a certification program.")
  @operationId("createCertificationProgram")
  @post
  @useAuth(bearerAuth)
  @extension("x-security-required-roles", #["association:admin"])
  createCertificationProgram(
    @body body: CertificationProgramCreateRequest
  ): ApiCreatedResponse<CertificationProgram>
    | ApiBadRequestResponse
    | ApiUnauthorizedResponse
    | ApiForbiddenResponse
    | ApiConflictResponse;

  @doc("Get a certification program by ID.")
  @operationId("getCertificationProgram")
  @get
  @route("/{programId}")
  @useAuth(bearerAuth)
  @extension("x-security-required-roles", #["association:admin", "association:member"])
  getCertificationProgram(
    @path programId: string
  ): ApiOkResponse<CertificationProgram>
    | ApiNotFoundResponse
    | ApiUnauthorizedResponse
    | ApiForbiddenResponse;

  @doc("List certification programs.")
  @operationId("listCertificationPrograms")
  @get
  @useAuth(bearerAuth)
  @extension("x-security-required-roles", #["association:admin", "association:member"])
  listCertificationPrograms(
    ...PaginationQuery,
    @query status?: CertProgramStatus
  ): ApiOkResponse<PaginatedResponse<CertificationProgram>>
    | ApiUnauthorizedResponse
    | ApiForbiddenResponse;

  @doc("Update a certification program.")
  @operationId("updateCertificationProgram")
  @patch(#{implicitOptionality: true})
  @route("/{programId}")
  @useAuth(bearerAuth)
  @extension("x-security-required-roles", #["association:admin"])
  updateCertificationProgram(
    @path programId: string,
    @body updates: CertificationProgramUpdateRequest
  ): ApiOkResponse<CertificationProgram>
    | ApiBadRequestResponse
    | ApiNotFoundResponse
    | ApiForbiddenResponse;

  @doc("Delete a certification program.")
  @operationId("deleteCertificationProgram")
  @delete
  @route("/{programId}")
  @useAuth(bearerAuth)
  @extension("x-security-required-roles", #["association:admin"])
  deleteCertificationProgram(
    @path programId: string
  ): ApiNoContentResponse
    | ApiNotFoundResponse
    | ApiConflictResponse
    | ApiForbiddenResponse;
}
```

**Lifecycle action operation pattern** (from `certification.tsp` lines 619–647 — `certifyEnrollment`):
```typespec
@doc("Award certification to a passing enrollment.")
@operationId("certifyEnrollment")
@post
@route("/{enrollmentId}/certify")
@useAuth(bearerAuth)
@extension("x-security-required-roles", #["association:admin"])
certifyEnrollment(
  @path enrollmentId: string,
  @body body: CertifyRequest
): ApiOkResponse<CertificationEnrollment>
  | ApiBadRequestResponse
  | ApiNotFoundResponse
  | ApiConflictResponse
  | ApiForbiddenResponse;
```

**Data model — certificates handler schema** (from RESEARCH.md Finding 3):
```typespec
model Certificate extends BaseEntity {
  organizationId: string;
  personId: string;
  trainingId: string;
  certificateNumber: string;
  issuedAt: utcDateTime;
}
```

**Member-scoped list operation pattern** (from `governance.tsp` — `listBallots` member-only variant):
```typespec
@doc("List my certificates.")
@operationId("listMyCertificates")
@get
@useAuth(bearerAuth)
@extension("x-security-required-roles", #["association:member"])
listMyCertificates(
  ...PaginationQuery,
  @query personId?: string
): ApiOkResponse<PaginatedResponse<Certificate>>
  | ApiUnauthorizedResponse
  | ApiForbiddenResponse;
```

---

### `specs/api/src/main.tsp` — ADDITIVE (register elections + certificates)

**Analog:** `specs/api/src/main.tsp` existing governance registrations (lines 265–271)

**Existing governance registrations pattern** (lines 265–271):
```typespec
@tag("Association:Member")
@route("/association/member/positions")
interface AssocPositionManagement extends Association.Member.Governance.PositionManagement {}

@tag("Association:Member")
@route("/association/member/officer-terms")
interface AssocOfficerTermManagement extends Association.Member.Governance.OfficerTermManagement {}
```

**Elections registrations to ADD** (after existing governance block, following RESEARCH.md Pattern 1):
```typespec
// =========================================================================
// Association Domain — Governance (Elections, Candidates & Ballots — Wave 2)
// =========================================================================

@tag("Association:Member")
@route("/association/member/elections")
interface AssocElectionManagement extends Association.Member.Governance.ElectionManagement {}

@tag("Association:Member")
@route("/association/member/candidates")
interface AssocCandidateManagement extends Association.Member.Governance.CandidateManagement {}

@tag("Association:Member")
@route("/association/member/ballots")
interface AssocBallotManagement extends Association.Member.Governance.BallotManagement {}
```

**Certificates import + registration to ADD:**
```typespec
// In import block (after governance.tsp import, line 43):
import "./association/member/certificates.tsp";

// In MonobaseAPI namespace (after credentials block):
// =========================================================================
// Association Domain — Certificates
// =========================================================================

@tag("Association:Member")
@route("/association/member/certificates")
interface AssocCertificateManagement extends Association.Member.Certificates.CertificateManagement {}
```

---

### `services/api-ts/src/app.ts` — REMOVE hand-wired route blocks

**Analog:** `services/api-ts/src/app.ts` itself (lines 357–372)

**Lines to REMOVE** (app.ts lines 357–372):
```typescript
// Auth middleware for all custom module routes
app.use('/dues/*', authMiddleware());
app.use('/membership/*', authMiddleware());
app.use('/communications/*', authMiddleware());
app.use('/certificates/*', authMiddleware());
app.use('/events/*', authMiddleware());
app.use('/training/*', authMiddleware());
app.use('/elections/*', authMiddleware());

// Register module routes (no /api prefix — Vite proxy strips it)
app.route('/dues', dues);
app.route('/membership', membership);
app.route('/communications', communications);
app.route('/certificates', certificates);
app.route('/events', eventsRouter);
app.route('/training', trainingRouter);
app.route('/elections', electionsRouter);
```

**ALSO remove dead imports** (lines 29–47 — 7 handler imports):
```typescript
// REMOVE these imports once routes are decommissioned:
import { dues } from '@/handlers/dues';
import { membership } from '@/handlers/membership';
import { communications } from '@/handlers/communications';
import { certificates } from '@/handlers/certificates';
import { eventsRouter } from '@/handlers/events';
import { trainingRouter } from '@/handlers/training';
import { electionsRouter } from '@/handlers/elections';
```

**NOTE:** Decommission module-by-module. For each module, verify generated route exists in `services/api-ts/src/generated/openapi/routes.ts` before removing the hand-wired block.

---

### Frontend components — migration from manual fetch to SDK hooks

**BEFORE pattern** (present in all 6 custom module components):
```typescript
// FROM: apps/memberry/src/features/certificates/components/certificate-list.tsx lines 1-3, 11-16
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

const { data, isLoading } = useQuery({
  queryKey: ['my-certificates'],
  queryFn: async () => {
    return api.get<{ data: any[] }>('/api/certificates/my')
  },
})
```

**AFTER pattern** (SDK-generated hooks):
```typescript
// Import from generated SDK
import { useQuery } from '@tanstack/react-query'
import { listMyCertificatesOptions } from '@monobase/sdk-ts/generated/react-query'

const { data, isLoading } = useQuery(
  listMyCertificatesOptions({ query: { limit: 50 } })
)
// Access: data?.items ?? []  (shape determined by OpenAPI schema)
```

**Generated queryOptions pattern** (from `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` lines 47–58):
```typescript
export const listAdminsOptions = (options?: Options<ListAdminsData>) => queryOptions<ListAdminsResponse, ListAdminsError, ListAdminsResponse, ReturnType<typeof listAdminsQueryKey>>({
    queryFn: async ({ queryKey, signal }) => {
        const { data } = await listAdmins({
            ...options,
            ...queryKey[0],
            signal,
            throwOnError: true
        });
        return data;
    },
    queryKey: listAdminsQueryKey(options)
});
```

**Generated mutationOptions pattern** (from `react-query.gen.ts` lines 63–74):
```typescript
export const inviteAdminMutation = (options?: Partial<Options<InviteAdminData>>): UseMutationOptions<InviteAdminResponse, InviteAdminError, Options<InviteAdminData>> => {
    const mutationOptions: UseMutationOptions<InviteAdminResponse, InviteAdminError, Options<InviteAdminData>> = {
        mutationFn: async (fnOptions) => {
            const { data } = await inviteAdmin({
                ...options,
                ...fnOptions,
                throwOnError: true
            });
            return data;
        }
    };
    return mutationOptions;
};
```

**Key rule:** Hook names follow `operationId` in TypeSpec exactly. After SDK regeneration, verify actual exported names in `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` before updating imports. Example: `@operationId("listMyCertificates")` → `listMyCertificatesOptions`.

---

## Shared Patterns

### TypeSpec CRUD interface — full shape
**Source:** `specs/api/src/association/member/governance.tsp` lines 682–746 (`ElectionManagement`)
**Apply to:** `certificates.tsp` new `CertificateManagement` interface

Every CRUD interface follows this exact shape:
1. `@doc` string
2. `@operationId` (camelCase, globally unique)
3. HTTP verb (`@post` / `@get` / `@patch(#{implicitOptionality: true})` / `@delete`)
4. Optional `@route("/{entityId}")` for non-collection operations
5. `@useAuth(bearerAuth)`
6. `@extension("x-security-required-roles", #["role1", "role2"])` — roles from the `association:*` namespace
7. Return type union: `ApiCreatedResponse<T> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse`

### Auth roles used in association domain
**Source:** `specs/api/src/association/member/governance.tsp` throughout
```typespec
// Admin-only write operations:
@extension("x-security-required-roles", #["association:admin"])

// Read — both admin and member:
@extension("x-security-required-roles", #["association:admin", "association:member"])

// Member-scoped (own data only):
@extension("x-security-required-roles", #["association:member"])

// Member owner (own record only):
@extension("x-security-required-roles", #["association:admin", "association:member:owner"])
```

### main.tsp interface registration block format
**Source:** `specs/api/src/main.tsp` lines 199–260
```typespec
// =========================================================================
// Association Domain — [Domain Name]
// =========================================================================

@tag("Association:Member")        // or "Association:Operations"
@route("/association/member/...")  // must match @route in the .tsp namespace
interface Assoc[InterfaceName] extends Association.[Namespace].[InterfaceName] {}
```

### SDK hook naming convention
**Source:** `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` line 42
- List (GET collection): `{operationId}Options` → `listElectionsOptions`
- Get (GET single): `{operationId}Options` → `getElectionOptions`  
- Create/Update/Delete: `{operationId}Mutation` → `createElectionMutation`
- Infinite scroll: `{operationId}InfiniteOptions`

### Frontend component imports after SDK migration
**Source:** `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` line 3
```typescript
// Replace:
import { api } from '@/lib/api'

// With (after SDK regeneration):
import { listMyCertificatesOptions } from '@monobase/sdk-ts/generated/react-query'
// or the barrel:
import { listMyCertificatesOptions } from '@monobase/sdk-ts'
```

---

## No Analog Found

All files have clear analogs. No novel patterns required.

---

## Metadata

**Analog search scope:** `specs/api/src/`, `services/api-ts/src/`, `apps/memberry/src/features/`, `packages/sdk-ts/src/generated/`
**Files scanned:** 10 source files read directly
**Pattern extraction date:** 2026-05-06

**Critical enum conflict to resolve before authoring certificates.tsp:**
The existing `certificates` handler uses `organizationId` / `personId` / `trainingId` / `certificateNumber` / `issuedAt` (from RESEARCH.md Finding 3). The new TypeSpec model should match these exact field names to avoid a data migration. Do NOT invent new field names.

**Build pipeline reminder (3 steps, all required):**
```bash
cd specs/api && bun run build                 # .tsp → openapi.json
cd services/api-ts && bun run generate        # openapi.json → routes/validators/registry
cd packages/sdk-ts && bun run generate        # openapi.json → SDK hooks
```
