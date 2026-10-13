import type { CreateReportRequest, CreateReportResponse } from '@vibemint/types';
import { secureStorage } from '../auth/secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

class MobileReportsService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/reports`;

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
   * Submits a report for a user, post, or comment.
   */
  async submitReport(data: CreateReportRequest): Promise<CreateReportResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to submit report');
    }

    return body;
  }
}

export const mobileReportsService = new MobileReportsService();
