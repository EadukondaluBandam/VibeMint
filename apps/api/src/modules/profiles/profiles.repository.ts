import { PrismaClient, Profile, ProfileVisibility } from '@prisma/client';
import crypto from 'node:crypto';
import { CreateOrUpdateProfileData } from './profiles.types.js';

export interface IProfileRepository {
  findProfileByUserId(userId: string): Promise<Profile | null>;
  findProfileByUsername(username: string): Promise<Profile | null>;
  createProfile(
    userId: string,
    data: CreateOrUpdateProfileData & { username: string; displayName: string },
  ): Promise<Profile>;
  updateProfile(userId: string, data: CreateOrUpdateProfileData): Promise<Profile>;
}

export class PrismaProfileRepository implements IProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findProfileByUserId(userId: string): Promise<Profile | null> {
    return this.prisma.profile.findUnique({
      where: { userId },
    });
  }

  async findProfileByUsername(username: string): Promise<Profile | null> {
    return this.prisma.profile.findUnique({
      where: { username: username.toLowerCase() },
    });
  }

  async createProfile(
    userId: string,
    data: CreateOrUpdateProfileData & { username: string; displayName: string },
  ): Promise<Profile> {
    return this.prisma.profile.create({
      data: {
        userId,
        username: data.username.toLowerCase(),
        displayName: data.displayName,
        bio: data.bio ?? null,
        avatarUrl: data.avatarUrl ?? null,
        coverImageUrl: data.coverImageUrl ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        gender: data.gender ?? null,
        location: data.location ?? null,
        profileVisibility: data.profileVisibility ?? 'PUBLIC',
      },
    });
  }

  async updateProfile(userId: string, data: CreateOrUpdateProfileData): Promise<Profile> {
    const updateData: Record<string, unknown> = {};

    if (data.username !== undefined) updateData.username = data.username.toLowerCase();
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.profileVisibility !== undefined) updateData.profileVisibility = data.profileVisibility;

    return this.prisma.profile.update({
      where: { userId },
      data: updateData,
    });
  }
}

export class InMemoryProfileRepository implements IProfileRepository {
  private profilesByUserId: Map<string, Profile> = new Map();

  async findProfileByUserId(userId: string): Promise<Profile | null> {
    const profile = this.profilesByUserId.get(userId);
    return profile ? { ...profile } : null;
  }

  async findProfileByUsername(username: string): Promise<Profile | null> {
    const lower = username.toLowerCase();
    for (const profile of this.profilesByUserId.values()) {
      if (profile.username.toLowerCase() === lower) {
        return { ...profile };
      }
    }
    return null;
  }

  async createProfile(
    userId: string,
    data: CreateOrUpdateProfileData & { username: string; displayName: string },
  ): Promise<Profile> {
    const profile: Profile = {
      id: crypto.randomUUID(),
      userId,
      username: data.username.toLowerCase(),
      displayName: data.displayName,
      bio: data.bio ?? null,
      avatarUrl: data.avatarUrl ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      dateOfBirth: data.dateOfBirth ?? null,
      gender: data.gender ?? null,
      location: data.location ?? null,
      profileVisibility: (data.profileVisibility ?? 'PUBLIC') as ProfileVisibility,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.profilesByUserId.set(userId, profile);
    return { ...profile };
  }

  async updateProfile(userId: string, data: CreateOrUpdateProfileData): Promise<Profile> {
    const existing = this.profilesByUserId.get(userId);
    if (!existing) {
      throw new Error(`Profile for user ${userId} not found`);
    }

    const updated: Profile = {
      ...existing,
      username: data.username !== undefined ? data.username.toLowerCase() : existing.username,
      displayName: data.displayName !== undefined ? data.displayName : existing.displayName,
      bio: data.bio !== undefined ? data.bio : existing.bio,
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl,
      coverImageUrl: data.coverImageUrl !== undefined ? data.coverImageUrl : existing.coverImageUrl,
      dateOfBirth: data.dateOfBirth !== undefined ? data.dateOfBirth : existing.dateOfBirth,
      gender: data.gender !== undefined ? data.gender : existing.gender,
      location: data.location !== undefined ? data.location : existing.location,
      profileVisibility:
        data.profileVisibility !== undefined
          ? (data.profileVisibility as ProfileVisibility)
          : existing.profileVisibility,
      updatedAt: new Date(),
    };

    this.profilesByUserId.set(userId, updated);
    return { ...updated };
  }

  clear(): void {
    this.profilesByUserId.clear();
  }
}
