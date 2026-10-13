import type {
  FollowStatusResponse,
  FollowersResponse,
  FollowingResponse,
  FollowRequestsResponse,
} from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

class WebFollowsService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/users`;

  /**
   * Follow a user or send a follow request.
   */
  async followUser(userId: string): Promise<FollowStatusResponse> {
    const res = await fetch(`${this.baseUrl}/${userId}/follow`, {
      method: 'PUT',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to follow user');
    }

    return body;
  }

  /**
   * Unfollow a user or cancel pending request.
   */
  async unfollowUser(userId: string): Promise<FollowStatusResponse> {
    const res = await fetch(`${this.baseUrl}/${userId}/follow`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to unfollow user');
    }

    return body;
  }

  /**
   * Get follow relationship status.
   */
  async getFollowStatus(userId: string): Promise<FollowStatusResponse> {
    const res = await fetch(`${this.baseUrl}/${userId}/follow-status`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to get follow status');
    }

    return await res.json();
  }

  /**
   * Get paginated followers for user.
   */
  async getFollowers(userId: string, cursor?: string, limit = 20): Promise<FollowersResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.baseUrl}/${userId}/followers?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to load followers');
    }

    return body;
  }

  /**
   * Get paginated following list for user.
   */
  async getFollowing(userId: string, cursor?: string, limit = 20): Promise<FollowingResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.baseUrl}/${userId}/following?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
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
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.baseUrl}/me/follow-requests?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
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
    const res = await fetch(`${this.baseUrl}/me/follow-requests/${followerId}/accept`, {
      method: 'PUT',
      credentials: 'include',
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
    const res = await fetch(`${this.baseUrl}/me/follow-requests/${followerId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to reject follow request');
    }
  }
}

export const webFollowsService = new WebFollowsService();
