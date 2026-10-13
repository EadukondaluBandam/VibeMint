import type {
  AdminReportListResponse,
  AdminReportStatsResponse,
  AdminReportDetailResponse,
  UpdateReportStatusRequest,
  UpdateReportStatusResponse,
  AdminReportQueueFilters,
  AdminRemoveContentRequest,
  AdminRestoreContentRequest,
  AdminSuspendUserRequest,
  AdminUnsuspendUserRequest,
  AdminEnforcementActionResult,
  ModerationHistoryResponse,
} from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

export class AdminModerationService {
  private readonly baseUrl = `${API_BASE_URL}/api/v1/admin/reports`;
  private readonly enforcementUrl = `${API_BASE_URL}/api/v1/admin/moderation`;

  /**
   * Retrieves summary count metrics for moderation queue dashboard.
   */
  async getStats(): Promise<AdminReportStatsResponse> {
    const res = await fetch(`${this.baseUrl}/stats`, {
      method: 'GET',
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to fetch stats (${res.status})`);
    }

    return data as AdminReportStatsResponse;
  }

  /**
   * Retrieves paginated reports queue filtered by status, targetType, reason, search query.
   */
  async getReportsQueue(filters: AdminReportQueueFilters = {}): Promise<AdminReportListResponse> {
    const query = new URLSearchParams();
    if (filters.status) query.set('status', filters.status);
    if (filters.targetType) query.set('targetType', filters.targetType);
    if (filters.reason) query.set('reason', filters.reason);
    if (filters.search) query.set('search', filters.search);
    if (filters.cursor) query.set('cursor', filters.cursor);
    if (filters.limit) query.set('limit', String(filters.limit));

    const url = query.toString() ? `${this.baseUrl}?${query.toString()}` : this.baseUrl;

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to fetch reports queue (${res.status})`);
    }

    return data as AdminReportListResponse;
  }

  /**
   * Retrieves full report details, target context, and moderation audit logs.
   */
  async getReportDetail(reportId: string): Promise<AdminReportDetailResponse> {
    const res = await fetch(`${this.baseUrl}/${encodeURIComponent(reportId)}`, {
      method: 'GET',
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to fetch report detail (${res.status})`);
    }

    return data as AdminReportDetailResponse;
  }

  /**
   * Updates report review status with decision note and returns updated state + audit entry.
   */
  async updateReportStatus(
    reportId: string,
    payload: UpdateReportStatusRequest,
  ): Promise<UpdateReportStatusResponse> {
    const res = await fetch(`${this.baseUrl}/${encodeURIComponent(reportId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to update report status (${res.status})`);
    }

    return data as UpdateReportStatusResponse;
  }

  /**
   * Removes or hides a reported post.
   */
  async removePost(
    postId: string,
    payload: AdminRemoveContentRequest,
  ): Promise<AdminEnforcementActionResult> {
    const res = await fetch(`${this.enforcementUrl}/posts/${encodeURIComponent(postId)}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to remove post (${res.status})`);
    }

    return data as AdminEnforcementActionResult;
  }

  /**
   * Restores a previously removed post.
   */
  async restorePost(
    postId: string,
    payload: AdminRestoreContentRequest,
  ): Promise<AdminEnforcementActionResult> {
    const res = await fetch(`${this.enforcementUrl}/posts/${encodeURIComponent(postId)}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to restore post (${res.status})`);
    }

    return data as AdminEnforcementActionResult;
  }

  /**
   * Removes or hides a reported comment.
   */
  async removeComment(
    commentId: string,
    payload: AdminRemoveContentRequest,
  ): Promise<AdminEnforcementActionResult> {
    const res = await fetch(
      `${this.enforcementUrl}/comments/${encodeURIComponent(commentId)}/remove`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to remove comment (${res.status})`);
    }

    return data as AdminEnforcementActionResult;
  }

  /**
   * Restores a previously removed comment.
   */
  async restoreComment(
    commentId: string,
    payload: AdminRestoreContentRequest,
  ): Promise<AdminEnforcementActionResult> {
    const res = await fetch(
      `${this.enforcementUrl}/comments/${encodeURIComponent(commentId)}/restore`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to restore comment (${res.status})`);
    }

    return data as AdminEnforcementActionResult;
  }

  /**
   * Suspends a user account with a reason and optional duration.
   */
  async suspendUser(
    userId: string,
    payload: AdminSuspendUserRequest,
  ): Promise<AdminEnforcementActionResult> {
    const res = await fetch(`${this.enforcementUrl}/users/${encodeURIComponent(userId)}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to suspend user (${res.status})`);
    }

    return data as AdminEnforcementActionResult;
  }

  /**
   * Unsuspends a user account with a reason.
   */
  async unsuspendUser(
    userId: string,
    payload: AdminUnsuspendUserRequest,
  ): Promise<AdminEnforcementActionResult> {
    const res = await fetch(
      `${this.enforcementUrl}/users/${encodeURIComponent(userId)}/unsuspend`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to unsuspend user (${res.status})`);
    }

    return data as AdminEnforcementActionResult;
  }

  /**
   * Retrieves enforcement action history for a target.
   */
  async getTargetModerationHistory(
    targetType: string,
    targetId: string,
  ): Promise<ModerationHistoryResponse> {
    const res = await fetch(
      `${this.enforcementUrl}/history/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`,
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to fetch moderation history (${res.status})`);
    }

    return data as ModerationHistoryResponse;
  }
}

export const adminModerationService = new AdminModerationService();
