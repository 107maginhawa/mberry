# Phase 19: Account Deletion + Data Export - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can request deletion of their account (with 30-day grace period and cancellation) and export all personal data as machine-readable JSON, satisfying Philippine Data Privacy Act (DPA 2012) requirements. Backend handlers + scheduled job + account settings UI.

</domain>

<decisions>
## Implementation Decisions

### Account Deletion Flow
- Member requests deletion from account settings → sets `deletionRequestedAt` + `deletionScheduledAt` (now + 30 days)
- Member can cancel before 30-day window closes → clears deletion timestamps
- Scheduled job runs daily, finds records past `deletionScheduledAt` → anonymizes PII in-place
- Anonymization replaces: firstName, lastName, middleName with "DELETED", contactInfo with `{email: "deleted@deleted.invalid", phone: null}`, primaryAddress with null, avatar with null, dateOfBirth with null, licenseNumber/prcId/specialization with null
- Financial records (dues payments, invoices) preserved — amounts and dates retained, personId FK remains but person data is anonymized
- Better-Auth session/account data cleaned up on execution

### Data Export
- JSON export includes: profile, memberships, dues payments, training credits, certificates, events attended, notification preferences, privacy settings
- Export endpoint returns JSON directly (no background job needed for typical data volume)
- Export available to the authenticated user only (self-service)
- No admin export endpoint needed for MVP — officers can see member data via roster

### Audit Log PII Protection
- Anonymization writes use a special audit action type that omits `before_state` payload
- This prevents PII from being captured in audit logs during the anonymization process
- Normal audit entries for deletion request/cancel retain standard before_state

### UI Implementation
- Add "Delete Account" section to existing `/settings/account` page in account app
- Show deletion status (not requested / pending with countdown / completed)
- "Request Deletion" button with confirmation dialog explaining 30-day grace period
- "Cancel Deletion" button shown when deletion is pending
- "Export My Data" button downloads JSON file
- Use sonner toast for confirmation messages (per CLAUDE.md convention)

### Claude's Discretion
All remaining implementation details at Claude's discretion. Follow existing handler patterns (requestMyAccountDeletion.ts etc. — likely stubs to implement). Use existing job infrastructure from core/jobs.ts. Follow Drizzle ORM patterns for queries.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Person schema already has `deletionRequestedAt`, `deletionScheduledAt`, `deletionCompletedAt` timestamp columns
- 7 handler files already exist (likely stubs): requestAccountDeletion, requestMyAccountDeletion, cancelAccountDeletion, cancelMyAccountDeletion, executeAccountDeletion, exportMyData, exportPersonData
- Job infrastructure at `services/api-ts/src/core/jobs.ts`
- Audit middleware at `services/api-ts/src/middleware/audit.ts`
- Account settings page at `apps/account/src/routes/_dashboard/settings/account.tsx`

### Established Patterns
- Handler pattern: Router → Validators → Handlers → Repositories
- Job pattern: register in `jobs/` directory, use core/jobs infrastructure
- Audit: after-middleware captures write operations automatically
- UI: TanStack Router file-based routing, sonner toasts, shadcn components

### Integration Points
- Person repo at `services/api-ts/src/handlers/person/repos/person.repo.ts`
- Membership, dues, training, certificates, events repos for data export aggregation
- Better-Auth session cleanup on account deletion execution

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user defers to best practices and Philippine DPA 2012 compliance standards.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
