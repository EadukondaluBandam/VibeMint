import type {
  NotificationsResponse,
  UnreadNotificationCountResponse,
  MarkNotificationReadResponse,
  MarkAllNotificationsReadResponse,
} from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

class WebNotificationsService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/notifications`;

  /**
   * Retrieves paginated notifications for the current authenticated user.
   */
  async getNotifications(cursor?: string, limit = 20): Promise<NotificationsResponse> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));

    const qs = params.toString();
    const url = qs ? `${this.baseUrl}?${qs}` : this.baseUrl;

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to fetch notifications');
    }

    return body;
  }

  /**
   * Retrieves unread notification count.
   */
  async getUnreadCount(): Promise<UnreadNotificationCountResponse> {
    const res = await fetch(`${this.baseUrl}/unread-count`, {
      method: 'GET',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to fetch unread count');
    }

    return body;
  }

  /**
   * Marks a single notification as read.
   */
  async markAsRead(notificationId: string): Promise<MarkNotificationReadResponse> {
    const res = await fetch(`${this.baseUrl}/${notificationId}/read`, {
      method: 'PATCH',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to mark notification as read');
    }

    return body;
  }

  /**
   * Marks all notifications as read for current user.
   */
  async markAllAsRead(): Promise<MarkAllNotificationsReadResponse> {
    const res = await fetch(`${this.baseUrl}/read-all`, {
      method: 'PATCH',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to mark all notifications as read');
    }

    return body;
  }
}

export const webNotificationsService = new WebNotificationsService();
