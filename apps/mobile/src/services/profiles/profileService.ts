import type {
  UserProfile,
  PublicUserProfile,
  UpdateProfileInput,
  UsernameAvailabilityResponse,
} from '@vibemint/types';
import { secureStorage } from '../auth/secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

class MobileProfileService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/profiles`;

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
   * Retrieves profile of authenticated mobile user.
   */
  async getMyProfile(): Promise<UserProfile | null> {
    const headers = await this.getAuthHeaders();
    try {
      const res = await fetch(`${this.baseUrl}/me`, {
        method: 'GET',
        headers,
      });

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        throw new Error('Failed to load profile');
      }

      return await res.json();
    } catch (err) {
      if (err instanceof Error && err.message === 'Failed to load profile') {
        throw err;
      }
      return null;
    }
  }

  /**
   * Creates or updates profile for authenticated mobile user.
   */
  async updateMyProfile(data: UpdateProfileInput): Promise<UserProfile> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/me`, {
      method: 'PUT',
      headers,
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
    const headers = await this.getAuthHeaders();
    try {
      const res = await fetch(`${this.baseUrl}/${encodeURIComponent(username)}`, {
        method: 'GET',
        headers,
      });

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        throw new Error('Failed to load profile');
      }

      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Checks whether a username is available.
   */
  async checkUsernameAvailability(username: string): Promise<UsernameAvailabilityResponse> {
    const headers = await this.getAuthHeaders();
    try {
      const res = await fetch(
        `${this.baseUrl}/username-availability?username=${encodeURIComponent(username)}`,
        {
          method: 'GET',
          headers,
        },
      );

      if (!res.ok) {
        return { username, available: false, reason: 'Failed to check availability' };
      }

      return await res.json();
    } catch {
      return { username, available: false, reason: 'Network failure' };
    }
  }
}

export const mobileProfileService = new MobileProfileService();
