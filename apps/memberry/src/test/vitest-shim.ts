/* eslint-disable @typescript-eslint/no-explicit-any */
// Workspace-local replacement for `vitest` under the bun:test runner.
//
// IMPORTANT: each test primitive (describe/test/etc.) is wrapped in a fresh
// arrow function — not re-exported as a binding — so bun's stack-based file
// attribution credits the caller test file, not this shim. Otherwise bun
// deduplicates tests from different files because all describes appear to
// originate from this shim's location.

import * as bunTest from 'bun:test';

export const describe = (name: any, fn: any) => bunTest.describe(name, fn);
export const test = (name: any, fn?: any, timeout?: any) => bunTest.test(name, fn, timeout);
export const it = (name: any, fn?: any, timeout?: any) => bunTest.it(name, fn, timeout);
export const expect: typeof bunTest.expect = bunTest.expect;
export const beforeAll = (fn: any, timeout?: any) => bunTest.beforeAll(fn, timeout);
export const beforeEach = (fn: any, timeout?: any) => bunTest.beforeEach(fn, timeout);
export const afterAll = (fn: any, timeout?: any) => bunTest.afterAll(fn, timeout);
export const afterEach = (fn: any, timeout?: any) => bunTest.afterEach(fn, timeout);
export const mock = bunTest.mock;
export const spyOn = bunTest.spyOn;
export const jest = bunTest.jest;

// Augment bun's `vi` with Vitest-shape methods (mock, hoisted, useFakeTimers, ...).
// `vi` is mutable and shared within a test file's execution context, so adding
// methods here makes them available to whoever imports `vi` from this shim.
const v: any = bunTest.vi as any;
if (!v.__augmented) {
  v.mock = (path: string, factory?: () => unknown) => {
    if (factory) return bunTest.mock.module(path, factory as () => Record<string, unknown>);
    return bunTest.mock.module(path, () => ({}));
  };
  v.hoisted = <T>(fn: () => T): T => fn();
  v.useFakeTimers = () => { bunTest.jest.useFakeTimers(); return v; };
  v.useRealTimers = () => { bunTest.jest.useRealTimers(); return v; };
  v.advanceTimersByTime = (ms: number) => bunTest.jest.advanceTimersByTime(ms);
  v.setSystemTime = (when?: number | Date) => bunTest.jest.setSystemTime(when as any);
  v.resetAllMocks = () => bunTest.jest.resetAllMocks();
  v.restoreAllMocks ??= () => bunTest.jest.restoreAllMocks();
  v.clearAllMocks ??= () => bunTest.jest.clearAllMocks();
  v.mocked = <T>(item: T): T => item;
  v.importActual = async (modulePath: string) => import(modulePath);
  v.doMock = (path: string, factory: () => unknown) =>
    bunTest.mock.module(path, factory as () => Record<string, unknown>);
  v.unmock = () => undefined;
  v.resetModules = () => undefined;
  v.stubGlobal = (k: string, val: unknown) => {
    (globalThis as Record<string, unknown>)[k] = val;
  };
  v.unstubAllGlobals = () => undefined;
  if (!v.spyOn) v.spyOn = bunTest.spyOn;
  if (!v.fn) v.fn = (impl?: any) => (impl ? bunTest.jest.fn(impl) : bunTest.jest.fn());
  v.__augmented = true;
}

export const vi = v;
export const vitest = v;
