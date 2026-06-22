/**
 * [BR-55][BR-56] Postmark webhook parsing + auth — unit.
 *
 * Pure-function coverage for the two security-relevant primitives: which
 * provider events map to a suppression (hard bounce → hard_bounce, spam →
 * complaint; soft bounces / other events ignored) and the constant-time Basic
 * Auth secret check. The full verify→persist path is covered against real PG in
 * postmarkWebhook.integration.test.ts.
 */
import { describe, test, expect } from 'bun:test';
import { parsePostmarkEvent, verifyWebhookBasicAuth } from './postmarkWebhook';

const basic = (user: string, pass: string) =>
  'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

describe('[BR-55][BR-56] parsePostmarkEvent', () => {
  test('hard bounce → hard_bounce suppression', () => {
    const e = parsePostmarkEvent({ RecordType: 'Bounce', Type: 'HardBounce', Email: 'A@X.com' });
    expect(e).toEqual({ email: 'a@x.com', reason: 'hard_bounce', label: 'Bounce/HardBounce' });
  });

  test('BadEmailAddress bounce → hard_bounce', () => {
    const e = parsePostmarkEvent({ RecordType: 'Bounce', Type: 'BadEmailAddress', Email: 'b@x.com' });
    expect(e?.reason).toBe('hard_bounce');
  });

  test('spam complaint → complaint suppression', () => {
    const e = parsePostmarkEvent({ RecordType: 'SpamComplaint', Email: 'c@x.com' });
    expect(e).toEqual({ email: 'c@x.com', reason: 'complaint', label: 'SpamComplaint' });
  });

  test('soft bounce is NOT suppressed (returns null)', () => {
    expect(parsePostmarkEvent({ RecordType: 'Bounce', Type: 'SoftBounce', Email: 'd@x.com' })).toBeNull();
    expect(parsePostmarkEvent({ RecordType: 'Bounce', Type: 'Transient', Email: 'd@x.com' })).toBeNull();
  });

  test('non-deliverability events (Delivery/Open) ignored', () => {
    expect(parsePostmarkEvent({ RecordType: 'Delivery', Email: 'e@x.com' })).toBeNull();
    expect(parsePostmarkEvent({ RecordType: 'Open', Email: 'e@x.com' })).toBeNull();
  });

  test('missing/blank email → null', () => {
    expect(parsePostmarkEvent({ RecordType: 'SpamComplaint' })).toBeNull();
    expect(parsePostmarkEvent({ RecordType: 'SpamComplaint', Email: '' })).toBeNull();
    expect(parsePostmarkEvent(null)).toBeNull();
    expect(parsePostmarkEvent('nope')).toBeNull();
  });
});

describe('[BR-56] verifyWebhookBasicAuth', () => {
  const SECRET = 's3cr3t-token';

  test('correct password in Basic header → true', () => {
    expect(verifyWebhookBasicAuth(basic('postmark', SECRET), SECRET)).toBe(true);
    // Username is ignored — only the password component must match.
    expect(verifyWebhookBasicAuth(basic('anything', SECRET), SECRET)).toBe(true);
  });

  test('wrong password → false', () => {
    expect(verifyWebhookBasicAuth(basic('postmark', 'wrong'), SECRET)).toBe(false);
  });

  test('missing / non-Basic / malformed header → false', () => {
    expect(verifyWebhookBasicAuth(undefined, SECRET)).toBe(false);
    expect(verifyWebhookBasicAuth('Bearer ' + SECRET, SECRET)).toBe(false);
    expect(verifyWebhookBasicAuth('Basic !!!notbase64', SECRET)).toBe(false);
  });
});
