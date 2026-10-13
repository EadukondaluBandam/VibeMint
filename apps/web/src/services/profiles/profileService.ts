import type {
  UserProfile,
  PublicUserProfile,
  UpdateProfileInput,
  UsernameAvailabilityResponse,
} from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

class WebProfileService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/profiles`;

  /**
   * Retrieves profile of authenticated user.
   */
  async getMyProfile(): Promise<UserProfile | null> {
    try {
      const res = await fetch(`${this.baseUrl}/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        throw new Error('Failed to retrieve profile');
      }

      return await res.json();
    } catch (err) {
      if (err instanceof Error && err.message === 'Failed to retrieve profile') {
        throw err;
      }
      return null;
    }
  }

  /**
   * Creates or updates authenticated user's profile.
   */
  async updateMyProfile(data: UpdateProfileInput): Promise<UserProfile> {
    const res = await fetch(`${this.baseUrl}/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to update profile');
    }

    return body;
  }

  /**
   * Retrieves public profile by username.
   */
  async getProfileByUsername(username: string): Promise<PublicUserProfile | null> {
    const res = await fetch(`${this.baseUrl}/${encodeURIComponent(username)}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error('Failed to load profile');
    }

    return await res.json();
  }

  /**
   * Checks whether a username is available.
   */
  async checkUsernameAvailability(username: string): Promise<UsernameAvailabilityResponse> {
    const res = await fetch(
      `${this.baseUrl}/username-availability?username=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    if (!res.ok) {
      return { username, available: false, reason: 'Failed to verify availability' };
    }

    return await res.json();
  }
}

export const webProfileService = new WebProfileService();
