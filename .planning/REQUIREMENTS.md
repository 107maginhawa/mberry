# Requirements: Memberry

**Defined:** 2026-05-13
**Core Value:** Members can manage their association membership, track continuing education credits, and stay current on dues — from any device, with minimal friction.

## v1.2.0 Requirements

Requirements for Pilot Launch. Each maps to roadmap phases 18-25.

### Security

- [x] **SEC-01**: Dues invoice endpoints enforce org-scoped RBAC (markDuesInvoicePaid requires officer role + chapter scope)
- [x] **SEC-02**: All dues query endpoints validate caller's organization membership before returning data

### Data Privacy (PH DPA Compliance)

- [x] **DPA-01**: User can request account deletion with 30-day grace period and cancellation option
- [x] **DPA-02**: Account deletion anonymizes PII in-place but preserves financial records for 7yr BIR retention
- [x] **DPA-03**: User can export all personal data as machine-readable JSON (profile, memberships, payments, training, certificates)
- [x] **DPA-04**: Data export covers all modules that hold person-linked data (person, membership, dues, training, certificates, events, storage)
- [x] **DPA-05**: Audit middleware exempts anonymization writes from capturing PII in before_state payload
- [x] **DPA-06**: Grace period deletion executes automatically via scheduled job after 30 days

### Payment

- [x] **PAY-01**: Officer can record offline dues payment (GCash, bank transfer) and mark invoice as paid
- [x] **PAY-02**: Payment recording generates a receipt viewable by member and officer
- [x] **PAY-03**: Concurrent payment recording on same invoice handled safely (no double-payment via optimistic locking)

### Officer Operations

- [x] **OPS-01**: Officer can view chapter roster with dues status and training summary (server-side JOINs)
- [x] **OPS-02**: Officer can bulk approve membership applications with partial-success response shape
- [x] **OPS-03**: Bulk operations validate per-record organization scope (not just outer isOfficer check)
- [x] **OPS-04**: Officer can filter roster by membership status, dues status, and training compliance

### PRC CPD Compliance

- [x] **PRC-01**: Training events store PRC accreditation number and accredited provider reference
- [x] **PRC-02**: Credit entries include CPD category, approval code, and verification status
- [x] **PRC-03**: Officer can view CPD compliance summary per member (credits earned vs required)
- [x] **PRC-04**: Accredited providers registry with status tracking and expiry warnings

### Member Lifecycle

- [x] **LIF-01**: Officer can mark member as resigned with termination reason code
- [x] **LIF-02**: Officer can mark member as deceased with date
- [x] **LIF-03**: Departed/deceased members automatically excluded from dues billing and notifications
- [x] **LIF-04**: Membership termination uses status enum (not boolean) supporting resigned, deceased, expelled, lapsed

### Quality Gap Closure

- [x] **QAL-01**: Roster API 500 on /association/member/roster fixed (pre-existing handler param mismatch)
- [x] **QAL-02**: Audit log filter bug fixed (eventType/category params actually filter results)
- [x] **QAL-03**: BR-35 through BR-40 implemented and tested

### Email & Notification Guards

- [x] **EML-01**: Email rate limiting applied to bulk sends only (transactional emails bypass rate limits)
- [x] **EML-02**: Hard bounce suppression removes bounced addresses from future sends
- [x] **EML-03**: Deceased/departed member guard prevents email and notification sends
- [x] **EML-04**: Email unsubscribe mechanism (one-click unsubscribe header + link)
- [x] **EML-05**: Remaining untested handlers have unit test coverage

## v1.3.0 Requirements

Deferred to next milestone. Tracked but not in current roadmap.

### Transfer & Cross-Org

- **TRN-01**: Member can initiate chapter transfer (source approves → target approves)
- **TRN-02**: Cross-org training credits portable with source organization tracking
- **TRN-03**: Dues proration on mid-cycle transfer
- **TRN-04**: Transfer history preserved on membership record

### TypeSpec & Architecture

- **ARC-01**: TypeSpec 100% coverage (8 inline app.ts routes migrated)
- **ARC-02**: association:member mega-module split (171 handlers → domain sub-modules)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Online payment gateway (Stripe/PayMongo) | PH dental chapters use offline payments (GCash, bank transfer); gateway is v2 |
| PRC CPDAS API integration | No public API exists; manual submission workflow only |
| Receipt PDF generation (server-side) | Evaluate during Phase 20 planning; client-side print may suffice |
| Real-time sync (cadence activation) | Stub exists, activation deferred to v2 |
| Mobile-native apps | Tauri handles desktop/mobile via webview |
| Cross-org transfer workflow | HIGH complexity; defer until first real transfer request from pilot (v1.3.0) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 18 | Complete |
| SEC-02 | Phase 18 | Complete |
| DPA-01 | Phase 19 | Complete |
| DPA-02 | Phase 19 | Complete |
| DPA-03 | Phase 19 | Complete |
| DPA-04 | Phase 19 | Complete |
| DPA-05 | Phase 19 | Complete |
| DPA-06 | Phase 19 | Complete |
| PAY-01 | Phase 20 | Complete |
| PAY-02 | Phase 20 | Complete |
| PAY-03 | Phase 20 | Complete |
| OPS-01 | Phase 21 | Complete |
| OPS-02 | Phase 21 | Complete |
| OPS-03 | Phase 21 | Complete |
| OPS-04 | Phase 21 | Complete |
| PRC-01 | Phase 22 | Complete |
| PRC-02 | Phase 22 | Complete |
| PRC-03 | Phase 22 | Complete |
| PRC-04 | Phase 22 | Complete |
| LIF-01 | Phase 23 | Complete |
| LIF-02 | Phase 23 | Complete |
| LIF-03 | Phase 23 | Complete |
| LIF-04 | Phase 23 | Complete |
| QAL-01 | Phase 24 | Complete |
| QAL-02 | Phase 24 | Complete |
| QAL-03 | Phase 24 | Complete |
| EML-01 | Phase 25 | Complete |
| EML-02 | Phase 25 | Complete |
| EML-03 | Phase 25 | Complete |
| EML-04 | Phase 25 | Complete |
| EML-05 | Phase 25 | Complete |

**Coverage:**
- v1.2.0 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-13 after roadmap creation (corrected phase numbers: LIF→23, QAL→24, EML→25)*
