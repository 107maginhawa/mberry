import { describe, test, expect, afterEach } from 'bun:test';
import {
  createCredentialToken,
  verifyCredentialToken,
  resolveCredentialVerifySecret,
} from './credential-token';

const ENV_KEY = 'CREDENTIAL_VERIFY_SECRET';
const originalSecret = process.env[ENV_KEY];
const originalNodeEnv = process.env['NODE_ENV'];

afterEach(() => {
  if (originalSecret === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalSecret;
  if (originalNodeEnv === undefined) delete process.env['NODE_ENV'];
  else process.env['NODE_ENV'] = originalNodeEnv;
});

describe('credential-token round-trip', () => {
  test('a token created with a secret verifies with the same secret', () => {
    const token = createCredentialToken('cred-1', 'org-1', 'unit-secret');
    const payload = verifyCredentialToken(token, 'unit-secret');
    expect(payload).not.toBeNull();
    expect(payload?.credentialId).toBe('cred-1');
    expect(payload?.organizationId).toBe('org-1');
  });

  test('a token does not verify under a different secret', () => {
    const token = createCredentialToken('cred-1', 'org-1', 'unit-secret');
    expect(verifyCredentialToken(token, 'OTHER-secret')).toBeNull();
  });
});

describe('resolveCredentialVerifySecret — FIX-012 fail-closed (G16)', () => {
  test('returns the configured secret when CREDENTIAL_VERIFY_SECRET is set', () => {
    process.env[ENV_KEY] = 'configured-secret';
    expect(resolveCredentialVerifySecret()).toBe('configured-secret');
  });

  test('THROWS in production when the secret is unset (no guessable literal fallback)', () => {
    delete process.env[ENV_KEY];
    process.env['NODE_ENV'] = 'production';
    expect(() => resolveCredentialVerifySecret()).toThrow(/CREDENTIAL_VERIFY_SECRET/);
  });

  test('never returns the legacy guessable literal "dev-credential-verify-secret" in production', () => {
    delete process.env[ENV_KEY];
    process.env['NODE_ENV'] = 'production';
    let returned: string | null = null;
    try {
      returned = resolveCredentialVerifySecret();
    } catch {
      returned = null;
    }
    expect(returned).not.toBe('dev-credential-verify-secret');
  });

  test('allows a dev fallback outside production so local/test flows keep working', () => {
    delete process.env[ENV_KEY];
    process.env['NODE_ENV'] = 'development';
    expect(resolveCredentialVerifySecret()).toBe('dev-credential-verify-secret');
  });
});
