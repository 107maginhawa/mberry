/**
 * Tests for ChatMessageRepository organization scoping (FIX-008).
 *
 * Every message-create path must persist a non-null organization_id. The WS
 * chat path (ws.chat-room.ts) calls createTextMessage WITHOUT an org, which
 * previously inserted NULL (the `organizationId!` lie). The repo now derives
 * the org from the message's room row when a caller omits it — closing the
 * leak at the chokepoint and making the FIX-010 SET NOT NULL migration safe.
 *
 * Uses the make-ctx pristine-restore machinery so cross-file prototype
 * pollution (other comms test files raw-patch ChatMessageRepository.prototype)
 * cannot leak into these assertions.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { stubRepo, restoreRepo, ensurePristine } from '@/test-utils/make-ctx';
import { ChatMessageRepository } from './chatMessage.repo';

// Capture the clean prototype at module load (before any test body patches it).
ensurePristine(ChatMessageRepository);

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

/** Mock db whose room lookup resolves to a room carrying `roomOrg` (or no row when null). */
function makeDb(roomOrg: string | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (roomOrg === null ? [] : [{ organizationId: roomOrg }]),
        }),
      }),
    }),
  } as any;
}

describe('ChatMessageRepository org scoping (FIX-008)', () => {
  let captured: any = null;

  beforeEach(() => {
    restoreRepo(ChatMessageRepository); // undo any cross-file prototype pollution
    captured = null;
    stubRepo(ChatMessageRepository, {
      createOne: async (data: any) => { captured = data; return { ...data, id: 'msg-1' }; },
    });
  });

  afterEach(() => {
    restoreRepo(ChatMessageRepository);
    captured = null;
  });

  test('createTextMessage derives organizationId from the room when the caller omits it (WS path)', async () => {
    const repo = new ChatMessageRepository(makeDb('org-from-room'), noopLogger);
    await repo.createTextMessage('room-1', 'sender-1', 'hello'); // no org — the WS leak
    expect(captured.organizationId).toBe('org-from-room');
  });

  test('createTextMessage uses the caller-provided organizationId (no room lookup needed)', async () => {
    // Room lookup would return [] (and throw) if used — proving explicit org short-circuits it.
    const repo = new ChatMessageRepository(makeDb(null), noopLogger);
    await repo.createTextMessage('room-1', 'sender-1', 'hello', 'org-explicit');
    expect(captured.organizationId).toBe('org-explicit');
  });

  test('createSystemMessage derives organizationId from the room when omitted', async () => {
    const repo = new ChatMessageRepository(makeDb('org-sys'), noopLogger);
    await repo.createSystemMessage('room-1', 'call ended', 'user-1');
    expect(captured.organizationId).toBe('org-sys');
  });

  test('createVideoCallMessage derives organizationId from the room when omitted', async () => {
    const repo = new ChatMessageRepository(makeDb('org-vid'), noopLogger);
    await repo.createVideoCallMessage('room-1', 'sender-1', { participants: ['sender-1'] } as any);
    expect(captured.organizationId).toBe('org-vid');
  });
});
