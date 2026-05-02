/**
 * Tests for runtime-config.ts
 *
 * fetchRuntimeConfig:
 *   - fetches /config.json, normalises snake_case → camelCase
 *   - caches result for 30 s (CACHE_TTL)
 *   - falls back to {} on non-OK response
 *   - falls back to {} on fetch timeout (AbortError)
 *   - falls back to {} on any other network error
 *
 * clearRuntimeConfigCache:
 *   - resets the in-memory cache so next call re-fetches
 *
 * Strategy: replace the global `fetch` with a bun:test `mock()` before each
 * test, and call `clearRuntimeConfigCache()` to reset module-level state.
 */
import { describe, test, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test'
import { fetchRuntimeConfig, clearRuntimeConfigCache } from './runtime-config'

// ---------------------------------------------------------------------------
// Helpers to build minimal fetch Response objects
// ---------------------------------------------------------------------------

function makeResponse(body: unknown, status = 200): Response {
  const json = JSON.stringify(body)
  return new Response(json, {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Keep a reference to the original fetch so we can restore it
// ---------------------------------------------------------------------------
const originalFetch = globalThis.fetch

// ---------------------------------------------------------------------------
// Reset cache + restore fetch before/after each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  clearRuntimeConfigCache()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ---------------------------------------------------------------------------
// Successful fetches
// ---------------------------------------------------------------------------

describe('fetchRuntimeConfig — successful responses', () => {
  test('normalises api_url to apiUrl', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(makeResponse({ api_url: 'https://api.example.com' })),
    ) as any

    const config = await fetchRuntimeConfig()

    expect(config.apiUrl).toBe('https://api.example.com')
  })

  test('normalises onesignal_app_id to onesignalAppId', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(makeResponse({ onesignal_app_id: 'app-id-123' })),
    ) as any

    const config = await fetchRuntimeConfig()

    expect(config.onesignalAppId).toBe('app-id-123')
  })

  test('normalises both fields at once', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeResponse({ api_url: 'https://api.example.com', onesignal_app_id: 'oss-99' }),
      ),
    ) as any

    const config = await fetchRuntimeConfig()

    expect(config.apiUrl).toBe('https://api.example.com')
    expect(config.onesignalAppId).toBe('oss-99')
  })

  test('returns empty config when /config.json contains no known keys', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(makeResponse({})),
    ) as any

    const config = await fetchRuntimeConfig()

    expect(config).toEqual({})
  })

  test('fetches /config.json with cache-busting headers', async () => {
    let capturedInit: RequestInit | undefined
    globalThis.fetch = mock((_url: string, init?: RequestInit) => {
      capturedInit = init
      return Promise.resolve(makeResponse({}))
    }) as any

    await fetchRuntimeConfig()

    expect(capturedInit?.headers).toBeDefined()
    const headers = capturedInit!.headers as Record<string, string>
    expect(headers['Cache-Control']).toContain('no-cache')
  })

  test('calls fetch with /config.json path', async () => {
    let capturedUrl = ''
    globalThis.fetch = mock((url: string) => {
      capturedUrl = url
      return Promise.resolve(makeResponse({}))
    }) as any

    await fetchRuntimeConfig()

    expect(capturedUrl).toBe('/config.json')
  })
})

// ---------------------------------------------------------------------------
// Caching behaviour
// ---------------------------------------------------------------------------

describe('fetchRuntimeConfig — caching', () => {
  test('returns cached result on second call without re-fetching', async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      return Promise.resolve(makeResponse({ api_url: 'https://cached.example.com' }))
    }) as any

    const first = await fetchRuntimeConfig()
    const second = await fetchRuntimeConfig()

    expect(callCount).toBe(1)
    expect(first).toBe(second) // Same object reference from cache
  })

  test('re-fetches after cache is cleared', async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      return Promise.resolve(makeResponse({ api_url: 'https://example.com' }))
    }) as any

    await fetchRuntimeConfig()
    clearRuntimeConfigCache()
    await fetchRuntimeConfig()

    expect(callCount).toBe(2)
  })

  test('clearRuntimeConfigCache causes next call to hit the network', async () => {
    const responses = [
      makeResponse({ api_url: 'https://first.example.com' }),
      makeResponse({ api_url: 'https://second.example.com' }),
    ]
    let idx = 0
    globalThis.fetch = mock(() => Promise.resolve(responses[idx++]!)) as any

    const first = await fetchRuntimeConfig()
    clearRuntimeConfigCache()
    const second = await fetchRuntimeConfig()

    expect(first.apiUrl).toBe('https://first.example.com')
    expect(second.apiUrl).toBe('https://second.example.com')
  })
})

// ---------------------------------------------------------------------------
// Fallback — non-OK HTTP status
// ---------------------------------------------------------------------------

describe('fetchRuntimeConfig — non-OK HTTP responses', () => {
  test('returns empty object on 404 response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(makeResponse('Not Found', 404)),
    ) as any

    const config = await fetchRuntimeConfig()

    expect(config).toEqual({})
  })

  test('returns empty object on 500 response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(makeResponse('Internal Server Error', 500)),
    ) as any

    const config = await fetchRuntimeConfig()

    expect(config).toEqual({})
  })

  test('does NOT cache the fallback empty config after a failed response', async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      // First call fails, second succeeds
      if (callCount === 1) return Promise.resolve(makeResponse('err', 503))
      return Promise.resolve(makeResponse({ api_url: 'https://recovered.example.com' }))
    }) as any

    const first = await fetchRuntimeConfig()
    const second = await fetchRuntimeConfig()

    // First call returns empty fallback, second re-fetches and succeeds
    expect(first).toEqual({})
    expect(second.apiUrl).toBe('https://recovered.example.com')
    expect(callCount).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Fallback — network / timeout errors
// ---------------------------------------------------------------------------

describe('fetchRuntimeConfig — network errors', () => {
  test('returns empty object when fetch rejects with a network error', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network error')),
    ) as any

    const config = await fetchRuntimeConfig()

    expect(config).toEqual({})
  })

  test('returns empty object when fetch is aborted (AbortError / timeout)', async () => {
    globalThis.fetch = mock(() => {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    }) as any

    const config = await fetchRuntimeConfig()

    expect(config).toEqual({})
  })

  test('does not throw on any error — always resolves', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new TypeError('Failed to fetch')),
    ) as any

    // Must resolve, not reject
    await expect(fetchRuntimeConfig()).resolves.toBeDefined()
  })

  test('does not cache after an AbortError', async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      if (callCount === 1) {
        const err = new Error('aborted')
        err.name = 'AbortError'
        return Promise.reject(err)
      }
      return Promise.resolve(makeResponse({ api_url: 'https://retry.example.com' }))
    }) as any

    const first = await fetchRuntimeConfig()
    const second = await fetchRuntimeConfig()

    expect(first).toEqual({})
    expect(second.apiUrl).toBe('https://retry.example.com')
    expect(callCount).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// clearRuntimeConfigCache
// ---------------------------------------------------------------------------

describe('clearRuntimeConfigCache', () => {
  test('is a function', () => {
    expect(typeof clearRuntimeConfigCache).toBe('function')
  })

  test('calling it multiple times does not throw', () => {
    expect(() => {
      clearRuntimeConfigCache()
      clearRuntimeConfigCache()
    }).not.toThrow()
  })

  test('after clearing, fetchRuntimeConfig hits the network again', async () => {
    let fetchCalls = 0
    globalThis.fetch = mock(() => {
      fetchCalls++
      return Promise.resolve(makeResponse({ api_url: 'https://example.com' }))
    }) as any

    await fetchRuntimeConfig() // populates cache
    expect(fetchCalls).toBe(1)

    clearRuntimeConfigCache()

    await fetchRuntimeConfig() // cache cleared → re-fetches
    expect(fetchCalls).toBe(2)
  })
})
