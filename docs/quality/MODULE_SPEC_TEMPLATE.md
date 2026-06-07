# MODULE_SPEC: <module-name>

> Canonical template. Fill in every section. Mark unknowns as `TBD` rather than skipping — surfaces missing context.

## 1. Purpose
One paragraph: what business capability this module provides.

## 2. Bounded Context
Domain owned by this module. What's in vs out of scope. Adjacent modules + interface boundaries.

## 3. Handler Inventory
| Handler file | Verb | Auth required | Audit action | Notes |
|---|---|---|---|---|
| createX.ts | POST /x | officer (org) | `x.create` | … |
| ... | | | | |

## 4. TypeSpec source
Path to module's `.tsp` (e.g. `specs/api/src/modules/<module>/index.tsp`).

## 5. Database schema
Paths to `*.schema.ts` files under `repos/`.

## 6. Cross-module dependencies
- Emits domain events: `x.created`, `x.deleted`
- Consumes events from: ...
- Calls handlers from: ... (rare — most should go through events)

## 7. Test coverage status
- Unit tests: <N>/<M> handlers covered (<P>%)
- Contract scenarios: <N> Hurl files in `specs/api/tests/contract/<module>/`
- E2E: <N> specs at `apps/memberry/tests/e2e/<module>*`

## 8. Hand-wired routes (if any)
Link to `docs/quality/HAND_WIRED_ROUTES.yaml` entries; cite the allowed reason.

## 9. Known gotchas
Documented edge cases, historical bugs, surprising invariants.

## 10. AI extension checklist

To add a new endpoint to this module:
1. `specs/api/src/modules/<module>/...tsp` — declare operation + `@extension`s
2. `services/api-ts/src/handlers/<module>/<verbResource>.ts` — handler impl
3. `services/api-ts/src/handlers/<module>/<verbResource>.test.ts` — unit test
4. `specs/api/tests/contract/<module>/<verbResource>.hurl` — contract scenario
5. Run: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`
6. Frontend hook auto-generated; no manual SDK edits

Forbidden:
- Editing `services/api-ts/src/generated/**`
- Adding to `app.ts` unless reason fits HAND_WIRED_ROUTES.yaml allowed-reason set
- Verb prefixes `new*`/`make*`/`do*`/`process*` in handler scope
