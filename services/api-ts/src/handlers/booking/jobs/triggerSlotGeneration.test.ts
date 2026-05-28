/**
 * Tests for triggerSlotGeneration job utility
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// --- Mock BookingEventRepository ---
const mockFindActiveEventsByOwner = mock(async (_ownerId: string) => [
  { id: 'event-1', owner: 'owner-1', status: 'active' },
  { id: 'event-2', owner: 'owner-1', status: 'active' },
]);

const mockFindMany = mock(async (_filters?: any) => [
  { id: 'event-A', owner: 'owner-1', status: 'active' },
  { id: 'event-B', owner: 'owner-2', status: 'active' },
  { id: 'event-C', owner: 'owner-3', status: 'active' },
]);

mock.module('../repos/bookingEvent.repo', () => ({
  BookingEventRepository: class {
    findActiveEventsByOwner = mockFindActiveEventsByOwner;
    findMany = mockFindMany;
  },
}));

// --- Mock regenerateEventSlots ---
const mockRegenerateEventSlots = mock(async (_db: any, _eventId: string) => {});

mock.module('./slotGenerator', () => ({
  regenerateEventSlots: mockRegenerateEventSlots,
  slotGeneratorJob: mock(async () => {}),
}));

// Import after mocks are set up
const { triggerSlotGeneration } = await import('./index');

const fakeDb = {} as any;

describe('triggerSlotGeneration', () => {
  beforeEach(() => {
    mockFindActiveEventsByOwner.mockClear();
    mockFindMany.mockClear();
    mockRegenerateEventSlots.mockClear();
  });

  it('with ownerId: calls findActiveEventsByOwner and regenerates each event', async () => {
    await triggerSlotGeneration(fakeDb, 'owner-1');

    expect(mockFindActiveEventsByOwner).toHaveBeenCalledTimes(1);
    expect(mockFindActiveEventsByOwner).toHaveBeenCalledWith('owner-1');
    expect(mockFindMany).not.toHaveBeenCalled();

    expect(mockRegenerateEventSlots).toHaveBeenCalledTimes(2);
    expect(mockRegenerateEventSlots).toHaveBeenCalledWith(fakeDb, 'event-1');
    expect(mockRegenerateEventSlots).toHaveBeenCalledWith(fakeDb, 'event-2');
  });

  it('without ownerId: calls findMany with active status and regenerates each event', async () => {
    await triggerSlotGeneration(fakeDb);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({ status: 'active' });
    expect(mockFindActiveEventsByOwner).not.toHaveBeenCalled();

    expect(mockRegenerateEventSlots).toHaveBeenCalledTimes(3);
    expect(mockRegenerateEventSlots).toHaveBeenCalledWith(fakeDb, 'event-A');
    expect(mockRegenerateEventSlots).toHaveBeenCalledWith(fakeDb, 'event-B');
    expect(mockRegenerateEventSlots).toHaveBeenCalledWith(fakeDb, 'event-C');
  });

  it('with ownerId: handles zero active events gracefully', async () => {
    mockFindActiveEventsByOwner.mockImplementationOnce(async () => []);

    await triggerSlotGeneration(fakeDb, 'owner-empty');

    expect(mockFindActiveEventsByOwner).toHaveBeenCalledTimes(1);
    expect(mockRegenerateEventSlots).not.toHaveBeenCalled();
  });
});
