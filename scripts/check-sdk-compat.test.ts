/**
 * check-sdk-compat — AHA F-5 / P-9 additive-vs-breaking discrimination
 *
 * The SDK-compat gate originally failed on ANY operationId drift (added,
 * removed, or changed). But an ADDED operationId is purely additive — it grows
 * the SDK surface and cannot break an existing consumer. Only REMOVED or
 * CHANGED (method/path moved) ops break consumers. F-5 makes the gate
 * discriminate: block on breaking drift, allow additive drift (with a notice),
 * and keep an opt-in `--strict` for the old block-on-any-drift behavior.
 */
import { describe, test, expect } from 'bun:test';
import { classifyDrift, decideExit } from './check-sdk-compat';

const op = (operationId: string, method: string, path: string) => ({
  operationId,
  method,
  path,
});

describe('classifyDrift', () => {
  test('added op is additive, not breaking', () => {
    const baseline = [op('opA', 'GET', '/a')];
    const current = [op('opA', 'GET', '/a'), op('opB', 'GET', '/b')];
    const d = classifyDrift(baseline, current);
    expect(d.added.map((e) => e.operationId)).toEqual(['opB']);
    expect(d.removed).toHaveLength(0);
    expect(d.changed).toHaveLength(0);
  });

  test('removed op is breaking', () => {
    const baseline = [op('opA', 'GET', '/a'), op('opB', 'GET', '/b')];
    const current = [op('opA', 'GET', '/a')];
    const d = classifyDrift(baseline, current);
    expect(d.removed.map((e) => e.operationId)).toEqual(['opB']);
    expect(d.added).toHaveLength(0);
  });

  test('changed signature (same op id, new path) is breaking', () => {
    const baseline = [op('opA', 'POST', '/postings')];
    const current = [op('opA', 'POST', '/association/jobs/postings')];
    const d = classifyDrift(baseline, current);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0].opId).toBe('opA');
    expect(d.added).toHaveLength(0);
    expect(d.removed).toHaveLength(0);
  });
});

describe('decideExit', () => {
  const none = { added: [], removed: [], changed: [] };
  const additiveOnly = {
    added: [op('opB', 'GET', '/b')],
    removed: [],
    changed: [],
  };
  const breaking = {
    added: [op('opB', 'GET', '/b')],
    removed: [op('opC', 'GET', '/c')],
    changed: [],
  };

  test('no drift → exit 0', () => {
    expect(decideExit(none, { strict: false }).code).toBe(0);
  });

  test('additive-only → exit 0 (non-strict, non-breaking)', () => {
    const r = decideExit(additiveOnly, { strict: false });
    expect(r.code).toBe(0);
    expect(r.additiveCount).toBe(1);
    expect(r.breakingCount).toBe(0);
  });

  test('additive-only with --strict → exit 1 (old behavior)', () => {
    expect(decideExit(additiveOnly, { strict: true }).code).toBe(1);
  });

  test('breaking drift → exit 1 even non-strict', () => {
    const r = decideExit(breaking, { strict: false });
    expect(r.code).toBe(1);
    expect(r.breakingCount).toBe(1);
  });
});
