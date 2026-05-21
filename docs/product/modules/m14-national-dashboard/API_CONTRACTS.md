<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — National Dashboard (M14)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/admin/national` |
| Auth default | GA+HG (national officer) or PA (platform admin) |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | `associationId` from session for national officers; platform admins see all associations |

---

## 2. Endpoints

### 2.1 Association Summary

#### GET `/admin/national/summary`

**Get cross-chapter aggregated KPIs for an association**

| Property | Value |
|----------|-------|
| Auth | GA+HG — national officer (president) or PA |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-084 |
| Business rules | BR-36, M14-R1, M14-R2, M14-R3 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| associationId | string (uuid) | No | Association to query. Required for PA; inferred from session for national officers |
| filter[dateFrom] | string | No | Start of reporting period (YYYY-MM-DD). Default: 12 months ago |
| filter[dateTo] | string | No | End of reporting period (YYYY-MM-DD). Default: today |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Aggregated KPIs |
| data.associationId | string | No | uuid | Association ID |
| data.associationName | string | No | — | Association display name |
| data.totalMembers | number | No | integer | Total member count across all chapters |
| data.activeMembers | number | No | integer | Members with active status |
| data.activePercentage | number | No | float | Active members / total * 100 |
| data.collectionRate | number | No | float | Dues paid / dues expected * 100 |
| data.totalRevenueCents | number | No | integer | Total dues revenue in cents |
| data.creditCompliance | number | No | float | % members meeting credit requirements |
| data.eventCount | number | No | integer | Events held in period |
| data.trainingCount | number | No | integer | Trainings held in period |
| data.chapterCount | number | No | integer | Total organizations in association |
| data.snapshotDate | string | No | ISO 8601 | When data was last aggregated |
| data.isStale | boolean | No | — | True if snapshot > 24h old (M14-R3) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `M14-001` | 403 | User is not a national officer or platform admin |
| `AUTHZ-006` | 403 | National officer accessing another association's data |
| `NOT_FOUND-001` | 404 | Association not found |
| `M14-002` | 422 | Invalid date range (dateTo before dateFrom) |

---

### 2.2 Chapter Comparison

#### GET `/admin/national/chapters`

**List chapters with comparative metrics for benchmarking**

| Property | Value |
|----------|-------|
| Auth | GA+HG — national officer or PA |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-084 |
| Business rules | BR-36, M14-R2 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| associationId | string (uuid) | No | Association to query. Required for PA; inferred from session for national officers |
| limit | number | No | Items per page (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |
| before | string | No | Cursor for backward pagination |
| sort | string | No | Sort field: `totalMembers`, `collectionRate`, `creditCompliance`, `-totalMembers`, `-collectionRate`, `-creditCompliance`. Default: `-totalMembers` |
| filter[dateFrom] | string | No | Start of reporting period (YYYY-MM-DD) |
| filter[dateTo] | string | No | End of reporting period (YYYY-MM-DD) |
| search | string | No | Search chapter name (min 2 chars) |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | — | Array of chapter metric objects |
| data[].organizationId | string | No | uuid | Chapter organization ID |
| data[].organizationName | string | No | — | Chapter name |
| data[].totalMembers | number | No | integer | Member count |
| data[].activeMembers | number | No | integer | Active member count |
| data[].activePercentage | number | No | float | Active % |
| data[].collectionRate | number | No | float | Dues collection rate % |
| data[].creditCompliance | number | No | float | Credit compliance % |
| data[].totalRevenueCents | number | No | integer | Revenue in cents |
| data[].eventCount | number | No | integer | Events in period |
| data[].trainingCount | number | No | integer | Trainings in period |
| data[].isSuppressed | boolean | No | — | True if < 5 members (M14-R2); individual metrics hidden |
| meta | object | No | — | Pagination metadata |
| meta.cursor | string | Yes | — | Opaque cursor for next page |
| meta.hasMore | boolean | No | — | Whether more results exist |
| meta.total | number | Yes | — | Total chapter count |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `M14-001` | 403 | Not a national officer or platform admin |
| `AUTHZ-006` | 403 | Cross-association access denied |
| `VALIDATION-007` | 400 | Invalid sort or filter parameter |

---

### 2.3 Chapter Drill-Down

#### GET `/admin/national/chapters/{organizationId}`

**Get detailed metrics for a single chapter**

| Property | Value |
|----------|-------|
| Auth | GA+HG — national officer (own association) or PA |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-085 |
| Business rules | BR-36, M14-R2 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Chapter to drill into |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[dateFrom] | string | No | Start of reporting period (YYYY-MM-DD) |
| filter[dateTo] | string | No | End of reporting period (YYYY-MM-DD) |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Detailed chapter metrics |
| data.organizationId | string | No | uuid | Chapter ID |
| data.organizationName | string | No | — | Chapter name |
| data.totalMembers | number | No | integer | Member count |
| data.activeMembers | number | No | integer | Active members |
| data.activePercentage | number | No | float | Active % |
| data.memberStatusBreakdown | object | No | — | Status distribution |
| data.memberStatusBreakdown.active | number | No | integer | Active count |
| data.memberStatusBreakdown.grace | number | No | integer | Grace count |
| data.memberStatusBreakdown.lapsed | number | No | integer | Lapsed count |
| data.memberStatusBreakdown.suspended | number | No | integer | Suspended count |
| data.collectionRate | number | No | float | Dues collection % |
| data.totalRevenueCents | number | No | integer | Revenue in cents |
| data.creditCompliance | number | No | float | Credit compliance % |
| data.creditComplianceBreakdown | object | No | — | Compliance detail |
| data.creditComplianceBreakdown.compliant | number | No | integer | Members meeting requirements |
| data.creditComplianceBreakdown.nonCompliant | number | No | integer | Members not meeting requirements |
| data.creditComplianceBreakdown.exempt | number | No | integer | Exempt members |
| data.eventCount | number | No | integer | Events held |
| data.trainingCount | number | No | integer | Trainings held |
| data.recentEvents | array | No | — | Last 5 events (title, date) |
| data.snapshotDate | string | No | ISO 8601 | When data was aggregated |
| data.isSuppressed | boolean | No | — | True if < 5 members (M14-R2) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `M14-001` | 403 | Not a national officer or platform admin |
| `AUTHZ-006` | 403 | Chapter not in officer's association |
| `NOT_FOUND-001` | 404 | Chapter not found |

---

### 2.4 Data Export

#### GET `/admin/national/export`

**Export aggregated dashboard data as CSV or PDF**

| Property | Value |
|----------|-------|
| Auth | GA+HG — national officer or PA |
| Rate limit | Bulk operations (10 req/min) |
| Idempotency | N/A |
| Workflow | WF-086 |
| Business rules | M14-R4 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| associationId | string (uuid) | No | Association to export. Required for PA; inferred for national officers |
| format | string | Yes | Export format: `csv`, `pdf` |
| filter[dateFrom] | string | No | Start of reporting period (YYYY-MM-DD) |
| filter[dateTo] | string | No | End of reporting period (YYYY-MM-DD) |
| filter[organizationId] | string (uuid) | No | Export single chapter only |

**Response** `200 OK` (CSV) / `200 OK` (PDF)

For CSV: `Content-Type: text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="national-report-{date}.csv"`

For PDF: `Content-Type: application/pdf` with `Content-Disposition: attachment; filename="national-report-{date}.pdf"`

For large datasets, returns `202 Accepted`:

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Async job reference |
| data.jobId | string | No | uuid | Job ID for polling |
| data.status | string | No | — | `"processing"` |
| data.pollUrl | string | No | url | URL to poll for completion |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `M14-001` | 403 | Not a national officer or platform admin |
| `AUTHZ-006` | 403 | Cross-association access denied |
| `M14-002` | 422 | Invalid date range |
| `VALIDATION-005` | 400 | Invalid format value (must be `csv` or `pdf`) |
| `M14-003` | 422 | Aggregation query timed out |

---

### 2.5 Platform-Wide Summary

#### GET `/admin/national/platform`

**Get platform-wide analytics across all associations (platform admin only)**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | — |
| Business rules | M14-R1 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Items per page (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |
| sort | string | No | Sort field: `totalMembers`, `collectionRate`, `-totalMembers`, `-collectionRate`. Default: `-totalMembers` |
| filter[dateFrom] | string | No | Start of reporting period (YYYY-MM-DD) |
| filter[dateTo] | string | No | End of reporting period (YYYY-MM-DD) |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | — | Array of association summaries |
| data[].associationId | string | No | uuid | Association ID |
| data[].associationName | string | No | — | Association name |
| data[].chapterCount | number | No | integer | Number of chapters |
| data[].totalMembers | number | No | integer | Total member count |
| data[].activeMembers | number | No | integer | Active member count |
| data[].collectionRate | number | No | float | Dues collection % |
| data[].creditCompliance | number | No | float | Credit compliance % |
| data[].totalRevenueCents | number | No | integer | Revenue in cents |
| meta | object | No | — | Pagination metadata |
| meta.cursor | string | Yes | — | Opaque cursor |
| meta.hasMore | boolean | No | — | More results exist |
| meta.total | number | Yes | — | Total association count |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `M14-003` | 422 | Aggregation query timed out |
