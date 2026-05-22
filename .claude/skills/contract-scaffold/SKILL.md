---
name: contract-scaffold
description: Generate FAILING Hurl contract test scenarios from OpenAPI spec for a module. RED phase for API contracts — scaffolds .hurl files with auth flows, happy paths, error codes, and multi-step journeys. Use after backend GREEN, "write contract tests", "scaffold hurl", "contract RED phase".
---

# contract-scaffold

RED phase for API contracts. Generates failing Hurl scenarios from the OpenAPI spec, following the established patterns in `specs/api/tests/contract/`. Covers happy paths, error responses, edge cases, and multi-step flows.

## Triggers

- After backend implementation passes unit tests (Step 6 of VERTICAL_TDD)
- "Write contract tests for {module}", "scaffold hurl"
- "Contract RED phase", "add hurl scenarios"
- Automatically dispatched by `/develop` after backend GREEN

## Source Files

- **OpenAPI spec**: `specs/api/dist/openapi/openapi.json`
- **Existing contracts**: `specs/api/tests/contract/*.hurl`
- **Contract runner**: `scripts/run-contract-tests.ts`
- **BR registry**: `docs/ver-3/business/br-registry.json` (for BR-tagged scenarios)

## Workflow

### Step 1: Read OpenAPI Spec for Module

Extract from `specs/api/dist/openapi/openapi.json`:
- All paths matching the module (e.g., `/members`, `/members/{id}`, `/members/{id}/activate`)
- HTTP methods per path
- Request body schemas (required fields, types, constraints)
- Response schemas per status code (200, 201, 400, 401, 403, 404, 409, 422)
- Query parameters (filters, pagination, sorting)

### Step 2: Study Existing Patterns

Read 2-3 existing `.hurl` files to match conventions:

**Auth flow pattern** (from existing files):
```hurl
### 0. Sign in as admin (captures session cookie)
POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "admin@test.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200
[Captures]
admin_cookie: cookie "better-auth.session_token"
```

**CRUD flow pattern**:
```hurl
### 1. Create resource
POST {{api}}/{module}
Content-Type: application/json
Cookie: better-auth.session_token={{admin_cookie}}
{
  "field": "value"
}
HTTP 201
[Captures]
resource_id: jsonpath "$.id"

### 2. Get resource
GET {{api}}/{module}/{{resource_id}}
Cookie: better-auth.session_token={{admin_cookie}}
HTTP 200
[Asserts]
jsonpath "$.field" == "value"
```

**Error pattern**:
```hurl
### N. Reject invalid payload
POST {{api}}/{module}
Content-Type: application/json
Cookie: better-auth.session_token={{admin_cookie}}
{
  "field": ""
}
HTTP 422
```

### Step 3: Generate Hurl Scenarios

Create `specs/api/tests/contract/{module}-flow.hurl` with sections:

**A. Auth setup** (always first):
- Sign in as appropriate role (admin, member, or both for role-based tests)
- Capture session cookie

**B. Happy path CRUD** (core flow):
- CREATE with valid payload → 201, capture ID
- GET by ID → 200, assert fields match
- LIST → 200, assert created resource in list
- UPDATE with valid payload → 200, assert changed fields
- DELETE → 200 or 204

**C. Validation errors** (from OpenAPI required fields + constraints):
- Missing required fields → 422
- Invalid types (string where number expected) → 422
- Boundary violations (from BR edge cases) → 422
- Empty body → 400 or 422

**D. Auth/authz errors**:
- No cookie → 401
- Wrong role (if role-based) → 403
- Access other user's resource → 403 or 404

**E. Not found**:
- GET with fake UUID → 404
- UPDATE non-existent → 404
- DELETE non-existent → 404

**F. Multi-step journeys** (if module has state transitions):
- Create → Activate → Deactivate flow
- Create → Attempt invalid transition → error

**G. BR-tagged scenarios** (from br-registry.json):
- One scenario per testable BR with `### [BR-##]` comment

### Step 4: Add Variable Configuration

Ensure file uses project's Hurl variables:
```hurl
# Variables: {{api}} = API base URL, {{suffix}} = unique test suffix
# Run with: hurl --variable api=$API_URL --variable suffix=$(date +%s)
```

### Step 5: Run and Confirm RED

```bash
cd specs/api && hurl --test --variable api=http://localhost:7213 \
  --variable suffix=$(date +%s) \
  tests/contract/{module}-flow.hurl
```

Expected: ALL new scenarios FAIL (endpoints may not handle all cases yet, or return wrong status codes).

### Step 6: Report

```
CONTRACT SCAFFOLD: {module}
═══════════════════════════

File: specs/api/tests/contract/{module}-flow.hurl
Scenarios: 18 total
  - Auth setup: 1
  - Happy path CRUD: 5
  - Validation errors: 5
  - Auth/authz errors: 3
  - Not found: 3
  - State transitions: 1
  - BR-tagged: 2 ([BR-05], [BR-07])

Status: ALL FAILING (RED)
Next: Fix handlers until all scenarios pass (GREEN)
```

## Hurl Syntax Reference

```hurl
# Captures (save response values)
[Captures]
id: jsonpath "$.id"
cookie_val: cookie "name"

# Asserts (verify response)
[Asserts]
jsonpath "$.name" == "expected"
jsonpath "$.items" count == 3
jsonpath "$.total" >= 0
header "Content-Type" contains "json"

# Options (retries, delays)
[Options]
retry: 5
retry-interval: 1000ms

# Query params
GET {{api}}/items?page=1&limit=10

# File upload
POST {{api}}/upload
[MultipartFormData]
file: file,test.pdf; application/pdf
```

## Rules

- ALWAYS start with auth setup — never assume existing session
- Use `{{suffix}}` or timestamps for unique test data (avoid conflicts between runs)
- Match existing file naming: `{module}-flow.hurl` for main flow, `{module}-edge.hurl` for edge cases
- Include ALL error codes declared in OpenAPI spec — don't skip 403 or 409
- Capture IDs from create responses — use them in subsequent requests (no hardcoded UUIDs)
- Test pagination if LIST endpoint supports it (`?page=1&limit=1` + assert count)
- NEVER modify existing `.hurl` files — create new ones or append sections
- If module needs seed data that doesn't exist, note it as prerequisite
