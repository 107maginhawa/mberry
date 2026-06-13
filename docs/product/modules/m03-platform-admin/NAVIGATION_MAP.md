---
name: navigation-map
module: m03-platform-admin
route-count: 22
route-groups: 15
derived-from-head: 7553767d
last-generated: 2026-06-12
status: reviewed
---

# Navigation Map — m03-platform-admin

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

The platform-admin surface is the **admin app** (`apps/admin`, port 3003). Every
route below sits behind the admin auth gate wired in `apps/admin/src/main.tsx`
(the authenticated user must resolve to a `platform_admin` row via
`getAdminRole`). Per-route role gating is enforced client-side by `RequireRole`
(`apps/admin/src/lib/role-gate.tsx`) and listed in the **Roles** column; the
authoritative server-side tier enforcement is tracked separately (gap G1).

## Routes (22 across 15 route groups)

| Path | Page Component | App | Auth | Roles | Params |
|------|----------------|-----|------|-------|--------|
| `/` | DashboardPage | admin | yes (admin) | super, support, analyst | — |
| `/associations` | AssociationsPage | admin | yes (admin) | super, support, analyst | — |
| `/associations/$associationId` | AssociationDetailPage | admin | yes (admin) | super, support, analyst | associationId |
| `/audit` | AuditPage | admin | yes (admin) | super, support | — |
| `/committees` | CommitteesPage | admin | yes (admin) | super, support | — |
| `/communications` | CommunicationsBroadcasts | admin | yes (admin) | super, support | — |
| `/communications/email` | EmailHealth | admin | yes (admin) | super, support, analyst | — |
| `/communications/moderation` | ModerationQueue | admin | yes (admin) | super, support | — |
| `/communications/templates` | PlatformTemplates | admin | yes (admin) | super | — |
| `/compliance` | CompliancePage | admin | yes (admin) | super, support, analyst | — |
| `/events` | EventsPage | admin | yes (admin) | super, support | — |
| `/feature-flags` | FeatureFlagsPage | admin | yes (admin) | super | — |
| `/impersonate` | ImpersonatePage | admin | yes (admin) | super, support | — |
| `/members` | MembersPage | admin | yes (admin) | super, support, analyst | — |
| `/members/$personId` | MemberDetailPage | admin | yes (admin) | super, support, analyst | personId |
| `/national-dashboard` | NationalDashboardPage | admin | yes (admin) | super | — |
| `/operators` | OperatorsPage | admin | yes (admin) | super | — |
| `/organizations` | OrganizationsPage | admin | yes (admin) | super, support, analyst | — |
| `/organizations/$organizationId` | OrganizationDetailPage | admin | yes (admin) | super, support, analyst | organizationId |
| `/surveys` | SurveysPage | admin | yes (admin) | super, support, analyst | — |
| `/training` | TrainingPage | admin | yes (admin) | super, support, analyst | — |
| `/verifications` | VerificationsPage | admin | yes (admin) | super, support | — |

## Route groups (15 directories + root dashboard)

Root dashboard: `/` (root `index.tsx`).

15 route-group directories: `associations` · `audit` · `committees` ·
`communications` · `compliance` · `events` · `feature-flags` · `impersonate` ·
`members` · `national-dashboard` · `operators` · `organizations` · `surveys` ·
`training` · `verifications`

## Cross-module note

Several admin route groups are **platform-tier views whose backend lives in
other product modules** — they are surfaced inside the admin shell for ops
staff, but their domain ownership is elsewhere:

- `communications` → communication / comms modules
- `surveys` → surveys module
- `training` → association:operations (training/CPD)
- `events` → events / association:operations
- `members` → membership / association:member
- `national-dashboard` → m14 national dashboard

The journeys dimension still rolls their route-level coverage attributes
(page-load latency, nav-link integrity, error-boundary presence, role-gate
enforcement) into the platform-admin surface, since they are reachable only
through the admin app.

## Derivation

Regenerated under AHA FIX-018 (G16) from the live admin-app route tree
(`apps/admin/src/routes/**`) and the role matrix in
`apps/admin/src/lib/role-gate.tsx` (`ROUTE_ROLES`). Supersedes the stale
auto-inferred 7-route draft (which also mis-attributed a memberry officer
route to this module). The single non-admin-app touchpoint historically listed
here (`/org/$orgSlug/officer/compliance`, OfficerCompliance) belongs to the
memberry officer surface, not the admin app, and is intentionally excluded.

## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
