<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md M11, ARCHITECTURE.md -->
# Integration Contracts — Documents & Credentials (M11)

## 1. S3/MinIO (Object Storage)

| Property | Value |
|----------|-------|
| Provider | S3-compatible (AWS S3 or MinIO) |
| SDK | `@aws-sdk/client-s3` |
| Auth | Access key + secret key |
| Test strategy | MinIO local instance |
| Docs | https://docs.aws.amazon.com/AmazonS3/latest/API/ |

### Operations Used

| S3 Operation | Purpose | Memberry Trigger |
|-------------|---------|------------------|
| `PutObject` | Upload file | Document upload, certificate PDF generation |
| `GetObject` | Download file | Document download, certificate download |
| `DeleteObject` | Remove file | Document deletion, account deletion cascade |
| `HeadObject` | Check file exists | Pre-download validation |
| `CreatePresignedUrl` (GET) | Temporary download URL | Secure file access (15-min expiry) |
| `CreatePresignedUrl` (PUT) | Temporary upload URL | Client-side direct upload |
| `CopyObject` | Copy file | Document versioning |

### Bucket Structure

| Bucket | Purpose | Access |
|--------|---------|--------|
| `memberry-documents` | Organization documents | Presigned URLs only |
| `memberry-certificates` | Generated certificates/credentials | Presigned URLs only |
| `memberry-avatars` | Profile photos | Public read (CDN-fronted) |
| `memberry-uploads` | Temporary upload staging | Presigned PUT, auto-expire 24h |

### Error Handling

| S3 Error | Maps To | User Message |
|---------|---------|--------------|
| `NoSuchKey` | `NOT_FOUND-001` | Resource not found |
| `AccessDenied` | `INTERNAL-001` | Internal error (misconfigured credentials — alert) |
| `SlowDown` | `EXT-003` | Storage service unavailable |
| `ServiceUnavailable` | `EXT-003` | Storage service unavailable |
| `EntityTooLarge` | `VALIDATION-006` | Payload too large |

### Circuit Breaker

| Parameter | Value |
|-----------|-------|
| Failure threshold | 3 consecutive failures |
| Recovery timeout | 30 seconds |
| Fallback | Return 502 with `EXT-003` |
| Health check | `HeadBucket` on primary bucket |

### File Validation

| Check | Rule |
|-------|------|
| Max file size | 50 MB (configurable per bucket) |
| Allowed MIME types | Per module: documents (PDF, DOCX, XLSX, images), certificates (PDF only), avatars (JPEG, PNG, WebP) |
| SVG sanitization | SVG files sanitized server-side before storage (BR-31) |
| Virus scan | Planned (not yet implemented) |

### Secret Policy

| Secret | Env Var | Injection | Redaction |
|--------|---------|-----------|-----------|
| Access key | `S3_ACCESS_KEY` | Environment variable | Mask all but last 4 chars |
| Secret key | `S3_SECRET_KEY` | Environment variable | Never log |
| Endpoint URL | `S3_ENDPOINT` | Environment variable | Can log |
| Bucket name | `S3_BUCKET_*` | Environment variable | Can log |
