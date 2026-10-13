import { Follow, FollowStatus, User, Profile } from '@prisma/client';
import type {
  FollowRelationshipStatus,
  FollowStatusResponse,
  FollowUserSummary,
  FollowListPagination,
  FollowersResponse,
  FollowingResponse,
  FollowRequestItem,
  FollowRequestsResponse,
} from '@vibemint/types';

export type {
  FollowRelationshipStatus,
  FollowStatusResponse,
  FollowUserSummary,
  FollowListPagination,
  FollowersResponse,
  FollowingResponse,
  FollowRequestItem,
  FollowRequestsResponse,
};

export interface FollowWithFollowerUser extends Follow {
  follower: User & { profile: Profile | null };
}

export interface FollowWithFollowingUser extends Follow {
  following: User & { profile: Profile | null };
}

export interface IFollowsRepository {
  createFollow(followerId: string, followingId: string, status: FollowStatus): Promise<Follow>;
  findFollow(followerId: string, followingId: string): Promise<Follow | null>;
  updateFollowStatus(
    followerId: string,
    followingId: string,
    status: FollowStatus,
  ): Promise<Follow>;
  deleteFollow(followerId: string, followingId: string): Promise<boolean>;
  getFollowers(userId: string, cursor?: string, limit?: number): Promise<FollowWithFollowerUser[]>;
  getFollowing(userId: string, cursor?: string, limit?: number): Promise<FollowWithFollowingUser[]>;
  getFollowRequests(
    userId: string,
    cursor?: string,
    limit?: number,
  ): Promise<FollowWithFollowerUser[]>;
  getFollowerCount(userId: string): Promise<number>;
  getFollowingCount(userId: string): Promise<number>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
}
