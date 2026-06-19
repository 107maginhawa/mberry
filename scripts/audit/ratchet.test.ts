import { test, expect } from 'bun:test'
import { ratchetCheck, countUndeferredPhase1Gaps } from './ratchet'

const base = { a: 1, b: 76, c: 85 }

test('gate-A counts phase-1 non-complete BRs, excluding deferred and other phases', () => {
  const rows = [
    { verdict: 'UNTESTED', phase: 1, deferred: false }, // counts
    { verdict: 'UNTESTED', phase: 1, deferred: true }, // deferred → excluded
    { verdict: 'INCOMPLETE', phase: 1, deferred: false }, // counts
    { verdict: 'COMPLETE', phase: 1, deferred: false }, // complete → excluded
    { verdict: 'UNTESTED', phase: 2, deferred: false }, // phase 2 → excluded
  ]
  expect(countUndeferredPhase1Gaps(rows)).toBe(2)
})

test('passes when counts equal baseline', () => {
  const r = ratchetCheck({ a: 1, b: 76, c: 85 }, base)
  expect(r.pass).toBe(true)
  expect(r.regressions).toEqual([])
  expect(r.improvements).toEqual([])
})

test('fails when any axis grows', () => {
  const r = ratchetCheck({ a: 1, b: 77, c: 85 }, base)
  expect(r.pass).toBe(false)
  expect(r.regressions).toEqual(['b: 76 → 77'])
})

test('passes but flags improvement when an axis shrinks', () => {
  const r = ratchetCheck({ a: 0, b: 76, c: 80 }, base)
  expect(r.pass).toBe(true)
  expect(r.regressions).toEqual([])
  expect(r.improvements).toEqual(['a: 1 → 0', 'c: 85 → 80'])
})
