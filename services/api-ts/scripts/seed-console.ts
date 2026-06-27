#!/usr/bin/env bun
/**
 * seed-console.ts — bootstrap a dev platform-operator account for apps/console.
 *
 * Idempotent: safe to re-run (skips already-seeded rows).
 *
 * ─── Run command ───────────────────────────────────────────────────────────────
 *   cd services/api-ts && bun scripts/seed-console.ts
 *
 * ─── Prerequisites ─────────────────────────────────────────────────────────────
 *  1. Postgres running with memberry_dev DB and all migrations applied:
 *       docker run --name memberry-pg \
 *         -e POSTGRES_PASSWORD=postgres \
 *         -e POSTGRES_DB=memberry_dev \
 *         -p 5432:5432 -d postgres:16-alpine
 *       export DATABASE_URL="postgres://postgres:postgres@localhost:5432/memberry_dev"
 *       cd services/api-ts && bun scripts/ci-migrate.ts
 *
 *  2. Export env var:
 *       export DATABASE_URL="postgres://postgres:postgres@localhost:5432/memberry_dev"
 *
 * ─── What this seeds ───────────────────────────────────────────────────────────
 *  (a) One association — Philippine Dental Association (PDA) — so the create-org
 *      form has something to select (otherwise "Seed an association first" alert
 *      shows and the submit button is disabled).
 *  (b) A Better-Auth user for the founder (inserts directly into the `user` and
 *      `account` tables that Better-Auth manages). Password uses the same scrypt
 *      params as @better-auth/utils/password (N=16384, r=16, p=1, dkLen=64,
 *      format: "${salt_hex}:${key_hex}").
 *  (c) A platform_admin row (role='super') linking the Better-Auth user to the
 *      console. Without this row, useSession (which calls listOrganizations) gets
 *      403, __root renders "Platform operator access required", and sign-in is
 *      effectively blocked after the session cookie is set.
 *
 * ─── Why seed first? ───────────────────────────────────────────────────────────
 *  Creating an org via apps/console against a live stack requires a platform_admin
 *  row. That is the ONLY blocker — NOT G2 (create-org has no money path; no
 *  PayMongo connected-account is needed to create an org). Once this seed is
 *  applied, a founder can sign in at http://localhost:3006 and create orgs.
 *
 *  Credentials after seeding:
 *    Email:    founder@memberry.ph
 *    Password: dev-password
 */

import { randomBytes, scrypt } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { createDatabase, closeDatabaseConnection } from '@/core/database';
import { associations, platformAdmins } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { user, account } from '@/generated/better-auth/schema';

// ─── Config ────────────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5432/memberry_dev';

const FOUNDER_EMAIL = 'founder@memberry.ph';
const FOUNDER_NAME = 'Memberry Founder';
const FOUNDER_PASSWORD = 'dev-password';

// ─── Password hashing ──────────────────────────────────────────────────────────

/**
 * Hash a password using the same scrypt parameters as @better-auth/utils/password
 * (the node implementation: node:crypto scrypt, N=16384, r=16, p=1, dkLen=64).
 * Format: "${salt_hex}:${key_hex}" — matches what verifyPassword() expects.
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      },
    );
  });
  return `${salt}:${key.toString('hex')}`;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const db = createDatabase({ url: DATABASE_URL });

try {
  console.log('seed-console: starting…');

  // ── (a) Association ─────────────────────────────────────────────────────────
  let [assoc] = await db
    .select()
    .from(associations)
    .where(eq(associations.name, 'Philippine Dental Association'))
    .limit(1);
  if (!assoc) {
    [assoc] = await db
      .insert(associations)
      .values({
        name: 'Philippine Dental Association',
        country: 'PH',
        currency: 'PHP',
        locale: 'en',
        licenseFormatRegex: '^\\d{4,7}$',
        creditCyclePeriod: 36,
        requiredCreditsPerCycle: 60,
        carryoverEnabled: true,
        status: 'active',
      })
      .returning();
    console.log(`  ✓ Association: ${assoc!.name} (${assoc!.id}) — created`);
  } else {
    console.log(`  ✓ Association: ${assoc.name} (${assoc.id}) — already exists, skipping`);
  }

  // ── (b) Better-Auth user ────────────────────────────────────────────────────
  // Insert directly into `user` + `account` tables (managed by better-auth).
  // Uses a UUID for the user ID so the platform_admin.userId (uuid column) accepts it.
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, FOUNDER_EMAIL))
    .limit(1);

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    console.log(`  ✓ User: ${existingUser.email} (${userId}) — already exists, skipping`);
  } else {
    userId = randomUUID();
    await db.insert(user).values({
      id: userId,
      name: FOUNDER_NAME,
      email: FOUNDER_EMAIL,
      // emailVerified=true so the account-claim hook (create.before in core/auth.ts)
      // can link roster members by email. Also avoids any OTP-verification prompt.
      emailVerified: true,
    });
    console.log(`  ✓ User: ${FOUNDER_EMAIL} (${userId}) — created`);

    // Credential account — stores the hashed password for email/password sign-in.
    // better-auth convention: accountId for credential provider = userId.
    const hashedPw = await hashPassword(FOUNDER_PASSWORD);
    await db.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hashedPw,
      // account.updatedAt has no DB DEFAULT (only Drizzle $onUpdate); must provide for insert.
      updatedAt: new Date(),
    });
    console.log(`  ✓ Account: credential provider created, password hashed (scrypt)`);
  }

  // ── (c) platform_admin row ─────────────────────────────────────────────────
  // role='super' gives full access to create orgs + manage platform admins.
  const [existingAdmin] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.email, FOUNDER_EMAIL))
    .limit(1);

  if (existingAdmin) {
    console.log(
      `  ✓ PlatformAdmin: ${existingAdmin.email} (role=${existingAdmin.role}) — already exists, skipping`,
    );
  } else {
    const [newAdmin] = await db
      .insert(platformAdmins)
      .values({
        userId,
        email: FOUNDER_EMAIL,
        name: FOUNDER_NAME,
        role: 'super',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();
    console.log(`  ✓ PlatformAdmin: ${newAdmin!.email} (role=${newAdmin!.role}) — created`);
  }

  console.log('\nseed-console: done ✓');
  console.log('\n  ── Sign in ─────────────────────────────────────────────────');
  console.log(`  URL:      http://localhost:3006/sign-in`);
  console.log(`  Email:    ${FOUNDER_EMAIL}`);
  console.log(`  Password: ${FOUNDER_PASSWORD}`);
  console.log('\n  ── Create your first org ───────────────────────────────────');
  console.log(`  URL:      http://localhost:3006/orgs/new`);
  console.log('  (no PayMongo account needed — create-org has no money path)');
} catch (err) {
  console.error('seed-console: failed', err);
  process.exit(1);
} finally {
  await closeDatabaseConnection(db);
}
