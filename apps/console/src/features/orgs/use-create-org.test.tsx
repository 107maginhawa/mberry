import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@monobase/sdk-ts/generated', () => ({ createOrganization: vi.fn() }))
import { createOrganization } from '@monobase/sdk-ts/generated'
import type { CreateOrganizationResponse } from '@monobase/sdk-ts/generated'
import { useCreateOrg } from './use-create-org'
import { ok, err } from '../../test-utils/mock-sdk'

/**
 * M5 DRIFT TRIPWIRE: FULL_ORG is typed as CreateOrganizationResponse
 * (= PlatformAdminModuleOrganization). Every required field must be present —
 * a missing field is a compile error, not a runtime surprise.
 * Required: id, associationId, name, orgType, status, createdAt, updatedAt.
 */
const FULL_ORG: CreateOrganizationResponse = {
  id: 'org-1',
  associationId: 'assoc-1',
  name: 'Olive Dental Chapter',
  orgType: 'chapter',
  status: 'trial',
  createdAt: new Date('2026-06-27'),
  updatedAt: new Date('2026-06-27'),
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useCreateOrg', () => {
  it('success → resolves with org data + invalidates [orgs]', async () => {
    vi.mocked(createOrganization).mockResolvedValue(ok<CreateOrganizationResponse>(FULL_ORG, 201))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const w = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useCreateOrg(), { wrapper: w })
    let res: CreateOrganizationResponse | undefined
    await act(async () => {
      res = await result.current.submit({
        associationId: 'assoc-1',
        name: 'Olive Dental Chapter',
        orgType: 'chapter',
      })
    })
    expect(res?.name).toBe('Olive Dental Chapter')
    expect(res?.id).toBe('org-1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orgs'] })
  })

  it('409 dup name → error string surfaced from message key', async () => {
    // DRIFT: handler returns { message } plain object; SDK error type is ConflictError → cast.
    vi.mocked(createOrganization).mockResolvedValue(
      err(409, { message: 'Organization with this name already exists in this association' }) as any,
    )
    const { result } = renderHook(() => useCreateOrg(), { wrapper })
    await act(async () => {
      try {
        await result.current.submit({ associationId: 'a1', name: 'Dup', orgType: 'chapter' })
      } catch {
        // expected — mutation throws after surfacing error
      }
    })
    await waitFor(() =>
      expect(result.current.error).toContain('Organization with this name already exists'),
    )
  })

  it('403 not super → error string surfaced from error key', async () => {
    // DRIFT: handler returns { error } plain object; SDK error type is AuthenticationError → cast.
    vi.mocked(createOrganization).mockResolvedValue(
      err(403, { error: 'Super admin access required' }) as any,
    )
    const { result } = renderHook(() => useCreateOrg(), { wrapper })
    await act(async () => {
      try {
        await result.current.submit({ associationId: 'a1', name: 'Test', orgType: 'chapter' })
      } catch {
        // expected
      }
    })
    await waitFor(() =>
      expect(result.current.error).toContain('Super admin access required'),
    )
  })
})
