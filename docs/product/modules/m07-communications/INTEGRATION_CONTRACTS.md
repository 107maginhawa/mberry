<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md M07, ARCHITECTURE.md -->
# Integration Contracts — Communications (M07)

## 1. OneSignal (Push Notifications)

| Property | Value |
|----------|-------|
| Provider | OneSignal |
| API version | REST API v1 |
| SDK | `@onesignal/node-onesignal` |
| Auth | REST API key (`ONESIGNAL_REST_API_KEY`) |
| Test strategy | OneSignal sandbox / test users |
| Docs | https://documentation.onesignal.com/reference |

### Architecture Pattern

**Single App ID** across all frontends (app-agnostic). OneSignal uses `external_id` (person UUID) to target users across devices/apps.

### Endpoints Called

| OneSignal Endpoint | Purpose | Memberry Trigger |
|-------------------|---------|------------------|
| `POST /notifications` | Send push notification | Notification created (any module) |
| `POST /players` | Register device | Frontend app initialization |
| `PUT /players/:id` | Update device tags | App tag assignment |
| `DELETE /players/:id` | Remove device | Account deletion |
| `GET /notifications/:id` | Check delivery status | Delivery tracking |

### Error Handling

| OneSignal Error | Maps To | User Message |
|----------------|---------|--------------|
| `400 Bad Request` | `INTERNAL-001` | Internal error (invalid payload — log + alert) |
| `401 Unauthorized` | `INTERNAL-001` | Internal error (bad API key — alert) |
| `429 Rate Limit` | `EXT-002` | Notification service unavailable |
| `500/503` | `EXT-002` | Notification service unavailable |
| Device not registered | Swallow | No notification sent (expected for unregistered) |

### Circuit Breaker

| Parameter | Value |
|-----------|-------|
| Failure threshold | 10 consecutive failures |
| Recovery timeout | 120 seconds |
| Fallback | Queue notification for retry, fall back to email channel |
| Health check | `GET /apps/:app_id` |

### Secret Policy

| Secret | Env Var | Injection | Redaction |
|--------|---------|-----------|-----------|
| REST API key | `ONESIGNAL_REST_API_KEY` | Environment variable | Mask all but last 4 chars |
| App ID | `ONESIGNAL_APP_ID` | Environment variable | Semi-public — logged in debug only |

---

## 2. Email Service (SMTP/Transactional)

| Property | Value |
|----------|-------|
| Provider | Configurable (Postmark, SendGrid, SMTP) |
| Auth | API key or SMTP credentials |
| Test strategy | Email sandbox / test recipients |

### Endpoints Called

| Action | Purpose | Memberry Trigger |
|--------|---------|------------------|
| Send email | Deliver transactional email | `email.processor` pg-boss job |
| Send batch | Bulk announcement delivery | `AnnouncementPublished` event |

### Error Handling

| Error | Maps To | Handling |
|-------|---------|---------|
| SMTP connection failure | `EXT-004` | Retry via pg-boss (3 retries, exponential backoff) |
| Invalid recipient | Swallow | Add to `email_suppression` table |
| Rate limit | `EXT-004` | Backoff, reduce send rate |
| Bounce | Swallow | Add to `email_suppression` table |

### Secret Policy

| Secret | Env Var | Injection | Redaction |
|--------|---------|-----------|-----------|
| API key / SMTP password | `EMAIL_API_KEY` or `SMTP_PASSWORD` | Environment variable | Never log |
| SMTP host | `SMTP_HOST` | Environment variable | Can log |
