---
name: navigation-map
module: m04-org-admin
route-count: 39
derivation: heuristic-path-tokens-from-CODE_ROUTE_MAP
derived-from-head: bf8b8fdd
derived-from-map: 80312e6e
last-generated: 2026-06-03T01:03:31.716Z
last-generated-by: scripts/generate-navigation-map.ts (P2-14)
status: INFERRED — needs human review
---

# Navigation Map — m04-org-admin

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module, so `/oli-check --journeys` decomposes coverage per-module instead of inferring it heuristically every cycle.

## Routes (39)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/associations/$associationId` | `/associations/$associationId` | AssociationDetailPage | admin | — | associationId | — |
| `/associations/` | `/associations/` | AssociationsPage | admin | — | — | — |
| `/organizations/$organizationId` | `/organizations/$organizationId` | OrganizationDetailPage | admin | — | organizationId | — |
| `/organizations/` | `/organizations/` | OrganizationsPage | admin | — | — | — |
| `/org/$slug` | `/org/$slug` | PublicOrgProfile | memberry | — | slug | — |
| `/_authenticated/org/$orgSlug/directory` | `/org/$orgSlug/directory` | DirectoryPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/home` | `/org/$orgSlug/home` | OrgHome | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/my-cpd` | `/org/$orgSlug/my-cpd` | MyCpdDashboard | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/my-notifications` | `/org/$orgSlug/my-notifications` | MyNotificationsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer` | `/org/$orgSlug/officer` | OfficerLayout | memberry | yes | orgSlug | requireOrgOfficer |
| `/_authenticated/org/$orgSlug` | `/org/$orgSlug` | OrgLayout | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/directory/$personId` | `/org/$orgSlug/directory/$personId` | MemberProfilePage | memberry | yes | orgSlug, personId | — |
| `/_authenticated/org/$orgSlug/governance/` | `/org/$orgSlug/governance/` | GovernancePage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/applications` | `/org/$orgSlug/officer/applications` | ApplicationsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/officers` | `/org/$orgSlug/officer/officers` | OfficersPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/roster` | `/org/$orgSlug/officer/roster` | — | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/finances/assessments` | `/org/$orgSlug/officer/finances/assessments` | FinancesAssessmentsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/finances/dues` | `/org/$orgSlug/officer/finances/dues` | DuesSchedulePage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/finances/funds` | `/org/$orgSlug/officer/finances/funds` | FundsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/finances/` | `/org/$orgSlug/officer/finances/` | FinancesOverviewPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/finances/invoices` | `/org/$orgSlug/officer/finances/invoices` | InvoicesPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/finances/members` | `/org/$orgSlug/officer/finances/members` | FinancialMembersPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/institutional-memberships/$institutionalMembershipId` | `/org/$orgSlug/officer/institutional-memberships/$institutionalMembershipId` | InstitutionalMembershipDetailPage | memberry | yes | orgSlug, institutionalMembershipId | — |
| `/_authenticated/org/$orgSlug/officer/institutional-memberships/` | `/org/$orgSlug/officer/institutional-memberships/` | InstitutionalMembershipsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/institutional-memberships/new` | `/org/$orgSlug/officer/institutional-memberships/new` | NewInstitutionalMembershipPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/roster/$memberId` | `/org/$orgSlug/officer/roster/$memberId` | MemberDetailPage | memberry | yes | orgSlug, memberId | — |
| `/_authenticated/org/$orgSlug/officer/roster/import` | `/org/$orgSlug/officer/roster/import` | RosterImportPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/roster/` | `/org/$orgSlug/officer/roster/` | RosterPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/settings/chapters` | `/org/$orgSlug/officer/settings/chapters` | ChaptersSettingsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/settings/cpd` | `/org/$orgSlug/officer/settings/cpd` | CpdSettings | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/settings/dues` | `/org/$orgSlug/officer/settings/dues` | — | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/settings/funds` | `/org/$orgSlug/officer/settings/funds` | — | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/settings/gateway` | `/org/$orgSlug/officer/settings/gateway` | GatewaySettingsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/settings/membership-categories` | `/org/$orgSlug/officer/settings/membership-categories` | CategoriesPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/settings/org` | `/org/$orgSlug/officer/settings/org` | OrgSettingsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/settings/providers` | `/org/$orgSlug/officer/settings/providers` | ProvidersPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/finances/invoices/$invoiceId` | `/org/$orgSlug/officer/finances/invoices/$invoiceId` | InvoiceDetailPage | memberry | yes | orgSlug, invoiceId | — |
| `/_authenticated/org/$orgSlug/officer/finances/invoices/` | `/org/$orgSlug/officer/finances/invoices/` | InvoicesPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/finances/members/$memberId` | `/org/$orgSlug/officer/finances/members/$memberId` | MemberFinancialDetailPage | memberry | yes | orgSlug, memberId | — |

## Derivation

Generated by `scripts/generate-navigation-map.ts` from `docs/audits/codebase-map/CODE_ROUTE_MAP.json` at HEAD `bf8b8fdd`. The path→module mapping uses a hand-tuned regex table; results are `[INFERRED]` and require human review where the route's intent is ambiguous. To regenerate after a route add/rename, run the generator and commit the diff.

## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
