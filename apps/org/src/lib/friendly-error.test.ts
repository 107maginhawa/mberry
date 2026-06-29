import { describe, it, expect } from 'vitest'
import { friendlyApiError } from './friendly-error'

describe('friendlyApiError', () => {
  it('maps csrf/origin/forbidden errors to a device-verify message', () => {
    expect(friendlyApiError('Invalid origin')).toMatch(/verify this device/i)
    expect(friendlyApiError('CSRF token mismatch')).toMatch(/verify this device/i)
  })

  it('maps 403/officer/permission errors to an access message', () => {
    const out = friendlyApiError('403: officer permission required')
    expect(out).toMatch(/Treasurer or President/i)
  })

  it('maps gateway/key errors to a plain payment-provider message', () => {
    const out = friendlyApiError('PayMongo API key invalid (401)')
    expect(out).toMatch(/payment provider/i)
    expect(out.toLowerCase()).not.toContain('api key')
  })

  it('maps rate-limit errors to a wait message', () => {
    expect(friendlyApiError('Too many requests')).toMatch(/wait a minute/i)
  })

  it('maps network/5xx errors to a connection message', () => {
    expect(friendlyApiError('Network request failed (503)')).toMatch(/reach the server/i)
  })

  it('is case-insensitive', () => {
    expect(friendlyApiError('PayMongo API KEY invalid')).toMatch(/payment provider/i)
  })

  it('falls back to a generic message for unknown strings', () => {
    expect(friendlyApiError('TypeError: undefined is not a function'))
      .toBe('Something went wrong. Please try again.')
  })
})
