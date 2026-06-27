/**
 * [A1 RED] Account claim by email — real PG integration test.
 *
 * Proves the gap: a roster-imported member who logs in via email-OTP for the
 * first time does NOT get linked to their existing person/memberships.
 *
 * Why it fails today:
 *   - Roster import creates: person(id=rosterPersonId, contactInfo.email=X) + membership
 *   - better-auth's user.create.after hook (auth.ts) creates a NEW person with
 *     id = freshUuid (the new user's id), never checking for an existing person
 *     by email.
 *   - getMyMemberships queries WHERE personId = session.user.id → returns empty
 *     because the membership is still under rosterPersonId, not freshUuid.
 *
 * Fix (Task A2 — NOT this task): add a create.before hook that overrides
 * user.id = matchedPerson.id when emailVerified=true and a person with that
 * email already exists in the roster.
 *
 * This test MUST FAIL on main. It passes once A2 is implemented.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { createAuth } from './auth';
import { PersonRepository } from '@/handlers/person/repos/person.repo';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import * as authSchema from '@/generated/better-auth/schema';
import type { EmailService } from '@/core/email';
import type { Config } from '@/core/config';

// ── Table list: all tables touched by email-OTP sign-in + person + membership
// better-auth core: user, session, account, verification
// better-auth plugins: two_factor (twoFactor plugin), passkey, apikey
// app domain: person, membership
const SCRATCH_TABLES = [
  'user',
  'session',
  'account',
  'verification',
  'two_factor',
  'passkey',
  'apikey',
  'person',
  'membership',
];

// Minimal config — only fields createAuth reads.
// Uses `as unknown as Config` to avoid typing every optional field.
const TEST_CONFIG = {
  auth: {
    baseUrl: 'http://localhost:7213',
    // better-auth requires at least 32 chars for the secret
    secret: 'test-auth-secret-must-be-at-least-32-chars-long',
    adminEmails: [] as string[],
    requireEmailVerification: false,
    sessionLimit: 5,
  },
  cors: {
    origins: ['http://localhost:3004'],
    credentials: true,
    allowLocalNetwork: true,
    allowTunneling: false,
    strict: false,
  },
} as unknown as Config;

// ── Suite-level scratch DB ─────────────────────────────────────────────────
let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(SCRATCH_TABLES);
});

afterAll(async () => {
  await H?.teardown();
});

// ── Tests ──────────────────────────────────────────────────────────────────
describe('[A1 RED] roster email-OTP login must claim roster person + surface memberships', () => {
  test(
    'email-OTP sign-in creates a fresh person (gap) — memberships invisible under new user.id',
    async () => {
      if (!H.dbReachable) return;

      const rosterPersonId = randomUUID();
      const orgId = randomUUID();
      const tierId = randomUUID();
      const email = 'olive@chapter.ph';

      // ── 1. Seed: roster person (no better-auth user yet) ───────────────────
      // Only first_name is NOT NULL without a default on the person table.
      // contact_info is jsonb — store email there so the claim hook can find it.
      await H.scopedPool.query(
        `INSERT INTO person
           (id, first_name, contact_info, created_at, updated_at, version)
         VALUES ($1, $2, $3::jsonb, now(), now(), 1)`,
        [rosterPersonId, 'Olive', JSON.stringify({ email })],
      );

      // ── 2. Seed: membership under rosterPersonId ───────────────────────────
      // FKs are NOT copied by createScratch (LIKE ... INCLUDING ALL skips FK),
      // so we can insert without standing up org/tier rows.
      await H.scopedPool.query(
        `INSERT INTO membership
           (id, organization_id, person_id, tier_id, start_date, status,
            joined_at, grace_period_days, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, '2025-01-01', 'active',
                 now(), 30, now(), now(), 1)`,
        [randomUUID(), orgId, rosterPersonId, tierId],
      );

      // ── 3. Build auth instance against scratch DB ──────────────────────────
      // Capture the OTP from the emailService.queueEmail callback.
      // The emailOTP plugin's sendVerificationOTP puts the code in variables.code.
      let capturedOtp: string | undefined;
      const mockEmailService = {
        queueEmail: async (req: { variables?: { code?: unknown } }) => {
          if (req.variables?.code !== undefined) {
            capturedOtp = String(req.variables.code);
          }
          return {};
        },
        sendEmail: async () => ({ success: true, messageId: 'test' }),
        initializeDefaultTemplates: async () => {},
        previewTemplate: async () => ({ html: '', subject: '' }),
        renderTemplate: async () => ({ html: '', subject: '' }),
        processPendingEmails: async () => {},
      } as unknown as EmailService;

      const mockAuditRepo = { logEvent: async () => undefined };
      const personRepo = new PersonRepository(H.db as never);

      const auth = createAuth(
        H.db as never,
        TEST_CONFIG,
        undefined, // logger — undefined is fine; warnings are swallowed
        mockEmailService,
        { auditRepo: mockAuditRepo, personRepo },
      );

      // ── 4. Drive: send OTP ─────────────────────────────────────────────────
      // The emailOTP plugin writes the code to the verification table (plaintext
      // by default, since storeOTP is not configured) and calls sendVerificationOTP
      // callback synchronously (runInBackgroundOrAwait awaits in non-background mode).
      await auth.api.sendVerificationOTP({
        body: { email, type: 'sign-in' },
      });

      // Prefer the captured OTP; fall back to reading from the verification table
      // (identifier contains the email — format: `otp:sign-in:${email}`)
      if (!capturedOtp) {
        const verRow = await H.scopedPool.query<{ value: string }>(
          `SELECT value FROM verification
            WHERE identifier LIKE $1
            ORDER BY created_at DESC LIMIT 1`,
          [`%${email}%`],
        );
        capturedOtp = verRow.rows[0]?.value;
      }

      expect(capturedOtp).toBeDefined();

      // ── 5. Drive: sign in with OTP ─────────────────────────────────────────
      // better-auth will: verify OTP → internalAdapter.createUser (emailVerified=true)
      // → triggers databaseHooks.user.create.before / .after → creates session.
      await auth.api.signInEmailOTP({
        body: { email, otp: capturedOtp! },
      });

      // ── 6. Read the newly created better-auth user ─────────────────────────
      const users = await H.db
        .select()
        .from(authSchema.user)
        .where(eq(authSchema.user.email, email));
      expect(users).toHaveLength(1);
      const newUser = users[0]!;

      // ── RED assertions — current broken behaviour ──────────────────────────
      // Each assertion below is what A2 must make TRUE.
      // Right now every one FAILS, proving the gap.

      // FAIL #1: user.id is a fresh UUID, NOT the roster person's id.
      // A2 fix: create.before overrides user.id = rosterPersonId on emailVerified=true claim.
      expect(newUser.id).toBe(rosterPersonId);
      // ↑ FAILS NOW: newUser.id is a random UUID generated by better-auth

      // FAIL #2: a duplicate person was auto-created by the create.after hook.
      // A2 fix: create.before claims the roster person → create.after finds
      //         existing person via findOneById(user.id=rosterPersonId) → no duplicate.
      const personRows = await H.scopedPool.query<{ id: string }>(
        `SELECT id FROM person WHERE contact_info->>'email' = $1`,
        [email],
      );
      expect(personRows.rows).toHaveLength(1);
      // ↑ FAILS NOW: 2 rows — the seeded roster person + the auto-created duplicate

      // FAIL #3: memberships are invisible under the new user.id.
      // A2 fix: after claim, user.id === rosterPersonId → membership query returns 1+ rows.
      const mine = await H.db
        .select()
        .from(memberships)
        .where(eq(memberships.personId, newUser.id));
      expect(mine.length).toBeGreaterThan(0);
      // ↑ FAILS NOW: 0 rows — membership.person_id = rosterPersonId, not freshUuid
    },
  );
});
