import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { toast, downloadCsv } = vi.hoisted(() => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
  downloadCsv: vi.fn(),
}))
vi.mock('sonner', () => ({ toast }))
vi.mock('@monobase/sdk-ts/generated', () => ({ listRosterMembers: vi.fn() }))
vi.mock('./members-csv', async (orig) => ({ ...(await orig<Record<string, unknown>>()), downloadCsv }))
import { listRosterMembers } from '@monobase/sdk-ts/generated'
import { useExportMembers } from './use-export-members'
import { ok, err } from '../../test-utils/mock-sdk'

beforeEach(() => vi.clearAllMocks())

describe('useExportMembers', () => {
  it('fetches the roster, builds a CSV, downloads it, and toasts success', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(ok({
      data: [{ id: 'm1', personId: 'p1', name: 'Maria Santos', memberNumber: 'A-1', status: 'active', joinedAt: '2019-05-01T00:00:00Z', duesExpiryDate: '2026-01-12T00:00:00Z', duesInvoiceStatus: null }],
      totalCount: 1,
    } as any))
    const { result } = renderHook(() => useExportMembers('o1'))
    await act(async () => { await result.current.exportCsv() })
    expect(downloadCsv).toHaveBeenCalledTimes(1)
    const [filename, csv] = downloadCsv.mock.calls[0]!
    expect(filename).toBe('members.csv')
    expect(csv).toContain('Name,Member number')
    expect(csv).toContain('Maria Santos')
    expect(toast.success).toHaveBeenCalledWith('Exported 1 member')
  })

  it('toasts info on an empty roster and does not download', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(ok({ data: [], totalCount: 0 } as any))
    const { result } = renderHook(() => useExportMembers('o1'))
    await act(async () => { await result.current.exportCsv() })
    expect(downloadCsv).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith('No members to export.')
  })

  it('surfaces a friendly message on 403 and does not download', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(err(403, { error: 'forbidden' }) as any)
    const { result } = renderHook(() => useExportMembers('o1'))
    await act(async () => { await result.current.exportCsv() })
    expect(toast.error).toHaveBeenCalledWith('You need officer access to export members.')
    expect(downloadCsv).not.toHaveBeenCalled()
  })

  it('notes truncation when the roster exceeds the page cap', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(ok({
      data: [{ id: 'm1', personId: 'p1', name: 'A', status: 'active' }],
      totalCount: 150,
    } as any))
    const { result } = renderHook(() => useExportMembers('o1'))
    await act(async () => { await result.current.exportCsv() })
    expect(toast.success).toHaveBeenCalledWith('Exported the first 1 of 150 members')
  })
})
