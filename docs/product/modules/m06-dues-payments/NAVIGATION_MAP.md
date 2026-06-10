---
name: navigation-map
module: m06-dues-payments
route-count: 11
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.716Z
status: INFERRED — needs human review
---

# Navigation Map — m06-dues-payments

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (11)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/pay/$token` | `/pay/$token` | PublicPaymentPage | memberry | — | token | — |
| `/_authenticated/my/billing` | `/my/billing` | BillingPage | memberry | yes | — | — |
| `/_authenticated/my/payments` | `/my/payments` | MyPaymentsPage | memberry | yes | — | — |
| `/_authenticated/org/$orgSlug/dues` | `/org/$orgSlug/dues` | MemberDuesPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/payments` | `/org/$orgSlug/officer/payments` | — | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/dues/assessments` | `/org/$orgSlug/officer/dues/assessments` | — | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/dues/member/$memberId` | `/org/$orgSlug/officer/dues/member/$memberId` | — | memberry | yes | orgSlug, memberId | — |
| `/_authenticated/org/$orgSlug/officer/dues/treasurer` | `/org/$orgSlug/officer/dues/treasurer` | — | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/payments/$paymentId` | `/org/$orgSlug/officer/payments/$paymentId` | PaymentDetailPage | memberry | yes | orgSlug, paymentId | — |
| `/_authenticated/org/$orgSlug/officer/payments/` | `/org/$orgSlug/officer/payments/` | OfficerPaymentsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/payments/new` | `/org/$orgSlug/officer/payments/new` | RecordPaymentPage | memberry | yes | orgSlug | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
