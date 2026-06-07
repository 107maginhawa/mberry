# QA Review Checklist

Use this checklist when reviewing a PR before merge.

## Acceptance Criteria
- [ ] All acceptance criteria from slice spec satisfied
- [ ] Definition of Done met (see CONTRIBUTING.md)
- [ ] Each error scenario described in the spec is handled and verified

## Regression & Correctness
- [ ] No regressions — existing tests still pass: `cd services/api-ts && bun test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] Lint passes: `bun run lint`
- [ ] Contract tests pass: `bun run test:contract`

## Frontend (full-stack slices only)
- [ ] Frontend renders correctly in the browser
- [ ] Responsive behavior verified for target breakpoints
- [ ] Loading, empty, and error states render as expected

## Security & Compliance
- [ ] PII not logged in plain text (check Pino log calls)
- [ ] Permissions enforced — unauthorized requests return 401/403
- [ ] Consent fields checked before processing (if spec requires)

## Code Health
- [ ] No generated files manually edited (`src/generated/` is untouched)
- [ ] No unrelated modules changed
- [ ] Assumptions and gaps documented in PR description
- [ ] PR description includes layer coverage: UI, API, validation, permissions, data, tests
