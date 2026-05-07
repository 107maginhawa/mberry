import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { detectCountry } from './detect-country'

describe('detectCountry', () => {
  let originalNavigator: any
  let originalIntl: typeof Intl

  beforeEach(() => {
    originalNavigator = global.navigator
    originalIntl = global.Intl
    // @ts-ignore
    global.navigator = {
      language: undefined,
      languages: undefined
    }
    // Mock Intl so timezone detection returns UTC (no country mapping → fallback)
    Object.defineProperty(global, 'Intl', {
      value: {
        ...originalIntl,
        DateTimeFormat: class {
          resolvedOptions() {
            return { timeZone: 'UTC' }
          }
        }
      },
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    global.navigator = originalNavigator
    Object.defineProperty(global, 'Intl', {
      value: originalIntl,
      writable: true,
      configurable: true
    })
  })

  test('returns fallback when no locale or timezone available', () => {
    const result = detectCountry()
    expect(result).toBe('CA') // default fallback
  })

  test('uses custom fallback when provided', () => {
    const result = detectCountry({ fallback: 'US' })
    expect(result).toBe('US')
  })

  test('detects country from navigator.language with country code', () => {
    // @ts-ignore
    global.navigator = {
      language: 'en-US',
      languages: undefined
    }
    const result = detectCountry()
    expect(result).toBe('US')
  })

  test('detects country from navigator.languages', () => {
    // @ts-ignore
    global.navigator = {
      language: undefined,
      languages: ['fr-FR', 'en-US']
    }
    const result = detectCountry()
    expect(result).toBe('FR')
  })

  test('handles locale without country code', () => {
    // @ts-ignore
    global.navigator = {
      language: 'en',
      languages: undefined
    }
    const result = detectCountry()
    // Should fall back to timezone detection or default
    expect(result).toBeTruthy()
  })

  test('converts country code to uppercase', () => {
    // @ts-ignore
    global.navigator = {
      language: 'en-gb',
      languages: undefined
    }
    const result = detectCountry()
    expect(result).toBe('GB')
  })

  test('handles multiple locales in languages array', () => {
    // @ts-ignore
    global.navigator = {
      language: undefined,
      languages: ['zh-CN', 'en-US', 'es-ES']
    }
    const result = detectCountry()
    expect(result).toBe('CN')
  })

  test('handles error gracefully and returns fallback', () => {
    // @ts-ignore
    global.navigator = {
      get language() {
        throw new Error('Access denied')
      }
    }
    const result = detectCountry({ fallback: 'AU' })
    expect(result).toBe('AU')
  })

  test('handles complex locale strings', () => {
    // @ts-ignore
    global.navigator = {
      language: 'zh-Hans-CN',
      languages: undefined
    }
    const result = detectCountry()
    expect(result).toBe('CN')
  })
})