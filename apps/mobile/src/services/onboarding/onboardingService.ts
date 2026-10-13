import type { OnboardingStatus, OnboardingCompleteResponse } from '@vibemint/types';
import { secureStorage } from '../auth/secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

class MobileOnboardingService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/onboarding`;

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
   * Retrieves current onboarding status derived from server-side data.
   */
  async getStatus(): Promise<OnboardingStatus> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/status`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to fetch onboarding status');
    }

    return await res.json();
  }

  /**
   * Completes onboarding flow when prerequisites are met.
   */
  async complete(): Promise<OnboardingCompleteResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/complete`, {
      method: 'POST',
      headers,
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to complete onboarding');
    }

    return body;
  }
}

export const mobileOnboardingService = new MobileOnboardingService();
