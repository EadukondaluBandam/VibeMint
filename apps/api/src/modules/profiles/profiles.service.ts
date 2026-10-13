import { Profile } from '@prisma/client';
import { IProfileRepository } from './profiles.repository.js';
import {
  FullProfileResponse,
  PublicProfileResponse,
  CreateOrUpdateProfileData,
  UsernameAvailabilityResult,
} from './profiles.types.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../errors/app-error.js';
import { isValidUsername, normalizeUsername } from './profiles.schema.js';
import { IFollowsRepository } from '../follows/follows.types.js';
import { IBlocksRepository } from '../blocks/blocks.types.js';
import type { FollowRelationshipStatus } from '@vibemint/types';
import type { MediaService } from '../media/media.service.js';

export class ProfilesService {
  constructor(
    private readonly repository: IProfileRepository,
    private readonly followsRepository?: IFollowsRepository,
    private readonly blocksRepository?: IBlocksRepository,
    private readonly mediaService?: MediaService | null,
  ) {}

  async toFullProfile(profile: Profile): Promise<FullProfileResponse> {
    let followerCount = 0;
    let followingCount = 0;

    if (this.followsRepository) {
      followerCount = await this.followsRepository.getFollowerCount(profile.userId);
      followingCount = await this.followsRepository.getFollowingCount(profile.userId);
    }

    return {
      id: profile.id,
      userId: profile.userId,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      coverImageUrl: profile.coverImageUrl,
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString() : null,
      gender: profile.gender,
      location: profile.location,
      profileVisibility: profile.profileVisibility,
      followerCount,
      followingCount,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  async toPublicProfile(profile: Profile, viewerUserId?: string): Promise<PublicProfileResponse> {
    const isOwner = Boolean(viewerUserId && viewerUserId === profile.userId);
    const isPrivate = profile.profileVisibility === 'PRIVATE';

    let followStatus: FollowRelationshipStatus = 'NOT_FOLLOWING';
    let isAcceptedFollower = false;

    if (viewerUserId && this.followsRepository) {
      if (viewerUserId === profile.userId) {
        followStatus = 'SELF';
      } else {
        const follow = await this.followsRepository.findFollow(viewerUserId, profile.userId);
        if (follow) {
          followStatus = follow.status === 'ACCEPTED' ? 'FOLLOWING' : 'PENDING';
          isAcceptedFollower = follow.status === 'ACCEPTED';
        }
      }
    }

    let isBlocked = false;
    let isBlockedByViewer = false;
    if (viewerUserId && this.blocksRepository) {
      isBlockedByViewer = await this.blocksRepository.isBlocked(viewerUserId, profile.userId);
      const hasBlockedViewer = await this.blocksRepository.isBlocked(profile.userId, viewerUserId);
      isBlocked = isBlockedByViewer || hasBlockedViewer;
    }

    if (isBlocked) {
      return {
        id: profile.id,
        userId: profile.userId,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        profileVisibility: profile.profileVisibility,
        isRestricted: true,
        followStatus: 'NOT_FOLLOWING',
        isBlocked: true,
        isBlockedByViewer,
      };
    }

    if (isPrivate && !isOwner && !isAcceptedFollower) {
      // Restricted profile for non-owner viewing private profile
      // Do not expose relationship data belonging to another user's private account
      return {
        id: profile.id,
        userId: profile.userId,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        profileVisibility: 'PRIVATE',
        isRestricted: true,
        followStatus,
      };
    }

    let followerCount = 0;
    let followingCount = 0;
    if (this.followsRepository) {
      followerCount = await this.followsRepository.getFollowerCount(profile.userId);
      followingCount = await this.followsRepository.getFollowingCount(profile.userId);
    }

    // Full public profile (or owner viewing own private profile)
    return {
      id: profile.id,
      userId: profile.userId,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      coverImageUrl: profile.coverImageUrl,
      bio: profile.bio,
      location: profile.location,
      profileVisibility: profile.profileVisibility,
      isRestricted: false,
      followerCount,
      followingCount,
      followStatus,
      createdAt: profile.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves profile of currently authenticated user.
   */
  async getMyProfile(userId: string): Promise<FullProfileResponse> {
    const profile = await this.repository.findProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Profile has not been created yet');
    }
    return this.toFullProfile(profile);
  }

  /**
   * Creates or updates the authenticated user's profile.
   */
  async createOrUpdateProfile(
    userId: string,
    data: CreateOrUpdateProfileData,
  ): Promise<FullProfileResponse> {
    const existing = await this.repository.findProfileByUserId(userId);

    // If updating username, check uniqueness
    if (data.username) {
      const normalized = normalizeUsername(data.username);
      const conflict = await this.repository.findProfileByUsername(normalized);
      if (conflict && conflict.userId !== userId) {
        throw new ConflictError('Username is already taken');
      }
    }

    let finalAvatarUrl = data.avatarUrl;

    if (data.mediaAssetId) {
      if (!this.mediaService) {
        throw new BadRequestError('Media service is unavailable');
      }
      const verified = await this.mediaService.verifyAssetForUse(
        userId,
        data.mediaAssetId,
        'AVATAR',
      );
      finalAvatarUrl = verified.deliveryUrl || finalAvatarUrl;
    }

    const payloadWithAvatar: CreateOrUpdateProfileData = {
      ...data,
      avatarUrl: finalAvatarUrl,
    };

    if (existing) {
      const updated = await this.repository.updateProfile(userId, payloadWithAvatar);
      return this.toFullProfile(updated);
    }

    // Creating initial profile
    if (!data.username) {
      throw new BadRequestError('Username is required for initial profile creation');
    }

    const username = normalizeUsername(data.username);
    const displayName = data.displayName?.trim() || username;

    const created = await this.repository.createProfile(userId, {
      ...payloadWithAvatar,
      username,
      displayName,
    });

    return this.toFullProfile(created);
  }

  /**
   * Retrieves a user profile by username respecting visibility rules.
   */
  async getProfileByUsername(
    username: string,
    viewerUserId?: string,
  ): Promise<PublicProfileResponse> {
    const normalized = normalizeUsername(username);
    const profile = await this.repository.findProfileByUsername(normalized);
    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return this.toPublicProfile(profile, viewerUserId);
  }

  /**
   * Checks whether a username is available.
   */
  async checkUsernameAvailability(
    usernameInput: string,
    currentUserId?: string,
  ): Promise<UsernameAvailabilityResult> {
    if (!isValidUsername(usernameInput)) {
      return {
        username: usernameInput,
        available: false,
        reason:
          'Username must be 3-30 characters long and contain only letters, numbers, and underscores',
      };
    }

    const normalized = normalizeUsername(usernameInput);
    const existing = await this.repository.findProfileByUsername(normalized);

    if (!existing) {
      return {
        username: normalized,
        available: true,
      };
    }

    // If belongs to the querying user, it's available for them
    if (currentUserId && existing.userId === currentUserId) {
      return {
        username: normalized,
        available: true,
      };
    }

    return {
      username: normalized,
      available: false,
      reason: 'Username is already taken',
    };
  }
}
