import { describe, test, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility', () => {
  test('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  test('handles conditional classes', () => {
    const isHidden = false
    expect(cn('base', isHidden && 'hidden', 'visible')).toBe('base visible')
  })

  test('handles undefined values', () => {
    expect(cn('base', undefined, 'end')).toBe('base end')
  })

  test('merges tailwind conflicts correctly', () => {
    // tailwind-merge should resolve conflicts
    const result = cn('p-4', 'p-8')
    expect(result).toBe('p-8')
  })

  test('returns empty string for no args', () => {
    expect(cn()).toBe('')
  })
})
