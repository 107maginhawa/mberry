<!-- oli:artifact performance v1.0 generated:2026-05-21 source:MASTER_PRD.md -->
# Performance Requirements: Memberry

> Performance SLAs and targets derived from PRD audit. Triggered by: SLAs present in PRD S7.

## SLA Summary

| Requirement | Target | Rationale | Measurement Point |
|-------------|--------|-----------|-------------------|
| API response time (p95) | < 500ms | Officers on mobile in the field | API gateway → response complete |
| Page load on mobile 3G | < 3 seconds | Philippine mobile infrastructure | First contentful paint (FCP) |
| Platform uptime | >= 99.5% | < 3.6 hours downtime/month | Health check endpoint availability |
| PDF generation | < 3 seconds | Real-time ID card/receipt at events | Request → PDF bytes returned |
| Member search | < 200ms | Reception-desk instant lookup | API request → results returned |
| Concurrent users | >= 500 simultaneous | Annual convention spikes | Active WebSocket + HTTP connections |

## SLA Enforcement

From PRD S7: "NFR breaches in production are treated as P1 incidents with 24-hour resolution SLA."

| Aspect | Status |
|--------|--------|
| Monitoring mechanism | **Gap** — No observability strategy defined in PRD |
| Alert thresholds | **Gap** — No alerting pipeline specified |
| Breach detection | **Gap** — How are p95 violations detected? |
| Escalation path | Defined: P1 incident → 24-hour resolution |

## Performance Budget by Module

| Module | Critical Path | Target | Notes |
|--------|--------------|--------|-------|
| M01 Auth | Login, OTP verification | < 500ms | Better-Auth session creation |
| M02 Profile | Profile load, search | < 200ms (search) | Member search is the tightest SLA |
| M05 Membership | Roster load, status check | < 500ms | Status computed from dues_expiry_date at query time |
| M06 Dues | Payment recording | < 500ms | Optimistic locking adds latency; idempotency check |
| M08 Events | Registration, QR check-in | < 500ms | Convention spike scenario (500 concurrent) |
| M09 Training | Enrollment, completion | < 500ms | Auto-credit award crosses M09 → M10 |
| M10 Credits | Credit aggregation | < 500ms | Cross-org aggregation may be expensive |
| M11 Documents | PDF generation | < 3 seconds | ID cards, certificates, receipts |
| M07 Comms | WebSocket messaging | < 100ms (delivery) | Real-time notification delivery |

## Capacity Planning Inputs

| Dimension | PRD Estimate | Notes |
|-----------|-------------|-------|
| Target market | 2,800+ chapters, 250,000+ professionals | PRD S1 |
| Pilot target | 30+ active members per org | PRD S6 |
| Concurrent users | 500 simultaneous | Convention spike NFR |
| Payment throughput | 10+ payments per org in month 3 | Pilot success criteria |

**Gap:** No data volume estimates in PRD. Unknown: members per org (typical), events per month, notifications per day, file uploads per month.

## Database Performance Considerations

| Concern | Mitigation | Status |
|---------|-----------|--------|
| Member search < 200ms | Index on name, license_number, email | **Verify indexes exist** |
| Status computation at query time | Derived from dues_expiry_date (no stored status) | Efficient but verify with large rosters |
| Cross-org credit aggregation | May require materialized views or caching | **Design needed** |
| Audit log growth | 1-year active retention, then archive | Partitioning strategy needed |
| Multi-tenant query scoping | Every query includes org/association scope | **Verify no table scans** |

## Frontend Performance

| Target | Metric | Measurement |
|--------|--------|-------------|
| Mobile 3G page load | < 3 seconds FCP | Lighthouse on throttled 3G |
| Bundle size | TBD | No target in PRD — recommend < 300KB gzipped |
| Image optimization | TBD | No target in PRD — S3/CDN serving |
| Offline resilience | N/A | Removed from architecture |

## Recommendations

1. **Define observability pipeline** before production — SLA enforcement requires measurement
2. **Add rate limiting** per endpoint category — convention spike + PDF generation abuse vectors
3. **Benchmark cross-org credit aggregation** — potential hot path with 250K+ professionals
4. **Set bundle size budget** — mobile 3G target implies strict frontend performance
5. **Add data volume estimates** to PRD — capacity planning needs targets beyond concurrent users

---

> **Rules:**
> - NFR breach = P1 incident with 24-hour resolution SLA.
> - Performance targets must be validated with load tests before production launch.
> - Update this document when new modules add performance-sensitive paths.
