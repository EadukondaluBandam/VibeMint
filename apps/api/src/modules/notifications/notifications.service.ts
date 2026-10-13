import {
  INotificationsRepository,
  NotificationWithActor,
  CreateNotificationInput,
  NotificationItem,
  NotificationsResponse,
  UnreadNotificationCountResponse,
  MarkNotificationReadResponse,
  MarkAllNotificationsReadResponse,
  NotificationActorSummary,
} from './notifications.types.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../errors/app-error.js';
import { User, Profile } from '@prisma/client';
import { IBlocksRepository } from '../blocks/blocks.types.js';

export class NotificationsService {
  constructor(
    private readonly repository: INotificationsRepository,
    private readonly blocksRepository?: IBlocksRepository | null,
  ) {}

  private toActorSummary(
    actor: (User & { profile: Profile | null }) | null,
  ): NotificationActorSummary | null {
    if (!actor) return null;
    return {
      id: actor.id,
      username: actor.profile?.username ?? 'user',
      displayName: actor.profile?.displayName ?? 'VibeMint User',
      avatarUrl: actor.profile?.avatarUrl ?? null,
    };
  }

  private toNotificationItem(notif: NotificationWithActor): NotificationItem {
    return {
      id: notif.id,
      recipientId: notif.recipientId,
      actorId: notif.actorId ?? null,
      actor: this.toActorSummary(notif.actor),
      type: notif.type,
      resourceType: notif.resourceType ?? null,
      resourceId: notif.resourceId ?? null,
      isRead: notif.isRead,
      readAt: notif.readAt ? notif.readAt.toISOString() : null,
      createdAt: notif.createdAt.toISOString(),
    };
  }

  /**
   * Creates a notification while preventing self-notifications and duplicate events.
   */
  async createNotification(params: CreateNotificationInput): Promise<NotificationItem | null> {
    // Prevent notifications for actions performed on user's own content/profile
    if (params.actorId && params.recipientId === params.actorId) {
      return null;
    }

    // Suppress notifications if either user has blocked the other
    if (
      params.actorId &&
      this.blocksRepository &&
      (await this.blocksRepository.isBlockedEither(params.recipientId, params.actorId))
    ) {
      return null;
    }

    // Check for existing notification to avoid duplicate spam on retries
    const existing = await this.repository.findExistingNotification(
      params.recipientId,
      params.actorId,
      params.type,
      params.resourceId,
    );
    if (existing) {
      return this.toNotificationItem(existing);
    }

    const created = await this.repository.createNotification(params);
    return this.toNotificationItem(created);
  }

  /**
   * Retrieves paginated notifications for the authenticated recipient.
   */
  async getNotifications(
    recipientId: string,
    cursor?: string,
    rawLimit?: unknown,
  ): Promise<NotificationsResponse> {
    const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 50);
    const notifs = await this.repository.getNotifications(recipientId, cursor, limit);

    let blockedIds: Set<string> | null = null;
    if (this.blocksRepository) {
      const { blockedUserIds, blockerUserIds } =
        await this.blocksRepository.getBlockedAndBlockerUserIds(recipientId);
      blockedIds = new Set([...blockedUserIds, ...blockerUserIds]);
    }

    const filtered = blockedIds
      ? notifs.filter((n) => !n.actorId || !blockedIds?.has(n.actorId))
      : notifs;

    const hasMore = filtered.length > limit;
    const trimmed = hasMore ? filtered.slice(0, limit) : filtered;
    const nextCursor = hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null;

    return {
      notifications: trimmed.map((n) => this.toNotificationItem(n)),
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Returns current user's unread notifications count.
   */
  async getUnreadCount(recipientId: string): Promise<UnreadNotificationCountResponse> {
    if (this.blocksRepository) {
      const all = await this.repository.getNotifications(recipientId, undefined, 100);
      const { blockedUserIds, blockerUserIds } =
        await this.blocksRepository.getBlockedAndBlockerUserIds(recipientId);
      const blockedIds = new Set([...blockedUserIds, ...blockerUserIds]);
      const unreadCount = all.filter(
        (n) => !n.isRead && (!n.actorId || !blockedIds.has(n.actorId)),
      ).length;
      return { unreadCount };
    }
    const unreadCount = await this.repository.getUnreadCount(recipientId);
    return { unreadCount };
  }

  /**
   * Marks a specific notification as read idempotently.
   */
  async markAsRead(
    recipientId: string,
    notificationId: string,
  ): Promise<MarkNotificationReadResponse> {
    if (!notificationId || typeof notificationId !== 'string') {
      throw new BadRequestError('Invalid notification ID');
    }

    const existing = await this.repository.findNotificationById(notificationId);
    if (!existing) {
      throw new NotFoundError('Notification not found');
    }

    if (existing.recipientId !== recipientId) {
      throw new ForbiddenError('Access denied to this notification');
    }

    if (existing.isRead) {
      return {
        id: existing.id,
        isRead: true,
        readAt: existing.readAt ? existing.readAt.toISOString() : null,
      };
    }

    const updated = await this.repository.markAsRead(notificationId, new Date());
    return {
      id: updated.id,
      isRead: true,
      readAt: updated.readAt ? updated.readAt.toISOString() : null,
    };
  }

  /**
   * Marks all notifications as read for the authenticated recipient.
   */
  async markAllAsRead(recipientId: string): Promise<MarkAllNotificationsReadResponse> {
    const markedCount = await this.repository.markAllAsRead(recipientId, new Date());
    return {
      success: true,
      markedCount,
    };
  }
}
