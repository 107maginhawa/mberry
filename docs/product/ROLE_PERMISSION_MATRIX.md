# Role Permission Matrix

> Generated from `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` Section 6,
> `services/api-ts/src/types/auth.ts`, `services/api-ts/src/utils/org-auth.ts`,
> and `services/api-ts/src/utils/officer-check.ts`.
>
> Last updated: 2026-05-14

---

## 1. Role Definitions

### System-Wide Roles (types/auth.ts)

| Role | Scope | Description |
|------|-------|-------------|
| `user` | Any authenticated | Default Better-Auth role; base access level |
| `client` | System-wide | Application-level role for service consumers |
| `host` | System-wide | Application-level role for service providers |
| `admin` | System-wide | System administrator |

### Platform Admin Levels (platform_admin table — admin_role enum)

| Role | Scope | Description |
|------|-------|-------------|
| `super` | Platform | Highest platform privilege; full system access |
| `support` | Platform | Platform support staff — can impersonate, view data, respond to tickets |
| `analyst` | Platform | Read-only analytics access; cannot modify data or impersonate |

### Organization-Scoped Roles (utils/org-auth.ts — ROLE_HIERARCHY)

Listed in descending privilege order (index 0 = highest):

| Role | Hierarchy | Description |
|------|-----------|-------------|
| `president` | 0 (highest) | Organization president; 2FA required in production |
| `vice-president` | 1 | Vice president |
| `secretary` | 2 | Secretary; 2FA required in production |
| `treasurer` | 3 | Treasurer; 2FA required in production |
| `board-member` | 4 | Board member |
| `officer` | 5 | General officer |
| `staff` | 6 | Organization staff |
| `member` | 7 (lowest) | Regular member |

---

## 2. Auth Middleware Stack

| Layer | Middleware | Applied To | Mechanism |
|-------|-----------|------------|-----------|
| 1 | Global auth | All routes (except public) | Session validation via Better-Auth |
| 2 | Officer auth | `/association/*` mutations | `officerAuthMiddleware` — verifies active officer term; enforces 2FA for president/treasurer/secretary |
| 3 | Platform admin | `/admin/*` routes | `platformAdminAuthMiddleware` — checks `platform_admin` table membership |
| 4 | Handler guards | Per-handler | `requirePosition()`, `requireOrgRole()`, `requireActiveStatus()`, `requireTenantAccess()` |

### Public (Unprotected) Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/email/unsubscribe` | GET/POST | RFC 8058 one-click unsubscribe |
| `/association/member/credentials/public-verify` | GET | Public credential verification |
| `/association/member/ethics/public-complaints` | GET | Public ethics complaints list |
| `/association/member/ethics/public-complaint` | POST | Submit ethics complaint (captcha-protected) |
| `/association/member/directory/public` | GET | Public member directory (opt-in) |
| `/association/member/directory/search` | GET | Public directory search (opt-in) |

---

## 3. Role x Module x Action Matrix

### Legend

| Symbol | Meaning |
|--------|---------|
| Y | Allowed |
| -- | Denied |
| R | Read only |
| Own | Own records only |
| 2FA | Requires two-factor authentication in production |

### Auth Method Codes

| Code | Description |
|------|-------------|
| GA | Global auth (session required) |
| OA | Officer auth middleware |
| PA | Platform admin middleware |
| HG | Handler guard (`requirePosition` / `requireOrgRole`) |

---

### 3.1 Person Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user | client | host |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|--------|------|
| Create | GA | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | Own | -- | -- |
| Read own | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Read any | PA | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Update own | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Update any | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Delete | PA | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

### 3.2 Association:Member Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| List members | GA+OA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | R | -- |
| Get member | GA+OA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Own | -- |
| Import roster | GA+HG | Y | Y | -- | Y,2FA | -- | Y,2FA | -- | -- | -- | -- | -- | -- |
| Manage credentials | GA+HG | Y | Y | -- | Y,2FA | -- | Y,2FA | -- | -- | -- | -- | -- | -- |
| Create election | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | -- | -- | -- | -- |
| Delete election | GA+HG | Y | Y | -- | Y,2FA | Y | Y,2FA | Y,2FA | Y | Y | -- | -- | -- |
| Governance (mutations) | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | -- | -- | -- | -- |
| Dues mutations | GA+HG | Y | Y | -- | Y,2FA | -- | -- | Y,2FA | -- | -- | -- | -- | -- |
| Public directory | Public | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Public complaints | Public | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.3 Association:Operations Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Create training | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Update training | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Delete training | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Publish training | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Cancel training | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Create event | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Update event | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Publish event | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Create/update course | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Delete course | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Manage enrollments | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Check-in | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Refund registration | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Analytics (read) | GA+OA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- | -- |

> **Note:** "officer" column refers to the `Society Officer` position title specifically (POSITION_TITLES.SOCIETY_OFFICER). General officers without this title are denied.

### 3.4 Dues Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Dashboard | GA+HG | Y | Y | -- | Y,2FA | -- | -- | Y,2FA | -- | -- | -- | -- | -- |
| List invoices | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Own | -- |
| Create invoice | GA+HG | Y | Y | -- | Y,2FA | -- | -- | Y,2FA | -- | -- | -- | -- | -- |
| Record payment | GA+HG | Y | Y | -- | Y,2FA | -- | -- | Y,2FA | -- | -- | -- | -- | -- |
| Process refund | GA+HG | Y | Y | -- | Y,2FA | -- | -- | Y,2FA | -- | -- | -- | -- | -- |
| View own dues | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |

### 3.5 Training Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| List providers | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Create provider | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Update provider | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Delete provider | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| View credits | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Own | -- |

### 3.6 Membership Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Apply | GA | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | Y |
| Update org profile | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | -- | -- | -- | -- |
| Approve/reject | GA+HG | Y | Y | -- | Y,2FA | -- | Y,2FA | -- | -- | -- | -- | -- | -- |
| View own membership | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.7 Platform Admin Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| List admins | PA | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Get admin role | PA | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Create org | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Get/list orgs | PA | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Transition org status | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Create/update assoc | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Delete association | PA | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Feature flags | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Impersonation | PA | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

### 3.8 Billing Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Connect Stripe | GA+HG | Y | Y | -- | Y,2FA | -- | -- | Y,2FA | -- | -- | -- | -- | -- |
| View balance | GA+HG | Y | Y | -- | Y,2FA | -- | -- | Y,2FA | -- | -- | -- | -- | -- |
| List transactions | GA+HG | Y | Y | -- | Y,2FA | -- | -- | Y,2FA | -- | -- | -- | -- | -- |
| Process payout | GA+HG | Y | Y | -- | Y,2FA | -- | -- | Y,2FA | -- | -- | -- | -- | -- |
| View own invoices | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.9 Booking Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| List slots | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Create booking | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Cancel own | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Manage slots | GA+HG | Y | Y | -- | Y | Y | Y | -- | -- | Y | Y | -- | -- |

### 3.10 Events Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| List events | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| View event | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Register | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Create/update | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |
| Delete | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | Y | -- | -- | -- |

### 3.11 Elections Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| View elections | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |
| Cast vote | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |
| Nominate | GA | Y | Y | -- | Y | Y | Y | Y | Y | Y | Y | Y | -- |
| Create election | GA+HG | Y | Y | -- | Y,2FA | -- | -- | -- | -- | -- | -- | -- | -- |
| Delete election | GA+HG | Y | Y | -- | Y,2FA | Y | Y,2FA | Y,2FA | Y | Y | -- | -- | -- |

### 3.12 Communication Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| List templates | GA+OA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- | -- |
| Create template | GA+HG | Y | Y | -- | Y | Y | Y | -- | -- | Y | -- | -- | -- |
| Send broadcast | GA+HG | Y | Y | -- | Y | -- | Y | -- | -- | -- | -- | -- | -- |
| View own messages | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.13 Documents Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| List documents | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |
| Download | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |
| Upload | GA+HG | Y | Y | -- | Y | Y | Y | -- | -- | Y | Y | -- | -- |
| Delete | GA+HG | Y | Y | -- | Y | -- | -- | -- | -- | -- | -- | -- | -- |

### 3.14 Storage Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Upload file | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Download file | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Delete file | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Own | -- |

### 3.15 Certificates Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Generate cert | GA+HG | Y | Y | -- | Y | -- | Y | -- | -- | Y | -- | -- | -- |
| View own certs | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.16 Invite Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Send invite | GA+HG | Y | Y | -- | Y | Y | Y | -- | -- | Y | Y | -- | -- |
| Accept invite | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.17 Email Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Queue email | GA+HG | Y | Y | -- | Y | -- | Y | -- | -- | Y | -- | -- | -- |
| View queue | PA | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Unsubscribe | Public | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.18 Notifications Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| View own notifs | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Send push | GA+HG | Y | Y | -- | Y | -- | -- | -- | -- | Y | -- | -- | -- |
| Manage prefs | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.19 Reviews Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Submit review | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| View reviews | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.20 Audit Module

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| View audit logs | PA | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- |

### 3.21 Comms Module (WebSocket)

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Join channel | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Send message | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Video call | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.22 Professional Feed Module (M13)

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Browse feed | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Create post | GA+HG | Y | Y | -- | Y | -- | Y | -- | -- | -- | -- | -- | -- |
| Moderate (hide/remove) | GA+HG | Y | Y | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- |
| Mute/unmute author | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| View hidden posts | GA+HG | Y | Y | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- |

> **Note:** Post creation restricted to President and Secretary (communications officers) per M13 MODULE_SPEC domain intent. Platform super/admin retain override access. VP and support staff can moderate but not create posts.

### 3.23 National Dashboard Module (M14)

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| View association health | GA+HG | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- |
| Chapter drill-down | GA+HG | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- |
| Export data | GA+HG | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- |
| Configure dashboard access | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| View all associations | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

### 3.24 Job Board Module (M15)

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Browse listings | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Post job listing | GA+HG | Y | Y | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- |
| Apply to job | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |
| Manage bookmarks/alerts | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |
| Approve external employers | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

> **External Actor — Verified Employer:** M15 `verified employer` is a domain entity status (public registration → platform admin approval), not an org role in ROLE_HIERARCHY. Auth uses `employer.verificationStatus` check, not `hasMinimumRole()`. Employers can only manage own job listings.

### 3.25 Advertising Module (M16)

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| View ads | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Create campaign | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Approve creative | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| View ad dashboard | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Report ad | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Opt out of targeting | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 3.26 Marketplace Module (M17)

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Browse marketplace | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Place order | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |
| Register as vendor | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Manage vendor listings | GA | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Verify/reject vendor | PA | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

> **External Actor — Verified Vendor:** M17 `verified vendor` is a domain entity status (public registration → platform admin verification), not an org role in ROLE_HIERARCHY. Auth uses `vendor.verificationStatus` check, not `hasMinimumRole()`. Vendors can only manage own listings and orders.

### 3.27 Surveys & Polls Module (M18)

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Create survey | GA+HG | Y | Y | -- | Y | Y | Y | -- | -- | -- | -- | -- | -- |
| Respond to survey | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |
| View survey results | GA+HG | Y | Y | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- |
| Create quick poll | GA+HG | Y | Y | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- |
| Vote on poll | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |

### 3.28 Committee Management Module (M19)

**Org-Level Roles:**

| Action | Auth | super | admin | support | president | VP | secretary | treasurer | board-member | officer | staff | member | user |
|--------|------|-------|-------|---------|-----------|----|-----------|-----------|--------------|---------|----|--------|------|
| Create committee | GA+HG | Y | Y | -- | Y | Y | -- | -- | -- | -- | -- | -- | -- |
| View committee (active) | GA | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | -- |
| View committee (dissolved) | GA+HG | Y | Y | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- |
| Manage members | GA+HG | Y | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- |
| Manage tasks | GA+HG | Y | Y | Y | Y | Y | Y | -- | Y | Y | -- | -- | -- |
| Dissolve committee | GA+HG | Y | Y | Y | Y | -- | -- | -- | -- | -- | -- | -- | -- |

**Committee-Scoped Roles** (stored in `committee_member.role`, checked via custom `requireCommitteeRole()` — not `hasMinimumRole()`):

| Action | chairperson | vice_chair | secretary | member |
|--------|------------|-----------|-----------|--------|
| Manage committee members | Y | -- | -- | -- |
| Manage tasks | Y | Y | Y | configurable |
| Schedule meetings | Y | Y | -- | -- |
| Record meeting minutes | Y | Y | Y | -- |
| Submit reports | Y | -- | -- | -- |
| Dissolve committee (own) | Y | -- | -- | -- |

> **Note:** `chairperson` is a committee-scoped role, not an org-level role in ROLE_HIERARCHY. Auth is checked via `committee_member.role` lookup, not `hasMinimumRole()`. Org-level president/admin overrides apply regardless of committee role. See M19-R1: every committee must have a chairperson assigned. M19-R6: if chairperson removed from org, committee enters `leaderless` state until new chairperson assigned.

---

## 4. 2FA Enforcement

Privileged positions require two-factor authentication in production (P1-3):

| Position | 2FA Required | Enforced By |
|----------|-------------|-------------|
| President | Yes | `requirePosition()` + `officerAuthMiddleware` |
| Treasurer | Yes | `requirePosition()` + `officerAuthMiddleware` |
| Secretary | Yes | `requirePosition()` + `officerAuthMiddleware` |

2FA is skipped in development (`NODE_ENV !== 'production'`).

---

## 5. Hierarchy-Based Access (hasMinimumRole)

`org-auth.ts` provides `hasMinimumRole(userRole, minimumRole)` for hierarchy-based checks. A role at index N has access to anything requiring index >= N:

```
president (0) > vice-president (1) > secretary (2) > treasurer (3) > board-member (4) > officer (5) > staff (6) > member (7)
```

Most handlers use `requirePosition()` (title-based, explicit allow-list) rather than hierarchy-based checks. The hierarchy is available for future use.

---

## 6. Key Security Findings

1. **All mutation routes are protected** -- no unguarded mutation endpoints found (Section 6 audit).
2. **Officer auth uses DB-sourced titles** (T-13-01) -- position titles come from the database JOIN, never from client input.
3. **Platform admin checked via table membership** -- not role field; separate `platform_admin` table.
4. **60+ handler files** use `requirePosition`/`requireOfficerTerm` for fine-grained access control.
5. **`client` and `host` roles** are application-level roles not currently used in RBAC guards -- they represent service consumer/provider distinctions.
