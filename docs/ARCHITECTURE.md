# Architecture

> **Canonical architecture doc lives at the repo root: [`../ARCHITECTURE.md`](../ARCHITECTURE.md).**
>
> This file is a redirect. The root document is the technical source of truth
> (referenced by `CLAUDE.md`, `CONTRIBUTING.md`, `QUICKSTART.md`, the
> `services/api-ts/src/core/schema-registry.test.ts` ratifying-ADR test, and
> multiple skill / `.planning/` files).
>
> The prior monorepo-structure snapshot that lived here was derived from the
> 2026-05-08 OLI codebase-adoption audit, which has since been archived. Its
> unique sections — Deployment Topology, Request Flow / Vite Proxy, and
> Middleware Stack — were refreshed against current code and folded into the
> canonical root guide; the rest was already covered there.

For:
- High-level architecture, philosophy, tech stack, module pattern, vertical-slice flow → [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- Monorepo directory layout → [`./README.md`](./README.md) and [`../README.md`](../README.md)
- ADRs → [`./architecture/adr/`](./architecture/adr/)
- One-off architectural notes → [`./architecture/`](./architecture/)
