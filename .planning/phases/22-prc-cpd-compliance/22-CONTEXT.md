# Phase 22: PRC CPD Compliance - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Training events and credit entries carry PRC accreditation metadata, officers can view per-member CPD compliance summaries, and an accredited providers registry tracks provider status and expiry. Backend schema extensions + handlers + frontend.

</domain>

<decisions>
## Implementation Decisions

### Accreditation Metadata on Training Events
- Extend training event schema with: `prcAccreditationNumber` (varchar), `accreditedProviderId` (FK to provider registry)
- Store PRC accreditation data alongside existing training event fields
- Officers set accreditation info when creating/editing training events

### CPD Credit Entry Enhancement
- Extend credit entry schema with: `category` (enum: General, Major, Self-Directed), `approvalCode` (varchar), `verificationStatus` (enum: pending/verified/rejected)
- Categories follow PRC CPD credit classification
- Officers can set verification status

### Compliance Summary
- Endpoint returns per-member CPD status: total credits earned vs required (40 hours per 3-year cycle)
- Group by category for PRC reporting
- Officer view shows all chapter members' compliance status
- Member self-service shows own compliance

### Accredited Providers Registry
- New table for PRC-accredited training providers: name, accreditationNumber, status (active/suspended/expired), expiryDate
- List endpoint with status filter, highlight providers expiring within 30 days
- CRUD for admin/officer management

### Claude's Discretion
All implementation details at Claude's discretion. Follow existing training handler patterns. Use Drizzle ORM for schema extensions. TypeSpec-first if new API endpoints needed.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Training handlers under `services/api-ts/src/handlers/training/`
- Credit entry schema and repos
- Training event schema
- Person's `prcId` field already exists in schema

### Integration Points
- Training event creation/edit handlers
- Credit entry creation handlers
- Person module (prcId)
- Officer dashboard (compliance view)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user defers to best practices and PRC CPD regulatory compliance.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
