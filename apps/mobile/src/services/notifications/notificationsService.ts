import type {
  NotificationsResponse,
  UnreadNotificationCountResponse,
  MarkNotificationReadResponse,
  MarkAllNotificationsReadResponse,
} from '@vibemint/types';
import { secureStorage } from '../auth/secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

class MobileNotificationsService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/notifications`;

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await secureStorage.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Retrieves paginated notifications for the current user.
   */
  async getNotifications(cursor?: string, limit = 20): Promise<NotificationsResponse> {
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));

    const qs = params.toString();
    const url = qs ? `${this.baseUrl}?${qs}` : this.baseUrl;

    const res = await fetch(url, {
      method: 'GET',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to fetch notifications');
    }

    return body;
  }

  /**
   * Retrieves the unread notification count.
   */
  async getUnreadCount(): Promise<UnreadNotificationCountResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/unread-count`, {
      method: 'GET',
      headers,
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
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/${notificationId}/read`, {
      method: 'PATCH',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to mark notification as read');
    }

    return body;
  }

  /**
   * Marks all notifications as read.
   */
  async markAllAsRead(): Promise<MarkAllNotificationsReadResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/read-all`, {
      method: 'PATCH',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to mark all notifications as read');
    }

    return body;
  }
}

export const mobileNotificationsService = new MobileNotificationsService();
