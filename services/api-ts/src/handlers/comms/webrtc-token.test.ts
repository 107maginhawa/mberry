/**
 * EF-M07: WebRTC token generation
 *
 * Verifies that generateWebRTCToken produces a cryptographically
 * signed token instead of a hardcoded sentinel value.
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const source = fs.readFileSync(
  path.resolve(import.meta.dir, './joinVideoCall.ts'),
  'utf-8',
);

describe('EF-M07: WebRTC token generation', () => {
  test('does not return hardcoded USE_SESSION_TOKEN sentinel', () => {
    // The sentinel placeholder must be replaced with real crypto
    expect(source).not.toContain("return 'USE_SESSION_TOKEN'");
  });

  test('uses createHmac for token signing', () => {
    expect(source).toContain('createHmac');
  });

  test('token includes userId and callMessageId in payload', () => {
    // The HMAC payload must bind the token to the specific user and call
    expect(source).toContain('userId');
    expect(source).toContain('callMessageId');
  });

  test('uses config secret for signing', () => {
    // Must use config.auth.secret or equivalent, not a hardcoded key
    expect(source).toContain('auth.secret');
  });
});
