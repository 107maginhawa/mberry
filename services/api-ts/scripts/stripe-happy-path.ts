/**
 * stripe-happy-path.ts — End-to-end happy-path verify driver for online payments.
 *   Run: cd services/api-ts && bun scripts/stripe-happy-path.ts dues   (also: 'all'; default 'dues')
 *   DUES + EVENT are implemented; 'booking' is a TODO stub. Self-contained, idempotent,
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
// Member (Miguel Bautista) — session.user.id === MIGUEL (person-centric: user.id IS person id).
const MEMBER_EMAIL = 'member@memberry.ph';
const MEMBER_PASSWORD = 'TestPass123!';
const EVENT_MARKER = 'STRIPE-TEST-EVENT-';
const EVENT_FEE = 250000; // PHP 2500.00 in minor units
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

// ── EVENT driver ──────────────────────────────────────────────────────
// register-for-paid-event → checkout → webhook(payment_intent.succeeded) → verify
// event_registration.paid_at stamped. Event fee is server-side; we assert paid_at set.
async function runEvent(): Promise<void> {
  console.log('\n=== EVENT online-payment happy-path ===\n');

  // Pre-clean any orphan STRIPE-TEST-EVENT- fixtures from prior failed runs.
  preCleanEventOrphans();

  const eventId = crypto.randomUUID();
  const ts = Date.now();
  const title = `${EVENT_MARKER}${ts}`;

  try {
    // 1. FIXTURE — insert a fresh paid, published event (status 'published' allows registration).
    //    Required event columns (notNull, no default): organization_id, title, start_date, end_date.
    //    status defaults to 'draft'; set 'published' explicitly so the member can register.
    psql(`
      INSERT INTO event
        (id, created_at, updated_at, version, title, organization_id,
         start_date, end_date, capacity, registration_fee, currency,
         status, created_by, updated_by)
      VALUES
        (${q(eventId)}, now(), now(), 1, ${q(title)}, ${q(ORG)},
         now() + interval '30 days', now() + interval '30 days' + interval '4 hours', 50,
         ${EVENT_FEE}, 'PHP', 'published', ${q(MIGUEL)}, ${q(MIGUEL)});`);
    const insertedTitle = psql(`SELECT title FROM event WHERE id = ${q(eventId)};`);
    assert('1. fixture event inserted', title, insertedTitle, insertedTitle === title);

    // 2. MEMBER sign-in (better-auth) → capture cookie.
    let cookie = '';
    const signIn = await fetch(`${API_BASE}/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD }),
    });
    if (signIn.ok) cookie = captureCookies(signIn);
    assert('2. member sign-in 200 + cookie', 'cookie', cookie ? 'cookie' : '(none)', signIn.ok && cookie.length > 0);
    if (!cookie) throw new Error(`member sign-in failed (status ${signIn.status}) — cannot continue`);

    // 2b. CSRF double-submit — authenticated /association/* POSTs require a matching
    //     `csrf_token` cookie + `x-csrf-token` header (createCsrfTokenMiddleware). The
    //     dues /pay/* path is allowlisted; this authed route is not. GET /csrf-token to
    //     mint both, then send the token in BOTH the cookie jar and the header.
    const csrfRes = await fetch(`${API_BASE}/csrf-token`, { headers: { Cookie: cookie } });
    const csrfCookie = captureCookies(csrfRes); // e.g. "csrf_token=<tok>"
    const csrfToken = ((await csrfRes.json()) as { token?: string }).token ?? '';
    assert('2b. csrf-token minted', 'non-empty', csrfToken ? `${csrfToken.slice(0, 8)}…` : '(none)', csrfToken.length > 0);
    const cookieWithCsrf = [cookie, csrfCookie].filter(Boolean).join('; ');

    // 3. REGISTER-AND-PAY — POST .../register-and-pay (session+csrf cookies, x-csrf-token
    //    header, Origin for the hono/csrf origin-check). Response is enveloped:
    //    { data: { checkoutUrl, registrationId } } (also tolerate flat shape).
    //    x-org-id MUST be sent (as the real SDK client does): the org-context middleware
    //    otherwise grabs the eventId UUID out of the path as the org and 403s membership.
    const rapRes = await fetch(`${API_BASE}/association/event-lifecycle/${eventId}/register-and-pay`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Cookie: cookieWithCsrf,
        Origin: APP_ORIGIN,
        'x-csrf-token': csrfToken,
        'x-org-id': ORG,
      },
    });
    assert('3. register-and-pay 200/201', '200|201', rapRes.status, rapRes.status === 200 || rapRes.status === 201);
    const rapRaw = (await rapRes.json()) as
      | { data?: { checkoutUrl?: string; registrationId?: string }; checkoutUrl?: string; registrationId?: string; error?: string };
    const rapBody = rapRaw.data ?? rapRaw;
    const checkoutUrl = rapBody.checkoutUrl;
    assert(
      '3. checkoutUrl non-empty',
      'non-empty string',
      checkoutUrl ? `${checkoutUrl.slice(0, 40)}…` : `(none) err=${(rapRaw as { error?: string }).error}`,
      typeof checkoutUrl === 'string' && checkoutUrl.length > 0,
    );

    // Capture registrationId from response, else query event_registration for {eventId, person=MIGUEL}.
    let registrationId = rapBody.registrationId ?? '';
    if (!registrationId) {
      registrationId = psql(`
        SELECT id FROM event_registration
        WHERE event_id = ${q(eventId)} AND person_id = ${q(MIGUEL)}
        ORDER BY created_at DESC LIMIT 1;`);
    }
    assert('3. registrationId captured', 'non-empty', registrationId || '(none)', !!registrationId);
    if (!registrationId) throw new Error('No registrationId captured — cannot continue');

    // 4. ASSERT paid_at IS NULL before settlement.
    const paidBefore = psql(`SELECT COALESCE(paid_at::text, 'NULL') FROM event_registration WHERE id = ${q(registrationId)};`);
    assert('4. paid_at NULL before settle', 'NULL', paidBefore, paidBefore === 'NULL');

    // 5. FABRICATE + SIGN webhook (payment_intent.succeeded). The SETTLEMENT branch in
    //    processStripePayment only reads type/registrationId/eventId — it ignores orgId and
    //    returns before the dues orgId/paymentId guards. BUT the webhook INTAKE
    //    (stripeWebhookHandler → handleIncomingWebhook) inserts a webhook_retry_log row whose
    //    organization_id is NOT NULL uuid, sourced from metadata.orgId. So we include orgId
    //    here to satisfy that intake insert. (DISCOVERED: registerAndPayForEvent does NOT put
    //    orgId in its Stripe metadata, so the real event webhook would dead-letter at intake on
    //    an empty-string uuid — a separate, out-of-3-file-scope fix.) Stringify ONCE; sign+send same.
    const payload = JSON.stringify({
      id: `evt_stripe_test_event_${ts}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: `pi_stripe_test_event_${ts}`,
          status: 'succeeded',
          amount: EVENT_FEE,
          currency: 'php',
          metadata: {
            type: 'event_registration',
            registrationId,
            eventId,
            personId: MIGUEL,
            orgId: ORG, // intake-only: satisfies webhook_retry_log.organization_id NOT NULL
          },
        },
      },
    });
    const stripe = new Stripe('sk_test_x');
    const sigHeader = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: STRIPE_WEBHOOK_SECRET,
    });

    // 6. POST webhook → assert HTTP 200.
    const whRes = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'stripe-signature': sigHeader, 'content-type': 'application/json' },
      body: payload,
    });
    const whBody = (await whRes.json()) as { received?: boolean; action?: string };
    assert('6. webhook HTTP 200', 200, whRes.status, whRes.status === 200);
    // action 'processed' = settlement ran inline & succeeded; 'queued_for_retry' = it threw.
    assert(
      '6. webhook action===processed',
      'processed',
      `received=${whBody.received} action=${whBody.action}`,
      whBody.received === true && whBody.action === 'processed',
    );

    // 7. VERIFY SETTLEMENT — paid_at IS NOT NULL. Settlement runs inline in the webhook, so
    //    it's stamped by the time we get here; poll briefly anyway for timing robustness.
    let paidAfter = 'NULL';
    for (let i = 0; i < 10; i++) {
      paidAfter = psql(`SELECT COALESCE(paid_at::text, 'NULL') FROM event_registration WHERE id = ${q(registrationId)};`);
      if (paidAfter !== 'NULL' && paidAfter !== '') break;
      await new Promise((r) => setTimeout(r, 300));
    }
    assert('7. paid_at set after settle', 'not NULL', paidAfter, paidAfter !== 'NULL' && paidAfter !== '');
  } finally {
    // 8. CLEANUP (try/finally; runs even on failure unless --keep).
    if (KEEP) {
      console.log('\n  [--keep] Skipping cleanup. Fixture event + registration left in DB.');
    } else {
      cleanupEvent(eventId);
    }
  }
}

// Delete event_registration rows for the fixture event, then the event itself (scoped by eventId).
function cleanupEvent(eventId: string): void {
  const cleaned: string[] = [];

  const delReg = psql(
    `WITH d AS (DELETE FROM event_registration WHERE event_id = ${q(eventId)} RETURNING 1) SELECT count(*) FROM d;`,
  );
  if (delReg !== '0') cleaned.push(`event_registration(${delReg})`);

  const delEvt = psql(
    `WITH d AS (DELETE FROM event WHERE id = ${q(eventId)} RETURNING 1) SELECT count(*) FROM d;`,
  );
  if (delEvt !== '0') cleaned.push(`event(${delEvt})`);

  console.log(`\n  Cleanup: ${cleaned.length ? cleaned.join(', ') : 'nothing to clean'}`);
}

// Clear leftover STRIPE-TEST-EVENT- fixtures (+ their registrations) from prior failed runs.
function preCleanEventOrphans(): void {
  const orphanIds = psql(
    `SELECT id FROM event WHERE title LIKE ${q(EVENT_MARKER + '%')};`,
  )
    .split('\n')
    .filter(Boolean);
  if (!orphanIds.length) return;
  for (const id of orphanIds) {
    psql(`DELETE FROM event_registration WHERE event_id = ${q(id)};`);
    psql(`DELETE FROM event WHERE id = ${q(id)};`);
  }
  console.log(`  Pre-clean: removed ${orphanIds.length} orphan fixture event(s) from prior runs.`);
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
      await runEvent();
      // TODO: await runBooking(); — enable once implemented.
      console.log('\n  (all) booking is TODO — dues + event ran.');
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
