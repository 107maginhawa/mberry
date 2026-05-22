# Vertical Slice Checklist

Use this checklist when implementing a new vertical slice end-to-end.

## Spec & API Definition
- [ ] Slice spec read and understood
- [ ] TypeSpec definition created/updated in `specs/api/src/modules/`
- [ ] `cd specs/api && bun run build` — OpenAPI + types generated
- [ ] `cd services/api-ts && bun run generate` — routes/validators/handlers generated

## Backend Implementation
- [ ] Handler implemented with business logic in `services/api-ts/src/handlers/`
- [ ] Repository created/updated (extends `DatabaseRepository`)
- [ ] Server-side validation working (Zod schemas via generated validators)
- [ ] Permissions enforced (Better-Auth role checks)
- [ ] Error states handled: validation, permission, not-found, unexpected
- [ ] Audit logging added (if required by spec)

## Frontend Integration (full-stack slices only)
- [ ] Frontend route/component integrated with real API via SDK hooks
- [ ] Client-side validation working
- [ ] Loading, success, and empty states handled
- [ ] Error states surfaced to the user

## Quality & Contracts
- [ ] Tests written and passing: `cd services/api-ts && bun test`
- [ ] Contract tests pass: `bun run test:contract`
- [ ] Type checking passes: `bun run typecheck`
- [ ] Lint passes: `bun run lint`

## SDK & Scope
- [ ] SDK regenerated if API changed: `cd packages/sdk-ts && bun run build`
- [ ] No unrelated modules changed
- [ ] Assumptions and gaps documented
