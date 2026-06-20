/**
 * stripe-happy-path.ts — End-to-end happy-path verify driver for online payments.
 *   Run: cd services/api-ts && bun scripts/stripe-happy-path.ts dues   (also: 'all'; default 'dues')
 *   DUES is implemented; 'event' and 'booking' are TODO stubs. Self-contained, idempotent,
 *   re-runnable; exits non-zero on ANY assertion failure and prints a PASS/FAIL summary.
 */

import Stripe from 'stripe';
import { createHmac, randomBytes } from 'crypto';
import { spawnSync } from 'child_process';

// ── Verified constants ────────────────────────────────────────────────
const API_BASE = process.env['API_BASE'] || 'http://localhost:7213';
const WEBHOOK_URL = `${API_BASE}/webhooks/stripe`;
const DATABASE_URL =
  process.env['DATABASE_URL'] || 'postgres://postgres:password@localhost:5432/monobase';
const STRIPE_WEBHOOK_SECRET =
  process.env['STRIPE_WEBHOOK_SECRET'] || 'whsec_test_memberry_dev_dummy';
const PAYMENT_TOKEN_SECRET =
  process.env['PAYMENT_TOKEN_SECRET'] ||
  'memberry-dev-payment-token-secret-32-chars-min-please';

// Browser-equivalent Origin for the no-auth /pay/* POSTs. The global origin-check
// CSRF middleware (csrf({ origin: cors.origins })) 403s state-changing requests
// whose Origin isn't allow-listed; a bare fetch sends none, so we mirror the app origin.
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'http://localhost:3004';

const ORG = 'ed8e3a96-8126-4341-be42-e6eb7940c562';
const MIGUEL = '425e7ea6-b8d8-4910-86f3-74b401701ce9';
const MEMBERSHIP_ID = 'f659c8e0-7a5e-4efd-83a9-b472354dee34';
const OFFICER_EMAIL = 'test@memberry.ph';
const OFFICER_PASSWORD = 'TestPass123!';
const AMOUNT = 300000; // PHP 3000.00 in minor units
const FUND_ALLOCATIONS_JSON = JSON.stringify([
  { amount: 150000, fundName: 'General Fund' },
  { amount: 90000, fundName: 'Building Fund' },
  { amount: 60000, fundName: 'Emergency Fund' },
]);
const INVOICE_MARKER = 'INV-STRIPE-TEST-';

const KEEP = process.argv.includes('--keep');

// ── psql helper ───────────────────────────────────────────────────────
// Parse postgres://user:pass@host:port/db into env vars for psql.
function pgEnv(): NodeJS.ProcessEnv {
  const u = new URL(DATABASE_URL);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.replace(/^\//, ''),
  };
}
function psql(sql: string): string {
  const r = spawnSync('psql', ['-tA', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    env: pgEnv(),
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error(`psql failed (${r.status}): ${r.stderr || r.stdout}\n  SQL: ${sql}`);
  }
  return (r.stdout || '').trim();
}
// SQL string literal escaper (single quotes only; all inputs are fixed dev values).
const q = (s: string) => `'${String(s).replace(/'/g, "''")}'`;

// ── Assertion + result tracking ───────────────────────────────────────
interface Row {
  step: string;
  expected: string;
  actual: string;
  pass: boolean;
}
const rows: Row[] = [];
function record(step: string, expected: unknown, actual: unknown, pass: boolean) {
  rows.push({ step, expected: String(expected), actual: String(actual), pass });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${step} — expected=${expected} actual=${actual}`);
}
function assert(step: string, expected: unknown, actual: unknown, ok: boolean) {
  record(step, expected, actual, ok);
}

// ── Cookie jar (better-auth session) ──────────────────────────────────
function captureCookies(res: Response): string {
  // Bun exposes getSetCookie(); fall back to single set-cookie header.
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : ([res.headers.get('set-cookie')].filter(Boolean) as string[]);
  return list.map((c) => c.split(';')[0]).join('; ');
}

// ── DUES driver ───────────────────────────────────────────────────────
async function runDues(): Promise<void> {
  console.log('\n=== DUES online-payment happy-path ===\n');

  // Pre-clean any orphans from prior failed runs (idempotency safety net).
  preCleanOrphans();

  // crypto.randomUUID — generate ids in JS so we don't need RETURNING juggling.
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = `${INVOICE_MARKER}${Math.floor(Date.now() / 1000)}`;
  const ts = Date.now();
  let mintPath = 'unknown';
  let beforeExpiry = '';

  try {
    // 1. FIXTURE — insert a fresh dues_invoice (status 'sent').
    psql(`
      INSERT INTO dues_invoice
        (id, created_at, updated_at, version, membership_id, person_id, organization_id,
         invoice_number, period_start, period_end, total_amount, fund_allocations,
         status, generated_at, sent_at)
      VALUES
        (${q(invoiceId)}, now(), now(), 1, ${q(MEMBERSHIP_ID)}, ${q(MIGUEL)}, ${q(ORG)},
         ${q(invoiceNumber)}, '2026-01-01', '2026-12-31', ${AMOUNT}, ${q(FUND_ALLOCATIONS_JSON)}::jsonb,
         'sent', now(), now());`);
    const insertedNum = psql(`SELECT invoice_number FROM dues_invoice WHERE id = ${q(invoiceId)};`);
    assert('1. fixture invoice inserted', invoiceNumber, insertedNum, insertedNum === invoiceNumber);

    // 2. RECORD membership dues_expiry_date BEFORE.
    beforeExpiry = psql(
      `SELECT dues_expiry_date FROM membership WHERE id = ${q(MEMBERSHIP_ID)};`,
    );
    assert('2. read BEFORE expiry', 'non-empty', beforeExpiry, beforeExpiry.length > 0);

    // 3. MINT TOKEN — try the real officer endpoint, else fall back to direct insert.
    let rawToken = '';

    // 3a. Officer sign-in (better-auth) → capture cookie.
    let cookie = '';
    try {
      const signIn = await fetch(`${API_BASE}/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: OFFICER_EMAIL, password: OFFICER_PASSWORD }),
      });
      if (signIn.ok) cookie = captureCookies(signIn);
    } catch {
      /* fall through to fallback */
    }

    // 3b. Try officer mint endpoint.
    let minted = false;
    if (cookie) {
      const mintRes = await fetch(`${API_BASE}/org/${ORG}/payments/send-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ personId: MIGUEL, amount: AMOUNT, invoiceId }),
      });
      if (mintRes.status === 201) {
        const body = (await mintRes.json()) as { token?: string };
        if (body.token) {
          rawToken = body.token;
          minted = true;
          mintPath = 'officer-endpoint (POST /org/:org/payments/send-link)';
        }
      } else if (mintRes.status !== 401 && mintRes.status !== 403) {
        const txt = await mintRes.text();
        throw new Error(`send-link unexpected status ${mintRes.status}: ${txt}`);
      }
    }

    // 3c. FALLBACK — insert payment_token directly.
    if (!minted) {
      rawToken = randomBytes(32).toString('hex');
      const hash = createHmac('sha256', PAYMENT_TOKEN_SECRET).update(rawToken).digest('hex');
      psql(`
        INSERT INTO payment_token
          (id, created_at, updated_at, version, token_hash, person_id, organization_id,
           invoice_id, amount, currency, expires_at, used_at, created_by_officer)
        VALUES
          (gen_random_uuid(), now(), now(), 1, ${q(hash)}, ${q(MIGUEL)}, ${q(ORG)},
           ${q(invoiceId)}, ${AMOUNT}, 'PHP', now() + interval '1 day', NULL, ${q(MIGUEL)});`);
      mintPath = 'direct-insert fallback (officer mint gated)';
    }
    assert('3. mint token', 'non-empty raw token', `${rawToken.slice(0, 8)}… via ${mintPath}`, rawToken.length > 0);

    // 4. VALIDATE — GET /pay/:token/validate (no auth).
    const valRes = await fetch(`${API_BASE}/pay/${rawToken}/validate`);
    const valBody = (await valRes.json()) as { valid?: boolean; amount?: number };
    assert('4. validate HTTP 200', 200, valRes.status, valRes.status === 200);
    assert('4. validate valid===true', true, valBody.valid, valBody.valid === true);
    assert('4. validate amount===300000', AMOUNT, valBody.amount, valBody.amount === AMOUNT);

    // 5. CHECKOUT — POST /pay/:token/checkout (no auth, no body; Origin satisfies CSRF origin-check).
    const coRes = await fetch(`${API_BASE}/pay/${rawToken}/checkout`, {
      method: 'POST',
      headers: { Origin: APP_ORIGIN },
    });
    const coBody = (await coRes.json()) as { checkoutUrl?: string; error?: string };
    assert('5. checkout HTTP 200', 200, coRes.status, coRes.status === 200);
    assert(
      '5. checkoutUrl non-empty',
      'non-empty string',
      coBody.checkoutUrl ? `${coBody.checkoutUrl.slice(0, 40)}…` : `(none) err=${coBody.error}`,
      typeof coBody.checkoutUrl === 'string' && coBody.checkoutUrl.length > 0,
    );

    // 6. GET paymentId — exactly one pending row, amount integer 300000 (MONEY ROUND-TRIP).
    const pendingRows = psql(`
      SELECT id || '|' || amount::text
      FROM dues_payment
      WHERE invoice_id = ${q(invoiceId)} AND status = 'pending'
      ORDER BY created_at DESC;`);
    const pendingList = pendingRows ? pendingRows.split('\n') : [];
    assert('6. exactly one pending payment', 1, pendingList.length, pendingList.length === 1);
    const [paymentId, pendingAmountStr] = (pendingList[0] || '|').split('|');
    const pendingAmount = Number(pendingAmountStr);
    assert(
      '6. MONEY round-trip amount===300000',
      AMOUNT,
      `${pendingAmountStr} (Number=${pendingAmount})`,
      pendingAmount === AMOUNT && pendingAmountStr === '300000',
    );
    if (!paymentId) throw new Error('No paymentId captured — cannot continue');

    // 7. FABRICATE webhook event (stringify ONCE, sign+send the SAME string).
    const payload = JSON.stringify({
      id: `evt_stripe_test_${ts}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: `pi_stripe_test_${ts}`,
          status: 'succeeded',
          amount: AMOUNT,
          currency: 'php',
          metadata: {
            paymentId,
            personId: MIGUEL,
            orgId: ORG,
            organizationId: ORG,
            invoiceId,
          },
        },
      },
    });

    // 8. SIGN.
    const stripe = new Stripe('sk_test_x');
    const sigHeader = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: STRIPE_WEBHOOK_SECRET,
    });

    // 9. POST webhook.
    const whRes = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'stripe-signature': sigHeader, 'content-type': 'application/json' },
      body: payload,
    });
    const whBody = (await whRes.json()) as { received?: boolean; action?: string };
    assert('9. webhook HTTP 200', 200, whRes.status, whRes.status === 200);
    assert(
      '9. webhook received:true / action present',
      'received:true|action',
      `received=${whBody.received} action=${whBody.action}`,
      whBody.received === true || typeof whBody.action === 'string',
    );

    // 10. VERIFY SETTLEMENT.
    const payRow = psql(`
      SELECT status || '|' || COALESCE(paid_at::text,'NULL') || '|' || COALESCE(membership_extended_to::text,'NULL')
      FROM dues_payment WHERE id = ${q(paymentId)};`);
    const [payStatus, paidAt, extendedTo] = (payRow || '||').split('|');
    assert('10a. payment.status===completed', 'completed', payStatus, payStatus === 'completed');
    assert('10a. payment.paid_at not null', 'not NULL', paidAt, paidAt !== 'NULL' && paidAt !== '');
    // NOTE: the online-webhook settle path (createProcessPayment → settlePayment)
    // extends the *membership* row but does not write membership_extended_to back
    // onto the dues_payment row (only the officer-recorded flows do). So this
    // column is expected NULL here — the authoritative extension proof is 10c
    // (membership.dues_expiry_date advanced). Informational only, not asserted.
    console.log(`  [info] payment.membership_extended_to=${extendedTo} (NULL expected for online flow)`);

    const invRow = psql(`
      SELECT status || '|' || COALESCE(payment_id,'NULL')
      FROM dues_invoice WHERE id = ${q(invoiceId)};`);
    const [invStatus, invPaymentId] = (invRow || '|').split('|');
    assert('10b. invoice.status===paid', 'paid', invStatus, invStatus === 'paid');
    assert('10b. invoice.payment_id===paymentId', paymentId, invPaymentId, invPaymentId === paymentId);

    const afterExpiry = psql(
      `SELECT dues_expiry_date FROM membership WHERE id = ${q(MEMBERSHIP_ID)};`,
    );
    const extended = new Date(afterExpiry).getTime() > new Date(beforeExpiry).getTime();
    assert(
      '10c. membership expiry AFTER > BEFORE',
      `> ${beforeExpiry}`,
      afterExpiry,
      extended,
    );
  } finally {
    // 11. CLEANUP (try/finally; runs even on failure unless --keep).
    if (KEEP) {
      console.log('\n  [--keep] Skipping cleanup. Fixture invoice + payment + token left in DB.');
    } else {
      cleanupDues(invoiceId, beforeExpiry);
    }
  }
}

// Delete in FK-safe order; restore membership expiry. Discovers allocation rows by payment_id.
function cleanupDues(invoiceId: string, beforeExpiry: string): void {
  const cleaned: string[] = [];

  // Find payment ids tied to this fixture invoice.
  const payIds = psql(`SELECT id FROM dues_payment WHERE invoice_id = ${q(invoiceId)};`)
    .split('\n')
    .filter(Boolean);

  for (const pid of payIds) {
    // dues_fund_allocation is onDelete:cascade, but delete explicitly for a clean report.
    const a = psql(
      `WITH d AS (DELETE FROM dues_fund_allocation WHERE payment_id = ${q(pid)} RETURNING 1) SELECT count(*) FROM d;`,
    );
    if (a !== '0') cleaned.push(`dues_fund_allocation(${a}) for payment ${pid.slice(0, 8)}`);
    // dues_payment_status_history is onDelete:restrict — MUST delete before the payment.
    const h = psql(
      `WITH d AS (DELETE FROM dues_payment_status_history WHERE payment_id = ${q(pid)} RETURNING 1) SELECT count(*) FROM d;`,
    );
    if (h !== '0') cleaned.push(`dues_payment_status_history(${h}) for payment ${pid.slice(0, 8)}`);
  }

  const delPay = psql(
    `WITH d AS (DELETE FROM dues_payment WHERE invoice_id = ${q(invoiceId)} RETURNING 1) SELECT count(*) FROM d;`,
  );
  if (delPay !== '0') cleaned.push(`dues_payment(${delPay})`);

  const delTok = psql(
    `WITH d AS (DELETE FROM payment_token WHERE invoice_id = ${q(invoiceId)} RETURNING 1) SELECT count(*) FROM d;`,
  );
  if (delTok !== '0') cleaned.push(`payment_token(${delTok})`);

  const delInv = psql(
    `WITH d AS (DELETE FROM dues_invoice WHERE id = ${q(invoiceId)} RETURNING 1) SELECT count(*) FROM d;`,
  );
  if (delInv !== '0') cleaned.push(`dues_invoice(${delInv})`);

  if (beforeExpiry) {
    psql(
      `UPDATE membership SET dues_expiry_date = ${q(beforeExpiry)}, updated_at = now() WHERE id = ${q(MEMBERSHIP_ID)};`,
    );
    cleaned.push(`membership.dues_expiry_date restored→${beforeExpiry}`);
  }

  console.log(`\n  Cleanup: ${cleaned.length ? cleaned.join(', ') : 'nothing to clean'}`);
}

// Clear any leftover fixtures from prior failed runs (marker-scoped).
function preCleanOrphans(): void {
  const orphanIds = psql(
    `SELECT id FROM dues_invoice WHERE invoice_number LIKE ${q(INVOICE_MARKER + '%')};`,
  )
    .split('\n')
    .filter(Boolean);
  if (!orphanIds.length) return;
  for (const id of orphanIds) {
    const pids = psql(`SELECT id FROM dues_payment WHERE invoice_id = ${q(id)};`)
      .split('\n')
      .filter(Boolean);
    for (const pid of pids) {
      psql(`DELETE FROM dues_fund_allocation WHERE payment_id = ${q(pid)};`);
      psql(`DELETE FROM dues_payment_status_history WHERE payment_id = ${q(pid)};`);
    }
    psql(`DELETE FROM dues_payment WHERE invoice_id = ${q(id)};`);
    psql(`DELETE FROM payment_token WHERE invoice_id = ${q(id)};`);
    psql(`DELETE FROM dues_invoice WHERE id = ${q(id)};`);
  }
  console.log(`  Pre-clean: removed ${orphanIds.length} orphan fixture invoice(s) from prior runs.`);
}

// ── TODO stubs ────────────────────────────────────────────────────────
// TODO(event): register-for-paid-event → mint/checkout → webhook → verify registration paid +
//   ticket/seat decremented + ledger row. Mirror runDues structure once the event-pay flow is verified.
async function runEvent(): Promise<void> {
  console.log('\n=== EVENT happy-path: TODO (not implemented) ===');
  throw new Error('event subcommand not implemented yet');
}
// TODO(booking): billing-Connect invoice-pay → checkout → webhook → verify booking invoice settled.
async function runBooking(): Promise<void> {
  console.log('\n=== BOOKING happy-path: TODO (not implemented) ===');
  throw new Error('booking subcommand not implemented yet');
}

// ── Dispatch + summary ────────────────────────────────────────────────
async function main(): Promise<void> {
  const cmd = process.argv[2] || 'dues';

  try {
    if (cmd === 'dues') {
      await runDues();
    } else if (cmd === 'event') {
      await runEvent();
    } else if (cmd === 'booking') {
      await runBooking();
    } else if (cmd === 'all') {
      await runDues();
      // TODO: await runEvent(); await runBooking(); — enable once implemented.
      console.log('\n  (all) event + booking are TODO — only dues ran.');
    } else {
      console.error(`Unknown subcommand: ${cmd}. Use: dues | event | booking | all`);
      process.exit(2);
    }
  } catch (err) {
    // A thrown error (not an assertion) is itself a failure.
    record('driver exception', 'no exception', err instanceof Error ? err.message : String(err), false);
  }

  // ── SUMMARY TABLE ──
  const failed = rows.filter((r) => !r.pass).length;
  const stepW = Math.max(4, ...rows.map((r) => r.step.length));
  const expW = Math.max(8, ...rows.map((r) => r.expected.length));
  const actW = Math.max(6, ...rows.map((r) => r.actual.length));
  const line = (s: string, e: string, a: string, st: string) =>
    `| ${s.padEnd(stepW)} | ${e.padEnd(expW)} | ${a.padEnd(actW)} | ${st.padEnd(4)} |`;

  console.log('\n' + '='.repeat(8) + ' SUMMARY ' + '='.repeat(8));
  console.log(line('STEP', 'EXPECTED', 'ACTUAL', 'R/S'));
  console.log(line('-'.repeat(stepW), '-'.repeat(expW), '-'.repeat(actW), '----'));
  for (const r of rows) {
    console.log(line(r.step, r.expected, r.actual, r.pass ? 'PASS' : 'FAIL'));
  }
  console.log('='.repeat(25));

  if (failed > 0) {
    console.error(`\nRESULT: FAIL — ${failed}/${rows.length} assertion(s) failed.`);
    process.exit(1);
  }
  console.log(`\nRESULT: PASS — ${rows.length}/${rows.length} assertions passed.`);
  process.exit(0);
}

main();
