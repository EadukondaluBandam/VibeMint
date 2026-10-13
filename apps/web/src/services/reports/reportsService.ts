import type { CreateReportRequest, CreateReportResponse } from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

class WebReportsService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/reports`;

  /**
   * Submit a new content or user report.
   */
  async submitReport(data: CreateReportRequest): Promise<CreateReportResponse> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to submit report');
    }

    return body;
  }
}

export const webReportsService = new WebReportsService();
