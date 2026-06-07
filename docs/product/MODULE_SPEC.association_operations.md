# MODULE_SPEC: association:operations

> Generated as part of Step-2 (MODULE_SPEC backfill).
>
> Sister module to `association:member`. This module owns the **operational** surface of an association (events, training, committees, governance reporting, accredited providers, national-dashboard export); `association:member` owns the **identity / lifecycle** surface (memberships, credentials, credits, elections, chapter affiliations, dues payments).
>
> The split was the Wave-3.5 verdict: "KEEP-AS-IS". Do not merge with `association:member`; the mega-module rebuild plan is scoped only to `association:member`.

## 1. Purpose

Owns everything an association *does* that isn't directly a membership-record mutation: hosting events with paid registrations and waitlists, running training programs with courses + enrollments + quizzes, organising committees with tasks and dissolution, registering accredited CPD providers, and producing the national-dashboard CSV / KPI export for federation-level reporting.

The module assumes the member record already exists (created via `invite` + `association:member`) and that dues / billing are wired up elsewhere — handlers compose those modules, they do not duplicate them.

## 2. Bounded Context

**Owns:**
- Events: lifecycle (draft → published → completed / cancelled), registrations, check-ins, waitlists, refunds, paid-event Stripe flow.
- Training: courses, enrollments, quizzes, progress tracking, certificates issuance (delegates the PDF render to `certificates`).
- Committees: creation, member tasks, dissolution.
- Accredited providers: per-org list of CPD providers whose external training counts toward member credits.
- National dashboard export: aggregated per-org KPIs for federation reporting.

**Out of scope:** the actual membership / credit / credential rows (those live in `association:member` — this module reads them, never writes them), Stripe API integration (lives in `billing`), document generation (`documents` + `certificates`), notification delivery (`notifs`).

**Adjacent modules:**
- `association:member` — credit award after training completion is published as a domain event; the consumer in `association:member` writes the credit entry.
- `billing` — paid event registration calls into the billing module's stripe flow; refunds dispatch through there.
- `certificates` — issuance is a domain event; certificate PDF rendering is owned by `certificates`.
- `notifs` — registration confirmation, training completion, committee task assignment all fan out via notification-triggers.
- `documents` — uploaded materials (event flyers, course attachments) live in `storage` via `documents`.

## 3. Handler Inventory

Approximately 69 handlers grouped by sub-domain. Spot-check the registry imports under `services/api-ts/src/generated/openapi/registry.ts` for the live list; the groups below are stable but individual handler counts drift as the module evolves.

**Events (paid + free) — ~25 handlers:**
`createEvent`, `getEvent`, `updateEvent`, `deleteEvent`, `searchEvents`, `publishEvent`, `cancelEvent`, `completeEvent`, `createEventRegistration`, `getEventRegistration`, `updateEventRegistration`, `deleteEventRegistration`, `cancelEventRegistration`, `refundEventRegistration`, `searchEventRegistrations`, `registerAndPayForEvent`, `registerForCustomEvent`, `listMyCustomEvents`, `listCustomEventRegistrations`, `listCustomEventAttendance`, `checkInCustomEvent`, `createCheckIn`, `searchCheckIns`, `listWaitlistEntries`, `promoteWaitlistEntry`.

**Training (courses + enrollments + quizzes) — ~25 handlers:**
`createTraining`, `getTraining`, `updateTraining`, `deleteTraining`, `searchTrainings`, `publishTraining`, `cancelCustomTraining`, `completeCustomTraining`, `checkInCustomTraining`, `enrollInCustomTraining`, `listMyCustomTrainings`, `listCustomTrainingEnrollments`, `createTrainingEnrollment`, `getTrainingEnrollment`, `updateTrainingEnrollment`, `deleteTrainingEnrollment`, `completeTrainingEnrollment`, `searchTrainingEnrollments`, `createCourse`, `getCourse`, `updateCourse`, `deleteCourse`, `searchCourses`, `createCourseEnrollment`, `getCourseEnrollment`, `updateCourseEnrollment`, `deleteCourseEnrollment`, `updateCourseProgress`, `searchCourseEnrollments`, `createQuizAttempt`, `searchQuizAttempts`.

**Committees + tasks — ~7 handlers:**
`createCommittee`, `getCommittee`, `listCommittees`, `updateCommittee`, `dissolveCommittee`, `createCommitteeTask`, `updateCommitteeTask`, `completeCommitteeTask`.

**Accredited providers — 4 handlers:**
`listOrgAccreditedProviders`, `createOrgAccreditedProvider`, `updateOrgAccreditedProvider`, `deleteOrgAccreditedProvider`.

**National dashboard — 1 handler:**
`exportNationalDashboard` (CSV / aggregated KPI snapshot for federation reporting).

Verb conventions follow CLAUDE.md §"Handler verb conventions" — `registerForEvent` and `registerAndPayForEvent` use the restricted `register*` prefix because that is the domain verb users invoke.

## 4. TypeSpec source

Per-sub-domain `.tsp` files under `specs/api/src/association/operations/`:
- `events.tsp` — event + registration + check-in operations.
- `training.tsp` — course + training + enrollment + quiz operations.
- `conference.tsp`, `marketing.tsp`, `portal.tsp`, `publications.tsp`, `volunteer.tsp` — adjacent sub-domains; some operations are declared but not yet implemented (`marketplace.tsp` and `announcements.tsp` declare additional ops that may surface in this handler dir over time).
- Committees are declared in `specs/api/src/association/member/governance.tsp` because they shared a registration earlier; despite the `.tsp` location, the *handlers* live here.

If you cannot find the `.tsp` source for an operation, look first under `specs/api/src/association/operations/`, then `specs/api/src/association/member/`, then ripgrep the operationId.

## 5. Database schema

Five `*.schema.ts` files under `handlers/association:operations/repos/`:
- `events.schema.ts` — events, registrations, check-ins, waitlists.
- `training.schema.ts` — trainings, courses, enrollments, quiz attempts, progress.
- `committee.schema.ts` — committees, committee members.
- `committee-task.schema.ts` — committee tasks, status, assignment.
- `accredited-provider.schema.ts` — per-org accredited CPD providers.

All tables are multi-tenant scoped on `organizationId`.

## 6. Cross-module dependencies

- **Emits domain events** (see `core/domain-events.registry.ts` for canonical names):
  - `event.published`, `event.cancelled`, `event.completed`
  - `event.registered`, `event.checked-in`, `event.registration-cancelled`, `event.refunded`
  - `training.published`, `training.completed`
  - `training.enrolled`, `training.completed-by-person`
  - `committee.created`, `committee.dissolved`
  - `committee.task-assigned`, `committee.task-completed`
- **Consumes events from:**
  - `person.deleted` — consumer in `core/domain-event-consumers.ts` scrubs event registrations + training enrollments + committee memberships owned by the deleted person.
  - `dues.*` events influence registration eligibility (members in arrears may be blocked from registering); the gate is read-only — `association:operations` queries the dues repo, doesn't mutate it.
- **Calls handlers from:** prefer events over direct calls. Today, `registerAndPayForEvent` calls into the billing module's flow directly (Stripe init); long-term this should also be event-driven.

## 7. Test coverage status

- Unit tests: dense — every handler has at least one accompanying `*.test.ts`. Domain test suites (`events.test.ts`, `training.test.ts`, `training-lifecycle.test.ts`, `committees.test.ts`, `quiz.test.ts`, `custom-events.test.ts`, `register-and-pay.test.ts`, etc.) cover cross-handler flows.
- Contract scenarios: ~8 dedicated Hurl files under `specs/api/tests/contract/`:
  - `assoc-event-lifecycle-flow.hurl`, `assoc-events-flow.hurl`, `assoc-events-checkins-flow.hurl`, `assoc-events-registrations-flow.hurl`
  - `assoc-training-courses-flow.hurl`, `assoc-training-enrollments-flow.hurl`, `assoc-training-lifecycle-flow.hurl`, `assoc-training-main-flow.hurl`
- E2E: covered by `apps/memberry/tests/e2e/officer/*`, `journeys/training-to-credit.spec.ts`, and `member/training-browse.spec.ts`. Several of these are in the W2 selector-only depth-debt; see SCORECARD row "E2E real-flow".

## 8. Hand-wired routes

None known. All operations go through the generated registry; `app.ts` does not have direct registrations for `association:operations` handlers.

## 9. Known gotchas

- **`association:operations` is NOT the mega-module.** The mega-module rebuild plan is scoped to `association:member`. This module is structurally fine — Wave-3.5 reviewed it and confirmed KEEP-AS-IS. Do not collapse the two.
- **Two parallel naming styles: "custom" prefix.** `registerForCustomEvent` / `checkInCustomEvent` / `cancelCustomTraining` etc. — the "custom" prefix marks operations that act on org-owned events/trainings (as opposed to system-curated ones). The non-custom variants exist for system-curated content. When adding a new operation, follow the prefix convention rather than adding "Org" / "My" suffixes.
- **Waitlist promotion is its own operation.** Don't fold it into `cancelEventRegistration` — the cancel handler emits `event.registration-cancelled`, and a separate consumer should call `promoteWaitlistEntry` (today this is sequential inside `cancelEventRegistration` and should be migrated to an event-driven flow when the rebuild plan touches registration lifecycle).
- **`exportNationalDashboard` is heavy.** Aggregates across orgs. Has rate-limit + audit-log integration; do not call it inline from a UI handler — it's a CSV download endpoint, treated as a long-running response.
- **`completeTrainingEnrollment` is the credit-award trigger.** It emits `training.completed-by-person`; the consumer in `association:member` writes the credit entry. Do not call the credit repo directly from a training handler — that bypasses the audit + journal contract.
- **Hand-off from billing comes back here for refund.** `refundEventRegistration` is the local handler; billing fires the Stripe refund and then this module marks the registration as refunded + emits the event. Refund races (double-fire) are protected by the `(eventRegistrationId)` idempotency key on the refund row in `billing`.

## 10. AI extension checklist

To add a new endpoint to this module:

1. Decide which sub-domain you're in (events / training / committee / accredited-provider / dashboard) — your `.tsp` source file lives accordingly under `specs/api/src/association/operations/`. Operations are grouped by sub-domain in the TypeSpec dir, NOT by HTTP namespace.
2. Add the operation in the right `.tsp` file. For org-scoped mutations add `@extension("x-audit", #{ action: "...", resourceType: "<event/training/committee/...>" })`. For officer-only mutations add `@extension("x-require-officer", true)` (path mode) or `#{ from: "body.organizationId" }` (body mode). For privileged-title gates use `@extension("x-require-position", #["President", "Treasurer", ...])`.
3. Implement under `services/api-ts/src/handlers/association:operations/<verbResource>.ts`. Reuse the repo for the sub-domain (`events.repo.ts`, `training.repo.ts`, etc.); never raw SQL.
4. Cross-module side effects MUST go through `domainEvents.emit(...)`. No direct call into `association:member`, `billing`, `notifs`. The event names + payload shapes are in `core/domain-events.registry.ts`.
5. Unit test (`<verbResource>.test.ts`) + extend the appropriate Hurl file (`assoc-event-*-flow.hurl` or `assoc-training-*-flow.hurl`).
6. Regenerate: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`.

Forbidden:
- Editing `services/api-ts/src/generated/**`.
- Writing to `membership`, `credit_entry`, `professional_license`, `chapter_affiliation`, `dues_payment`, or any other table owned by `association:member`. Read is fine; write happens via event.
- Calling Stripe directly. Use the `billing` module's flow.
- Hand-wiring a new route in `app.ts` — the operation namespace is registry-driven and any allow-list addition needs a clearly documented reason.
- Adding a new "custom*" handler without a matching system-curated variant if you are introducing a new resource type — pick a single naming convention before scaling.

When in doubt about whether something belongs here vs `association:member`: ask "does this mutate a membership identity record?" If yes → `association:member`. If it's about *what the org is doing* (events, training, committees, programs) → here.
