import type { Interest } from '@vibemint/types';
import { secureStorage } from '../auth/secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

class MobileInterestsService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/interests`;

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
   * Retrieves active interests, optionally filtered by category.
   */
  async getActiveInterests(category?: string): Promise<Interest[]> {
    const url = category
      ? `${this.baseUrl}?category=${encodeURIComponent(category)}`
      : this.baseUrl;

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      throw new Error('Failed to load interests');
    }

    return await res.json();
  }

  /**
   * Retrieves authenticated user's selected interests.
   */
  async getMyInterests(): Promise<Interest[]> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/me`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error('Failed to load user interests');
    }

    return await res.json();
  }

  /**
   * Replaces user's selected interests.
   */
  async updateMyInterests(interestIds: string[]): Promise<Interest[]> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/me`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ interestIds }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to update interests');
    }

    return body;
  }
}

export const mobileInterestsService = new MobileInterestsService();
