import type { ValidatedContext } from '@/types/app';
import type { GetChatRoomParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { 
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { ChatRoomRepository } from './repos/chatRoom.repo';
import { ChatRoomMemberRepository } from './repos/chatRoomMember.repo';

/**
 * getChatRoom
 * 
 * Path: GET /comms/chat-rooms/{room}
 * OperationId: getChatRoom
 * 
 * Get specific chat room (only accessible to participants)
 */
export async function getChatRoom(
  ctx: ValidatedContext<never, never, GetChatRoomParams>
): Promise<Response> {
  // Get authenticated user from Better-Auth
  const user = ctx.get('user') as User;

  if (!user.id) {
    throw new ValidationError('Valid user ID required');
  }
  
  // Extract validated parameters
  const params = ctx.req.valid('param') as { room: string };
  
  if (!params.room) {
    throw new ValidationError('Room ID is required');
  }
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'comms' }) ?? baseLogger;

  // Authorization uses Person ID directly (no profile lookups needed)

  // Instantiate repository
  const repo = new ChatRoomRepository(db, logger);

  // Find the chat room
  const room = await repo.findOneById(params.room);

  if (!room) {
    throw new NotFoundError('Chat room not found', {
      resourceType: 'chat-room',
      resource: params.room,
      suggestions: ['Check chat room ID format', 'Verify chat room exists']
    });
  }

  // FIX-008 (G4 read-path): tenant isolation for org-scoped rooms. A caller
  // whose active org context differs from the room's org must not read a
  // channel/group/booking room — defense-in-depth beyond the (possibly stale)
  // participant arrays. DM rooms are org-agnostic by design (PD-2 gated): the
  // org guard is skipped for them and participant access still governs. orgId is
  // derived from ctx.get('organizationId') (set by orgContextOptionalMiddleware)
  // — module-local, no shared middleware change.
  const callerOrgId = ctx.get('organizationId') as string | undefined;
  if (room.roomType !== 'dm' && callerOrgId && callerOrgId !== room.organizationId) {
    throw new ForbiddenError('Access denied: chat room belongs to a different organization');
  }

  // Security check: user must be a participant in the room (using Person ID).
  // FIX-007 (G5): honor BOTH the legacy JSONB `participants` array AND the
  // `chat_room_member` join table, so a member tracked only in the join table
  // is not wrongly denied. Compatibility OR-shim — JSONB stays canonical; the
  // `||` short-circuits, so the join-table query only runs when JSONB misses.
  const memberRepo = new ChatRoomMemberRepository(db, logger);
  const isParticipant =
    room.participants.includes(user.id) ||
    (await memberRepo.isMember(params.room, user.id));

  if (!isParticipant) {
    throw new ForbiddenError('Access denied: not a participant in this chat room');
  }
  
  // Log audit trail
  logger?.info({
    userId: user.id,
    roomId: params.room,
    action: 'get_chat_room'
  }, 'Chat room accessed successfully');
  
  return ctx.json(room, 200);
}