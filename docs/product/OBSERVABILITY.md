<!-- oli:artifact observability v1.0 generated:2026-05-21 source:MASTER_PRD.md,codebase -->
# Observability Strategy: Memberry

> Defines logging, metrics, alerting, and tracing standards. Ensures NFR targets (PRD S7) are measurable and enforceable. NFR breaches are P1 incidents with 24-hour resolution SLA.

## 1. Logging

### Stack

- **Library:** Pino (structured JSON)
- **Configuration:** `LOG_LEVEL` environment variable (`services/api-ts/src/core/config.ts`)
- **Valid levels:** `debug`, `info`, `warn`, `error` (default: `info`)
- **Output:** Structured JSON to stdout (12-factor app pattern)

### Levels by Environment

| Environment | Level | Rationale |
|-------------|-------|-----------|
| Development | `debug` | Full visibility for local debugging |
| Staging | `info` | Match production pattern, catch issues early |
| Production | `info` | Balance between visibility and volume; `warn` if cost-constrained |
| CI/Test | `warn` | Reduce noise in test output |

### Mandatory Log Fields

Every log entry must include:

| Field | Source | Purpose |
|-------|--------|---------|
| `requestId` | `X-Request-ID` header or auto-generated UUID | Request correlation |
| `path` | `c.req.path` | Route identification |
| `method` | `c.req.method` | HTTP method |
| `statusCode` | Response status | Outcome classification |
| `duration` | Request timer | Performance tracking |
| `organizationId` | Auth context | Tenant scoping |
| `userId` | Session | Actor identification |

### PII Rules (DPA 2012)

- **Never log:** passwords, session tokens, payment credentials, license numbers, raw email addresses
- **Hash before logging:** email (for correlation without exposure)
- **Allowed:** person ID (UUID), organization ID, role, action type
- **Audit log:** Separate audit table (`audit` module), not application logs

---

## 2. Metrics (RED Method)

### Per-Endpoint Metrics

| Metric | Description | Labels | NFR Target |
|--------|-------------|--------|-----------|
| `http_request_rate` | Requests per second | `method`, `route`, `status_class` | Baseline + 500 concurrent spike |
| `http_request_errors` | Error rate (4xx + 5xx) | `method`, `route`, `error_code` | < 1% of total requests |
| `http_request_duration_seconds` | Response latency histogram | `method`, `route` | p95 < 500ms (general), p95 < 200ms (search) |

### Business Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| `auth_login_failures` | Failed login attempts per minute | > 10/min per IP (possible brute force) |
| `payment_processing_duration` | Dues payment end-to-end time | p95 > 3s |
| `pdf_generation_duration` | Certificate/receipt/ID card generation | > 3s (NFR target) |
| `member_search_duration` | Member search response time | p95 > 200ms (NFR target) |
| `email_queue_depth` | Pending emails in queue | > 1000 (backlog building) |
| `websocket_connections` | Active WebSocket connections | > 500 (capacity limit) |

### Infrastructure Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| `db_connection_pool_usage` | Active/idle/waiting connections | > 80% active |
| `db_query_duration` | Query execution time | p95 > 100ms |
| `s3_upload_duration` | File upload latency | p95 > 2s |
| `memory_usage_bytes` | Process memory | > 80% of limit |
| `cpu_usage_percent` | Process CPU | > 70% sustained |

### Implementation

Phase 1 (recommended): Pino-based request logging with duration tracking. Extract metrics from structured logs using log aggregator (e.g., Datadog, Grafana Loki).

Phase 2 (when scale demands): OpenTelemetry SDK with Prometheus exporter for real-time metrics.

---

## 3. Alerting

### NFR-Derived Alerts

| Alert | Condition | Severity | Response SLA |
|-------|-----------|----------|-------------|
| API Latency High | p95 > 500ms for 5 minutes | P1 | 24 hours |
| Search Latency High | p95 > 200ms for 5 minutes | P1 | 24 hours |
| PDF Generation Slow | p95 > 3s for 5 minutes | P1 | 24 hours |
| Error Rate Spike | 5xx rate > 1% for 5 minutes | P1 | 24 hours |
| Uptime Below SLA | Availability < 99.5% (rolling 30d) | P0 | Immediate |
| Concurrent Users Approaching Limit | WebSocket connections > 400 | P2 | Next business day |

### Security Alerts

| Alert | Condition | Severity | Response |
|-------|-----------|----------|----------|
| Brute Force Detected | > 10 failed logins/min per IP | P1 | Auto-block IP, notify admin |
| Cross-Tenant Access Attempt | Query without org scope | P0 | Immediate investigation |
| Payment Credential Exposure | Gateway secret in logs | P0 | Rotate credentials, audit |
| Rate Limit Storm | > 100 rate-limited requests/min | P2 | Review source, adjust limits |

### Alert Routing

| Severity | Channel | Recipient |
|----------|---------|-----------|
| P0 | SMS + Email + Dashboard | On-call engineer + CTO |
| P1 | Email + Dashboard | On-call engineer |
| P2 | Dashboard | Engineering team |
| P3 | Weekly digest | Engineering team |

---

## 4. Tracing

### Request Correlation

- **Header:** `X-Request-ID` (auto-generated UUID if not provided by client)
- **Propagation:** Injected by middleware, available as `c.get('requestId')` in handlers
- **Scope:** All log entries, error responses, and audit records include `requestId`
- **Cross-service:** Currently single-service (monolith). When services split, propagate via `X-Request-ID` header.

### Audit Trail Integration

- Audit module logs all state-changing operations with `requestId`
- Enables full request reconstruction: HTTP request → handler → DB changes → audit entry
- Financial operations (payments, refunds) include `requestId` in status history tables

### Future: OpenTelemetry

When the platform scales beyond a single process:

1. Add `@opentelemetry/sdk-node` with auto-instrumentation
2. Export traces to Jaeger or Grafana Tempo
3. Instrument critical paths: auth → handler → DB → external service (Stripe, OneSignal, S3)
4. Add span attributes for `organizationId`, `personId`, `module`

---

## 5. Health Checks

### Endpoints

| Endpoint | Purpose | Checks | Response |
|----------|---------|--------|----------|
| `GET /health` | Liveness probe | Process is running | `200 { "status": "ok" }` |
| `GET /health/ready` | Readiness probe | DB connection + migrations current | `200` or `503` |
| `GET /health/startup` | Startup probe | Initial migration complete | `200` or `503` |

### Implementation Notes

- Health checks must bypass auth middleware (public endpoints)
- Readiness probe should verify PostgreSQL connection with a simple query (`SELECT 1`)
- Startup probe prevents traffic before migrations complete
- Do not expose internal state (version, config, env) in health responses

---

## 6. Dashboard Requirements

### Operational Dashboard

| Panel | Data Source | Refresh |
|-------|-----------|---------|
| Request rate by route | Request logs | 30s |
| p95 latency by route | Request logs | 30s |
| Error rate by error code | Request logs | 30s |
| Active users (WebSocket) | Connection count | 10s |
| Email queue depth | DB query | 60s |
| Payment processing status | DB query | 60s |

### Business Dashboard

| Panel | Data Source | Refresh |
|-------|-----------|---------|
| MAM (Monthly Active Members) | Auth events | Daily |
| Dues payments today | Payment events | 5m |
| Active organizations | DB query | Hourly |
| Event registrations this week | Event module | Hourly |

---

> **Rules:**
> - NFR breach = P1 incident with 24-hour resolution SLA (PRD S7).
> - PII must never appear in application logs. Use the audit module for PII access tracking.
> - Every new endpoint must emit request duration metrics from day one.
> - Alert thresholds derive from PRD NFR targets — update both together.
