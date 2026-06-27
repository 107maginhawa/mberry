import { describe, it, expect } from 'vitest'
import { centavosToPhp } from '@monobase/ui'

describe('centavosToPhp', () => {
  it('formats centavos as PHP', () => {
    expect(centavosToPhp(250000)).toBe('₱2,500.00')
    expect(centavosToPhp(0)).toBe('₱0.00')
    expect(centavosToPhp(99)).toBe('₱0.99')
  })
})
