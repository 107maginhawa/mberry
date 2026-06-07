# Module Specification: [Module Name]

**Parent PRD:** [docs/prd/PRODUCT_NAME.md]
**Version:** [0.1.0]
**Date:** [YYYY-MM-DD]
**Author:** [Name]
**Status:** Draft | Review | Approved

---

## 1. Module Purpose

**What it does:**
<!-- One paragraph. What problem does this module solve within the product? -->

**Why it exists (not handled by built-ins):**
<!-- Why isn't person / booking / billing / notifs etc. sufficient? What's domain-specific? -->

**Handler path:** `services/api-ts/src/handlers/[module]/`
**TypeSpec path:** `specs/api/src/modules/[module].tsp`

---

## 2. Domain Terminology

<!-- Define terms as used in THIS module. Prevents ambiguity in ACs and tests. -->

| Term | Definition |
|------|------------|
| [Term] | <!-- what it means in this domain --> |
| [Term] | |

---

## 3. Entity / Data Model

<!-- High-level — not SQL, not TypeSpec yet. Just shapes and relationships. -->

| Entity | Key Fields | Relationships |
|--------|------------|---------------|
| [EntityName] | id, [field1], [field2], created_at | belongs to [Other], has many [Other] |
| | | |

**Schema path (once created):** `services/api-ts/src/handlers/[module]/repos/[module].schema.ts`

---

## 4. Business Rules

<!-- Numbered so slices and tests can reference them exactly. -->
<!-- Each rule should be independently testable. -->

1. [Rule: e.g. "A [Entity] can only be created by a user with role [X]"]
2. [Rule: e.g. "A [Entity] transitions from [StateA] to [StateB] only when [condition]"]
3. [Rule: e.g. "Deleting a [Parent] cascades to [Child] records"]

---

## 5. Vertical Slice Inventory

<!-- Each row maps to a SLICE_SPEC.template.md file. -->
<!-- Slices are ordered by dependency — foundational CRUD before derived operations. -->

| Slice Name | Type | Priority | Description |
|------------|------|----------|-------------|
| Create [Entity] | full-stack / backend-only | P0 | <!-- what the user/system does --> |
| List [Entity] | full-stack / backend-only | P0 | |
| Update [Entity] | full-stack / backend-only | P1 | |
| Delete [Entity] | backend-only | P1 | |
| [Domain Action] | full-stack / backend-only | P1 | <!-- non-CRUD operations --> |

---

## 6. Permissions Matrix

<!-- Roles come from Better-Auth configuration. -->

| Action | Roles Allowed | Notes |
|--------|---------------|-------|
| Create [Entity] | [role1], [role2] | <!-- any conditions --> |
| Read own [Entity] | [role1] | |
| Read any [Entity] | [role2] | |
| Update [Entity] | [role1] | |
| Delete [Entity] | [role2] | <!-- soft delete vs hard delete --> |

---

## 7. Dependencies on Other Modules

| Module | Why Needed |
|--------|------------|
| person | <!-- e.g. Links [Entity] to person.id for ownership --> |
| [other] | |

---

## 8. Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1.0 | [YYYY-MM-DD] | [Name] | Initial draft |
