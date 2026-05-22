import { describe, expect, test } from 'bun:test';
import { parseFeatureFlags, isEnabled } from './feature-flags';
// Factory N/A: core infrastructure test — config/setup/service assertions, no domain entities

describe('parseFeatureFlags', () => {
  test('parses FF_ prefixed env vars', () => {
    const env = {
      FF_NEW_DUES_FLOW: 'true',
      FF_BETA_EVENTS: 'false',
      OTHER_VAR: 'ignored',
    };
    const flags = parseFeatureFlags(env);
    expect(flags).toEqual({
      newDuesFlow: true,
      betaEvents: false,
    });
  });

  test('treats "1" as true', () => {
    const flags = parseFeatureFlags({ FF_THING: '1' });
    expect(flags.thing).toBe(true);
  });

  test('treats missing/other values as false', () => {
    const flags = parseFeatureFlags({ FF_THING: 'yes' });
    expect(flags.thing).toBe(false);
  });

  test('returns empty object when no FF_ vars', () => {
    const flags = parseFeatureFlags({ DATABASE_URL: 'postgres://...' });
    expect(flags).toEqual({});
  });

  test('handles single-word flag names', () => {
    const flags = parseFeatureFlags({ FF_MAINTENANCE: 'true' });
    expect(flags.maintenance).toBe(true);
  });

  test('handles multi-segment names', () => {
    const flags = parseFeatureFlags({ FF_ENABLE_NEW_BILLING_V2: 'true' });
    expect(flags.enableNewBillingV2).toBe(true);
  });
});

describe('isEnabled', () => {
  test('returns true for enabled flags', () => {
    expect(isEnabled({ myFlag: true }, 'myFlag')).toBe(true);
  });

  test('returns false for disabled flags', () => {
    expect(isEnabled({ myFlag: false }, 'myFlag')).toBe(false);
  });

  test('returns false for missing flags', () => {
    expect(isEnabled({}, 'nonexistent')).toBe(false);
  });
});
