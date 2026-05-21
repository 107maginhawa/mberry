<!-- oli:artifact disaster-recovery v1.0 generated:2026-05-21 source:MASTER_PRD.md -->
# Disaster Recovery Plan: Memberry

> Business continuity and disaster recovery for a regulated multi-tenant SaaS platform. Compliance: Philippines DPA 2012, BIR financial record retention.

## 1. Recovery Objectives

| Objective | Target | Rationale |
|-----------|--------|-----------|
| **RTO** (Recovery Time Objective) | 4 hours | Maximum time to restore service. Officers use the platform between patient appointments — 4-hour gap is acceptable for non-emergency operations. |
| **RPO** (Recovery Point Objective) | 1 hour | Maximum data loss. Financial transactions (dues payments) must not be lost. 1-hour RPO with WAL archiving achieves this. |
| **MTTR** (Mean Time To Recovery) | 2 hours | Target average recovery time. RTO is the upper bound. |

---

## 2. Backup Strategy

### PostgreSQL Backups

| Type | Frequency | Retention | Storage | Purpose |
|------|-----------|-----------|---------|---------|
| Full backup (`pg_dump`) | Daily at 02:00 UTC | 30 days | S3 (different region) | Point-in-time baseline |
| WAL archiving | Continuous | 7 days | S3 (different region) | Point-in-time recovery within RPO |
| Logical backup | Weekly (Sunday) | 90 days | S3 (different region) | Long-term disaster recovery |
| Financial records archive | Monthly | 7 years | S3 Glacier | BIR compliance (BR-32) |

### File Storage (S3/MinIO)

| Type | Strategy | Retention |
|------|----------|-----------|
| User uploads | S3 versioning enabled, cross-region replication | Account lifetime + 30 days |
| Generated PDFs (certificates, receipts) | Regenerable from data — backup data, not files | 7 years (financial) |
| Profile photos | S3 versioning | Account lifetime + 30 days |

### Backup Validation

- **Automated restore test:** Weekly — restore latest backup to staging, run health checks
- **Data integrity check:** Monthly — compare row counts and checksums between production and restored backup
- **Financial record verification:** Quarterly — verify 7-year retention chain is intact

---

## 3. Failure Scenarios

### Scenario 1: Database Corruption / Loss

| Step | Action | Time |
|------|--------|------|
| 1 | Alert fires (health check fails) | 0 min |
| 2 | On-call acknowledges | < 15 min |
| 3 | Assess scope (full DB loss vs. partial corruption) | 15-30 min |
| 4 | Restore from latest daily backup + WAL replay to RPO target | 30-120 min |
| 5 | Verify data integrity (row counts, financial totals, recent transactions) | 120-180 min |
| 6 | Resume service, notify affected users | 180-240 min |

**Data loss window:** Up to 1 hour (RPO) of transactions.
**Mitigation:** WAL archiving reduces actual loss to seconds in most cases.

### Scenario 2: Application Server Failure

| Step | Action | Time |
|------|--------|------|
| 1 | Health check fails, load balancer removes instance | 0-1 min |
| 2 | Auto-scaling launches replacement instance | 1-5 min |
| 3 | Migrations run on startup, service becomes ready | 5-10 min |

**Data loss:** None (database is separate from application).
**Note:** Single-region deployment in Phase 1. Multi-region failover in Phase 2.

### Scenario 3: S3/MinIO Storage Failure

| Step | Action | Time |
|------|--------|------|
| 1 | Upload/download errors detected | 0 min |
| 2 | Switch to backup storage region (if cross-region replication active) | 5-15 min |
| 3 | If no replication: files are unavailable until storage recovers | Hours |

**Mitigation:** PDFs are regenerable. Profile photos and uploads require S3 versioning/replication.

### Scenario 4: Payment Gateway Outage (Stripe/PayMongo)

| Step | Action | Time |
|------|--------|------|
| 1 | Payment API calls fail | 0 min |
| 2 | Platform remains operational — dues can be recorded manually | Immediate |
| 3 | Queue failed payments for retry when gateway recovers | Automatic |
| 4 | Notify treasurers of gateway status | < 30 min |

**Data loss:** None. Payments are idempotent (idempotency keys). Webhook retries handle catch-up.

### Scenario 5: Security Breach

| Step | Action | Time |
|------|--------|------|
| 1 | Intrusion detected (anomalous access patterns, credential exposure) | 0 min |
| 2 | Rotate all secrets (DB credentials, API keys, session signing key) | < 30 min |
| 3 | Force-expire all active sessions | < 30 min |
| 4 | NPC notification within 72 hours (DPA 2012 requirement) | < 72 hours |
| 5 | Affected users notified with plain-language explanation | < 72 hours |
| 6 | Post-incident review, implement additional controls | < 7 days |

---

## 4. Infrastructure Requirements

### Phase 1 (Pilot)

| Component | Configuration | Justification |
|-----------|--------------|---------------|
| Database | Single PostgreSQL instance, daily backups to S3 | Pilot scale (< 500 concurrent users) |
| Application | Single server, auto-restart on failure | Sufficient for pilot orgs |
| Storage | S3 with versioning | File protection |
| WAL archiving | Continuous to S3 | RPO < 1 hour compliance |
| Monitoring | Pino logs → log aggregator | See OBSERVABILITY.md |

### Phase 2 (Scale)

| Component | Configuration | Justification |
|-----------|--------------|---------------|
| Database | Primary + read replica, automated failover | 99.5% uptime SLA |
| Application | Multi-instance behind load balancer | Convention spike handling (500 concurrent) |
| Storage | S3 cross-region replication | Data durability |
| CDN | Static assets + generated PDFs | Mobile 3G performance target |
| Monitoring | OpenTelemetry → Grafana/Prometheus | Real-time alerting |

---

## 5. Communication Plan

### During Outage

| Audience | Channel | Message | Timing |
|----------|---------|---------|--------|
| Platform admins | Email + SMS | Incident summary, ETA, workaround | < 15 min |
| Officers | In-app banner (if app accessible) or email | Service status, ETA | < 30 min |
| Members | Status page | Plain-language summary | < 30 min |

### Post-Recovery

| Audience | Channel | Content | Timing |
|----------|---------|---------|--------|
| All users | Email | What happened, what data (if any) was affected, what was fixed | < 24 hours |
| Platform admins | Detailed report | Root cause, timeline, prevention measures | < 72 hours |
| NPC (if data breach) | Formal notification | Per DPA 2012 breach notification requirements | < 72 hours |

---

## 6. Testing Schedule

| Test | Frequency | Scope | Success Criteria |
|------|-----------|-------|-----------------|
| Backup restore drill | Monthly | Restore latest backup to staging | Data integrity verified, app starts successfully |
| Failover simulation | Quarterly | Kill primary DB, verify replica promotion | Recovery within RTO (4 hours) |
| Full DR exercise | Semi-annually | Simulate complete data center loss | Full recovery from backups within RTO |
| Financial audit trail | Quarterly | Verify 7-year retention chain | All financial records accessible and intact |
| Security incident drill | Semi-annually | Simulate credential exposure | Secrets rotated, sessions expired within 30 min |

---

## 7. Responsibilities

| Role | DR Responsibility |
|------|------------------|
| On-call engineer | First responder, initial assessment, execute recovery runbook |
| Engineering lead | Escalation point, authorize data restoration, coordinate communication |
| CTO | Approve communication to users, interface with NPC if breach |
| Platform admin (Memberry) | Notify affected organizations, provide workarounds |

---

## 8. Regulatory Compliance

| Requirement | Implementation |
|-------------|---------------|
| DPA 2012 — Breach notification | NPC notified within 72 hours, affected users notified |
| DPA 2012 — Data protection | Backups encrypted at rest (S3 SSE), in transit (TLS) |
| BIR — Financial retention | 7-year retention for payment records, monthly archive to S3 Glacier |
| BIR — Audit trail | Payment status history tables preserved in all backups |

---

> **Rules:**
> - DR plan must be tested quarterly. Untested DR plans are equivalent to no DR plan.
> - Backups must be stored in a different region from the primary database.
> - Financial record retention (7 years) is a legal requirement, not optional.
> - All secrets must be rotatable without downtime.
> - Update this plan when infrastructure changes (new database, new region, new provider).
