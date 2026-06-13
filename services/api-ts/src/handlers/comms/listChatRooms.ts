import type { ValidatedContext } from '@/types/app';
import type { ListChatRoomsQuery } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { 
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { ChatRoomRepository } from './repos/chatRoom.repo';
import { buildPaginationMeta } from '@/utils/query';

/**
 * listChatRooms
 * 
 * Path: GET /comms/chat-rooms
 * OperationId: listChatRooms
 * 
 * Lists user's chat rooms with optional filtering
 */
export async function listChatRooms(
  ctx: ValidatedContext<never, ListChatRoomsQuery, never>
): Promise<Response> {
  // Get authenticated user from Better-Auth
  const user = ctx.get('user') as User;

  if (!user.id) {
    throw new ValidationError('Valid user ID required');
  }
  
  // Extract validated query parameters
  const query = ctx.req.valid('query') as {
    status?: 'active' | 'archived';
    context?: string;
    withParticipant?: string;
    hasActiveCall?: boolean;
    page?: number;
    pageSize?: number;
    offset?: number;
    limit?: number;
  };
  
  // Get dependencies from context for authorization check
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'comms' }) ?? baseLogger;

  // Authorization uses Person ID directly (no profile lookups needed)

  // Instantiate repository
  const repo = new ChatRoomRepository(db, logger);

  // Build pagination options
  const page = query.page || 1;
  const pageSize = query.pageSize || query.limit || 50;
  const offset = query.offset || (page - 1) * pageSize;

  // FIX-013: push status/context/withParticipant filtering AND pagination into
  // SQL. The previous handler sliced an unbounded in-memory list and applied the
  // context/withParticipant filters AFTER the slice, so a matching room on a
  // later page disappeared (broke booking-chat lookup by context). The repo now
  // builds every filter into the WHERE clause and returns the true total.
  // FIX-008 (G4 read-path): when the caller's org context is known, scope the
  // listing to that org's non-DM rooms while preserving DMs (org-agnostic,
  // PD-2). orgId from ctx.get('organizationId'); module-local.
  const callerOrgId = ctx.get('organizationId') as string | undefined;

  const { data: finalRooms, totalCount } = await repo.findUserRoomsPage(user.id, {
    status: query.status,
    context: query.context,
    withParticipant: query.withParticipant,
    hasActiveCall: query.hasActiveCall,
    organizationId: callerOrgId,
    limit: pageSize,
    offset
  });

  // Log audit trail
  logger?.info({
    userId: user.id,
    filters: {
      status: query.status,
      context: query.context,
      withParticipant: query.withParticipant,
      hasActiveCall: query.hasActiveCall
    },
    resultCount: finalRooms.length,
    totalCount,
    action: 'list_chat_rooms'
  }, 'Chat rooms listed successfully');

  // Return paginated response matching TypeSpec definition
  return ctx.json({
    data: finalRooms,
    pagination: buildPaginationMeta(finalRooms, totalCount, pageSize, offset)
  }, 200);
}