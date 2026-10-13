import { PrismaClient, Interest } from '@prisma/client';
import crypto from 'node:crypto';
import { INITIAL_INTERESTS } from './interests.seed-data.js';

export interface UserOnboardingInfo {
  onboardingCompleted: boolean;
  hasProfile: boolean;
  profileValid: boolean;
  interestsCount: number;
}

export interface IInterestsRepository {
  listActiveInterests(category?: string): Promise<Interest[]>;
  findInterestsByIds(ids: string[]): Promise<Interest[]>;
  findUserInterests(userId: string): Promise<Interest[]>;
  replaceUserInterests(userId: string, interestIds: string[]): Promise<Interest[]>;
  getUserOnboardingInfo(userId: string): Promise<UserOnboardingInfo>;
  setUserOnboardingCompleted(userId: string): Promise<void>;
  createInterest?(data: Omit<Interest, 'id' | 'createdAt' | 'updatedAt'>): Promise<Interest>;
}

export class PrismaInterestsRepository implements IInterestsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listActiveInterests(category?: string): Promise<Interest[]> {
    return this.prisma.interest.findMany({
      where: {
        isActive: true,
        ...(category ? { category } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findInterestsByIds(ids: string[]): Promise<Interest[]> {
    return this.prisma.interest.findMany({
      where: {
        id: { in: ids },
      },
    });
  }

  async findUserInterests(userId: string): Promise<Interest[]> {
    const userInterests = await this.prisma.userInterest.findMany({
      where: { userId },
      include: { interest: true },
      orderBy: { interest: { name: 'asc' } },
    });
    return userInterests.map((ui) => ui.interest);
  }

  async replaceUserInterests(userId: string, interestIds: string[]): Promise<Interest[]> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete current selections
      await tx.userInterest.deleteMany({
        where: { userId },
      });

      // 2. Insert new selections
      if (interestIds.length > 0) {
        await tx.userInterest.createMany({
          data: interestIds.map((interestId) => ({
            userId,
            interestId,
          })),
        });
      }

      // 3. Retrieve and return populated interests
      const updated = await tx.userInterest.findMany({
        where: { userId },
        include: { interest: true },
        orderBy: { interest: { name: 'asc' } },
      });

      return updated.map((ui) => ui.interest);
    });
  }

  async getUserOnboardingInfo(userId: string): Promise<UserOnboardingInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        interests: true,
      },
    });

    if (!user) {
      return {
        onboardingCompleted: false,
        hasProfile: false,
        profileValid: false,
        interestsCount: 0,
      };
    }

    const hasProfile = Boolean(user.profile);
    const profileValid = Boolean(
      user.profile &&
      user.profile.username.trim().length > 0 &&
      user.profile.displayName.trim().length > 0,
    );
    const interestsCount = user.interests.length;

    return {
      onboardingCompleted: user.onboardingCompleted,
      hasProfile,
      profileValid,
      interestsCount,
    };
  }

  async setUserOnboardingCompleted(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });
  }
}

export class InMemoryInterestsRepository implements IInterestsRepository {
  private interests: Map<string, Interest> = new Map();
  private userInterests: Map<string, Set<string>> = new Map(); // userId -> Set<interestId>
  private userOnboardingMap: Map<string, boolean> = new Map(); // userId -> completed
  private profilesRef: Map<string, { username: string; displayName: string }> = new Map();

  constructor() {
    this.seedDefaultInterests();
  }

  seedDefaultInterests(): void {
    for (const item of INITIAL_INTERESTS) {
      const id = `interest-${item.slug}`;
      this.interests.set(id, {
        id,
        name: item.name,
        slug: item.slug,
        category: item.category,
        description: item.description,
        icon: item.icon ?? null,
        isActive: true,
        sortOrder: item.sortOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  async listActiveInterests(category?: string): Promise<Interest[]> {
    const result = Array.from(this.interests.values()).filter((i) => {
      if (!i.isActive) return false;
      if (category && i.category.toLowerCase() !== category.toLowerCase()) return false;
      return true;
    });

    return result.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async findInterestsByIds(ids: string[]): Promise<Interest[]> {
    return ids.map((id) => this.interests.get(id)).filter((i): i is Interest => Boolean(i));
  }

  async findUserInterests(userId: string): Promise<Interest[]> {
    const interestIds = this.userInterests.get(userId) || new Set();
    const result: Interest[] = [];
    for (const id of interestIds) {
      const interest = this.interests.get(id);
      if (interest) result.push({ ...interest });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async replaceUserInterests(userId: string, interestIds: string[]): Promise<Interest[]> {
    this.userInterests.set(userId, new Set(interestIds));
    return this.findUserInterests(userId);
  }

  async getUserOnboardingInfo(userId: string): Promise<UserOnboardingInfo> {
    const onboardingCompleted = this.userOnboardingMap.get(userId) || false;
    const profile = this.profilesRef.get(userId);
    const hasProfile = Boolean(profile);
    const profileValid = Boolean(
      profile && profile.username.trim().length > 0 && profile.displayName.trim().length > 0,
    );
    const interestsCount = (this.userInterests.get(userId) || new Set()).size;

    return {
      onboardingCompleted,
      hasProfile,
      profileValid,
      interestsCount,
    };
  }

  async setUserOnboardingCompleted(userId: string): Promise<void> {
    this.userOnboardingMap.set(userId, true);
  }

  // Helpers for testing
  setProfileForUser(
    userId: string,
    profile: { username: string; displayName: string } | null,
  ): void {
    if (profile) {
      this.profilesRef.set(userId, profile);
    } else {
      this.profilesRef.delete(userId);
    }
  }

  async createInterest(data: Omit<Interest, 'id' | 'createdAt' | 'updatedAt'>): Promise<Interest> {
    const id = `interest-${crypto.randomUUID()}`;
    const interest: Interest = {
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.interests.set(id, interest);
    return { ...interest };
  }

  deactivateInterest(id: string): void {
    const interest = this.interests.get(id);
    if (interest) {
      interest.isActive = false;
      this.interests.set(id, interest);
    }
  }

  clear(): void {
    this.interests.clear();
    this.userInterests.clear();
    this.userOnboardingMap.clear();
    this.profilesRef.clear();
    this.seedDefaultInterests();
  }
}
