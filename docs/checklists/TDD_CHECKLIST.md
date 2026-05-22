# TDD Checklist

Use this checklist when writing tests spec-first for a vertical slice.

## Test Planning
- [ ] Acceptance criteria identified from slice spec
- [ ] One test per acceptance criterion created (failing first)
- [ ] Business rule tests written
- [ ] Validation tests written (valid inputs + each invalid input variant)
- [ ] Permission tests written (authorized role passes, unauthorized role rejected)
- [ ] State transition tests written (if applicable — e.g., booking status flow)

## Contract & Integration
- [ ] API contract tests verified against OpenAPI spec
- [ ] Edge case tests for boundary conditions (empty lists, max lengths, zero values)

## Execution
- [ ] All tests run and pass: `cd services/api-ts && bun test`
- [ ] No skipped tests without a documented reason in a comment
- [ ] No tests asserting on implementation details (assert behavior, not internals)
