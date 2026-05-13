#!/usr/bin/env bash
set -euo pipefail

# Rollback script for Memberry deployments
# Uses Railway CLI for API and Cloudflare Wrangler for frontends
#
# Usage:
#   ./scripts/rollback.sh --env staging|production --to-sha <commit-sha>
#   ./scripts/rollback.sh --env production --steps 1   # roll back 1 deploy
#
# Prerequisites:
#   - RAILWAY_TOKEN env var (or `railway login`)
#   - CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID env vars
#   - gh CLI authenticated (for finding previous deploy SHAs)

ENV=""
TO_SHA=""
STEPS=""
DRY_RUN=false

usage() {
  echo "Usage: $0 --env <staging|production> [--to-sha <sha>] [--steps <n>] [--dry-run]"
  echo ""
  echo "Options:"
  echo "  --env         Target environment (staging or production)"
  echo "  --to-sha      Specific commit SHA to roll back to"
  echo "  --steps       Roll back N deployments (default: 1)"
  echo "  --dry-run     Show what would happen without executing"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --env) ENV="$2"; shift 2 ;;
    --to-sha) TO_SHA="$2"; shift 2 ;;
    --steps) STEPS="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) usage ;;
  esac
done

[[ -z "$ENV" ]] && usage
[[ "$ENV" != "staging" && "$ENV" != "production" ]] && echo "Error: --env must be staging or production" && exit 1

# Resolve target SHA
if [[ -n "$TO_SHA" ]]; then
  TARGET_SHA="$TO_SHA"
elif [[ -n "$STEPS" ]]; then
  echo "Finding SHA from $STEPS deploys ago..."
  # Use gh to find previous successful deploy workflow runs
  TARGET_SHA=$(gh run list --workflow=deploy.yml --status=success --limit=$((STEPS + 1)) --json headSha --jq ".[$STEPS].headSha")
  if [[ -z "$TARGET_SHA" ]]; then
    echo "Error: Could not find deploy $STEPS steps back"
    exit 1
  fi
else
  STEPS=1
  echo "No --to-sha or --steps specified, defaulting to --steps 1"
  TARGET_SHA=$(gh run list --workflow=deploy.yml --status=success --limit=2 --json headSha --jq ".[1].headSha")
  if [[ -z "$TARGET_SHA" ]]; then
    echo "Error: Could not find previous deploy"
    exit 1
  fi
fi

echo "============================================"
echo "ROLLBACK PLAN"
echo "============================================"
echo "Environment: $ENV"
echo "Target SHA:  $TARGET_SHA"
echo "Dry run:     $DRY_RUN"
echo "============================================"

if $DRY_RUN; then
  echo ""
  echo "Would execute:"
  echo "  1. railway up --service memberry-api --environment $ENV --image ghcr.io/\$REPO/api:$TARGET_SHA"
  echo "  2. Rebuild frontends at $TARGET_SHA and deploy via wrangler"
  echo "  3. Health check /readyz on $ENV"
  echo ""
  echo "Dry run complete — no changes made."
  exit 0
fi

echo ""
read -p "Proceed with rollback? (y/N) " -n 1 -r
echo ""
[[ ! $REPLY =~ ^[Yy]$ ]] && echo "Aborted." && exit 0

# Step 1: Roll back API via Railway (redeploy previous image)
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
IMAGE="ghcr.io/$REPO/api:$TARGET_SHA"

echo ""
echo "Step 1/3: Rolling back API to $IMAGE..."
railway up --service memberry-api --environment "$ENV" --image "$IMAGE"

# Step 2: Roll back frontends — checkout target SHA, build, deploy
echo ""
echo "Step 2/3: Rebuilding frontends at $TARGET_SHA..."
TMPDIR=$(mktemp -d)
git worktree add "$TMPDIR" "$TARGET_SHA" --detach 2>/dev/null

(
  cd "$TMPDIR"
  bun install --frozen-lockfile
  bun --filter @monobase/api-spec run build
  bun --filter @monobase/api-ts run generate

  if [[ "$ENV" == "production" ]]; then
    PROJECT_SUFFIX="production"
  else
    PROJECT_SUFFIX="staging"
  fi

  cd apps/memberry && bun run build && cd ../..
  wrangler pages deploy apps/memberry/dist/ --project-name "memberry-$PROJECT_SUFFIX" --branch main

  cd apps/admin && bun run build && cd ../..
  wrangler pages deploy apps/admin/dist/ --project-name "memberry-admin-$PROJECT_SUFFIX" --branch main

  cd apps/account && bun run build && cd ../..
  wrangler pages deploy apps/account/dist/ --project-name "memberry-account-$PROJECT_SUFFIX" --branch main
)

git worktree remove "$TMPDIR" 2>/dev/null || rm -rf "$TMPDIR"

# Step 3: Health check
echo ""
echo "Step 3/3: Health check..."

if [[ "$ENV" == "production" ]]; then
  DEPLOY_URL="${PRODUCTION_API_URL:-}"
else
  DEPLOY_URL="${STAGING_API_URL:-}"
fi

if [[ -n "$DEPLOY_URL" ]]; then
  for i in $(seq 1 20); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL/readyz")
    echo "Attempt $i: HTTP $STATUS"
    if [ "$STATUS" = "200" ]; then
      READYZ=$(curl -s "$DEPLOY_URL/readyz?verbose")
      echo "readyz: $READYZ"
      echo ""
      echo "============================================"
      echo "ROLLBACK COMPLETE ✓"
      echo "Environment: $ENV"
      echo "Rolled back to: $TARGET_SHA"
      echo "============================================"
      exit 0
    fi
    sleep 5
  done
  echo "::error::Health check failed after rollback"
  exit 1
else
  echo "Warning: No ${ENV^^}_API_URL set — skipping health check"
  echo ""
  echo "============================================"
  echo "ROLLBACK DEPLOYED (unverified)"
  echo "Environment: $ENV"
  echo "Rolled back to: $TARGET_SHA"
  echo "Manually verify the deployment!"
  echo "============================================"
fi
