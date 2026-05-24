/**
 * Tests for credit cycle calculation utilities (BR-46, BR-11, BR-12)
 *
 * BR-46: Credit cycle boundaries computed from member registration date
 * BR-11: Configurable cycle start date per association (fixed annual anchor)
 * BR-12: Carryover capped at 50% of required credits
 */

import { describe, test, expect } from 'bun:test';
import {
  getCycleForDate,
  getCycleForDateWithConfig,
  getCurrentCycle,
  getCurrentCycleWithConfig,
  calculateCarryover,
  summarizeCycle,
  type CreditCycleConfig,
  type CreditCycle,
} from './credit-cycle';

// ─── Helpers ───────────────────────────────────────────

function date(s: string): Date {
  return new Date(s);
}

// ─── getCycleForDate (legacy registration-based) [BR-46] ───

describe('getCycleForDate [BR-46]', () => {
  test('first cycle starts at registration date', () => {
    const reg = date('2024-01-01');
    const target = date('2024-06-15');
    const cycle = getCycleForDate(reg, target, 1);
    expect(cycle.cycleNumber).toBe(0);
    expect(cycle.cycleStart.getFullYear()).toBe(2024);
  });

  test('second year cycle for 1-year period', () => {
    const reg = date('2024-01-01');
    const target = date('2025-06-15'); // ~1.5 years after registration
    const cycle = getCycleForDate(reg, target, 1);
    expect(cycle.cycleNumber).toBe(1);
  });

  test('2-year cycle period', () => {
    const reg = date('2020-01-01');
    const target = date('2023-06-15'); // ~3.5 years -> cycle 1 of 2-year periods
    const cycle = getCycleForDate(reg, target, 2);
    expect(cycle.cycleNumber).toBe(1);
    expect(cycle.cycleStart.getTime()).toBeLessThanOrEqual(target.getTime());
    expect(cycle.cycleEnd.getTime()).toBeGreaterThanOrEqual(target.getTime());
  });

  test('3-year cycle period', () => {
    const reg = date('2020-01-01');
    const target = date('2026-06-15'); // ~6.5 years -> cycle 2 of 3-year periods
    const cycle = getCycleForDate(reg, target, 3);
    expect(cycle.cycleNumber).toBe(2);
  });

  test('target exactly at registration date returns cycle 0', () => {
    const reg = date('2024-01-01');
    const cycle = getCycleForDate(reg, reg, 1);
    expect(cycle.cycleNumber).toBe(0);
  });

  test('cycle end is after cycle start', () => {
    const reg = date('2024-01-01');
    const target = date('2025-03-15');
    const cycle = getCycleForDate(reg, target, 1);
    expect(cycle.cycleEnd.getTime()).toBeGreaterThan(cycle.cycleStart.getTime());
  });

  test('target date falls within its cycle boundaries', () => {
    const reg = date('2022-07-01');
    const target = date('2025-09-15');
    const cycle = getCycleForDate(reg, target, 1);
    expect(cycle.cycleStart.getTime()).toBeLessThanOrEqual(target.getTime());
    expect(cycle.cycleEnd.getTime()).toBeGreaterThanOrEqual(target.getTime());
  });
});

// ─── getCycleForDateWithConfig (fixed annual anchor) [BR-11] ───

describe('getCycleForDateWithConfig [BR-11]', () => {
  const baseConfig: CreditCycleConfig = {
    cyclePeriodYears: 1,
    requiredCredits: 40,
    carryoverEnabled: false,
    cycleStartMonth: 7,
    cycleStartDay: 1,
  };

  test('fixed anchor: July 1 cycle, target in Oct -> cycle starts this July', () => {
    const cycle = getCycleForDateWithConfig(date('2025-10-15'), baseConfig);
    expect(cycle.cycleStart).toEqual(date('2025-07-01'));
  });

  test('fixed anchor: July 1 cycle, target in March -> cycle starts prev July', () => {
    const cycle = getCycleForDateWithConfig(date('2025-03-15'), baseConfig);
    expect(cycle.cycleStart).toEqual(date('2024-07-01'));
  });

  test('fixed anchor: exactly on cycle start date', () => {
    const cycle = getCycleForDateWithConfig(date('2025-07-01'), baseConfig);
    expect(cycle.cycleStart).toEqual(date('2025-07-01'));
  });

  test('2-year cycle period with fixed anchor', () => {
    const config: CreditCycleConfig = {
      ...baseConfig,
      cyclePeriodYears: 2,
    };
    const cycle = getCycleForDateWithConfig(date('2025-10-15'), config);
    // 2-year periods aligned from epoch year 2000
    expect(cycle.cycleEnd.getTime()).toBeGreaterThan(cycle.cycleStart.getTime());
    // Cycle should span 2 years
    const startYear = cycle.cycleStart.getFullYear();
    const endYear = cycle.cycleEnd.getFullYear();
    expect(endYear - startYear).toBe(2);
  });

  test('fallback to registration-based when cycleStartMonth is null', () => {
    const config: CreditCycleConfig = {
      ...baseConfig,
      cycleStartMonth: null,
    };
    const reg = date('2024-03-15');
    const cycle = getCycleForDateWithConfig(date('2025-01-01'), config, reg);
    expect(cycle.cycleNumber).toBeGreaterThanOrEqual(0);
  });

  test('throws when legacy mode with no registrationDate', () => {
    const config: CreditCycleConfig = {
      ...baseConfig,
      cycleStartMonth: null,
    };
    expect(() => getCycleForDateWithConfig(date('2025-01-01'), config)).toThrow(
      'registrationDate required',
    );
  });

  test('default cycleStartDay is 1 when not provided', () => {
    const config: CreditCycleConfig = {
      cyclePeriodYears: 1,
      requiredCredits: 40,
      carryoverEnabled: false,
      cycleStartMonth: 7,
      cycleStartDay: null,
    };
    const cycle = getCycleForDateWithConfig(date('2025-10-15'), config);
    expect(cycle.cycleStart.getDate()).toBe(1);
  });

  test('custom day in anchor (e.g. July 15)', () => {
    const config: CreditCycleConfig = {
      ...baseConfig,
      cycleStartDay: 15,
    };
    const cycle = getCycleForDateWithConfig(date('2025-08-01'), config);
    expect(cycle.cycleStart.getDate()).toBe(15);
  });
});

// ─── getCurrentCycle / getCurrentCycleWithConfig ───

describe('getCurrentCycle', () => {
  test('returns a valid cycle for today', () => {
    const reg = date('2020-01-01');
    const cycle = getCurrentCycle(reg, 1);
    expect(cycle.cycleNumber).toBeGreaterThanOrEqual(0);
    expect(cycle.cycleStart.getTime()).toBeLessThanOrEqual(Date.now());
    expect(cycle.cycleEnd.getTime()).toBeGreaterThanOrEqual(Date.now());
  });
});

describe('getCurrentCycleWithConfig', () => {
  test('returns a valid cycle for today with config', () => {
    const config: CreditCycleConfig = {
      cyclePeriodYears: 1,
      requiredCredits: 40,
      carryoverEnabled: false,
      cycleStartMonth: 1,
      cycleStartDay: 1,
    };
    const cycle = getCurrentCycleWithConfig(config);
    expect(cycle.cycleNumber).toBeGreaterThanOrEqual(0);
  });
});

// ─── calculateCarryover [BR-12] ───

describe('calculateCarryover [BR-12]', () => {
  test('no carryover when disabled', () => {
    expect(calculateCarryover(60, 40, false)).toBe(0);
  });

  test('no carryover when earned <= required', () => {
    expect(calculateCarryover(40, 40, true)).toBe(0);
    expect(calculateCarryover(30, 40, true)).toBe(0);
  });

  test('carryover = excess when excess <= 50% of required', () => {
    // required=40, excess=10, cap=20 -> carryover=10
    expect(calculateCarryover(50, 40, true)).toBe(10);
  });

  test('carryover capped at 50% of required [BR-12]', () => {
    // required=40, excess=30, cap=floor(40*0.5)=20 -> carryover=20
    expect(calculateCarryover(70, 40, true)).toBe(20);
  });

  test('carryover cap is floored (odd required credits)', () => {
    // required=41, excess=30, cap=floor(41*0.5)=20 -> carryover=20
    expect(calculateCarryover(71, 41, true)).toBe(20);
  });

  test('zero earned credits', () => {
    expect(calculateCarryover(0, 40, true)).toBe(0);
  });

  test('zero required credits — edge case', () => {
    // required=0, excess=10, cap=floor(0)=0 -> carryover=0
    expect(calculateCarryover(10, 0, true)).toBe(0);
  });
});

// ─── summarizeCycle ───

describe('summarizeCycle', () => {
  const cycle: CreditCycle = {
    cycleStart: date('2025-01-01'),
    cycleEnd: date('2025-12-31'),
    cycleNumber: 5,
  };

  test('compliant when total >= required', () => {
    const summary = summarizeCycle(cycle, 35, 40, 10);
    expect(summary.compliant).toBe(true);
    expect(summary.total).toBe(45);
    expect(summary.remaining).toBe(0);
  });

  test('not compliant when total < required', () => {
    const summary = summarizeCycle(cycle, 20, 40, 5);
    expect(summary.compliant).toBe(false);
    expect(summary.total).toBe(25);
    expect(summary.remaining).toBe(15);
  });

  test('exactly meeting requirement is compliant', () => {
    const summary = summarizeCycle(cycle, 40, 40, 0);
    expect(summary.compliant).toBe(true);
    expect(summary.remaining).toBe(0);
  });

  test('zero earned with carryover', () => {
    const summary = summarizeCycle(cycle, 0, 40, 10);
    expect(summary.total).toBe(10);
    expect(summary.remaining).toBe(30);
    expect(summary.compliant).toBe(false);
  });

  test('preserves cycle reference', () => {
    const summary = summarizeCycle(cycle, 50, 40, 0);
    expect(summary.cycle).toBe(cycle);
    expect(summary.earned).toBe(50);
    expect(summary.required).toBe(40);
    expect(summary.carryoverFromPrevious).toBe(0);
  });
});
