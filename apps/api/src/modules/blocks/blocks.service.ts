import {
  IBlocksRepository,
  BlockStatusResponse,
  BlockUserResponse,
  BlockedUsersResponse,
  BlockedUserSummary,
  BlockWithBlockedUser,
} from './blocks.types.js';
import { IAuthRepository } from '../auth/auth.repository.js';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';

export class BlocksService {
  constructor(
    private readonly repository: IBlocksRepository,
    private readonly authRepository: IAuthRepository,
  ) {}

  private toBlockedUserSummary(item: BlockWithBlockedUser): BlockedUserSummary {
    return {
      id: item.id,
      userId: item.blockedUserId,
      username: item.blockedUser.profile?.username || 'user',
      displayName: item.blockedUser.profile?.displayName || 'VibeMint User',
      avatarUrl: item.blockedUser.profile?.avatarUrl ?? null,
      blockedAt: item.createdAt.toISOString(),
    };
  }

  /**
   * Blocks a user, cleanly removes reciprocal follow relationships, and prevents further interactions.
   */
  async blockUser(blockerId: string, targetUserId: string): Promise<BlockUserResponse> {
    if (blockerId === targetUserId) {
      throw new BadRequestError('You cannot block yourself');
    }

    const targetUser = await this.authRepository.findUserById(targetUserId);
    if (!targetUser || targetUser.status !== 'ACTIVE') {
      throw new NotFoundError('User not found');
    }

    await this.repository.createBlock(blockerId, targetUserId);

    return {
      userId: targetUserId,
      isBlocked: true,
      message: 'User blocked successfully',
    };
  }

  /**
   * Unblocks a user idempotently. Does not retroactively restore previously removed follows.
   */
  async unblockUser(blockerId: string, targetUserId: string): Promise<BlockUserResponse> {
    if (blockerId === targetUserId) {
      throw new BadRequestError('You cannot unblock yourself');
    }

    await this.repository.deleteBlock(blockerId, targetUserId);

    return {
      userId: targetUserId,
      isBlocked: false,
      message: 'User unblocked successfully',
    };
  }

  /**
   * Returns relationship block state for the authenticated viewer.
   */
  async getBlockStatus(
    viewerUserId: string | undefined,
    targetUserId: string,
  ): Promise<BlockStatusResponse> {
    if (!viewerUserId || viewerUserId === targetUserId) {
      return {
        userId: targetUserId,
        isBlockedByViewer: false,
        hasBlockedViewer: false,
        isBlocked: false,
      };
    }

    const [isBlockedByViewer, hasBlockedViewer] = await Promise.all([
      this.repository.isBlocked(viewerUserId, targetUserId),
      this.repository.isBlocked(targetUserId, viewerUserId),
    ]);

    return {
      userId: targetUserId,
      isBlockedByViewer,
      hasBlockedViewer,
      isBlocked: isBlockedByViewer || hasBlockedViewer,
    };
  }

  /**
   * Lists blocked users with cursor pagination for the authenticated user.
   */
  async getBlockedUsers(
    blockerId: string,
    cursor?: string,
    rawLimit?: unknown,
  ): Promise<BlockedUsersResponse> {
    const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 50);
    const items = await this.repository.getBlockedUsers(blockerId, cursor, limit);

    const hasMore = items.length > limit;
    const trimmed = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null;

    return {
      blockedUsers: trimmed.map((b) => this.toBlockedUserSummary(b)),
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Helper to check whether either user has blocked the other.
   */
  async isBlockedEither(userA: string, userB: string): Promise<boolean> {
    return this.repository.isBlockedEither(userA, userB);
  }
}
