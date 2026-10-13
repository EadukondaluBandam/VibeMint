import type {
  CreatePostInput,
  PostSummary,
  FeedResponse,
  PostLikeResponse,
  SavedPostResponse,
  SavedPostsResponse,
} from '@vibemint/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

class WebPostsService {
  private readonly postsUrl = `${API_BASE_URL}/api/v1/posts`;
  private readonly feedUrl = `${API_BASE_URL}/api/v1/feed`;

  /**
   * Retrieves paginated feed of published posts.
   */
  async getFeed(cursor?: string, limit = 20): Promise<FeedResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.feedUrl}?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to load feed');
    }

    return await res.json();
  }

  /**
   * Creates a new post.
   */
  async createPost(input: CreatePostInput): Promise<PostSummary> {
    const res = await fetch(this.postsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to create post');
    }

    return body;
  }

  /**
   * Retrieves single post by ID.
   */
  async getPostById(postId: string): Promise<PostSummary> {
    const res = await fetch(`${this.postsUrl}/${postId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Post not found');
    }

    return await res.json();
  }

  /**
   * Deletes a post. Author only.
   */
  async deletePost(postId: string): Promise<void> {
    const res = await fetch(`${this.postsUrl}/${postId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to delete post');
    }
  }

  /**
   * Likes a post.
   */
  async likePost(postId: string): Promise<PostLikeResponse> {
    const res = await fetch(`${this.postsUrl}/${postId}/like`, {
      method: 'PUT',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to like post');
    }

    return await res.json();
  }

  /**
   * Unlikes a post.
   */
  async unlikePost(postId: string): Promise<PostLikeResponse> {
    const res = await fetch(`${this.postsUrl}/${postId}/like`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to unlike post');
    }

    return await res.json();
  }

  /**
   * Saves a post.
   */
  async savePost(postId: string): Promise<SavedPostResponse> {
    const res = await fetch(`${this.postsUrl}/${postId}/save`, {
      method: 'PUT',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to save post');
    }

    return await res.json();
  }

  /**
   * Unsaves a post.
   */
  async unsavePost(postId: string): Promise<SavedPostResponse> {
    const res = await fetch(`${this.postsUrl}/${postId}/save`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to unsave post');
    }

    return await res.json();
  }

  /**
   * Retrieves authenticated user's saved posts.
   */
  async getSavedPosts(cursor?: string, limit = 20): Promise<SavedPostsResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.postsUrl}/saved?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to load saved posts');
    }

    return await res.json();
  }
}

export const webPostsService = new WebPostsService();
