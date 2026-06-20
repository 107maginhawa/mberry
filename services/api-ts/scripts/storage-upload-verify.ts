/**
 * storage-upload-verify.ts — End-to-end happy-path verify driver for MinIO presigned uploads.
 *   Run: cd services/api-ts && bun scripts/storage-upload-verify.ts   (add --keep to leave fixtures)
 *
 * Proves the full browser-equivalent round-trip: request a presigned upload URL →
 * (CORS preflight) → PUT bytes straight to MinIO → complete → download → byte-identical
 * read-back. Mirrors the auth pattern from stripe-happy-path.ts (better-auth sign-in →
 * /csrf-token double-submit → fetch with Cookie + x-csrf-token + x-org-id + Origin).
 * Self-contained, idempotent, re-runnable; cleans up (DB row + MinIO object) in a finally,
 * exits non-zero on ANY assertion failure, and prints a PASS/FAIL table.
 *
 * Why this exists: the SDK file-upload flow sent `size: BigInt(file.size)`, which the
 * jsonBodySerializer stringifies → the wire JSON carried size as a STRING → the backend
 * validator 400'd. Step 6 below documents that exact trap as a guard.
 */

import { spawnSync } from 'child_process';

// ── Verified constants ────────────────────────────────────────────────
const API_BASE = process.env['API_BASE'] || 'http://localhost:7213';
const DATABASE_URL =
  process.env['DATABASE_URL'] || 'postgres://postgres:password@localhost:5432/monobase';
const MINIO_BASE = process.env['MINIO_URL'] || 'http://localhost:9000';
const BUCKET = process.env['STORAGE_BUCKET'] || 'monobase-files';
// Browser-equivalent Origin — the global hono/csrf origin-check 403s state-changing
// requests whose Origin isn't allow-listed; a bare fetch sends none, so we mirror the app.
const APP_ORIGIN = process.env['APP_ORIGIN'] || 'http://localhost:3004';

const ORG = 'ed8e3a96-8126-4341-be42-e6eb7940c562';
const MEMBER_EMAIL = 'member@memberry.ph';
const MEMBER_PASSWORD = 'TestPass123!';
// Name of the running MinIO docker container (for object cleanup via `mc`).
const MINIO_CONTAINER = process.env['MINIO_CONTAINER'] || 'hapihub-test-minio-default';

const FIXTURE_FILENAME = 'storage-verify.png';
const KEEP = process.argv.includes('--keep');

// ── psql helper (parse postgres:// URL → PG* env for psql) ─────────────
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
const q = (s: string) => `'${String(s).replace(/'/g, "''")}'`;

// ── Assertion + result tracking ───────────────────────────────────────
interface Row {
  step: string;
  expected: string;
  actual: string;
  pass: boolean;
}
const rows: Row[] = [];
function assert(step: string, expected: unknown, actual: unknown, ok: boolean) {
  rows.push({ step, expected: String(expected), actual: String(actual), pass: ok });
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${step} — expected=${expected} actual=${actual}`);
}

// ── Cookie jar (better-auth session) ──────────────────────────────────
function captureCookies(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : ([res.headers.get('set-cookie')].filter(Boolean) as string[]);
  return list.map((c) => c.split(';')[0]).join('; ');
}

// ── Authed-request helper (session + CSRF double-submit + x-org-id + Origin) ──
// Mirrors stripe-happy-path.ts signInAuthed: better-auth sign-in → GET /csrf-token for
// the double-submit cookie+token → returns a json() helper that sends session+csrf
// cookies, the x-csrf-token header, x-org-id (storage is org-scoped), and a browser Origin.
async function signInAuthed(email: string, password: string): Promise<{
  json: (method: string, path: string, body?: unknown) => Promise<Response>;
}> {
  const signIn = await fetch(`${API_BASE}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = signIn.ok ? captureCookies(signIn) : '';
  if (!cookie) throw new Error(`sign-in failed for ${email} (status ${signIn.status})`);

  const csrfRes = await fetch(`${API_BASE}/csrf-token`, { headers: { Cookie: cookie } });
  const csrfCookie = captureCookies(csrfRes);
  const csrfToken = ((await csrfRes.json()) as { token?: string }).token ?? '';
  const cookieWithCsrf = [cookie, csrfCookie].filter(Boolean).join('; ');

  return {
    json: (method, path, body) => {
      const headers: Record<string, string> = {
        Cookie: cookieWithCsrf,
        Origin: APP_ORIGIN,
        'x-csrf-token': csrfToken,
        'x-org-id': ORG,
      };
      if (body !== undefined) headers['content-type'] = 'application/json';
      return fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
  };
}

// Remove the MinIO object for a fileId (tolerate a missing container / mc / object).
function removeMinioObject(fileId: string): boolean {
  const r = spawnSync(
    'docker',
    [
      'exec',
      MINIO_CONTAINER,
      'sh',
      '-c',
      `mc alias set L ${MINIO_BASE} minioadmin minioadmin >/dev/null 2>&1; mc rm L/${BUCKET}/${fileId} >/dev/null 2>&1`,
    ],
    { encoding: 'utf8' },
  );
  // status 0 = removed; non-zero = container/object absent — both fine for cleanup.
  return r.status === 0;
}

// Pre-clean orphan rows from prior runs (marker = our fixture filename).
function preCleanOrphans(): string[] {
  const ids = psql(
    `SELECT id FROM stored_file WHERE filename = ${q(FIXTURE_FILENAME)};`,
  )
    .split('\n')
    .filter(Boolean);
  for (const id of ids) {
    removeMinioObject(id);
    psql(`DELETE FROM stored_file WHERE id = ${q(id)};`);
  }
  return ids;
}

// ── Main driver ───────────────────────────────────────────────────────
async function run(): Promise<void> {
  console.log('\n=== STORAGE presigned-upload happy-path ===\n');

  const orphans = preCleanOrphans();
  if (orphans.length) {
    console.log(`  Pre-clean: removed ${orphans.length} orphan ${FIXTURE_FILENAME} row(s) from prior runs.`);
  }

  // 1x1 transparent PNG (real image bytes so the image/png MIME allowlist accepts it).
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );

  let fileId = '';

  try {
    const member = await signInAuthed(MEMBER_EMAIL, MEMBER_PASSWORD);

    // ── 1. Request presigned upload URL (size on the wire is a NUMBER — the SDK fix). ──
    const upRes = await member.json('POST', '/storage/files/upload', {
      filename: FIXTURE_FILENAME,
      size: pngBytes.length,
      mimeType: 'image/png',
    });
    const upText = await upRes.clone().text();
    assert('1. upload-url HTTP 201', 201, upRes.status, upRes.status === 201);
    if (upRes.status !== 201) throw new Error(`upload-url failed: ${upText.slice(0, 300)}`);
    const upBody = (await upRes.json()) as { file?: string; uploadUrl?: string };
    fileId = upBody.file ?? '';
    const uploadUrl = upBody.uploadUrl ?? '';
    assert('1. fileId captured', 'non-empty', fileId || '(none)', fileId.length > 0);
    assert('1. uploadUrl captured', 'non-empty', uploadUrl ? `${uploadUrl.slice(0, 40)}…` : '(none)', uploadUrl.length > 0);
    // The presigned host MUST be browser-reachable (localhost:9000), not an internal docker host.
    const uploadHost = uploadUrl ? new URL(uploadUrl).host : '';
    assert('1. uploadUrl host browser-reachable', 'localhost:9000', uploadHost, uploadHost === 'localhost:9000');
    if (!fileId || !uploadUrl) throw new Error('Missing fileId/uploadUrl — cannot continue');

    // ── 2. CORS preflight to the presigned URL (proves a real browser PUT would pass). ──
    const preflight = await fetch(uploadUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: APP_ORIGIN,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    const allowOrigin = preflight.headers.get('access-control-allow-origin');
    assert('2. CORS preflight 200/204', '200|204', preflight.status, preflight.status === 200 || preflight.status === 204);
    assert(
      '2. access-control-allow-origin present',
      'present',
      allowOrigin ?? '(none)',
      allowOrigin != null && (allowOrigin === '*' || allowOrigin === APP_ORIGIN),
    );

    // ── 3. PUT the bytes directly to MinIO via the presigned URL. ──
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: pngBytes,
    });
    assert('3. PUT bytes HTTP 200', 200, putRes.status, putRes.status === 200);

    // ── 4. Complete the upload, then assert DB status flipped to 'available'. ──
    const completeRes = await member.json('POST', `/storage/files/${fileId}/complete`);
    const completeText = await completeRes.clone().text();
    assert('4. complete HTTP 200', 200, completeRes.status, completeRes.status === 200);
    if (completeRes.status !== 200) console.log(`  [finding] complete failed: ${completeText.slice(0, 300)}`);
    const dbStatus = psql(`SELECT status FROM stored_file WHERE id = ${q(fileId)};`);
    assert('4. DB stored_file.status===available', 'available', dbStatus, dbStatus === 'available');

    // ── 5. Download URL + byte-identical round-trip read-back. ──
    const dlRes = await member.json('GET', `/storage/files/${fileId}/download`);
    assert('5. download HTTP 200', 200, dlRes.status, dlRes.status === 200);
    const dlBody = (await dlRes.json()) as { downloadUrl?: string };
    const downloadUrl = dlBody.downloadUrl ?? '';
    assert('5. downloadUrl non-empty', 'non-empty', downloadUrl ? `${downloadUrl.slice(0, 40)}…` : '(none)', downloadUrl.length > 0);
    if (downloadUrl) {
      const fetchedRes = await fetch(downloadUrl);
      const fetchedBytes = Buffer.from(await fetchedRes.arrayBuffer());
      assert('5. download bytes HTTP 200', 200, fetchedRes.status, fetchedRes.status === 200);
      assert(
        '5. round-trip byte length matches',
        pngBytes.length,
        fetchedBytes.length,
        fetchedBytes.length === pngBytes.length,
      );
      assert('5. round-trip bytes identical', 'equal', fetchedBytes.equals(pngBytes) ? 'equal' : 'differ', fetchedBytes.equals(pngBytes));
    }

    // ── 6. Contract guard: size as the STRING '123' MUST 400 (documents the BigInt-stringify trap). ──
    const trapRes = await member.json('POST', '/storage/files/upload', {
      filename: 'storage-verify-trap.png',
      size: '123', // deliberately a string — the exact shape the unfixed SDK put on the wire
      mimeType: 'image/png',
    });
    assert('6. [trap guard] string size === 400', 400, trapRes.status, trapRes.status === 400);
  } finally {
    // ── 7. CLEANUP (try/finally; runs even on failure unless --keep). ──
    if (KEEP) {
      console.log(`\n  [--keep] Skipping cleanup. Fixture ${FIXTURE_FILENAME} row + MinIO object left in place.`);
    } else {
      const cleaned: string[] = [];
      // Delete by both the captured fileId and the fixture filename (catches partial-run rows).
      const ids = new Set<string>();
      if (fileId) ids.add(fileId);
      for (const id of psql(`SELECT id FROM stored_file WHERE filename = ${q(FIXTURE_FILENAME)};`).split('\n').filter(Boolean)) {
        ids.add(id);
      }
      for (const id of ids) {
        if (removeMinioObject(id)) cleaned.push(`minio object ${id.slice(0, 8)}`);
      }
      const del = psql(
        `WITH d AS (DELETE FROM stored_file WHERE filename = ${q(FIXTURE_FILENAME)} RETURNING 1) SELECT count(*) FROM d;`,
      );
      if (del !== '0') cleaned.push(`stored_file(${del})`);
      console.log(`\n  Cleanup: ${cleaned.length ? cleaned.join(', ') : 'nothing to clean'}`);
    }
  }
}

// ── Dispatch + summary ────────────────────────────────────────────────
async function main(): Promise<void> {
  try {
    await run();
  } catch (err) {
    rows.push({
      step: 'driver exception',
      expected: 'no exception',
      actual: err instanceof Error ? err.message : String(err),
      pass: false,
    });
    console.log(`  [FAIL] driver exception — ${err instanceof Error ? err.message : String(err)}`);
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
