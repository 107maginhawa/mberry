# Requirements: Memberry

**Defined:** 2026-05-13
**Core Value:** Members can manage their association membership, track continuing education credits, and stay current on dues — from any device, with minimal friction.

## v1.2.0 Requirements

Requirements for Pilot Launch. Each maps to roadmap phases 18-25.

### Security

- [ ] **SEC-01**: Dues invoice endpoints enforce org-scoped RBAC (markDuesInvoicePaid requires officer role + chapter scope)
- [ ] **SEC-02**: All dues query endpoints validate caller's organization membership before returning data

### Data Privacy (PH DPA Compliance)

- [ ] **DPA-01**: User can request account deletion with 30-day grace period and cancellation option
- [ ] **DPA-02**: Account deletion anonymizes PII in-place but preserves financial records for 7yr BIR retention
- [ ] **DPA-03**: User can export all personal data as machine-readable JSON (profile, memberships, payments, training, certificates)
- [ ] **DPA-04**: Data export covers all modules that hold person-linked data (person, membership, dues, training, certificates, events, storage)
- [ ] **DPA-05**: Audit middleware exempts anonymization writes from capturing PII in before_state payload
- [ ] **DPA-06**: Grace period deletion executes automatically via scheduled job after 30 days

### Payment

- [ ] **PAY-01**: Officer can record offline dues payment (GCash, bank transfer) and mark invoice as paid
- [ ] **PAY-02**: Payment recording generates a receipt viewable by member and officer
- [ ] **PAY-03**: Concurrent payment recording on same invoice handled safely (no double-payment via optimistic locking)

### Officer Operations

- [ ] **OPS-01**: Officer can view chapter roster with dues status and training summary (server-side JOINs)
- [ ] **OPS-02**: Officer can bulk approve membership applications with partial-success response shape
- [ ] **OPS-03**: Bulk operations validate per-record organization scope (not just outer isOfficer check)
- [ ] **OPS-04**: Officer can filter roster by membership status, dues status, and training compliance

### PRC CPD Compliance

- [ ] **PRC-01**: Training events store PRC accreditation number and accredited provider reference
- [ ] **PRC-02**: Credit entries include CPD category, approval code, and verification status
- [ ] **PRC-03**: Officer can view CPD compliance summary per member (credits earned vs required)
- [ ] **PRC-04**: Accredited providers registry with status tracking and expiry warnings

### Member Lifecycle

- [ ] **LIF-01**: Officer can mark member as resigned with termination reason code
- [ ] **LIF-02**: Officer can mark member as deceased with date
- [ ] **LIF-03**: Departed/deceased members automatically excluded from dues billing and notifications
- [ ] **LIF-04**: Membership termination uses status enum (not boolean) supporting resigned, deceased, expelled, lapsed

### Quality Gap Closure

- [ ] **QAL-01**: Roster API 500 on /association/member/roster fixed (pre-existing handler param mismatch)
- [ ] **QAL-02**: Audit log filter bug fixed (eventType/category params actually filter results)
- [ ] **QAL-03**: BR-35 through BR-40 implemented and tested

### Email & Notification Guards

- [ ] **EML-01**: Email rate limiting applied to bulk sends only (transactional emails bypass rate limits)
- [ ] **EML-02**: Hard bounce suppression removes bounced addresses from future sends
- [ ] **EML-03**: Deceased/departed member guard prevents email and notification sends
- [ ] **EML-04**: Email unsubscribe mechanism (one-click unsubscribe header + link)
- [ ] **EML-05**: Remaining untested handlers have unit test coverage

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
| SEC-01 | Phase 18 | Pending |
| SEC-02 | Phase 18 | Pending |
| DPA-01 | Phase 19 | Pending |
| DPA-02 | Phase 19 | Pending |
| DPA-03 | Phase 19 | Pending |
| DPA-04 | Phase 19 | Pending |
| DPA-05 | Phase 19 | Pending |
| DPA-06 | Phase 19 | Pending |
| PAY-01 | Phase 20 | Pending |
| PAY-02 | Phase 20 | Pending |
| PAY-03 | Phase 20 | Pending |
| OPS-01 | Phase 21 | Pending |
| OPS-02 | Phase 21 | Pending |
| OPS-03 | Phase 21 | Pending |
| OPS-04 | Phase 21 | Pending |
| PRC-01 | Phase 22 | Pending |
| PRC-02 | Phase 22 | Pending |
| PRC-03 | Phase 22 | Pending |
| PRC-04 | Phase 22 | Pending |
| LIF-01 | Phase 23 | Pending |
| LIF-02 | Phase 23 | Pending |
| LIF-03 | Phase 23 | Pending |
| LIF-04 | Phase 23 | Pending |
| QAL-01 | Phase 24 | Pending |
| QAL-02 | Phase 24 | Pending |
| QAL-03 | Phase 24 | Pending |
| EML-01 | Phase 25 | Pending |
| EML-02 | Phase 25 | Pending |
| EML-03 | Phase 25 | Pending |
| EML-04 | Phase 25 | Pending |
| EML-05 | Phase 25 | Pending |

**Coverage:**
- v1.2.0 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-13 after roadmap creation (corrected phase numbers: LIF→23, QAL→24, EML→25)*
