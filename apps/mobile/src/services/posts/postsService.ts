import type {
  CreatePostInput,
  PostSummary,
  FeedResponse,
  PostLikeResponse,
  SavedPostResponse,
  SavedPostsResponse,
} from '@vibemint/types';
import { secureStorage } from '../auth/secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

class MobilePostsService {
  private readonly postsUrl = `${API_BASE_URL}/api/v1/posts`;
  private readonly feedUrl = `${API_BASE_URL}/api/v1/feed`;

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
   * Retrieves paginated social feed.
   */
  async getFeed(cursor?: string, limit = 20): Promise<FeedResponse> {
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.feedUrl}?${params.toString()}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error('Failed to load feed');
    }

    return await res.json();
  }

  /**
   * Creates a new post with caption and/or image URL.
   */
  async createPost(input: CreatePostInput): Promise<PostSummary> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(this.postsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to create post');
    }

    return body;
  }

  /**
   * Retrieves a single post by ID.
   */
  async getPostById(postId: string): Promise<PostSummary> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.postsUrl}/${postId}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error('Post not found');
    }

    return await res.json();
  }

  /**
   * Deletes a post created by the authenticated user.
   */
  async deletePost(postId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.postsUrl}/${postId}`, {
      method: 'DELETE',
      headers,
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
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.postsUrl}/${postId}/like`, {
      method: 'PUT',
      headers,
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
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.postsUrl}/${postId}/like`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      throw new Error('Failed to unlike post');
    }

    return await res.json();
  }

  /**
   * Saves a post to personal collection.
   */
  async savePost(postId: string): Promise<SavedPostResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.postsUrl}/${postId}/save`, {
      method: 'PUT',
      headers,
    });

    if (!res.ok) {
      throw new Error('Failed to save post');
    }

    return await res.json();
  }

  /**
   * Removes a post from personal saved collection.
   */
  async unsavePost(postId: string): Promise<SavedPostResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.postsUrl}/${postId}/save`, {
      method: 'DELETE',
      headers,
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
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${this.postsUrl}/saved?${params.toString()}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error('Failed to load saved posts');
    }

    return await res.json();
  }
}

export const mobilePostsService = new MobilePostsService();
