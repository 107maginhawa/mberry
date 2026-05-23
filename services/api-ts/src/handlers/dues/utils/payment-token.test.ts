/**
 * Tests for payment-token HMAC utilities (VS-W0B-003)
 */

import { describe, test, expect } from 'bun:test';
import {
  generatePaymentToken,
  hashPaymentToken,
  defaultPaymentTokenExpiry,
  isPaymentTokenExpired,
  getPaymentTokenSecret,
} from './payment-token';

describe('[VS-W0B-003] payment-token utils', () => {
  const secret = 'test-secret-for-payment-tokens';

  test('generatePaymentToken returns raw and hash', () => {
    const { raw, hash } = generatePaymentToken(secret);
    expect(raw).toBeDefined();
    expect(hash).toBeDefined();
    expect(raw).not.toBe(hash);
    expect(hash.length).toBe(64); // SHA-256 hex
  });

  test('hashPaymentToken is deterministic', () => {
    const raw = 'test-raw-token';
    const h1 = hashPaymentToken(raw, secret);
    const h2 = hashPaymentToken(raw, secret);
    expect(h1).toBe(h2);
  });

  test('hashPaymentToken differs with different secrets', () => {
    const raw = 'test-raw-token';
    const h1 = hashPaymentToken(raw, 'secret-a');
    const h2 = hashPaymentToken(raw, 'secret-b');
    expect(h1).not.toBe(h2);
  });

  test('defaultPaymentTokenExpiry is ~72 hours from now', () => {
    const before = Date.now();
    const expiry = defaultPaymentTokenExpiry();
    const after = Date.now();
    const expectedMs = 72 * 60 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000);
  });

  test('isPaymentTokenExpired returns false for future date', () => {
    const future = new Date(Date.now() + 60000);
    expect(isPaymentTokenExpired(future)).toBe(false);
  });

  test('isPaymentTokenExpired returns true for past date', () => {
    const past = new Date(Date.now() - 60000);
    expect(isPaymentTokenExpired(past)).toBe(true);
  });

  test('getPaymentTokenSecret uses PAYMENT_TOKEN_SECRET env', () => {
    process.env['PAYMENT_TOKEN_SECRET'] = 'primary-secret';
    process.env['INVITE_TOKEN_SECRET'] = 'fallback-secret';
    expect(getPaymentTokenSecret()).toBe('primary-secret');
    delete process.env['PAYMENT_TOKEN_SECRET'];
    delete process.env['INVITE_TOKEN_SECRET'];
  });

  test('getPaymentTokenSecret falls back to INVITE_TOKEN_SECRET', () => {
    delete process.env['PAYMENT_TOKEN_SECRET'];
    process.env['INVITE_TOKEN_SECRET'] = 'fallback-secret';
    expect(getPaymentTokenSecret()).toBe('fallback-secret');
    delete process.env['INVITE_TOKEN_SECRET'];
  });

  test('getPaymentTokenSecret throws when no secret configured', () => {
    delete process.env['PAYMENT_TOKEN_SECRET'];
    delete process.env['INVITE_TOKEN_SECRET'];
    expect(() => getPaymentTokenSecret()).toThrow(/not configured/);
  });
});
