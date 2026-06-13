import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// SDK exports are globally stubbed (test-setup-root.ts) as jest.fn() factories;
// we prime them per-test via mockReturnValue / mockImplementation.
import {
  createChatRoomMutation,
  listRosterMembersOptions,
} from '@monobase/sdk-ts/generated/react-query'
// SUT — first-party static import so the Confidence scanner detects SUT binding.
import { DmMemberPicker, buildDmCreateBody } from '../components/dm-member-picker'

// Roster fixture: one colleague + self. Self (p-me) must be excluded from the picker.
const MEMBERS = [
  { id: 'm1', personId: 'p-them', memberNumber: 'M-200' },
  { id: 'm2', personId: 'p-me', memberNumber: 'M-100' },
]

vi.mock('lucide-react', () => ({
  MessageCircle: () => <span>icon</span>,
  Search: () => <span>search</span>,
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// Real generated shape: createChatRoomMutation() → { mutationFn }; useMutation
// invokes mutationFn with the `.mutate()` variables ({ body }).
const mutationFn = vi.fn(async () => ({ id: 'dm-room-1' }))

beforeEach(() => {
  mutationFn.mockClear()
  ;(createChatRoomMutation as any).mockReturnValue({ mutationFn })
  ;(listRosterMembersOptions as any).mockImplementation((opts: any) => ({
    queryKey: ['listRosterMembers', opts?.query?.q ?? ''],
    queryFn: async () => ({ data: MEMBERS }),
  }))
})

describe('buildDmCreateBody (FIX-006 payload)', () => {
  test('emits a valid dm payload: roomType=dm, org-scoped, both participants, upsert', () => {
    const body = buildDmCreateBody('p-me', 'p-them', 'org-1')
    expect(body.roomType).toBe('dm')
    expect(body.organizationId).toBe('org-1')
    expect(body.participants).toEqual(['p-me', 'p-them'])
    // dedup re-open: upsert returns the existing DM instead of erroring
    expect(body.upsert).toBe(true)
    // no fake `context: "channel:x"`-style hack
    expect('context' in body).toBe(false)
  })

  test('excludes duplicate participants', () => {
    const body = buildDmCreateBody('p-me', 'p-me', 'org-1')
    expect(body.participants).toEqual(['p-me'])
  })
})

describe('DmMemberPicker → createChatRoom mutation', () => {
  test('selecting a colleague creates a dm with the valid body and opens it', async () => {
    const onCreated = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <DmMemberPicker
        open
        onOpenChange={onOpenChange}
        onCreated={onCreated}
        orgId="org-1"
        myPersonId="p-me"
      />,
      { wrapper },
    )

    // Type a search term (>= 2 chars) to trigger the roster query.
    const searchInput = screen.getByLabelText(/search members/i)
    fireEvent.change(searchInput, { target: { value: 'M-2' } })

    // The colleague appears; self (p-me) is filtered out.
    const memberBtn = await waitFor(() => screen.getByRole('button', { name: /M-200/ }), {
      timeout: 2000,
    })
    expect(screen.queryByRole('button', { name: /M-100/ })).toBeNull()

    fireEvent.click(memberBtn)

    // Real mutation shape: useMutation calls mutationFn(variables, context);
    // assert the variables (first arg) carry the valid dm body.
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1))
    expect(mutationFn.mock.calls[0][0]).toEqual({
      body: {
        roomType: 'dm',
        organizationId: 'org-1',
        participants: ['p-me', 'p-them'],
        upsert: true,
      },
    })

    // On success the new room opens and the dialog closes.
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('dm-room-1'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
