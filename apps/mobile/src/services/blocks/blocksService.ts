import type { BlockStatusResponse, BlockUserResponse, BlockedUsersResponse } from '@vibemint/types';
import { secureStorage } from '../auth/secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

class MobileBlocksService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/users`;

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
   * Block a user.
   */
  async blockUser(userId: string): Promise<BlockUserResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/${userId}/block`, {
      method: 'PUT',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to block user');
    }

    return body;
  }

  /**
   * Unblock a user.
   */
  async unblockUser(userId: string): Promise<BlockUserResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/${userId}/block`, {
      method: 'DELETE',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to unblock user');
    }

    return body;
  }

  /**
   * Get block relationship status with target user.
   */
  async getBlockStatus(userId: string): Promise<BlockStatusResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/${userId}/block-status`, {
      method: 'GET',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to retrieve block status');
    }

    return body;
  }

  /**
   * Get cursor-paginated list of blocked users.
   */
  async getBlockedUsers(cursor?: string, limit = 20): Promise<BlockedUsersResponse> {
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', String(limit));

    const url = `${this.baseUrl}/me/blocked-users${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to retrieve blocked users');
    }

    return body;
  }
}

export const mobileBlocksService = new MobileBlocksService();
