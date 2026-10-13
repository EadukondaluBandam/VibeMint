import { PrismaClient, ReportTargetType } from '@prisma/client';
import type {
  IModerationRepository,
  CreateModerationActionData,
  ModerationActionWithAdmin,
} from './moderation.types.js';

export class PrismaModerationRepository implements IModerationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createAction(data: CreateModerationActionData): Promise<ModerationActionWithAdmin> {
    return this.prisma.moderationAction.create({
      data: {
        adminId: data.adminId,
        targetType: data.targetType,
        targetId: data.targetId,
        actionType: data.actionType,
        reason: data.reason,
        reportId: data.reportId ?? null,
        suspendedUntil: data.suspendedUntil ?? null,
        metadata: data.metadata ? (data.metadata as object) : undefined,
      },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
    }) as unknown as Promise<ModerationActionWithAdmin>;
  }

  async getActionsForTarget(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<ModerationActionWithAdmin[]> {
    return this.prisma.moderationAction.findMany({
      where: {
        targetType,
        targetId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
    }) as unknown as Promise<ModerationActionWithAdmin[]>;
  }

  async getActionById(id: string): Promise<ModerationActionWithAdmin | null> {
    return this.prisma.moderationAction.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
    }) as unknown as Promise<ModerationActionWithAdmin | null>;
  }
}

export class InMemoryModerationRepository implements IModerationRepository {
  public actions: Map<string, ModerationActionWithAdmin> = new Map();
  public adminUsers: Map<
    string,
    { id: string; email: string; username?: string; displayName?: string }
  > = new Map();

  setAdminUser(user: { id: string; email: string; username?: string; displayName?: string }): void {
    this.adminUsers.set(user.id, user);
  }

  async createAction(data: CreateModerationActionData): Promise<ModerationActionWithAdmin> {
    const id = crypto.randomUUID();
    const admin = this.adminUsers.get(data.adminId) || {
      id: data.adminId,
      email: 'admin@vibemint.internal',
      username: 'admin',
      displayName: 'Administrator',
    };

    const action: ModerationActionWithAdmin = {
      id,
      adminId: data.adminId,
      targetType: data.targetType,
      targetId: data.targetId,
      actionType: data.actionType,
      reason: data.reason,
      reportId: data.reportId ?? null,
      suspendedUntil: data.suspendedUntil ?? null,
      metadata: (data.metadata as object) ?? null,
      createdAt: new Date(),
      admin: {
        id: admin.id,
        email: admin.email,
        profile: {
          username: admin.username || 'admin',
          displayName: admin.displayName || 'Administrator',
        },
      },
    };

    this.actions.set(id, action);
    return action;
  }

  async getActionsForTarget(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<ModerationActionWithAdmin[]> {
    return Array.from(this.actions.values())
      .filter((a) => a.targetType === targetType && a.targetId === targetId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActionById(id: string): Promise<ModerationActionWithAdmin | null> {
    return this.actions.get(id) || null;
  }

  clear(): void {
    this.actions.clear();
    this.adminUsers.clear();
  }
}
