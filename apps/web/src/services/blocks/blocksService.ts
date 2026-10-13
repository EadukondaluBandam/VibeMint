import type { BlockStatusResponse, BlockUserResponse, BlockedUsersResponse } from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

class WebBlocksService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/users`;

  /**
   * Block a user.
   */
  async blockUser(userId: string): Promise<BlockUserResponse> {
    const res = await fetch(`${this.baseUrl}/${userId}/block`, {
      method: 'PUT',
      credentials: 'include',
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
    const res = await fetch(`${this.baseUrl}/${userId}/block`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to unblock user');
    }

    return body;
  }

  /**
   * Get block relationship status.
   */
  async getBlockStatus(userId: string): Promise<BlockStatusResponse> {
    const res = await fetch(`${this.baseUrl}/${userId}/block-status`, {
      method: 'GET',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to get block status');
    }

    return body;
  }

  /**
   * Get paginated blocked users for current user.
   */
  async getBlockedUsers(cursor?: string, limit = 20): Promise<BlockedUsersResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.baseUrl}/me/blocked-users?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to get blocked users');
    }

    return body;
  }
}

export const webBlocksService = new WebBlocksService();
