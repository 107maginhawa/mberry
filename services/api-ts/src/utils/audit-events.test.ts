import { describe, test, expect } from 'bun:test';
import { AUDIT_EVENT_CATEGORIES, typedEventSubType } from './audit-events';

describe('Typed Audit Events', () => {
  test('all categories have at least one sub-type', () => {
    for (const [category, subTypes] of Object.entries(AUDIT_EVENT_CATEGORIES)) {
      expect(subTypes.length).toBeGreaterThan(0);
    }
  });

  test('typedEventSubType constructs correct string', () => {
    expect(typedEventSubType('financial', 'payment-recorded')).toBe('financial.payment-recorded');
    expect(typedEventSubType('governance', 'vote-cast')).toBe('governance.vote-cast');
  });

  test('no duplicate sub-types within a category', () => {
    for (const [category, subTypes] of Object.entries(AUDIT_EVENT_CATEGORIES)) {
      const unique = new Set(subTypes);
      expect(unique.size).toBe(subTypes.length);
    }
  });
});
