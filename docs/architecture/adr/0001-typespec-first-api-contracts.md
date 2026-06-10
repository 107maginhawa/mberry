# ADR-0001: TypeSpec-first API contracts

- Status: Accepted
- Date: 2026-06-06
- Deciders: Memberry team

## Context

The platform must serve multiple frontend apps (memberry, admin), a generated TypeScript SDK, and future polyglot server implementations (Rust, Go). Without a single authoritative API definition, each client and server can drift independently, breaking type safety and creating undocumented behavioral differences.

Early development used ad-hoc Hono route definitions without a schema layer. As the handler count grew past 100, the lack of a contract became a maintenance risk: no enforced request validation, no auto-generated docs, and no mechanism to detect breaking changes in CI.

TypeSpec was chosen as the authoring language rather than writing OpenAPI directly, because TypeSpec's type system (interfaces, generics, `@extension` decorators) allows DRY definitions that compile to OpenAPI 3.x. The compiled artifact (`specs/api/dist/openapi/openapi.json`) is then the single source of truth that drives:
- Route registration + Zod validators (`services/api-ts/src/generated/openapi/`)
- TypeScript types (`@monobase/api-spec`)
- Client SDK TanStack Query hooks (`packages/sdk-ts/`)
- Hurl contract tests (`specs/api/tests/contract/`)

Source: CLAUDE.md §"API-First Development", CONTRIBUTING.md §"API-First Development", README.md §"Spec-first, polyglot-ready".

## Decision

TypeSpec is the single source of truth for all API shapes. OpenAPI, handler stubs, validators, routes, and the client SDK are all generated from it. No route may be added to the generated router without a TypeSpec operation definition.

## Consequences

### Positive
- Type safety across frontend and backend guaranteed at compile time.
- OpenAPI docs are always current — no manual sync.
- Polyglot future: any language can implement the contract by reading the same OpenAPI doc.
- Breaking-change detection in CI via Schemathesis fuzz testing.

### Negative / tradeoffs
- Every new endpoint requires a TypeSpec → build → generate pipeline step before the handler can be implemented. Adds ~2-3 min to the inner loop.
- TypeSpec compiler errors are unfamiliar to developers who only know OpenAPI or JSON Schema.
- A small class of routes cannot be expressed cleanly in TypeSpec (see ADR-0002).

### Neutral
- The generated files (`src/generated/openapi/`) are never edited manually. The `DO_NOT_EDIT` header is enforced by code review convention, not tooling.

## Alternatives considered

- **Write OpenAPI YAML directly** — rejected because OpenAPI YAML has no type system; repetition is high and DRY is impossible without extensions.
- **Hand-write Hono routes with inline Zod** — rejected because it produces no canonical machine-readable contract, blocks polyglot growth, and was the previous state that caused the problem.
- **Protobuf / gRPC** — rejected because the frontend ecosystem (TanStack Query, fetch-based SDKs) is HTTP/REST-native; adding a gRPC layer adds infra complexity without benefit.

## References

- `CLAUDE.md` §"API-First Development"
- `CONTRIBUTING.md` §"API-First Development > Workflow Steps"
- `specs/api/CONTRACT.md` — wire-level contract every implementation must satisfy
- `specs/api/IMPLEMENTING.md` — playbook for adding a new server impl or client SDK
- `services/api-ts/scripts/generate.ts` — code generation pipeline
- `specs/api/dist/openapi/openapi.json` — canonical API artifact
