# User Journeys

> Hand-maintained. Define persona journeys here — generate.ts cross-references
> these against routes, BRs, and E2E tests to surface gaps.
>
> Format per journey:
> - Steps: `N. GET /route/path → description`
> - BRs: comma-separated BR references
> - Priority: P0 (critical) / P1 (important) / P2 (standard)
> - Status: mapped / partial / todo

## Persona: Member (Dr. Maria Santos)

### J-M01: First-time onboarding
1. GET /auth/sign-in → sign in with credentials
2. GET /onboarding → complete profile setup
3. GET /dashboard → see org memberships and status
4. GET /org/$orgId/dues → view dues status for first org
- BRs: BR-01, BR-03, BR-04
- Priority: P0
- Status: mapped

### J-M02: Pay annual dues
1. GET /dashboard → see renewal banner or dues alert
2. GET /org/$orgId/dues → view amount owed and payment options
3. GET /my/payments → see payment history and confirmation
- BRs: BR-04, BR-05, BR-06, BR-07
- Priority: P0
- Status: mapped

### J-M03: Track CPD credits
1. GET /my/credits → view credit summary across orgs
2. GET /my/credits/log → see detailed credit history
3. GET /org/$orgId/training → browse available training
4. GET /my/certificates → view and download certificates
- BRs: BR-11, BR-12, BR-13, BR-14
- Priority: P1
- Status: mapped

### J-M04: Browse and register for events
1. GET /my/events → view upcoming and past events
2. GET /org/$orgId/events → browse org events
3. GET /org/$orgId/events/$eventId → view event details and register
- BRs: BR-15, BR-27
- Priority: P1
- Status: mapped

## Persona: Treasurer

### J-T01: Record manual payment
1. GET /org/$orgId/officer/payments → view payment list
2. GET /org/$orgId/officer/payments/new → fill payment recording form
3. GET /org/$orgId/officer/payments/$paymentId → verify recorded payment
4. GET /org/$orgId/officer/reports/financial → check financial summary
- BRs: BR-05, BR-06, BR-08
- Priority: P0
- Status: mapped

### J-T02: Configure dues and funds
1. GET /org/$orgId/officer/settings/dues → set dues amounts and periods
2. GET /org/$orgId/officer/settings/funds → configure fund allocation splits
3. GET /org/$orgId/officer/settings/gateway → set up payment gateway
- BRs: BR-04, BR-05, BR-30
- Priority: P0
- Status: mapped

### J-T03: Generate financial report
1. GET /org/$orgId/officer/reports/financial → view financial dashboard
- BRs: BR-32
- Priority: P1
- Status: mapped

## Persona: President

### J-P01: Review membership roster
1. GET /org/$orgId/officer/dashboard → officer overview
2. GET /org/$orgId/officer/roster → view member list
3. GET /org/$orgId/officer/roster/$memberId → view member detail
4. GET /org/$orgId/officer/applications → review pending applications
- BRs: BR-01, BR-03, BR-22
- Priority: P1
- Status: mapped

### J-P02: Manage elections
1. GET /org/$orgId/officer/elections → view elections list
2. GET /org/$orgId/officer/elections/new → create new election
3. GET /org/$orgId/officer/elections/$electionId → monitor election progress
- BRs: BR-33, BR-34
- Priority: P2
- Status: mapped

## Persona: Secretary

### J-S01: Send announcement
1. GET /org/$orgId/officer/communications → view announcements list
2. GET /org/$orgId/officer/communications/new → compose new announcement
3. GET /org/$orgId/officer/communications/$announcementId → view sent announcement
- BRs: BR-28
- Priority: P1
- Status: mapped

### J-S02: Review membership applications
1. GET /org/$orgId/officer/applications → view pending applications
2. GET /org/$orgId/officer/roster/$memberId → review applicant details
- BRs: BR-03, BR-22
- Priority: P1
- Status: mapped

## Persona: Platform Administrator

> Note: Platform Admin routes live in `apps/admin` (port 3003), not `apps/memberry`.
> Journey routes below are scoped to the admin app and won't appear in memberry route maps.

### J-PA01: Monitor platform health
1. GET /admin → platform admin dashboard
2. GET /admin/organizations → view all organizations
3. GET /admin/users → view all platform users
- BRs: BR-22
- Priority: P2
- Status: deferred (apps/admin scope)

### J-PA02: Manage organizations
1. GET /admin/organizations → list organizations
2. GET /admin/organizations/$orgId → view org details and stats
3. GET /admin/organizations/$orgId/settings → configure org-level settings
- BRs: BR-22
- Priority: P2
- Status: deferred (apps/admin scope)

## Persona: Society Officer (National/Regional)

### J-SO01: Cross-chapter oversight
1. GET /org/$orgId/officer/dashboard → national-level officer dashboard
2. GET /org/$orgId/officer/roster → view cross-chapter member roster
3. GET /org/$orgId/officer/reports/credits → view aggregated CPD compliance
4. GET /org/$orgId/officer/reports/financial → view cross-chapter financial rollup
- BRs: BR-01, BR-11, BR-32
- Priority: P2
- Status: mapped

### J-SO02: Manage national events and training
1. GET /org/$orgId/officer/events → manage national events
2. GET /org/$orgId/officer/events/new → create national event
3. GET /org/$orgId/officer/events/$eventId → monitor event registrations
4. GET /org/$orgId/officer/events/$eventId/attendance → track attendance
5. GET /org/$orgId/officer/training → manage CPD training programs
- BRs: BR-15, BR-11, BR-27
- Priority: P2
- Status: mapped

### J-SO03: National communications
1. GET /org/$orgId/officer/communications → view all announcements
2. GET /org/$orgId/officer/communications/new → send national announcement
3. GET /org/$orgId/officer/communications/$announcementId → view delivery status
- BRs: BR-28
- Priority: P2
- Status: mapped
