import type { Interest } from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

class WebInterestsService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/interests`;

  /**
   * Retrieves active interests, optionally filtered by category.
   */
  async getActiveInterests(category?: string): Promise<Interest[]> {
    const url = category
      ? `${this.baseUrl}?category=${encodeURIComponent(category)}`
      : this.baseUrl;

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to retrieve active interests');
    }

    return await res.json();
  }

  /**
   * Retrieves authenticated user's selected interests.
   */
  async getMyInterests(): Promise<Interest[]> {
    const res = await fetch(`${this.baseUrl}/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to retrieve user interests');
    }

    return await res.json();
  }

  /**
   * Replaces user's selected interests with new set of interest IDs.
   */
  async updateMyInterests(interestIds: string[]): Promise<Interest[]> {
    const res = await fetch(`${this.baseUrl}/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ interestIds }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to update interests');
    }

    return body;
  }
}

export const webInterestsService = new WebInterestsService();
