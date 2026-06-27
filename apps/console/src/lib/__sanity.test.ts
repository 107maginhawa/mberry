import { describe, it, expect } from 'vitest'
import { ok, err } from '../test-utils/mock-sdk'

describe('console scaffold', () => {
  it('mock-sdk ok() builds a hey-api success envelope', () => {
    const env = ok({ hello: 'world' })
    expect(env.data).toEqual({ hello: 'world' })
    expect(env.error).toBeUndefined()
    expect(env.response.status).toBe(200)
  })
  it('mock-sdk err() builds a failure envelope', () => {
    const env = err(403, { error: 'nope' })
    expect(env.data).toBeUndefined()
    expect(env.response.status).toBe(403)
  })
})
