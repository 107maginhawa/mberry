import { describe, it, expect } from 'vitest'
import { centavosToPhp } from './money'
describe('centavosToPhp', () => {
  it('formats centavos as PHP with 2 decimals + grouping', () => {
    expect(centavosToPhp(250000)).toBe('₱2,500.00')
    expect(centavosToPhp(0)).toBe('₱0.00')
    expect(centavosToPhp(199)).toBe('₱1.99')
    expect(centavosToPhp(123456789)).toBe('₱1,234,567.89')
  })
})
