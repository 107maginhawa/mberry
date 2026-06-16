#!/usr/bin/env bun
/**
 * Reset known-mutable seed rows back to canonical seed values.
 *
 * Why: Playwright E2E specs that PATCH the seeded org / association /
 * tiers leave the DB in a polluted state. Subsequent specs that assert
 * against the seeded names then fail because the org is now called
 * "Updated-1780084414983" instead of "PDA Metro Manila Chapter".
 *
 * Cross-suite isolation: the Hurl CONTRACT suite shares this dev DB. The
 * member/dues-special-assessments/dues-funds-reporting.hurl scenario calls
 * upsertDuesFunds against pda-metro-manila (the only org its seeded officer
 * is President+Treasurer of, and thus the only org the position-gated upsert
 * can run on). That deactivates the canonical General/Building/Emergency
 * funds and writes "Operations <suffix>" / "Reserves <suffix>", breaking the
 * E2E funds specs (dues-lifecycle / settings-states). We heal it here, the
 * same way org/association/tier pollution is healed: restore the canonical
 * 3-fund 100% allocation and deactivate every non-canonical fund row.
 *
 * Idempotent — runs on every E2E suite boot via playwright.config.ts
 * globalSetup. Cheap (a handful of UPDATEs); takes < 200ms.
 *
 * Direct DB writes (no API) so we don't need a running server.
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq, notInArray } from 'drizzle-orm'
import { Pool } from 'pg'
import { associations, organizations } from '@/handlers/platformadmin/repos/platform-admin.schema'
import { duesFunds } from '@/handlers/dues/repos/dues-payments.schema'

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
  let metroManilaId: string | undefined
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
    if (o.slug === 'pda-metro-manila' && result[0]) metroManilaId = result[0].id
  }

  // Canonical dues funds for pda-metro-manila — must match
  // seed/layer-4-cross-module.ts (General 50 / Building 30 / Emergency 20,
  // all active, sortOrder 1/2/3 = 100%). The contract suite's
  // upsertDuesFunds run replaces these with Operations/Reserves; restore them
  // so the E2E funds specs see the canonical 3-fund allocation again.
  let fundResetCount = 0
  if (metroManilaId) {
    const canonicalFunds = [
      { name: 'General Fund', percentage: '50.00', sortOrder: 1 },
      { name: 'Building Fund', percentage: '30.00', sortOrder: 2 },
      { name: 'Emergency Fund', percentage: '20.00', sortOrder: 3 },
    ]
    const canonicalNames = canonicalFunds.map((f) => f.name)

    // 1. Deactivate every non-canonical fund (e.g. Operations*/Reserves*
    //    written by the contract upsert). Soft-delete, not DELETE, because
    //    dues_fund_allocation / special_assessment hold FKs to these rows.
    await db
      .update(duesFunds)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(duesFunds.organizationId, metroManilaId),
          notInArray(duesFunds.name, canonicalNames),
        ),
      )

    // 2. Reactivate + re-pin the canonical three to their seed values.
    for (const f of canonicalFunds) {
      const updated = await db
        .update(duesFunds)
        .set({
          active: true,
          percentage: f.percentage,
          sortOrder: f.sortOrder,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(duesFunds.organizationId, metroManilaId),
            eq(duesFunds.name, f.name),
          ),
        )
        .returning({ id: duesFunds.id })

      // Re-create if a prior run/cleanup removed the canonical row entirely.
      if (updated.length === 0) {
        await db.insert(duesFunds).values({
          organizationId: metroManilaId,
          name: f.name,
          percentage: f.percentage,
          sortOrder: f.sortOrder,
          active: true,
        })
      }
      fundResetCount += 1
    }
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

  console.log(
    `✓ seed-reset: restored ${resetCount} org rows + association baseline + ${fundResetCount} canonical dues funds`,
  )
  await pool.end()
}

main().catch((err) => {
  console.error('seed-reset failed:', err)
  process.exit(1)
})
