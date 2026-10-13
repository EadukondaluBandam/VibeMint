import type { Profile, ProfileVisibility } from '@prisma/client';
import type { FollowRelationshipStatus } from '@vibemint/types';

export type { Profile, ProfileVisibility };

export interface FullProfileResponse {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  location: string | null;
  profileVisibility: ProfileVisibility;
  followerCount?: number;
  followingCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProfileResponse {
  id: string;
  userId?: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  profileVisibility: ProfileVisibility;
  isRestricted?: boolean;
  bio?: string | null;
  coverImageUrl?: string | null;
  location?: string | null;
  followerCount?: number;
  followingCount?: number;
  followStatus?: FollowRelationshipStatus;
  isBlocked?: boolean;
  isBlockedByViewer?: boolean;
  createdAt?: string;
}

export interface CreateOrUpdateProfileData {
  username?: string;
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  location?: string | null;
  profileVisibility?: ProfileVisibility;
  mediaAssetId?: string | null;
}

export interface UsernameAvailabilityResult {
  username: string;
  available: boolean;
  reason?: string;
}
