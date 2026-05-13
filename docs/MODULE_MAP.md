# Module Dependency Map

Compliance documentation artifact mapping Memberry's 19 business modules to their dependencies and corresponding handler implementations.

**Canonical source:** [`docs/ver-3/business/modules/README.md`](ver-3/business/modules/README.md) contains the full module table, monetization tiers, phase rollout plan, and enable/disable behavior.

## Dependency Diagram

```mermaid
graph TD
    M01[M01 Auth & Onboarding]
    M02[M02 Member Profile]
    M03[M03 Platform Admin]
    M04[M04 Org Admin]
    M05[M05 Membership]
    M06[M06 Dues & Payments]
    M07[M07 Communications]
    M08[M08 Events]
    M09[M09 Training]
    M10[M10 Credit Tracking]
    M11[M11 Documents & Credentials]
    M12[M12 Elections & Governance]
    M13[M13 Professional Feed]
    M14[M14 National Dashboard]
    M15[M15 Job Board]
    M16[M16 Advertising]
    M17[M17 Marketplace]
    M18[M18 Surveys & Polls]
    M19[M19 Committee Management]

    %% Foundation
    M01 --> M02
    M01 --> M03
    M01 --> M13
    M01 --> M15
    M01 --> M17

    %% Platform/Org admin chain
    M03 --> M04
    M04 --> M05

    %% Membership fan-out
    M05 --> M06
    M05 --> M07
    M05 --> M11
    M05 --> M12
    M05 --> M13
    M05 --> M14
    M05 --> M15
    M05 --> M17
    M05 --> M18
    M05 --> M19

    %% Dues/Payments
    M06 --> M08
    M06 --> M09
    M06 --> M14

    %% Communications
    M07 --> M08
    M07 --> M09
    M07 --> M12
    M07 --> M16
    M07 --> M18

    %% Profile fan-out
    M02 --> M13
    M02 --> M15
    M02 --> M17

    %% Training/Credits chain
    M09 --> M10
    M10 --> M09
    M10 --> M11
    M10 --> M14
    M09 --> M11

    %% Org admin fan-out
    M04 --> M12
    M04 --> M14
    M04 --> M16
    M04 --> M18
    M04 --> M19

    %% Styling by phase
    classDef phase1w1 fill:#d4edda,stroke:#28a745
    classDef phase1w2 fill:#cce5ff,stroke:#007bff
    classDef phase1w3 fill:#fff3cd,stroke:#ffc107
    classDef phase2 fill:#e2e3e5,stroke:#6c757d
    classDef phase3 fill:#f8d7da,stroke:#dc3545

    class M01,M02,M03,M04,M05,M06 phase1w1
    class M07,M08,M09 phase1w2
    class M10,M11 phase1w3
    class M12,M13,M14,M15,M16 phase2
    class M17,M18,M19 phase3
```

**Legend:** Green = Phase 1 Wave 1, Blue = Phase 1 Wave 2, Yellow = Phase 1 Wave 3, Gray = Phase 2, Red = Phase 3

**Note:** M09 (Training) and M10 (Credit Tracking) have a circular dependency -- training generates AUTO credit entries, credit tracking consumes them. Both are developed in the same wave.

## Handler Cross-Reference

| Module | Spec File | Handler Directory | Handlers | TypeSpec |
|--------|-----------|-------------------|----------|---------|
| M01 Auth & Onboarding | `m01-auth-onboarding.md` | `person/` | 25 | Yes |
| M02 Member Profile | `m02-member-profile.md` | `person/` (shared) | -- | -- |
| M03 Platform Admin | `m03-platform-admin.md` | `platformadmin/` | 21 | Yes |
| M04 Org Admin | `m04-org-admin.md` | `association:member/` | 157 | Yes |
| M05 Membership | `m05-membership.md` | `membership/` + `association:member/` | 12 + shared | Mixed |
| M06 Dues & Payments | `m06-dues-payments.md` | `dues/` + `billing/` | 15 + 16 | Mixed |
| M07 Communications | `m07-communications.md` | `communication/` + `comms/` + `email/` + `notifs/` | 28 + 11 + 9 + 5 | Mixed |
| M08 Events | `m08-events.md` | `events/` + `booking/` | 11 + 19 | Yes |
| M09 Training | `m09-training.md` | `training/` | 10 | No |
| M10 Credit Tracking | `m10-credit-tracking.md` | `training/` (shared) | -- | -- |
| M11 Documents & Credentials | `m11-documents-credentials.md` | `documents/` + `certificates/` + `storage/` | 15 + 3 + 6 | Yes |
| M12 Elections & Governance | `m12-elections-governance.md` | `elections/` | 6 | Yes |
| M13 Professional Feed | `m13-professional-feed.md` | -- (Future) | -- | -- |
| M14 National Dashboard | `m14-national-dashboard.md` | `association:operations/` | 54 | Yes |
| M15 Job Board | `m15-job-board.md` | -- (Future) | -- | -- |
| M16 Advertising | `m16-advertising.md` | -- (Future) | -- | -- |
| M17 Marketplace | `m17-marketplace.md` | -- (Future) | -- | -- |
| M18 Surveys & Polls | `m18-surveys-polls.md` | -- (Future) | -- | -- |
| M19 Committee Management | `m19-committee-management.md` | -- (Future) | -- | -- |

### Handler directories without a direct module mapping

| Handler Directory | Purpose | Related Modules |
|-------------------|---------|-----------------|
| `audit/` | Compliance logging | Cross-cutting (all modules) |
| `invite/` | Org invitations | M04, M05 |
| `reviews/` | NPS review system | M08, M09 |

## Dependency Matrix (compact)

| Module | Depends On |
|--------|-----------|
| M01 | -- |
| M02 | M01 |
| M03 | M01 |
| M04 | M01, M03 |
| M05 | M01, M04 |
| M06 | M01, M04, M05 |
| M07 | M01, M04, M05 |
| M08 | M05, M06, M07 |
| M09 | M05, M06, M07, M10 |
| M10 | M05, M09 |
| M11 | M05, M09, M10 |
| M12 | M04, M05, M07 |
| M13 | M01, M02, M05 |
| M14 | M04, M05, M06, M10 |
| M15 | M01, M02, M05 |
| M16 | M03, M07 |
| M17 | M01, M02, M05 |
| M18 | M04, M05, M07 |
| M19 | M04, M05 |

---

*Generated 2026-05-13. Source of truth: `docs/ver-3/business/modules/README.md`.*
