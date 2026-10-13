import type { OnboardingStatus, OnboardingCompleteResponse } from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

class WebOnboardingService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/onboarding`;

  /**
   * Retrieves user's onboarding status derived from server-side persisted data.
   */
  async getStatus(): Promise<OnboardingStatus> {
    const res = await fetch(`${this.baseUrl}/status`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to fetch onboarding status');
    }

    return await res.json();
  }

  /**
   * Marks onboarding complete once profile and interest requirements are verified.
   */
  async complete(): Promise<OnboardingCompleteResponse> {
    const res = await fetch(`${this.baseUrl}/complete`, {
      method: 'POST',
      credentials: 'include',
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to complete onboarding');
    }

    return body;
  }
}

export const webOnboardingService = new WebOnboardingService();
