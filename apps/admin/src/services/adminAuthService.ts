import type { SafeAdminUser, AdminMeResponse } from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

export class AdminAuthService {
  private readonly authBaseUrl = `${API_BASE_URL}/api/v1/auth`;
  private readonly adminBaseUrl = `${API_BASE_URL}/api/v1/admin`;

  /**
   * Authenticates administrator credentials and validates server-side ADMIN role.
   */
  async login(email: string, password: string): Promise<SafeAdminUser> {
    const res = await fetch(`${this.authBaseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Invalid email or password');
    }

    const user = data.user as SafeAdminUser;

    // Strict role check: non-admin accounts cannot access admin portal
    if (user.role !== 'ADMIN') {
      // Immediately revoke session to prevent lingering unauthorized cookie
      await this.logout().catch(() => {});
      const forbiddenError = new Error('Access denied. Administrator privileges required.');
      (forbiddenError as unknown as { status: number }).status = 403;
      throw forbiddenError;
    }

    return user;
  }

  /**
   * Validates active session and retrieves verified administrator identity from /api/v1/admin/me.
   */
  async getMe(): Promise<SafeAdminUser> {
    const res = await fetch(`${this.adminBaseUrl}/me`, {
      method: 'GET',
      credentials: 'include',
    });

    const data = (await res.json().catch(() => ({}))) as AdminMeResponse & { message?: string };
    if (!res.ok) {
      const error = new Error(data.message || (res.status === 403 ? 'Forbidden' : 'Unauthorized'));
      (error as unknown as { status: number }).status = res.status;
      throw error;
    }

    return data.user;
  }

  /**
   * Logs out administrator and invalidates session on server.
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.authBaseUrl}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors during logout
    }
  }
}

export const adminAuthService = new AdminAuthService();
