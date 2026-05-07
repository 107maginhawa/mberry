# Phase 1: Billing Schema Completion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 1-billing-schema-completion
**Areas discussed:** Line items storage, Access control model, Invoice lifecycle flow, Metadata & context usage

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Line items storage | JSONB column on invoice vs separate line_items table | ✓ |
| Access control model | Who can do what with billing endpoints | ✓ |
| Invoice lifecycle flow | Valid transitions, void rules, refund scope | ✓ |
| Metadata & context usage | How Memberry uses metadata/context for dues tracking | ✓ |

**User's choice:** "I defer to your judgment"
**Notes:** User deferred all four gray areas to Claude's judgment. Decisions made based on codebase patterns (TypeSpec definitions, existing schema), domain context (healthcare association dues), and simplicity-first approach.

---

## Line Items Storage

| Option | Description | Selected |
|--------|-------------|----------|
| JSONB column | Store as JSON array on invoice table | ✓ |
| Separate table | Normalized line_items table with FK to invoice | |

**User's choice:** Claude's discretion
**Notes:** JSONB chosen — association dues have 1-3 line items per invoice. No reporting queries against individual line items anticipated. TypeSpec model maps cleanly to JSONB.

---

## Access Control Model

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-only all ops | Only admins can CRUD invoices | |
| Admin write, customer read own | Admin creates/manages, customers view their invoices | ✓ |
| Open read | Any authenticated user can view any invoice | |

**User's choice:** Claude's discretion
**Notes:** Admin write + customer read-own matches the association model (officers manage dues, members view their invoices).

---

## Invoice Lifecycle Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Simple linear | draft → open → paid/void, no reopen | ✓ |
| With refunds | Include refund status and entity | |
| Full state machine | All transitions including partial payment, dispute | |

**User's choice:** Claude's discretion
**Notes:** Simple linear flow sufficient for v1 dues billing. Refunds deferred to future phase.

---

## Metadata & Context Usage

| Option | Description | Selected |
|--------|-------------|----------|
| Idempotency + tracking | context for dedup, metadata for arbitrary data | ✓ |
| Structured metadata | Enforce schema on metadata contents | |

**User's choice:** Claude's discretion
**Notes:** Context format `{entity}:{period}:{identifier}` for dues deduplication. Metadata left schema-free for flexibility.

---

## Claude's Discretion

- All four gray areas were deferred to Claude's judgment
- Schema field wiring (authorizedAt, authorizedBy, etc.)
- Migration generation approach
- Test fixture structure
- Handler refactoring approach

## Deferred Ideas

- Refund handling — future phase
- Stripe webhook integration — future phase
- Invoice PDF generation — future phase
- Recurring billing / subscriptions — future phase
