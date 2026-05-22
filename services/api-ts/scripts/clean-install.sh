#!/bin/bash
# Clean install: drop DB → patch migrations → run migrations → fixup → seed → restore
# Usage: cd services/api-ts && bash scripts/clean-install.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB_URL="${DATABASE_URL:-postgres://postgres:password@localhost:5432}"
DB_NAME="${DB_NAME:-monobase}"

echo "╔══════════════════════════════════════════╗"
echo "║   CLEAN INSTALL — Memberry API           ║"
echo "╚══════════════════════════════════════════╝"

# Safety: abort if migrations have uncommitted changes
if ! git diff --quiet src/generated/migrations/ 2>/dev/null; then
  echo "❌ ERROR: src/generated/migrations/ has uncommitted changes."
  echo "   Commit or stash first: git stash push -m 'pre-clean-install' src/generated/migrations/"
  exit 1
fi

# Kill existing API if running
if lsof -ti:7213 >/dev/null 2>&1; then
  echo "→ Killing existing API on port 7213..."
  kill "$(lsof -ti:7213)" 2>/dev/null || true
  sleep 2
fi

# 1. Drop and recreate DB
echo ""
echo "Step 1: Reset database..."
psql "$DB_URL/postgres" -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null
psql "$DB_URL/postgres" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null
echo "  ✓ Database $DB_NAME reset"

# 2. Patch migrations
echo ""
echo "Step 2: Patch migrations for clean install..."
bun scripts/fix-migrations-for-clean-install.ts

# 3. Start API (runs patched migrations)
echo ""
echo "Step 3: Starting API (runs migrations)..."
bun dev > /tmp/clean-install-api.log 2>&1 &
API_PID=$!

# Wait for API to be ready
echo "  Waiting for API on port 7213..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:7213/health >/dev/null 2>&1; then
    echo "  ✓ API running (PID $API_PID)"
    break
  fi
  if ! kill -0 $API_PID 2>/dev/null; then
    echo "  ❌ API failed to start. Check /tmp/clean-install-api.log"
    git checkout -- src/generated/migrations/ 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

if ! curl -sf http://localhost:7213/health >/dev/null 2>&1; then
  echo "  ❌ API did not become ready in 30s. Check /tmp/clean-install-api.log"
  kill $API_PID 2>/dev/null || true
  git checkout -- src/generated/migrations/ 2>/dev/null || true
  exit 1
fi

# 4. Post-migration fixup
echo ""
echo "Step 4: Running post-migration fixup..."
psql "$DB_URL/$DB_NAME" -f scripts/post-migration-fixup.sql 2>/dev/null
echo "  ✓ Schema drift columns + enum values added"

# 5. Seed
echo ""
echo "Step 5: Seeding database..."
bun run db:seed

# 6. Restore original migrations
echo ""
echo "Step 6: Restoring original migration files..."
git checkout -- src/generated/migrations/
echo "  ✓ Migrations restored to git HEAD"

# 7. Cleanup
echo ""
echo "Step 7: Stopping API..."
kill $API_PID 2>/dev/null || true
echo "  ✓ API stopped"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅ CLEAN INSTALL COMPLETE              ║"
echo "║                                          ║"
echo "║   Start API:  bun dev                    ║"
echo "║   Run tests:  bunx playwright test       ║"
echo "╚══════════════════════════════════════════╝"
