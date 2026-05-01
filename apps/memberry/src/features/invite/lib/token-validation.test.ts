import { describe, test, expect } from 'bun:test';
import { isValidTokenFormat, isTokenExpired, parseInviteToken } from './token-validation';

describe('isValidTokenFormat', () => {
  test('valid token format passes', () => {
    // Tokens are base64url-encoded strings
    expect(isValidTokenFormat('eyJhbGciOiJIUzI1NiJ9.eyJvcmdJZCI6Im9yZy0xIn0.signature')).toBe(true);
    expect(isValidTokenFormat('abc123-def456_ghi789')).toBe(true);
  });

  test('empty token fails', () => {
    expect(isValidTokenFormat('')).toBe(false);
  });

  test('too short token fails', () => {
    expect(isValidTokenFormat('ab')).toBe(false);
  });
});

describe('isTokenExpired', () => {
  test('future timestamp is not expired', () => {
    const futureMs = Date.now() + 86400000; // +1 day
    expect(isTokenExpired(futureMs)).toBe(false);
  });

  test('past timestamp is expired', () => {
    const pastMs = Date.now() - 86400000; // -1 day
    expect(isTokenExpired(pastMs)).toBe(true);
  });
});

describe('parseInviteToken', () => {
  test('returns null for invalid tokens', () => {
    expect(parseInviteToken('')).toBe(null);
    expect(parseInviteToken('invalid')).toBe(null);
  });

  test('returns parsed data for well-formed token', () => {
    // Token is base64url encoded JSON: { orgId, orgName, role, expiresAt }
    const payload = { orgId: 'org-1', orgName: 'Test Org', role: 'member', expiresAt: Date.now() + 86400000 };
    const encoded = btoa(JSON.stringify(payload));
    const token = `invite.${encoded}.sig`;

    const result = parseInviteToken(token);
    expect(result).not.toBe(null);
    expect(result!.orgId).toBe('org-1');
    expect(result!.orgName).toBe('Test Org');
  });
});
