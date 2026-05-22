/**
 * Tests for HMAC unsubscribe token generation and verification
 */

import { describe, test, expect } from 'bun:test';
import { generateUnsubToken, verifyUnsubToken } from './unsub-token';
// Factory N/A: utility function test — primitive inputs/outputs, no domain entities

describe('generateUnsubToken', () => {
  test('returns a non-empty base64url string', () => {
    const token = generateUnsubToken('user@example.com', 'org-1');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    // base64url: only alphanumeric, hyphen, underscore — no + / =
    expect(token).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  test('same inputs always produce the same token (deterministic HMAC)', () => {
    const t1 = generateUnsubToken('user@example.com', 'org-1');
    const t2 = generateUnsubToken('user@example.com', 'org-1');
    expect(t1).toBe(t2);
  });

  test('different emails produce different tokens', () => {
    const t1 = generateUnsubToken('a@example.com', 'org-1');
    const t2 = generateUnsubToken('b@example.com', 'org-1');
    expect(t1).not.toBe(t2);
  });

  test('different orgIds produce different tokens', () => {
    const t1 = generateUnsubToken('user@example.com', 'org-1');
    const t2 = generateUnsubToken('user@example.com', 'org-2');
    expect(t1).not.toBe(t2);
  });
});

describe('verifyUnsubToken', () => {
  test('returns true for valid token matching email+orgId', () => {
    const token = generateUnsubToken('user@example.com', 'org-1');
    expect(verifyUnsubToken(token, 'user@example.com', 'org-1')).toBe(true);
  });

  test('returns false for tampered token', () => {
    const token = generateUnsubToken('user@example.com', 'org-1');
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(verifyUnsubToken(tampered, 'user@example.com', 'org-1')).toBe(false);
  });

  test('returns false for wrong email', () => {
    const token = generateUnsubToken('user@example.com', 'org-1');
    expect(verifyUnsubToken(token, 'other@example.com', 'org-1')).toBe(false);
  });

  test('returns false for wrong orgId', () => {
    const token = generateUnsubToken('user@example.com', 'org-1');
    expect(verifyUnsubToken(token, 'user@example.com', 'org-2')).toBe(false);
  });
});
