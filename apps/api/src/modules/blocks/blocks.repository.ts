import { PrismaClient, Block, User, Profile, Follow } from '@prisma/client';
import crypto from 'node:crypto';
import { IBlocksRepository, BlockWithBlockedUser } from './blocks.types.js';

export class PrismaBlocksRepository implements IBlocksRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createBlock(blockerId: string, blockedUserId: string): Promise<Block> {
    const [block] = await this.prisma.$transaction([
      this.prisma.block.upsert({
        where: {
          blockerId_blockedUserId: { blockerId, blockedUserId },
        },
        create: {
          blockerId,
          blockedUserId,
        },
        update: {},
      }),
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, followingId: blockedUserId },
            { followerId: blockedUserId, followingId: blockerId },
          ],
        },
      }),
    ]);

    return block;
  }

  async deleteBlock(blockerId: string, blockedUserId: string): Promise<boolean> {
    const res = await this.prisma.block.deleteMany({
      where: { blockerId, blockedUserId },
    });
    return res.count > 0;
  }

  async findBlock(blockerId: string, blockedUserId: string): Promise<Block | null> {
    return this.prisma.block.findUnique({
      where: {
        blockerId_blockedUserId: { blockerId, blockedUserId },
      },
    });
  }

  async isBlocked(blockerId: string, blockedUserId: string): Promise<boolean> {
    const count = await this.prisma.block.count({
      where: { blockerId, blockedUserId },
    });
    return count > 0;
  }

  async isBlockedEither(userA: string, userB: string): Promise<boolean> {
    const count = await this.prisma.block.count({
      where: {
        OR: [
          { blockerId: userA, blockedUserId: userB },
          { blockerId: userB, blockedUserId: userA },
        ],
      },
    });
    return count > 0;
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
      select: { blockedUserId: true },
    });
    return blocks.map((b) => b.blockedUserId);
  }

  async getBlockedAndBlockerUserIds(
    userId: string,
  ): Promise<{ blockedUserIds: string[]; blockerUserIds: string[] }> {
    const [blocked, blockers] = await Promise.all([
      this.prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedUserId: true },
      }),
      this.prisma.block.findMany({
        where: { blockedUserId: userId },
        select: { blockerId: true },
      }),
    ]);
    return {
      blockedUserIds: blocked.map((b) => b.blockedUserId),
      blockerUserIds: blockers.map((b) => b.blockerId),
    };
  }

  async getBlockedUsers(
    blockerId: string,
    cursor?: string,
    limit = 20,
  ): Promise<BlockWithBlockedUser[]> {
    return this.prisma.block.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        blockedUser: {
          include: { profile: true },
        },
      },
    });
  }

  async cleanupFollowsBetween(userA: string, userB: string): Promise<number> {
    const res = await this.prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: userA, followingId: userB },
          { followerId: userB, followingId: userA },
        ],
      },
    });
    return res.count;
  }
}

export class InMemoryBlocksRepository implements IBlocksRepository {
  public blocks: Map<string, Block>;
  public follows: Map<string, Follow>;
  public users: Map<string, User>;
  public profiles: Map<string, Profile>;

  constructor(
    blocks?: Map<string, Block>,
    follows?: Map<string, Follow>,
    users?: Map<string, User>,
    profiles?: Map<string, Profile>,
  ) {
    this.blocks = blocks || new Map();
    this.follows = follows || new Map();
    this.users = users || new Map();
    this.profiles = profiles || new Map();
  }

  private getKey(blockerId: string, blockedUserId: string): string {
    return `${blockerId}:${blockedUserId}`;
  }

  private buildBlockedUser(userId: string): User & { profile: Profile | null } {
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

  async createBlock(blockerId: string, blockedUserId: string): Promise<Block> {
    const key = this.getKey(blockerId, blockedUserId);
    const existing = this.blocks.get(key);
    if (existing) {
      // Still cleanup any residual follows
      await this.cleanupFollowsBetween(blockerId, blockedUserId);
      return existing;
    }

    const block: Block = {
      id: crypto.randomUUID(),
      blockerId,
      blockedUserId,
      createdAt: new Date(),
    };
    this.blocks.set(key, block);

    // Remove any follows between them in either direction
    await this.cleanupFollowsBetween(blockerId, blockedUserId);

    return block;
  }

  async deleteBlock(blockerId: string, blockedUserId: string): Promise<boolean> {
    const key = this.getKey(blockerId, blockedUserId);
    return this.blocks.delete(key);
  }

  async findBlock(blockerId: string, blockedUserId: string): Promise<Block | null> {
    return this.blocks.get(this.getKey(blockerId, blockedUserId)) || null;
  }

  async isBlocked(blockerId: string, blockedUserId: string): Promise<boolean> {
    return this.blocks.has(this.getKey(blockerId, blockedUserId));
  }

  async isBlockedEither(userA: string, userB: string): Promise<boolean> {
    return this.blocks.has(this.getKey(userA, userB)) || this.blocks.has(this.getKey(userB, userA));
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const ids: string[] = [];
    for (const b of this.blocks.values()) {
      if (b.blockerId === userId) {
        ids.push(b.blockedUserId);
      }
    }
    return ids;
  }

  async getBlockedAndBlockerUserIds(
    userId: string,
  ): Promise<{ blockedUserIds: string[]; blockerUserIds: string[] }> {
    const blockedUserIds: string[] = [];
    const blockerUserIds: string[] = [];
    for (const b of this.blocks.values()) {
      if (b.blockerId === userId) {
        blockedUserIds.push(b.blockedUserId);
      }
      if (b.blockedUserId === userId) {
        blockerUserIds.push(b.blockerId);
      }
    }
    return { blockedUserIds, blockerUserIds };
  }

  async getBlockedUsers(
    blockerId: string,
    cursor?: string,
    limit = 20,
  ): Promise<BlockWithBlockedUser[]> {
    const list = Array.from(this.blocks.values())
      .filter((b) => b.blockerId === blockerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (cursor) {
      const idx = list.findIndex((b) => b.id === cursor);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }

    const sliced = list.slice(startIndex, startIndex + limit + 1);
    return sliced.map((b) => ({
      ...b,
      blockedUser: this.buildBlockedUser(b.blockedUserId),
    }));
  }

  async cleanupFollowsBetween(userA: string, userB: string): Promise<number> {
    let count = 0;
    for (const [key, follow] of this.follows.entries()) {
      const isAtoB = follow.followerId === userA && follow.followingId === userB;
      const isBtoA = follow.followerId === userB && follow.followingId === userA;
      if (isAtoB || isBtoA) {
        this.follows.delete(key);
        count++;
      }
    }
    return count;
  }
}
