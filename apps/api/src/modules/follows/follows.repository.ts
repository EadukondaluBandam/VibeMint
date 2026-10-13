import { PrismaClient, Follow, FollowStatus, User, Profile } from '@prisma/client';
import crypto from 'node:crypto';
import {
  IFollowsRepository,
  FollowWithFollowerUser,
  FollowWithFollowingUser,
} from './follows.types.js';

export class PrismaFollowsRepository implements IFollowsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createFollow(
    followerId: string,
    followingId: string,
    status: FollowStatus,
  ): Promise<Follow> {
    return this.prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId, followingId },
      },
      create: {
        followerId,
        followingId,
        status,
      },
      update: {
        status,
      },
    });
  }

  async findFollow(followerId: string, followingId: string): Promise<Follow | null> {
    return this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });
  }

  async updateFollowStatus(
    followerId: string,
    followingId: string,
    status: FollowStatus,
  ): Promise<Follow> {
    return this.prisma.follow.update({
      where: {
        followerId_followingId: { followerId, followingId },
      },
      data: { status },
    });
  }

  async deleteFollow(followerId: string, followingId: string): Promise<boolean> {
    try {
      await this.prisma.follow.delete({
        where: {
          followerId_followingId: { followerId, followingId },
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getFollowers(
    userId: string,
    cursor?: string,
    limit = 20,
  ): Promise<FollowWithFollowerUser[]> {
    return this.prisma.follow.findMany({
      where: {
        followingId: userId,
        status: 'ACCEPTED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        follower: {
          include: { profile: true },
        },
      },
    });
  }

  async getFollowing(
    userId: string,
    cursor?: string,
    limit = 20,
  ): Promise<FollowWithFollowingUser[]> {
    return this.prisma.follow.findMany({
      where: {
        followerId: userId,
        status: 'ACCEPTED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        following: {
          include: { profile: true },
        },
      },
    });
  }

  async getFollowRequests(
    userId: string,
    cursor?: string,
    limit = 20,
  ): Promise<FollowWithFollowerUser[]> {
    return this.prisma.follow.findMany({
      where: {
        followingId: userId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        follower: {
          include: { profile: true },
        },
      },
    });
  }

  async getFollowerCount(userId: string): Promise<number> {
    return this.prisma.follow.count({
      where: {
        followingId: userId,
        status: 'ACCEPTED',
      },
    });
  }

  async getFollowingCount(userId: string): Promise<number> {
    return this.prisma.follow.count({
      where: {
        followerId: userId,
        status: 'ACCEPTED',
      },
    });
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });
    return Boolean(follow && follow.status === 'ACCEPTED');
  }
}

export class InMemoryFollowsRepository implements IFollowsRepository {
  public follows: Map<string, Follow>;
  public users: Map<string, User>;
  public profiles: Map<string, Profile>;

  constructor(
    follows?: Map<string, Follow>,
    users?: Map<string, User>,
    profiles?: Map<string, Profile>,
  ) {
    this.follows = follows || new Map();
    this.users = users || new Map();
    this.profiles = profiles || new Map();
  }

  private getKey(followerId: string, followingId: string): string {
    return `${followerId}:${followingId}`;
  }

  private buildUser(userId: string): User & { profile: Profile | null } {
    const user = this.users.get(userId) || {
      id: userId,
      email: `${userId}@example.com`,
      passwordHash: '',
      status: 'ACTIVE',
      role: 'USER',
      emailVerified: true,
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
    };

    const profile = this.profiles.get(userId) || null;

    return {
      ...user,
      profile,
    };
  }

  async createFollow(
    followerId: string,
    followingId: string,
    status: FollowStatus,
  ): Promise<Follow> {
    const key = this.getKey(followerId, followingId);
    const existing = this.follows.get(key);
    const now = new Date();

    if (existing) {
      const updated: Follow = {
        ...existing,
        status,
        updatedAt: now,
      };
      this.follows.set(key, updated);
      return updated;
    }

    const follow: Follow = {
      id: crypto.randomUUID(),
      followerId,
      followingId,
      status,
      createdAt: now,
      updatedAt: now,
    };
    this.follows.set(key, follow);
    return follow;
  }

  async findFollow(followerId: string, followingId: string): Promise<Follow | null> {
    return this.follows.get(this.getKey(followerId, followingId)) || null;
  }

  async updateFollowStatus(
    followerId: string,
    followingId: string,
    status: FollowStatus,
  ): Promise<Follow> {
    const key = this.getKey(followerId, followingId);
    const existing = this.follows.get(key);
    if (!existing) throw new Error('Follow not found');
    const updated: Follow = {
      ...existing,
      status,
      updatedAt: new Date(),
    };
    this.follows.set(key, updated);
    return updated;
  }

  async deleteFollow(followerId: string, followingId: string): Promise<boolean> {
    return this.follows.delete(this.getKey(followerId, followingId));
  }

  async getFollowers(
    userId: string,
    cursor?: string,
    limit = 20,
  ): Promise<FollowWithFollowerUser[]> {
    const matching = Array.from(this.follows.values())
      .filter((f) => f.followingId === userId && f.status === 'ACCEPTED')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (cursor) {
      const cursorIdx = matching.findIndex((f) => f.id === cursor);
      if (cursorIdx !== -1) startIndex = cursorIdx + 1;
    }

    const sliced = matching.slice(startIndex, startIndex + limit + 1);
    return sliced.map((f) => ({
      ...f,
      follower: this.buildUser(f.followerId),
    }));
  }

  async getFollowing(
    userId: string,
    cursor?: string,
    limit = 20,
  ): Promise<FollowWithFollowingUser[]> {
    const matching = Array.from(this.follows.values())
      .filter((f) => f.followerId === userId && f.status === 'ACCEPTED')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (cursor) {
      const cursorIdx = matching.findIndex((f) => f.id === cursor);
      if (cursorIdx !== -1) startIndex = cursorIdx + 1;
    }

    const sliced = matching.slice(startIndex, startIndex + limit + 1);
    return sliced.map((f) => ({
      ...f,
      following: this.buildUser(f.followingId),
    }));
  }

  async getFollowRequests(
    userId: string,
    cursor?: string,
    limit = 20,
  ): Promise<FollowWithFollowerUser[]> {
    const matching = Array.from(this.follows.values())
      .filter((f) => f.followingId === userId && f.status === 'PENDING')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (cursor) {
      const cursorIdx = matching.findIndex((f) => f.id === cursor);
      if (cursorIdx !== -1) startIndex = cursorIdx + 1;
    }

    const sliced = matching.slice(startIndex, startIndex + limit + 1);
    return sliced.map((f) => ({
      ...f,
      follower: this.buildUser(f.followerId),
    }));
  }

  async getFollowerCount(userId: string): Promise<number> {
    return Array.from(this.follows.values()).filter(
      (f) => f.followingId === userId && f.status === 'ACCEPTED',
    ).length;
  }

  async getFollowingCount(userId: string): Promise<number> {
    return Array.from(this.follows.values()).filter(
      (f) => f.followerId === userId && f.status === 'ACCEPTED',
    ).length;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = this.follows.get(this.getKey(followerId, followingId));
    return Boolean(follow && follow.status === 'ACCEPTED');
  }
}
