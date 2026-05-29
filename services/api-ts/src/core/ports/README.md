# core/ports

Hexagonal-architecture port interfaces. Middleware and other core/ code
depend on these abstractions, not directly on handler-owned repositories.

## Why

The cycle-3 audit (IC-01) catalogued 20 inverted `core → handler` imports.
Wave G2 slice **S-C4-014** removes the four highest-traffic ones in
`middleware/{officer-auth, impersonation-guard, platform-admin-auth, org-context}`
by routing them through ports defined here.

## Boundary rule

- **Port** lives in `core/ports/<name>.ts`. Pure TypeScript interface, no
  Drizzle imports.
- **Adapter** lives next to the owning repo, e.g. governance.repo.ts may
  export a `governanceRepoPort(db)` factory that returns an object
  conforming to the port. Handler code is free to import its own repos
  directly; only `core/` and `middleware/` must depend on the port.
- **Wire-up** happens in `app.ts` (or test setup): the adapter factory is
  invoked once per request via a thin lookup helper (`getPort(ctx, db)`),
  which lazily constructs the adapter so production code keeps its current
  ergonomics.

## Current ports

| Port | File | Replaces |
|------|------|----------|
| `GovernancePort` | `governance.port.ts` | `OfficerTermRepository` direct import in `middleware/officer-auth.ts` |
| `PlatformAdminPort` | `platform-admin.port.ts` | `PlatformAdminRepository` + `ImpersonationSessionRepository` imports in `middleware/{platform-admin-auth, impersonation-guard, org-context}` |
| `MembershipPort` | `membership.port.ts` | Raw `db.select().from(memberships)` queries in `middleware/org-context.ts` |

## Adding a port

1. Define the interface in `core/ports/<name>.port.ts` — narrow to only the
   methods the core consumer needs.
2. Export an adapter factory from the handler repo file:
   `export function <name>RepoPort(db: DatabaseInstance): <Name>Port { ... }`.
3. Register the factory in `core/ports/index.ts` so `getPort(ctx, name)`
   can resolve it without `core/` importing handler code.
4. Refactor the middleware/core consumer to depend on the port.
5. Add a contract test in `core/ports/<name>.port.test.ts` that proves the
   adapter satisfies the interface (TypeScript covers structural matches;
   add a runtime smoke test for shape).
