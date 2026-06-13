import { describe, test, expect, vi } from '@/test/vitest-shim'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// SUT — static first-party import (Confidence scanner reads top-of-file)
import { MessageSearch } from '../components/message-search'

// FIX-016: MessageSearch had zero consumers. These tests prove (1) the component
// renders and actually queries the search endpoint, and (2) the member messages
// page now mounts it (a source guard that goes RED if the mount is reverted).

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

const mockGet = vi.fn(async () => ({ data: [] }))
vi.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mockGet(...args) },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('MessageSearch (FIX-016)', () => {
  test('renders the search panel', () => {
    render(<MessageSearch orgId="org-1" onClose={() => {}} />, { wrapper })
    expect(screen.getByText('Search Messages')).toBeDefined()
    expect(screen.getByPlaceholderText('Search messages...')).toBeDefined()
  })

  test('queries the search endpoint after typing ≥2 characters', async () => {
    mockGet.mockClear()
    render(<MessageSearch orgId="org-1" onClose={() => {}} />, { wrapper })

    fireEvent.change(screen.getByPlaceholderText('Search messages...'), {
      target: { value: 'hello' },
    })

    await waitFor(() => expect(mockGet).toHaveBeenCalled(), { timeout: 2000 })
    const calledPath = mockGet.mock.calls[0][0] as string
    expect(calledPath).toContain('/api/comms/messages/search')
    expect(calledPath).toContain('q=hello')
  })
})

describe('Messages page mounts MessageSearch (FIX-016)', () => {
  // Source guard (mirrors the Batch B vite-ws-proxy config-presence test): the
  // member messages page must import and render MessageSearch. Goes RED if the
  // mount is removed, without needing to render the TanStack route in isolation.
  const pagePath = join(
    import.meta.dir,
    '../../../routes/_authenticated/org/$orgSlug/messages/index.tsx',
  )
  const source = readFileSync(pagePath, 'utf8')

  test('imports MessageSearch', () => {
    expect(source).toContain("from '@/features/comms/components/message-search'")
  })

  test('renders <MessageSearch', () => {
    expect(source).toContain('<MessageSearch')
  })
})
