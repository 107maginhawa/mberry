<!-- oli:artifact state-machines v1.0 generated:2026-05-21 source:codebase-schemas -->
# State Machines: Memberry

> Every entity with a `status` field has a documented state machine. Invalid transitions must be rejected. This document is authoritative — when implementation diverges from these machines, this document takes precedence.

## 1. Membership Status (BR-03)

**Schema:** `association:member` module (computed from `dues_expiry_date`)
**Source of truth:** `docs/ver-3/business/business-rules.md` BR-03

```
                    ┌──────────────────────────┐
                    │                          │
                    ▼                          │
    ┌─────────┐  approve  ┌────────┐  dues    ┌───────┐  grace    ┌─────────┐
    │ PENDING ├──────────►│ ACTIVE ├─expired──►│ GRACE ├─expired──►│ LAPSED  │
    └────┬────┘           └───┬────┘          └───────┘           └────┬────┘
         │                    │                                        │
         │ reject             │ suspend (officer)                      │ pay dues
         ▼                    ▼                                        │
    ┌─────────┐         ┌───────────┐                                  │
    │ REMOVED │◄────────┤ SUSPENDED │◄──── suspend (officer) ──────────┘
    └─────────┘  remove └─────┬─────┘
      (president)             │
                              │ restore (officer)
                              ▼
                          ┌────────┐
                          │ ACTIVE │
                          └────────┘
```

| From | To | Trigger | Actor |
|------|-----|---------|-------|
| PENDING | ACTIVE | Officer approves application | Officer (president/secretary) |
| PENDING | REMOVED | Officer rejects application | Officer (president/secretary) |
| ACTIVE | GRACE | Automatic when `dues_expiry_date` passes | System |
| GRACE | LAPSED | Automatic when grace period expires | System |
| LAPSED | ACTIVE | Member pays dues | System (on payment) |
| ACTIVE/GRACE/LAPSED | SUSPENDED | Officer action | Officer (president) |
| SUSPENDED | ACTIVE | Officer restores | Officer (president) |
| ACTIVE | REMOVED | President action | President only |
| ACTIVE/GRACE/LAPSED | EXPIRED | Automatic when lapsed period exceeds configured duration | System |
| ACTIVE/GRACE/LAPSED | RESIGNED | Member voluntarily resigns | Member (self-service) |
| Any (except DECEASED) | DECEASED | Officer records member death | Officer (president) |
| Any (except DECEASED) | EXPELLED | Disciplinary expulsion via M04 | President only |

**Terminal States:** EXPIRED, RESIGNED, DECEASED, EXPELLED have no outward transitions. Reactivation from terminal states is not supported — a new membership record must be created.

**Invariant:** Status is computed from `dues_expiry_date`, not stored as a mutable field. Invalid transitions are rejected silently.

---

## 2. Dues Payment Status

**Schema:** `dues-payments.schema.ts` → `duesPaymentStatusEnum`
**Values:** `pending`, `completed`, `failed`, `refunded`, `partiallyRefunded`, `expired`, `submitted`, `underReview`, `confirmed`, `rejected`
**Audit trail:** `dues_payment_status_history` table tracks every transition with `fromStatus`, `toStatus`, `changedAt`

```
    ┌─────────┐  submit   ┌───────────┐  review   ┌─────────────┐
    │ pending ├──────────►│ submitted ├──────────►│ underReview │
    └────┬────┘           └───────────┘           └──────┬──────┘
         │                                               │
         │ gateway                              confirm  │  reject
         │ callback                                      │
         ▼                                        ┌──────┴───────┐
    ┌───────────┐                                 │              │
    │ completed │◄────────────────────────────────┘              │
    └─────┬─────┘                                          ┌────▼─────┐
         │                                                 │ rejected │
         ├── refund (full, within 30d, BR-08) ─────►┌──────┴──┐      └──────────┘
         │                                          │ refunded│
         │                                          └─────────┘
         └── refund (partial) ─────────────────────►┌───────────────────┐
                                                    │ partiallyRefunded │
                                                    └───────────────────┘

    ┌─────────┐  no response   ┌─────────┐
    │ pending ├───────────────►│ expired │
    └─────────┘                └─────────┘

    ┌─────────┐  gateway fail  ┌────────┐
    │ pending ├───────────────►│ failed │
    └─────────┘                └────────┘
```

| From | To | Trigger | Actor |
|------|-----|---------|-------|
| pending | submitted | Member submits payment | Member |
| pending | completed | Gateway confirms (auto-capture) | System |
| pending | failed | Gateway rejects | System |
| pending | expired | No action within window | System |
| submitted | underReview | Treasurer starts review | Treasurer |
| underReview | confirmed | Treasurer approves | Treasurer |
| underReview | rejected | Treasurer rejects | Treasurer |
| confirmed | completed | Final approval | System |
| completed | refunded | Full refund within 30 days, not allocated (BR-08) | Treasurer |
| completed | partiallyRefunded | Partial refund | Treasurer |

**Invariant:** Refunds only for payments within 30 days that have not been allocated to funds (BR-08).

---

## 3. Invoice Status (Billing)

**Schema:** `billing.schema.ts` → `invoiceStatusEnum`
**Values:** `draft`, `open`, `paid`, `void`, `uncollectible`

```
    ┌───────┐  finalize  ┌──────┐  payment   ┌──────┐
    │ draft ├───────────►│ open ├───────────►│ paid │
    └───┬───┘            └──┬───┘            └──────┘
        │                   │
        │ void              │ void / uncollectible
        ▼                   ▼
    ┌──────┐          ┌──────────────┐
    │ void │          │uncollectible │
    └──────┘          └──────────────┘
```

| From | To | Trigger | Actor |
|------|-----|---------|-------|
| draft | open | Invoice finalized and sent | Officer/System |
| open | paid | Payment succeeds | System (gateway callback) |
| draft/open | void | Invoice cancelled | Officer |
| open | uncollectible | Payment attempts exhausted | System/Officer |

**Payment Status** (sub-state on invoice): `pending` → `requires_capture` → `processing` → `succeeded`/`failed`/`canceled`

---

## 4. Booking Event Status

**Schema:** `booking.schema.ts` → `bookingEventStatusEnum`
**Values:** `draft`, `active`, `paused`, `archived`

```
    ┌───────┐  publish  ┌────────┐  pause   ┌────────┐
    │ draft ├─────────►│ active ├────────►│ paused │
    └───────┘          └───┬────┘         └───┬────┘
                           │                   │
                           │ archive           │ resume → active
                           ▼                   │ archive
                      ┌──────────┐             │
                      │ archived │◄────────────┘
                      └──────────┘
```

| From | To | Trigger | Actor |
|------|-----|---------|-------|
| draft | active | Event published | Officer |
| active | paused | Event temporarily suspended | Officer |
| paused | active | Event resumed | Officer |
| active/paused | archived | Event completed or permanently closed | Officer/System |

---

## 5. Training Enrollment

**Schema:** `training` module (implicit status via `markComplete`)
**Values:** `enrolled`, `completed` (implicit — no pgEnum; status tracked via completion timestamp)

```
enrolled → completed (attendance confirmed)
enrolled → cancelled (member/officer cancels)
enrolled → noShow (training completed, not attended)
```

| From | To | Trigger | Actor |
|------|-----|---------|-------|
| enrolled | completed | Officer confirms attendance + completion | Officer (society) |
| enrolled | cancelled | Member or officer cancels before training date | Member/Officer |
| enrolled | noShow | Training completed but member not marked as attended | System (post-training) |

Cancelled and NoShow are terminal for that enrollment instance.

**Side effect:** Completing enrollment auto-awards credits per BR-13 (M09 → M10 cross-module).

**Provider Status** (`accredited_provider_status`): `active` → `suspended` → `expired`

---

## 6. Communication: Message Status

**Schema:** `communication.schema.ts` → `messageStatusEnum`
**Values:** `draft`, `scheduled`, `sending`, `sent`, `cancelled`, `failed`

```
    ┌───────┐  schedule  ┌───────────┐  process  ┌─────────┐  complete  ┌──────┐
    │ draft ├──────────►│ scheduled ├─────────►│ sending ├──────────►│ sent │
    └───┬───┘           └─────┬─────┘          └────┬────┘           └──────┘
        │                     │                      │
        │ cancel              │ cancel               │ fail
        ▼                     ▼                      ▼
    ┌───────────┐       ┌───────────┐          ┌────────┐
    │ cancelled │       │ cancelled │          │ failed │
    └───────────┘       └───────────┘          └────────┘
```

**Delivery Status** (per-recipient): `pending` → `sent` → `delivered`/`failed`/`bounced`

---

## 7. Communication: Announcement Status

**Schema:** `communication.schema.ts` → `announcementStatusEnum`
**Values:** `draft`, `scheduled`, `sent`, `scheduledFailed`, `archived`

```
    ┌───────┐  schedule  ┌───────────┐  publish  ┌──────┐  archive  ┌──────────┐
    │ draft ├──────────►│ scheduled ├─────────►│ sent ├─────────►│ archived │
    └───────┘           └─────┬─────┘          └──────┘          └──────────┘
                              │
                              │ scheduler failure
                              ▼
                        ┌─────────────────┐
                        │ scheduledFailed │
                        └─────────────────┘
```

---

## 8. Email Queue Status

**Schema:** `email.schema.ts` → `emailQueueStatusEnum`
**Values:** `pending`, `processing`, `sent`, `failed`, `cancelled`

```
    ┌─────────┐  pick up  ┌────────────┐  success  ┌──────┐
    │ pending ├─────────►│ processing ├─────────►│ sent │
    └────┬────┘          └──────┬─────┘          └──────┘
         │                      │
         │ cancel               │ fail (retryable → pending)
         ▼                      ▼
    ┌───────────┐          ┌────────┐
    │ cancelled │          │ failed │ (after max retries)
    └───────────┘          └────────┘
```

**Retry logic:** Failed emails return to `pending` with incremented `attempts` count until max retries. `nextRetryAt` controls backoff.

---

## 9. Communication: Template Status

**Schema:** `communication.schema.ts` / `email.schema.ts` → `templateStatusEnum`
**Values:** `draft`, `active`, `archived`

```
    ┌───────┐  activate  ┌────────┐  archive  ┌──────────┐
    │ draft ├──────────►│ active ├──────────►│ archived │
    └───────┘           └────────┘           └──────────┘
```

---

## 10. Webhook Retry Status

**Schema:** `dues-payments.schema.ts` → `webhookRetryStatusEnum`
**Values:** `processing`, `succeeded`, `failed`, `abandoned`

```
    ┌────────────┐  callback ok  ┌───────────┐
    │ processing ├─────────────►│ succeeded │
    └──────┬─────┘              └───────────┘
           │
           │ callback fail
           ▼
    ┌────────┐  max retries  ┌───────────┐
    │ failed ├──────────────►│ abandoned │
    └────────┘               └───────────┘
```

---

## Cross-Module State Dependencies

| Source State Change | Downstream Effect | Modules |
|--------------------|-------------------|---------|
| Membership → ACTIVE (payment) | Dues payment → completed | M05 → M06 |
| Dues payment → completed | Membership `dues_expiry_date` extended (BR-07) | M06 → M05 |
| Training enrollment → completed | Credit entry auto-created (BR-13) | M09 → M10 |
| Event attendance confirmed | Training enrollment → completed (if training event) | M08 → M09 |
| Membership → GRACE/LAPSED | Event registration blocked (BR-16) | M05 → M08 |
| Membership → REMOVED | Active enrollments cancelled | M05 → M09 |

---

> **Rules:**
> - Every new entity with a `status` field must have a state machine documented here before implementation.
> - Invalid transitions must be rejected — not silently ignored (exception: membership per BR-03).
> - State transition history tables are required for financial entities (dues, invoices).
> - Cross-module state dependencies must be tested with integration tests.
