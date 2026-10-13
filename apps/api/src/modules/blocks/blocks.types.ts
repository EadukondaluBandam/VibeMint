import { Block, User, Profile } from '@prisma/client';
import type {
  BlockStatusResponse,
  BlockUserResponse,
  BlockedUserSummary,
  BlockedUsersPagination,
  BlockedUsersResponse,
} from '@vibemint/types';

export type {
  BlockStatusResponse,
  BlockUserResponse,
  BlockedUserSummary,
  BlockedUsersPagination,
  BlockedUsersResponse,
};

export interface BlockWithBlockedUser extends Block {
  blockedUser: User & { profile: Profile | null };
}

export interface IBlocksRepository {
  createBlock(blockerId: string, blockedUserId: string): Promise<Block>;
  deleteBlock(blockerId: string, blockedUserId: string): Promise<boolean>;
  findBlock(blockerId: string, blockedUserId: string): Promise<Block | null>;
  isBlocked(blockerId: string, blockedUserId: string): Promise<boolean>;
  isBlockedEither(userA: string, userB: string): Promise<boolean>;
  getBlockedUserIds(userId: string): Promise<string[]>;
  getBlockedAndBlockerUserIds(
    userId: string,
  ): Promise<{ blockedUserIds: string[]; blockerUserIds: string[] }>;
  getBlockedUsers(
    blockerId: string,
    cursor?: string,
    limit?: number,
  ): Promise<BlockWithBlockedUser[]>;
  cleanupFollowsBetween(userA: string, userB: string): Promise<number>;
}
