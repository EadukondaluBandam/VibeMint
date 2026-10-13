import { secureStorage } from './secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

export interface MobileAuthUser {
  id: string;
  email: string;
  status: string;
  emailVerified: boolean;
  onboardingCompleted?: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface MobileAuthResponse {
  user: MobileAuthUser;
  token: string;
  expiresAt: string;
}

// Configurable mobile API endpoint (defaults to local development host)
const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

class MobileAuthService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/auth`;

  /**
   * Retrieves the currently stored token.
   */
  async getToken(): Promise<string | null> {
    return secureStorage.getToken();
  }

  /**
   * Register a new user account, securely store the returned token, and return user profile.
   */
  async signup(email: string, password: string): Promise<MobileAuthResponse> {
    const res = await fetch(`${this.baseUrl}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    if (data.token) {
      await secureStorage.setToken(data.token);
    }

    return data;
  }

  /**
   * Authenticate user, securely store the token, and return user profile.
   */
  async login(email: string, password: string): Promise<MobileAuthResponse> {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Invalid email or password');
    }

    if (data.token) {
      await secureStorage.setToken(data.token);
    }

    return data;
  }

  /**
   * Invalidate session on server and remove token from secure device storage.
   */
  async logout(): Promise<void> {
    const token = await secureStorage.getToken();
    try {
      if (token) {
        await fetch(`${this.baseUrl}/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Allow logout to proceed locally regardless of network reachability
    } finally {
      await secureStorage.removeToken();
    }
  }

  /**
   * Retrieve current user profile using the stored Bearer token.
   */
  async getCurrentUser(): Promise<MobileAuthUser | null> {
    const token = await secureStorage.getToken();
    if (!token) {
      return null;
    }

    try {
      const res = await fetch(`${this.baseUrl}/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        // If token has expired or was revoked, clean up local storage
        await secureStorage.removeToken();
        return null;
      }

      return await res.json();
    } catch {
      return null;
    }
  }
}

export const mobileAuthService = new MobileAuthService();
