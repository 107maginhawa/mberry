# AGENTS.md

AI guidance for Codex (and any agent) working on **Memberry (lean launch)**.

**Read [CLAUDE.md](./CLAUDE.md) — it is the single source of agent guidance.**
The architecture, current phase, Execution Standards, money/scope rules, and
conventions live there; this file does not duplicate them.

## The one-paragraph version

Memberry is a deliberately small PH dental-chapter **dues + renewals** product.
`services/api-ts` is a **frozen, ~8000-test, contract-gated engine** — additive
changes only, never break existing handlers/schemas. Three thin apps
(`apps/org`, `apps/member`, `apps/console`) will be built on `packages/ui` +
the generated `packages/sdk-ts`, against the OpenAPI spec
(`specs/api/dist/openapi/openapi.json`, the single source of truth). The old
full platform (`apps/memberry`, `apps/admin`) was deleted — reference backup at
`/desktop/memberry-full`. The "module diet" (deleting unused API handlers) is
deferred and NOT in scope.

## Non-negotiable

- **Lean ≠ undisciplined.** Follow the **Execution Standards** in CLAUDE.md:
  spec-first, vertical-slice TDD (real-PG where money/member data moves),
  domain-driven, green gates = done, design on `packages/ui` + DESIGN.md.
- **[DESIGN.md](./DESIGN.md) is design law** (accessibility baseline for older
  users: 18px / ≥48px / WCAG AA-AAA / labeled icons / one task per screen).
- **Never edit generated files** (`generated/**`); regenerate from TypeSpec, then
  regenerate the SDK.
- Verify before claiming done (run the gates; show evidence).
