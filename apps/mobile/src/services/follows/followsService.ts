import type {
  FollowStatusResponse,
  FollowersResponse,
  FollowingResponse,
  FollowRequestsResponse,
} from '@vibemint/types';
import { secureStorage } from '../auth/secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

class MobileFollowsService {
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
   * Follow a user or send a follow request.
   */
  async followUser(userId: string): Promise<FollowStatusResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/${userId}/follow`, {
      method: 'PUT',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to follow user');
    }

    return body;
  }

  /**
   * Unfollow a user or cancel pending follow request.
   */
  async unfollowUser(userId: string): Promise<FollowStatusResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/${userId}/follow`, {
      method: 'DELETE',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to unfollow user');
    }

    return body;
  }

  /**
   * Get follow relationship status with target user.
   */
  async getFollowStatus(userId: string): Promise<FollowStatusResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/${userId}/follow-status`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to get follow status');
    }

    return await res.json();
  }

  /**
   * Get paginated followers for a user.
   */
  async getFollowers(userId: string, cursor?: string, limit = 20): Promise<FollowersResponse> {
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.baseUrl}/${userId}/followers?${params.toString()}`, {
      method: 'GET',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to load followers');
    }

    return body;
  }

  /**
   * Get paginated following list for a user.
   */
  async getFollowing(userId: string, cursor?: string, limit = 20): Promise<FollowingResponse> {
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.baseUrl}/${userId}/following?${params.toString()}`, {
      method: 'GET',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to load following list');
    }

    return body;
  }

  /**
   * Get incoming follow requests for authenticated user.
   */
  async getFollowRequests(cursor?: string, limit = 20): Promise<FollowRequestsResponse> {
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.baseUrl}/me/follow-requests?${params.toString()}`, {
      method: 'GET',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to load follow requests');
    }

    return body;
  }

  /**
   * Accept an incoming follow request.
   */
  async acceptFollowRequest(followerId: string): Promise<FollowStatusResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/me/follow-requests/${followerId}/accept`, {
      method: 'PUT',
      headers,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to accept follow request');
    }

    return body;
  }

  /**
   * Reject an incoming follow request.
   */
  async rejectFollowRequest(followerId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/me/follow-requests/${followerId}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to reject follow request');
    }
  }
}

export const mobileFollowsService = new MobileFollowsService();
