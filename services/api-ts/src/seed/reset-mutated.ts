#!/usr/bin/env bun
/**
 * Reset known-mutable seed rows back to canonical seed values.
 *
 * Why: Playwright E2E specs that PATCH the seeded org / association /
 * tiers leave the DB in a polluted state. Subsequent specs that assert
 * against the seeded names then fail because the org is now called
 * "Updated-1780084414983" instead of "PDA Metro Manila Chapter".
 *
 * Idempotent — runs on every E2E suite boot via playwright.config.ts
 * globalSetup. Cheap (a handful of UPDATEs); takes < 200ms.
 *
 * Direct DB writes (no API) so we don't need a running server.
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { associations, organizations } from '@/handlers/platformadmin/repos/platform-admin.schema'

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5432/memberry_dev'

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL })
  const db = drizzle(pool)

  // Canonical values must match seed/layer-1-foundation.ts.
  const orgs = [
    {
      slug: 'pda-metro-manila',
      name: 'PDA Metro Manila Chapter',
      orgType: 'chapter' as const,
      region: 'NCR',
      contactEmail: 'metromanila@pda.ph',
      status: 'active' as const,
    },
    {
      slug: 'pda-cebu',
      name: 'PDA Cebu Chapter',
      orgType: 'chapter' as const,
      region: 'Region VII',
      contactEmail: 'cebu@pda.ph',
      status: 'active' as const,
    },
  ]

  let resetCount = 0
  for (const o of orgs) {
    const result = await db
      .update(organizations)
      .set({
        name: o.name,
        orgType: o.orgType,
        region: o.region,
        contactEmail: o.contactEmail,
        status: o.status,
      })
      .where(eq(organizations.slug, o.slug))
      .returning({ id: organizations.id })
    resetCount += result.length
  }

  // Association canonical state — Philippine Dental Association.
  // No slug column on associations; pin by stable id (set in seed).
  await db
    .update(associations)
    .set({
      country: 'PH',
      currency: 'PHP',
      status: 'active',
    })
    .where(eq(associations.name, 'Philippine Dental Association'))

  console.log(`✓ seed-reset: restored ${resetCount} org rows + association baseline`)
  await pool.end()
}

main().catch((err) => {
  console.error('seed-reset failed:', err)
  process.exit(1)
})
