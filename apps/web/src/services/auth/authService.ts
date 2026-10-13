export interface AuthUser {
  id: string;
  email: string;
  status: string;
  emailVerified: boolean;
  onboardingCompleted?: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  token?: string;
  expiresAt?: string;
}

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

class WebAuthService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/auth`;

  /**
   * Register a new user account. Cookies are automatically handled by browser.
   */
  async signup(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${this.baseUrl}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    return data;
  }

  /**
   * Log in with existing credentials. Session cookie is set HTTP-only.
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Invalid email or password');
    }

    return data;
  }

  /**
   * Invalidate current session and clear server session cookie.
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Allow logout to proceed locally regardless of network status
    }
  }

  /**
   * Fetch current authenticated user. Returns null if unauthenticated.
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const res = await fetch(`${this.baseUrl}/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        return null;
      }

      return await res.json();
    } catch {
      return null;
    }
  }
}

export const webAuthService = new WebAuthService();
