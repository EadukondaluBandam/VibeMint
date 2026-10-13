import { Notification, NotificationType, User, Profile } from '@prisma/client';
import type {
  NotificationItem,
  NotificationsResponse,
  UnreadNotificationCountResponse,
  MarkNotificationReadResponse,
  MarkAllNotificationsReadResponse,
  NotificationActorSummary,
  NotificationResourceType,
} from '@vibemint/types';

export type {
  NotificationItem,
  NotificationsResponse,
  UnreadNotificationCountResponse,
  MarkNotificationReadResponse,
  MarkAllNotificationsReadResponse,
  NotificationActorSummary,
  NotificationResourceType,
};

export interface NotificationWithActor extends Notification {
  actor: (User & { profile: Profile | null }) | null;
}

export interface CreateNotificationInput {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  resourceType?: string | null;
  resourceId?: string | null;
}

export interface INotificationsRepository {
  createNotification(data: CreateNotificationInput): Promise<NotificationWithActor>;
  findNotificationById(id: string): Promise<NotificationWithActor | null>;
  findExistingNotification(
    recipientId: string,
    actorId: string | null | undefined,
    type: NotificationType,
    resourceId?: string | null,
  ): Promise<NotificationWithActor | null>;
  getNotifications(
    recipientId: string,
    cursor?: string,
    limit?: number,
  ): Promise<NotificationWithActor[]>;
  getUnreadCount(recipientId: string): Promise<number>;
  markAsRead(id: string, readAt?: Date): Promise<NotificationWithActor>;
  markAllAsRead(recipientId: string, readAt?: Date): Promise<number>;
}
