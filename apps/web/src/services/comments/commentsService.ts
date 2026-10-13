import type { CommentsResponse, CommentSummary, CreateCommentInput } from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

class WebCommentsService {
  /**
   * Retrieves paginated comments for a post.
   */
  async getPostComments(postId: string, cursor?: string, limit = 20): Promise<CommentsResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(
      `${API_BASE_URL}/api/v1/posts/${postId}/comments?${params.toString()}`,
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to load comments');
    }

    return await res.json();
  }

  /**
   * Creates a new comment on a post.
   */
  async createComment(postId: string, input: CreateCommentInput): Promise<CommentSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
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
    const res = await fetch(`${API_BASE_URL}/api/v1/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to delete comment');
    }
  }
}

export const webCommentsService = new WebCommentsService();
