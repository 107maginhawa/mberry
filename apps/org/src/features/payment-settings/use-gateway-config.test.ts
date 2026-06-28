// apps/org/src/features/payment-settings/use-gateway-config.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ok, err } from '../../test-utils/mock-sdk'

vi.mock('@monobase/sdk-ts/generated', () => ({
  getDuesGatewayConfig: vi.fn(),
  upsertDuesGatewayConfig: vi.fn(),
  testDuesGatewayConnection: vi.fn(),
  disconnectDuesGateway: vi.fn(),
}))

import {
  getDuesGatewayConfig,
  upsertDuesGatewayConfig,
  testDuesGatewayConnection,
  disconnectDuesGateway,
} from '@monobase/sdk-ts/generated'
import type { GatewayConfig, GatewayTestResult } from '@monobase/sdk-ts/generated'
import { useGatewayConfig } from './use-gateway-config'

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

const GATEWAY_STUB: GatewayConfig = {
  id: 'gc1',
  version: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  organizationId: 'org-1',
  provider: 'paymongo',
  publicKey: 'pk_live_abc',
  connected: true,
  lastTestAt: new Date('2026-06-01'),
}

describe('useGatewayConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('statusQuery calls getDuesGatewayConfig with the orgId', async () => {
    vi.mocked(getDuesGatewayConfig).mockResolvedValue(ok<GatewayConfig>(GATEWAY_STUB))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useGatewayConfig('org-1'), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true))
    expect(vi.mocked(getDuesGatewayConfig)).toHaveBeenCalledWith({ path: { organizationId: 'org-1' } })
    expect(result.current.statusQuery.data?.connected).toBe(true)
    expect(result.current.statusQuery.data?.publicKey).toBe('pk_live_abc')
  })

  it('statusQuery is disabled when orgId is null', () => {
    const qc = new QueryClient()
    const { result } = renderHook(() => useGatewayConfig(null), { wrapper: wrapper(qc) })
    expect(result.current.statusQuery.fetchStatus).toBe('idle')
    expect(vi.mocked(getDuesGatewayConfig)).not.toHaveBeenCalled()
  })

  it('connect.mutate calls upsertDuesGatewayConfig with paymongo provider + all fields', async () => {
    vi.mocked(upsertDuesGatewayConfig).mockResolvedValue(ok<GatewayConfig>({ ...GATEWAY_STUB, connected: false }))
    const qc = new QueryClient()
    const { result } = renderHook(() => useGatewayConfig('org-1'), { wrapper: wrapper(qc) })
    result.current.connect.mutate({ publicKey: 'pk_test_x', secretKey: 'sk_test_y', webhookSecret: 'whsec_z' })
    await waitFor(() => expect(result.current.connect.isSuccess).toBe(true))
    expect(vi.mocked(upsertDuesGatewayConfig)).toHaveBeenCalledWith({
      path: { organizationId: 'org-1' },
      body: { provider: 'paymongo', publicKey: 'pk_test_x', secretKey: 'sk_test_y', webhookSecret: 'whsec_z' },
    })
  })

  it('connect.mutate omits webhookSecret when not provided', async () => {
    vi.mocked(upsertDuesGatewayConfig).mockResolvedValue(ok<GatewayConfig>({ ...GATEWAY_STUB, connected: false }))
    const qc = new QueryClient()
    const { result } = renderHook(() => useGatewayConfig('org-1'), { wrapper: wrapper(qc) })
    result.current.connect.mutate({ publicKey: 'pk_test_x', secretKey: 'sk_test_y' })
    await waitFor(() => expect(result.current.connect.isSuccess).toBe(true))
    expect(vi.mocked(upsertDuesGatewayConfig)).toHaveBeenCalledWith({
      path: { organizationId: 'org-1' },
      body: { provider: 'paymongo', publicKey: 'pk_test_x', secretKey: 'sk_test_y' },
    })
  })

  it('test.mutate calls testDuesGatewayConnection', async () => {
    const testResult: GatewayTestResult = { success: true, message: 'OK', testedAt: new Date() }
    vi.mocked(testDuesGatewayConnection).mockResolvedValue(ok<GatewayTestResult>(testResult))
    const qc = new QueryClient()
    const { result } = renderHook(() => useGatewayConfig('org-1'), { wrapper: wrapper(qc) })
    result.current.test.mutate()
    await waitFor(() => expect(result.current.test.isSuccess).toBe(true))
    expect(vi.mocked(testDuesGatewayConnection)).toHaveBeenCalledWith({ path: { organizationId: 'org-1' } })
    expect(result.current.test.data).toEqual(testResult)
  })

  it('disconnect.mutate calls disconnectDuesGateway and keys off response.ok', async () => {
    // jsdom rejects status 204 in the Response constructor — use 200 (hook checks response.ok, not status)
    vi.mocked(disconnectDuesGateway).mockResolvedValue(ok(undefined, 200) as any)
    const qc = new QueryClient()
    const { result } = renderHook(() => useGatewayConfig('org-1'), { wrapper: wrapper(qc) })
    result.current.disconnect.mutate()
    await waitFor(() => expect(result.current.disconnect.isSuccess).toBe(true))
    expect(vi.mocked(disconnectDuesGateway)).toHaveBeenCalledWith({ path: { organizationId: 'org-1' } })
  })

  it('connect.mutate throws immediately when orgId is null', async () => {
    const qc = new QueryClient()
    const { result } = renderHook(() => useGatewayConfig(null), { wrapper: wrapper(qc) })
    result.current.connect.mutate({ publicKey: 'pk', secretKey: 'sk' })
    await waitFor(() => expect(result.current.connect.isError).toBe(true))
    expect((result.current.connect.error as Error).message).toBe('No organization selected.')
    expect(vi.mocked(upsertDuesGatewayConfig)).not.toHaveBeenCalled()
  })

  it('statusQuery errors on non-2xx response (e.g. 403)', async () => {
    vi.mocked(getDuesGatewayConfig).mockResolvedValue(err(403, { error: 'Forbidden' }) as any)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useGatewayConfig('org-1'), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.statusQuery.isError).toBe(true))
    expect((result.current.statusQuery.error as Error).message).toContain('403')
  })

  it('connect.mutate throws on server error body', async () => {
    vi.mocked(upsertDuesGatewayConfig).mockResolvedValue(
      err(422, { error: 'Invalid public key format' }) as any
    )
    const qc = new QueryClient()
    const { result } = renderHook(() => useGatewayConfig('org-1'), { wrapper: wrapper(qc) })
    result.current.connect.mutate({ publicKey: 'bad', secretKey: 'bad' })
    await waitFor(() => expect(result.current.connect.isError).toBe(true))
    expect((result.current.connect.error as Error).message).toBe('Invalid public key format')
  })
})
