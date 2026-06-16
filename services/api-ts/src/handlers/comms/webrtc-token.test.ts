/**
 * EF-M07 + P0 comms remediation: WebRTC/video-call token generation.
 *
 * The call signaling token is now minted by the shared, validated util
 * `utils/call-token.ts` (signed over { callId, personId, exp }, secret from the
 * centralized accessor with NO runtime 'dev-fallback'). These source-level
 * checks lock in that joinVideoCall delegates to that util and that the old
 * insecure inline signer (with its 'dev-fallback' constant) is gone.
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const joinSource = fs.readFileSync(
  path.resolve(import.meta.dir, './joinVideoCall.ts'),
  'utf-8',
);
const tokenUtilSource = fs.readFileSync(
  path.resolve(import.meta.dir, './utils/call-token.ts'),
  'utf-8',
);

describe('P0: video-call token generation', () => {
  test('joinVideoCall no longer contains an inline dev-fallback secret', () => {
    expect(joinSource).not.toContain("'dev-fallback'");
    expect(joinSource).not.toContain('WEBRTC_TOKEN_SECRET');
  });

  test('joinVideoCall delegates token minting to the shared call-token util', () => {
    expect(joinSource).toContain('generateCallToken');
  });

  test('the token util binds the token to callId and personId', () => {
    expect(tokenUtilSource).toContain('callId');
    expect(tokenUtilSource).toContain('personId');
  });

  test('the token util signs with the validated accessor, not an inline literal', () => {
    expect(tokenUtilSource).toContain('getCallSigningSecret');
    expect(tokenUtilSource).not.toContain("'dev-fallback'");
  });

  test('the token util uses createHmac for signing', () => {
    expect(tokenUtilSource).toContain('createHmac');
  });
});
