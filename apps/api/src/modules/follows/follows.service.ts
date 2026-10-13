import {
  IFollowsRepository,
  FollowStatusResponse,
  FollowersResponse,
  FollowingResponse,
  FollowRequestsResponse,
  FollowUserSummary,
} from './follows.types.js';
import { IAuthRepository } from '../auth/auth.repository.js';
import { IProfileRepository } from '../profiles/profiles.repository.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { IBlocksRepository } from '../blocks/blocks.types.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../errors/app-error.js';
import { User, Profile } from '@prisma/client';

export class FollowsService {
  constructor(
    private readonly repository: IFollowsRepository,
    private readonly authRepository: IAuthRepository,
    private readonly profileRepository: IProfileRepository,
    private readonly notificationsService?: NotificationsService | null,
    private readonly blocksRepository?: IBlocksRepository | null,
  ) {}

  private toFollowUserSummary(
    user: User & { profile: Profile | null },
    createdAt: Date,
  ): FollowUserSummary {
    return {
      id: user.id,
      userId: user.id,
      username: user.profile?.username || 'anonymous',
      displayName: user.profile?.displayName || 'VibeMint User',
      avatarUrl: user.profile?.avatarUrl ?? null,
      bio: user.profile?.bio ?? null,
      createdAt: createdAt.toISOString(),
    };
  }

  /**
   * Follows a target user or creates a pending follow request for private profiles.
   */
  async followUser(followerId: string, targetUserId: string): Promise<FollowStatusResponse> {
    if (followerId === targetUserId) {
      throw new BadRequestError('You cannot follow yourself');
    }

    const targetUser = await this.authRepository.findUserById(targetUserId);
    if (!targetUser || targetUser.status !== 'ACTIVE') {
      throw new NotFoundError('User not found');
    }

    if (
      this.blocksRepository &&
      (await this.blocksRepository.isBlockedEither(followerId, targetUserId))
    ) {
      throw new ForbiddenError('Cannot follow a blocked user');
    }

    const targetProfile = await this.profileRepository.findProfileByUserId(targetUserId);
    const isPrivate = targetProfile?.profileVisibility === 'PRIVATE';
    const desiredStatus = isPrivate ? 'PENDING' : 'ACCEPTED';

    const existing = await this.repository.findFollow(followerId, targetUserId);
    if (existing) {
      return {
        userId: targetUserId,
        status: existing.status === 'ACCEPTED' ? 'FOLLOWING' : 'PENDING',
        isFollowing: existing.status === 'ACCEPTED',
        isPending: existing.status === 'PENDING',
      };
    }

    const follow = await this.repository.createFollow(followerId, targetUserId, desiredStatus);

    if (this.notificationsService) {
      try {
        if (desiredStatus === 'ACCEPTED') {
          await this.notificationsService.createNotification({
            recipientId: targetUserId,
            actorId: followerId,
            type: 'NEW_FOLLOWER',
            resourceType: 'USER',
            resourceId: followerId,
          });
        } else {
          await this.notificationsService.createNotification({
            recipientId: targetUserId,
            actorId: followerId,
            type: 'FOLLOW_REQUEST_RECEIVED',
            resourceType: 'FOLLOW_REQUEST',
            resourceId: followerId,
          });
        }
      } catch {
        // Silently proceed on notification error
      }
    }

    return {
      userId: targetUserId,
      status: follow.status === 'ACCEPTED' ? 'FOLLOWING' : 'PENDING',
      isFollowing: follow.status === 'ACCEPTED',
      isPending: follow.status === 'PENDING',
    };
  }

  /**
   * Unfollows a user or cancels a pending follow request.
   */
  async unfollowUser(followerId: string, targetUserId: string): Promise<FollowStatusResponse> {
    if (followerId === targetUserId) {
      throw new BadRequestError('You cannot unfollow yourself');
    }

    await this.repository.deleteFollow(followerId, targetUserId);
    return {
      userId: targetUserId,
      status: 'NOT_FOLLOWING',
      isFollowing: false,
      isPending: false,
    };
  }

  /**
   * Returns follow relationship state between authenticated viewer and target user.
   */
  async getFollowStatus(
    viewerUserId: string | undefined,
    targetUserId: string,
  ): Promise<FollowStatusResponse> {
    const targetUser = await this.authRepository.findUserById(targetUserId);
    if (!targetUser || targetUser.status !== 'ACTIVE') {
      throw new NotFoundError('User not found');
    }

    if (!viewerUserId) {
      return {
        userId: targetUserId,
        status: 'NOT_FOLLOWING',
        isFollowing: false,
        isPending: false,
      };
    }

    if (viewerUserId === targetUserId) {
      return {
        userId: targetUserId,
        status: 'SELF',
        isFollowing: false,
        isPending: false,
      };
    }

    if (
      viewerUserId &&
      this.blocksRepository &&
      (await this.blocksRepository.isBlockedEither(viewerUserId, targetUserId))
    ) {
      return {
        userId: targetUserId,
        status: 'NOT_FOLLOWING',
        isFollowing: false,
        isPending: false,
      };
    }

    const follow = await this.repository.findFollow(viewerUserId, targetUserId);
    if (!follow) {
      return {
        userId: targetUserId,
        status: 'NOT_FOLLOWING',
        isFollowing: false,
        isPending: false,
      };
    }

    return {
      userId: targetUserId,
      status: follow.status === 'ACCEPTED' ? 'FOLLOWING' : 'PENDING',
      isFollowing: follow.status === 'ACCEPTED',
      isPending: follow.status === 'PENDING',
    };
  }

  /**
   * Retrieves paginated followers for a user.
   * Enforces privacy: private accounts only accessible to owner or accepted followers.
   */
  async getFollowers(
    targetUserId: string,
    viewerUserId?: string,
    cursor?: string,
    rawLimit?: unknown,
  ): Promise<FollowersResponse> {
    const targetUser = await this.authRepository.findUserById(targetUserId);
    if (!targetUser || targetUser.status !== 'ACTIVE') {
      throw new NotFoundError('User not found');
    }

    if (
      viewerUserId &&
      this.blocksRepository &&
      (await this.blocksRepository.isBlockedEither(viewerUserId, targetUserId))
    ) {
      throw new ForbiddenError('This account is not accessible');
    }

    const targetProfile = await this.profileRepository.findProfileByUserId(targetUserId);
    const isPrivate = targetProfile?.profileVisibility === 'PRIVATE';
    const isOwner = Boolean(viewerUserId && viewerUserId === targetUserId);

    let isAcceptedFollower = false;
    if (viewerUserId && !isOwner) {
      isAcceptedFollower = await this.repository.isFollowing(viewerUserId, targetUserId);
    }

    if (isPrivate && !isOwner && !isAcceptedFollower) {
      throw new ForbiddenError('This account is private');
    }

    const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 50);
    const follows = await this.repository.getFollowers(targetUserId, cursor, limit);

    const hasMore = follows.length > limit;
    const trimmed = hasMore ? follows.slice(0, limit) : follows;
    const nextCursor = hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null;

    return {
      followers: trimmed.map((f) => this.toFollowUserSummary(f.follower, f.createdAt)),
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Retrieves paginated following list for a user.
   * Enforces privacy: private accounts only accessible to owner or accepted followers.
   */
  async getFollowing(
    targetUserId: string,
    viewerUserId?: string,
    cursor?: string,
    rawLimit?: unknown,
  ): Promise<FollowingResponse> {
    const targetUser = await this.authRepository.findUserById(targetUserId);
    if (!targetUser || targetUser.status !== 'ACTIVE') {
      throw new NotFoundError('User not found');
    }

    if (
      viewerUserId &&
      this.blocksRepository &&
      (await this.blocksRepository.isBlockedEither(viewerUserId, targetUserId))
    ) {
      throw new ForbiddenError('This account is not accessible');
    }

    const targetProfile = await this.profileRepository.findProfileByUserId(targetUserId);
    const isPrivate = targetProfile?.profileVisibility === 'PRIVATE';
    const isOwner = Boolean(viewerUserId && viewerUserId === targetUserId);

    let isAcceptedFollower = false;
    if (viewerUserId && !isOwner) {
      isAcceptedFollower = await this.repository.isFollowing(viewerUserId, targetUserId);
    }

    if (isPrivate && !isOwner && !isAcceptedFollower) {
      throw new ForbiddenError('This account is private');
    }

    const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 50);
    const follows = await this.repository.getFollowing(targetUserId, cursor, limit);

    const hasMore = follows.length > limit;
    const trimmed = hasMore ? follows.slice(0, limit) : follows;
    const nextCursor = hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null;

    return {
      following: trimmed.map((f) => this.toFollowUserSummary(f.following, f.createdAt)),
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Retrieves incoming follow requests for the authenticated user.
   */
  async getFollowRequests(
    userId: string,
    cursor?: string,
    rawLimit?: unknown,
  ): Promise<FollowRequestsResponse> {
    const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 50);
    const follows = await this.repository.getFollowRequests(userId, cursor, limit);

    const hasMore = follows.length > limit;
    const trimmed = hasMore ? follows.slice(0, limit) : follows;
    const nextCursor = hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null;

    return {
      requests: trimmed.map((f) => ({
        id: f.id,
        followerId: f.followerId,
        follower: this.toFollowUserSummary(f.follower, f.createdAt),
        createdAt: f.createdAt.toISOString(),
      })),
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Accepts a pending follow request.
   */
  async acceptFollowRequest(userId: string, followerId: string): Promise<FollowStatusResponse> {
    const follow = await this.repository.findFollow(followerId, userId);
    if (!follow || follow.status !== 'PENDING') {
      throw new NotFoundError('Follow request not found');
    }

    if (
      this.blocksRepository &&
      (await this.blocksRepository.isBlockedEither(userId, followerId))
    ) {
      throw new ForbiddenError('Cannot accept follow request from a blocked user');
    }

    await this.repository.updateFollowStatus(followerId, userId, 'ACCEPTED');

    if (this.notificationsService) {
      try {
        await this.notificationsService.createNotification({
          recipientId: followerId,
          actorId: userId,
          type: 'FOLLOW_REQUEST_ACCEPTED',
          resourceType: 'USER',
          resourceId: userId,
        });
      } catch {
        // Silently proceed on notification error
      }
    }

    return {
      userId: followerId,
      status: 'FOLLOWING',
      isFollowing: true,
      isPending: false,
    };
  }

  /**
   * Rejects/cancels a pending follow request.
   */
  async rejectFollowRequest(userId: string, followerId: string): Promise<void> {
    const follow = await this.repository.findFollow(followerId, userId);
    if (!follow) {
      throw new NotFoundError('Follow request not found');
    }

    await this.repository.deleteFollow(followerId, userId);
  }

  /**
   * Retrieves follower count.
   */
  async getFollowerCount(userId: string): Promise<number> {
    return this.repository.getFollowerCount(userId);
  }

  /**
   * Retrieves following count.
   */
  async getFollowingCount(userId: string): Promise<number> {
    return this.repository.getFollowingCount(userId);
  }
}
