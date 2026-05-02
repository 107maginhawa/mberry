# Updating Your Monobase Boilerplate

When the upstream boilerplate gets improvements, use this guide to pull changes into your project.

## What Changed (Latest Update)

### 1. Test Suite: 328 → 973 tests (35 new test files)

| Area | New Files | Tests Added |
|------|-----------|-------------|
| Backend core (config, errors, jobs, health) | 4 | 157 |
| Backend middleware (auth, security) | 2 | 39 |
| Billing handlers + repos | 4 | 109 |
| Booking handlers + repos + jobs | 6 | 113 |
| Person, storage, comms, reviews, email, notifs | 8 | 86 |
| SDK (client, flows, WebRTC) | 4 | 97 |
| Frontend (guards, runtime-config) | 2 | 44 |
| **Total new** | **30** | **645** |

### 2. VERTICAL_TDD.md — Test-first development protocol (new file)

### 3. Memberry Build Learnings (7 fixes)
- `format-date.ts` — null/undefined guard (prevents crash)
- `use-format-date.ts` — type signature updated for nullable dates
- `auth.ts` — role naming convention comment
- `security.ts` — CORS custom header reminder comment
- `CLAUDE.md` — Development Protocol section, Multi-App Architecture section
- `CONTRIBUTING.md` — Vertical TDD reference, Data Bootstrap Order section
- Skills updated: `/develop` (design spec check), `/frontend-module` (UX spec pre-check)

---

## Quick Update (Copy-Paste Prompt for Claude Code)

Paste this into a Claude Code session in your project:

```
I need to update my project's boilerplate files from the latest monobase upstream.
The upstream repo is at /Users/elad-mini/Desktop/monobase-js-lf (or git@github.com:mycurelabs/monobase-js-lf.git).

## Step 1: Copy all new test files (SAFE — additive, no conflicts)

These are NEW files that don't exist in the project yet. Copy them all:

services/api-ts/src/core/config.test.ts
services/api-ts/src/core/errors.test.ts
services/api-ts/src/core/health.test.ts
services/api-ts/src/core/jobs.test.ts
services/api-ts/src/middleware/auth.test.ts
services/api-ts/src/middleware/security.test.ts
services/api-ts/src/handlers/billing/repos/billing.repo.test.ts
services/api-ts/src/handlers/billing/createInvoice.test.ts
services/api-ts/src/handlers/billing/handleStripeWebhook.test.ts
services/api-ts/src/handlers/billing/payInvoice.test.ts
services/api-ts/src/handlers/booking/repos/booking.repo.test.ts
services/api-ts/src/handlers/booking/repos/bookingEvent.repo.test.ts
services/api-ts/src/handlers/booking/createBooking.test.ts
services/api-ts/src/handlers/booking/confirmBooking.test.ts
services/api-ts/src/handlers/booking/jobs/confirmationTimer.test.ts
services/api-ts/src/handlers/booking/jobs/slotGenerator.test.ts
services/api-ts/src/handlers/person/repos/person.repo.test.ts
services/api-ts/src/handlers/person/createPerson.test.ts
services/api-ts/src/handlers/storage/uploadFile.test.ts
services/api-ts/src/handlers/comms/ws.chat-room.test.ts
services/api-ts/src/handlers/comms/joinVideoCall.test.ts
services/api-ts/src/handlers/reviews/createReview.test.ts
services/api-ts/src/handlers/email/jobs/processor.test.ts
services/api-ts/src/handlers/notifs/markNotificationAsRead.test.ts
packages/sdk-ts/src/client.test.ts
packages/sdk-ts/src/flows/file-upload.test.ts
packages/sdk-ts/src/flows/billing-onboarding.test.ts
packages/sdk-ts/src/utils/webrtc/signaling-client.test.ts
apps/account/src/utils/guards.test.ts
apps/account/src/utils/runtime-config.test.ts

## Step 2: Copy new docs (SAFE — new files)

VERTICAL_TDD.md
UPDATING.md

## Step 3: Copy updated skills (SAFE — no project content)

.claude/skills/develop/SKILL.md
.claude/skills/frontend-module/SKILL.md
.claude/skills/handler/SKILL.md
.claude/skills/pre-commit/SKILL.md
.claude/skills/module-review/SKILL.md

## Step 4: Apply code fixes (REVIEW — small targeted changes)

a) apps/account/src/lib/format-date.ts — add null/undefined to function signatures:
   - formatDate(date: Date | number | string | null | undefined, ...)
   - formatRelativeDate(date: Date | number | string | null | undefined, ...)
   - Add `if (date == null) return ''` at top of each function

b) apps/account/src/hooks/use-format-date.ts — update UseFormatDateReturn interface:
   - formatDate: (date: Date | number | string | null | undefined) => string
   - formatRelativeDate: (date: Date | number | string | null | undefined, ...) => string

c) apps/account/src/lib/format-date.test.ts — add 4 null/undefined test cases

d) services/api-ts/src/middleware/auth.ts — add comment near line 168 (role split):
   "Roles must not contain ':' unless using the :owner pattern"

e) services/api-ts/src/middleware/security.ts — add comment at allowHeaders line:
   "When adding custom headers, add to BOTH allowHeaders AND exposeHeaders"

## Step 5: Merge doc updates (CAREFUL — may have project content)

CLAUDE.md — add these sections if missing:
- "## Development Protocol" section referencing VERTICAL_TDD.md
- "### Multi-App Architecture" section (3-app pattern)
- Update "When in Doubt" list to include VERTICAL_TDD.md

CONTRIBUTING.md — add these sections if missing:
- Vertical TDD reference in Testing Requirements section
- "### Data Bootstrap Order" section (signup → person → roles)

## Step 6: Verify

cd services/api-ts && bun test
cd apps/account && bun test
cd packages/sdk-ts && bun test

All tests should pass. Report any failures — they likely indicate project-specific
handler changes that need test adjustments.
```

---

## rsync Method (Local Upstream)

```bash
UPSTREAM=/Users/elad-mini/Desktop/monobase-js-lf
PROJECT=/path/to/your/project

# Step 1: All test files (safe — additive)
rsync -av --include='*.test.ts' --include='*.test.tsx' --include='*/' --exclude='*' \
  "$UPSTREAM/services/api-ts/src/" "$PROJECT/services/api-ts/src/"
rsync -av --include='*.test.ts' --include='*.test.tsx' --include='*/' --exclude='*' \
  "$UPSTREAM/packages/sdk-ts/src/" "$PROJECT/packages/sdk-ts/src/"
rsync -av --include='*.test.ts' --include='*.test.tsx' --include='*/' --exclude='*' \
  "$UPSTREAM/apps/account/src/" "$PROJECT/apps/account/src/"

# Step 2: New docs
cp "$UPSTREAM/VERTICAL_TDD.md" "$PROJECT/"
cp "$UPSTREAM/UPDATING.md" "$PROJECT/"

# Step 3: Skills (safe overwrite)
for skill in develop frontend-module handler pre-commit module-review; do
  cp "$UPSTREAM/.claude/skills/$skill/SKILL.md" "$PROJECT/.claude/skills/$skill/SKILL.md"
done

# Step 4-5: Source fixes + doc merges — use Claude Code prompt above
```

## Git Remote Method

```bash
git remote add boilerplate git@github.com:mycurelabs/monobase-js-lf.git
git fetch boilerplate main

# See what changed
git diff HEAD...boilerplate/main --stat

# Cherry-pick safe files
git checkout boilerplate/main -- VERTICAL_TDD.md UPDATING.md
git checkout boilerplate/main -- .claude/skills/develop/SKILL.md
git checkout boilerplate/main -- .claude/skills/frontend-module/SKILL.md

# For everything else, use the Claude Code prompt
```

## After Updating

```bash
cd services/api-ts && bun test          # Should pass
cd apps/account && bun test             # Should pass
cd packages/sdk-ts && bun test          # Should pass
cd services/api-ts && bun run typecheck # Should be clean
```

If tests fail after update, it usually means a project-specific handler was modified and the boilerplate test expects the original behavior. Adjust the test to match your implementation.
