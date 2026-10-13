import type { CommentsResponse, CommentSummary, CreateCommentInput } from '@vibemint/types';
import { secureStorage } from '../auth/secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

class MobileCommentsService {
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
   * Retrieves paginated comments for a post.
   */
  async getPostComments(postId: string, cursor?: string, limit = 20): Promise<CommentsResponse> {
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(
      `${API_BASE_URL}/api/v1/posts/${postId}/comments?${params.toString()}`,
      {
        method: 'GET',
        headers,
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to load comments');
    }

    return await res.json();
  }

  /**
   * Creates a new comment on a post.
   */
  async createComment(postId: string, input: CreateCommentInput): Promise<CommentSummary> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Failed to post comment');
    }

    return body;
  }

  /**
   * Deletes a comment by ID (author only).
   */
  async deleteComment(commentId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/comments/${commentId}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to delete comment');
    }
  }
}

export const mobileCommentsService = new MobileCommentsService();
