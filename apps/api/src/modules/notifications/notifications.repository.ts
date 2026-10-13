import { PrismaClient, Notification, NotificationType, User, Profile } from '@prisma/client';
import crypto from 'node:crypto';
import {
  INotificationsRepository,
  NotificationWithActor,
  CreateNotificationInput,
} from './notifications.types.js';

export class PrismaNotificationsRepository implements INotificationsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createNotification(data: CreateNotificationInput): Promise<NotificationWithActor> {
    return this.prisma.notification.create({
      data: {
        recipientId: data.recipientId,
        actorId: data.actorId ?? null,
        type: data.type,
        resourceType: data.resourceType ?? null,
        resourceId: data.resourceId ?? null,
      },
      include: {
        actor: {
          include: { profile: true },
        },
      },
    });
  }

  async findNotificationById(id: string): Promise<NotificationWithActor | null> {
    return this.prisma.notification.findUnique({
      where: { id },
      include: {
        actor: {
          include: { profile: true },
        },
      },
    });
  }

  async findExistingNotification(
    recipientId: string,
    actorId: string | null | undefined,
    type: NotificationType,
    resourceId?: string | null,
  ): Promise<NotificationWithActor | null> {
    return this.prisma.notification.findFirst({
      where: {
        recipientId,
        actorId: actorId ?? null,
        type,
        ...(resourceId !== undefined ? { resourceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          include: { profile: true },
        },
      },
    });
  }

  async getNotifications(
    recipientId: string,
    cursor?: string,
    limit = 20,
  ): Promise<NotificationWithActor[]> {
    return this.prisma.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        actor: {
          include: { profile: true },
        },
      },
    });
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        recipientId,
        isRead: false,
      },
    });
  }

  async markAsRead(id: string, readAt = new Date()): Promise<NotificationWithActor> {
    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt,
      },
      include: {
        actor: {
          include: { profile: true },
        },
      },
    });
  }

  async markAllAsRead(recipientId: string, readAt = new Date()): Promise<number> {
    const res = await this.prisma.notification.updateMany({
      where: {
        recipientId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt,
      },
    });
    return res.count;
  }
}

export class InMemoryNotificationsRepository implements INotificationsRepository {
  public notifications: Map<string, Notification>;
  public users: Map<string, User>;
  public profiles: Map<string, Profile>;

  constructor(
    notifications?: Map<string, Notification>,
    users?: Map<string, User>,
    profiles?: Map<string, Profile>,
  ) {
    this.notifications = notifications || new Map();
    this.users = users || new Map();
    this.profiles = profiles || new Map();
  }

  private buildActor(actorId?: string | null): (User & { profile: Profile | null }) | null {
    if (!actorId) return null;
    const user = this.users.get(actorId);
    if (!user) return null;
    const profile = this.profiles.get(actorId) || null;
    return {
      ...user,
      profile,
    };
  }

  private toWithActor(notif: Notification): NotificationWithActor {
    return {
      ...notif,
      actor: this.buildActor(notif.actorId),
    };
  }

  async createNotification(data: CreateNotificationInput): Promise<NotificationWithActor> {
    const id = crypto.randomUUID();
    const notif: Notification = {
      id,
      recipientId: data.recipientId,
      actorId: data.actorId ?? null,
      type: data.type,
      resourceType: data.resourceType ?? null,
      resourceId: data.resourceId ?? null,
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    };
    this.notifications.set(id, notif);
    return this.toWithActor(notif);
  }

  async findNotificationById(id: string): Promise<NotificationWithActor | null> {
    const notif = this.notifications.get(id);
    if (!notif) return null;
    return this.toWithActor(notif);
  }

  async findExistingNotification(
    recipientId: string,
    actorId: string | null | undefined,
    type: NotificationType,
    resourceId?: string | null,
  ): Promise<NotificationWithActor | null> {
    const matching = Array.from(this.notifications.values()).filter((n) => {
      const actorMatch = n.actorId === (actorId ?? null);
      const recipientMatch = n.recipientId === recipientId;
      const typeMatch = n.type === type;
      const resourceMatch = resourceId !== undefined ? n.resourceId === resourceId : true;
      return actorMatch && recipientMatch && typeMatch && resourceMatch;
    });

    if (matching.length === 0) return null;
    matching.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return this.toWithActor(matching[0]);
  }

  async getNotifications(
    recipientId: string,
    cursor?: string,
    limit = 20,
  ): Promise<NotificationWithActor[]> {
    const userNotifs = Array.from(this.notifications.values())
      .filter((n) => n.recipientId === recipientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (cursor) {
      const cursorIndex = userNotifs.findIndex((n) => n.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const sliced = userNotifs.slice(startIndex, startIndex + limit + 1);
    return sliced.map((n) => this.toWithActor(n));
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    let count = 0;
    for (const notif of this.notifications.values()) {
      if (notif.recipientId === recipientId && !notif.isRead) {
        count++;
      }
    }
    return count;
  }

  async markAsRead(id: string, readAt = new Date()): Promise<NotificationWithActor> {
    const notif = this.notifications.get(id);
    if (!notif) {
      throw new Error('Notification not found');
    }
    const updated: Notification = {
      ...notif,
      isRead: true,
      readAt: notif.readAt ?? readAt,
    };
    this.notifications.set(id, updated);
    return this.toWithActor(updated);
  }

  async markAllAsRead(recipientId: string, readAt = new Date()): Promise<number> {
    let count = 0;
    for (const [id, notif] of this.notifications.entries()) {
      if (notif.recipientId === recipientId && !notif.isRead) {
        this.notifications.set(id, {
          ...notif,
          isRead: true,
          readAt,
        });
        count++;
      }
    }
    return count;
  }
}
