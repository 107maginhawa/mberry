import { test, expect } from 'bun:test'
import { ratchetCheck } from './ratchet'

const base = { a: 1, b: 76, c: 85 }

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
