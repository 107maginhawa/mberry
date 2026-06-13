/**
 * ChatRoomRepository correctness tests for Batch C.
 *
 * - FIX-014: messageCount must increment SQL-side (no read-then-write race) and
 *   the active-call slot must be claimed atomically (conditional UPDATE → 0 rows
 *   means another start won the race → ConflictError).
 * - FIX-013: listChatRooms delegates to findUserRoomsPage, which pushes the
 *   participant (AND) + context/status filters and pagination into SQL and
 *   returns the true total — not an in-memory slice-then-filter.
 *
 * Uses the make-ctx pristine-restore machinery so cross-file prototype pollution
 * (other comms test files raw-patch ChatRoomRepository.prototype) can't leak in.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { stubRepo, restoreRepo, ensurePristine } from '@/test-utils/make-ctx';
import { ChatRoomRepository } from './chatRoom.repo';
import { ConflictError } from '@/core/errors';

ensurePristine(ChatRoomRepository);

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

/** Minimal db whose update().set().where().returning() resolves to `returning`. */
function makeUpdateDb(returning: any[]) {
  const captured: { setArg: any } = { setArg: undefined };
  const db = {
    update: () => ({
      set: (s: any) => {
        captured.setArg = s;
        return { where: () => ({ returning: async () => returning }) };
      },
    }),
  } as any;
  return { db, captured };
}

describe('ChatRoomRepository.updateLastMessage (FIX-014 atomic count)', () => {
  afterEach(() => restoreRepo(ChatRoomRepository));

  test('increments messageCount SQL-side, without a read-then-write', async () => {
    let captured: any;
    const findOneById = mock(async () => {
      throw new Error('read-then-write: findOneById must not be called');
    });
    stubRepo(ChatRoomRepository, {
      updateOneById: async (_id: string, data: any) => { captured = data; return { id: 'room-1' }; },
      findOneById,
    });

    const repo = new ChatRoomRepository({} as any, noopLogger);
    await repo.updateLastMessage('room-1', new Date());

    expect(findOneById).not.toHaveBeenCalled();
    // messageCount is a drizzle SQL fragment (object), not a precomputed number.
    expect(typeof captured.messageCount).toBe('object');
    expect(typeof captured.messageCount).not.toBe('number');
  });
});

describe('ChatRoomRepository.setActiveVideoCall (FIX-014 atomic claim)', () => {
  afterEach(() => restoreRepo(ChatRoomRepository));

  test('claims the slot when the conditional UPDATE affects a row', async () => {
    const { db } = makeUpdateDb([{ id: 'room-1', activeVideoCallMessage: 'msg-1' }]);
    const repo = new ChatRoomRepository(db, noopLogger);
    const room = await repo.setActiveVideoCall('room-1', 'msg-1');
    expect((room as any).activeVideoCallMessage).toBe('msg-1');
  });

  test('throws ConflictError when the slot is already taken (0 rows affected)', async () => {
    const { db } = makeUpdateDb([]); // conditional UPDATE matched nothing
    const repo = new ChatRoomRepository(db, noopLogger);
    await expect(repo.setActiveVideoCall('room-1', 'msg-2')).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('ChatRoomRepository.findUserRoomsPage (FIX-013 SQL filter + paginate)', () => {
  afterEach(() => restoreRepo(ChatRoomRepository));

  test('builds AND-participant + context/status filters, passes pagination, returns the true total', async () => {
    let captured: any;
    stubRepo(ChatRoomRepository, {
      findManyWithPagination: async (filters: any, options: any) => {
        captured = { filters, options };
        return { data: [{ id: 'room-1' }], totalCount: 7 };
      },
    });

    const repo = new ChatRoomRepository({} as any, noopLogger);
    const res = await repo.findUserRoomsPage('user-1', {
      withParticipant: 'user-2',
      context: 'booking-9',
      status: 'active',
      limit: 10,
      offset: 20,
    });

    expect(res.totalCount).toBe(7);
    expect(res.data).toHaveLength(1);
    // Both the current user AND the requested participant are required (AND).
    expect(captured.filters.withParticipants).toEqual(['user-1', 'user-2']);
    expect(captured.filters.context).toBe('booking-9');
    expect(captured.filters.status).toBe('active');
    // Pagination runs server-side.
    expect(captured.options.pagination).toEqual({ limit: 10, offset: 20 });
  });

  test('omits the extra participant when only the current user is scoped', async () => {
    let captured: any;
    stubRepo(ChatRoomRepository, {
      findManyWithPagination: async (filters: any) => {
        captured = filters;
        return { data: [], totalCount: 0 };
      },
    });

    const repo = new ChatRoomRepository({} as any, noopLogger);
    await repo.findUserRoomsPage('user-1', { limit: 50, offset: 0 });

    expect(captured.withParticipants).toEqual(['user-1']);
  });

  // FIX-008 (G4 read-path): the caller org maps to the (org OR dm) filter key,
  // so the WHERE scopes non-DM rooms to the org while preserving DMs.
  // PD-2 (CONTINUE-48): rooms are org-scoped INCLUDING DMs — findUserRoomsPage
  // now maps the caller org to the STRICT `organizationId` filter (no DM exemption).
  test('maps caller org to the strict organizationId filter key (PD-2)', async () => {
    let captured: any;
    stubRepo(ChatRoomRepository, {
      findManyWithPagination: async (filters: any) => {
        captured = filters;
        return { data: [], totalCount: 0 };
      },
    });

    const repo = new ChatRoomRepository({} as any, noopLogger);
    await repo.findUserRoomsPage('user-1', { organizationId: 'org-9', limit: 50, offset: 0 });

    expect(captured.organizationId).toBe('org-9');
    expect(captured.organizationIdOrDm).toBeUndefined();
  });

  // FIX-008: buildWhereConditions emits a clause for the org-or-dm filter.
  test('buildWhereConditions includes an org-or-dm clause (FIX-008)', () => {
    const repo = new ChatRoomRepository({} as any, noopLogger);
    const where = (repo as any).buildWhereConditions({ organizationIdOrDm: 'org-9' });
    expect(where).toBeDefined();
  });
});
