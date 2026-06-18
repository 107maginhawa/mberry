/**
 * P0 comms remediation — video-call signaling token.
 *
 * HOLE 1: the signing secret must come from the centralized validated config
 * (getCallSigningSecret) with NO runtime 'dev-fallback'. In production a
 * missing/default secret must fail closed. Tokens are signed over
 * { callId, personId, exp } and verified on use — expired / forged / foreign
 * tokens are rejected.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  generateCallToken,
  verifyCallToken,
  CALL_TOKEN_TTL_SECONDS,
} from './call-token';
import { getCallSigningSecret } from '@/core/config';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env['NODE_ENV'] = ORIGINAL_ENV['NODE_ENV'] ?? 'test';
  delete process.env['CALL_SIGNING_SECRET'];
  process.env['AUTH_SECRET'] = ORIGINAL_ENV['AUTH_SECRET'] ?? 'test-auth-secret';
}

beforeEach(resetEnv);
afterEach(() => {
  process.env['NODE_ENV'] = ORIGINAL_ENV['NODE_ENV'];
  if (ORIGINAL_ENV['CALL_SIGNING_SECRET'] === undefined) delete process.env['CALL_SIGNING_SECRET'];
  else process.env['CALL_SIGNING_SECRET'] = ORIGINAL_ENV['CALL_SIGNING_SECRET'];
  if (ORIGINAL_ENV['AUTH_SECRET'] === undefined) delete process.env['AUTH_SECRET'];
  else process.env['AUTH_SECRET'] = ORIGINAL_ENV['AUTH_SECRET'];
});

describe('getCallSigningSecret — fail closed in production (HOLE 1)', () => {
  test('throws in production when neither CALL_SIGNING_SECRET nor AUTH_SECRET set', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['CALL_SIGNING_SECRET'];
    delete process.env['AUTH_SECRET'];
    expect(() => getCallSigningSecret()).toThrow();
  });

  test('never returns the literal dev-fallback sentinel at runtime', () => {
    // Outside prod a dev fallback is permitted, but it must never be the old
    // hardcoded 'dev-fallback' constant.
    delete process.env['CALL_SIGNING_SECRET'];
    delete process.env['AUTH_SECRET'];
    process.env['NODE_ENV'] = 'development';
    const secret = getCallSigningSecret();
    expect(secret).not.toBe('dev-fallback');
  });

  test('prefers AUTH_SECRET when CALL_SIGNING_SECRET unset (prod boots with real key)', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['CALL_SIGNING_SECRET'];
    process.env['AUTH_SECRET'] = 'prod-auth-secret-xyz';
    expect(getCallSigningSecret()).toBe('prod-auth-secret-xyz');
  });
});

describe('generateCallToken / verifyCallToken (HOLE 1)', () => {
  test('a freshly minted token verifies for the same call + person', () => {
    const token = generateCallToken({ callId: 'call-1', personId: 'user-1' });
    const res = verifyCallToken(token, { callId: 'call-1', personId: 'user-1' });
    expect(res.valid).toBe(true);
  });

  test('rejects a token bound to a different call', () => {
    const token = generateCallToken({ callId: 'call-1', personId: 'user-1' });
    const res = verifyCallToken(token, { callId: 'call-OTHER', personId: 'user-1' });
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.reason).toBe('wrong-call');
  });

  test('rejects a token minted for a different person', () => {
    const token = generateCallToken({ callId: 'call-1', personId: 'user-1' });
    const res = verifyCallToken(token, { callId: 'call-1', personId: 'user-2' });
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.reason).toBe('wrong-person');
  });

  test('rejects an expired token', () => {
    const token = generateCallToken({ callId: 'call-1', personId: 'user-1', ttlSeconds: -1 });
    const res = verifyCallToken(token, { callId: 'call-1', personId: 'user-1' });
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.reason).toBe('expired');
  });

  test('rejects a forged/tampered signature', () => {
    const token = generateCallToken({ callId: 'call-1', personId: 'user-1' });
    const [encoded] = token.split('.');
    const forged = `${encoded}.deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`;
    const res = verifyCallToken(forged, { callId: 'call-1', personId: 'user-1' });
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.reason).toBe('bad-signature');
  });

  test('rejects a token signed with a different secret', () => {
    const token = generateCallToken({ callId: 'call-1', personId: 'user-1', secret: 'attacker-secret' });
    const res = verifyCallToken(token, { callId: 'call-1', personId: 'user-1', secret: 'real-secret' });
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.reason).toBe('bad-signature');
  });

  test('rejects malformed tokens', () => {
    expect(verifyCallToken('', { callId: 'call-1' }).valid).toBe(false);
    expect(verifyCallToken('no-dot-here', { callId: 'call-1' }).valid).toBe(false);
    expect(verifyCallToken('a.b', { callId: 'call-1' }).valid).toBe(false);
  });

  test('default TTL is positive and finite', () => {
    expect(CALL_TOKEN_TTL_SECONDS).toBeGreaterThan(0);
  });
});
