import { validateCreatePost } from '@vibemint/validation';
import {
  IPostsRepository,
  PostWithRelations,
  PostSummary,
  FeedResponse,
  PostLikeResponse,
  SavedPostResponse,
  SavedPostsResponse,
} from './posts.types.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../errors/app-error.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { IBlocksRepository } from '../blocks/blocks.types.js';

import type { MediaService } from '../media/media.service.js';

export class PostsService {
  constructor(
    private readonly repository: IPostsRepository,
    private readonly notificationsService?: NotificationsService | null,
    private readonly blocksRepository?: IBlocksRepository | null,
    private readonly mediaService?: MediaService | null,
  ) {}

  toPostSummary(post: PostWithRelations, viewerUserId?: string): PostSummary {
    const isLiked = viewerUserId
      ? Boolean(post.likes?.some((l) => l.userId === viewerUserId))
      : false;
    const isSaved = viewerUserId
      ? Boolean(post.savedBy?.some((s) => s.userId === viewerUserId))
      : false;

    const commentCount =
      post._count?.comments !== undefined
        ? post._count.comments
        : post.comments
          ? post.comments.filter((c) => c.status === 'PUBLISHED').length
          : 0;

    return {
      id: post.id,
      authorId: post.authorId,
      author: {
        id: post.author.id,
        username: post.author.profile?.username || 'anonymous',
        displayName: post.author.profile?.displayName || 'VibeMint User',
        avatarUrl: post.author.profile?.avatarUrl ?? null,
      },
      caption: post.caption,
      imageUrl: post.imageUrl,
      mediaAssetId: post.mediaAssetId ?? null,
      status: post.status,
      likeCount: post.likes ? post.likes.length : 0,
      commentCount,
      isLiked,
      isSaved,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  /**
   * Creates a new social post for the authenticated user.
   */
  async createPost(authorId: string, input: unknown): Promise<PostSummary> {
    const validation = validateCreatePost(input);
    if (!validation.success || !validation.data) {
      const message = validation.errors
        ? Object.values(validation.errors).join(', ')
        : 'Invalid post content';
      throw new BadRequestError(message);
    }

    let finalImageUrl = validation.data.imageUrl ?? null;
    let finalMediaAssetId = validation.data.mediaAssetId ?? null;

    if (validation.data.mediaAssetId) {
      if (!this.mediaService) {
        throw new BadRequestError('Media service is unavailable');
      }
      const verified = await this.mediaService.verifyAssetForUse(
        authorId,
        validation.data.mediaAssetId,
        'POST_IMAGE',
      );
      finalMediaAssetId = verified.id;
      finalImageUrl = verified.deliveryUrl || finalImageUrl;
    }

    const post = await this.repository.createPost(authorId, {
      caption: validation.data.caption,
      imageUrl: finalImageUrl,
      mediaAssetId: finalMediaAssetId,
    });
    return this.toPostSummary(post, authorId);
  }

  /**
   * Retrieves a single post by ID with author details and like/saved states.
   * Enforces private profile visibility rules.
   */
  async getPostById(postId: string, viewerUserId?: string): Promise<PostSummary> {
    const post = await this.repository.findPostById(postId);
    if (!post || post.status === 'REMOVED') {
      throw new NotFoundError('Post not found');
    }

    // Enforce private profile visibility
    const isOwner = Boolean(viewerUserId && viewerUserId === post.authorId);
    if (post.author.profile?.profileVisibility === 'PRIVATE' && !isOwner) {
      throw new ForbiddenError('This post is from a private account');
    }

    return this.toPostSummary(post, viewerUserId);
  }

  /**
   * Removes a post. Enforces that only the author can remove their post.
   */
  async deletePost(postId: string, requesterUserId: string): Promise<void> {
    const post = await this.repository.findPostById(postId);
    if (!post || post.status === 'REMOVED') {
      throw new NotFoundError('Post not found');
    }

    if (post.authorId !== requesterUserId) {
      throw new ForbiddenError('Only the author can remove their post');
    }

    await this.repository.updatePostStatus(postId, 'REMOVED');
  }

  /**
   * Retrieves paginated social feed of published posts.
   */
  async getFeed(viewerUserId?: string, cursor?: string, rawLimit?: unknown): Promise<FeedResponse> {
    const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 50);

    const posts = await this.repository.getFeed(cursor, limit);

    let blockedIds: Set<string> | null = null;
    if (viewerUserId && this.blocksRepository) {
      const { blockedUserIds, blockerUserIds } =
        await this.blocksRepository.getBlockedAndBlockerUserIds(viewerUserId);
      blockedIds = new Set([...blockedUserIds, ...blockerUserIds]);
    }

    // Filter out posts from private profiles where viewer is not author, and posts from blocked accounts
    const eligiblePosts = posts.filter((p) => {
      if (blockedIds && blockedIds.has(p.authorId)) {
        return false;
      }
      if (p.author.profile?.profileVisibility === 'PRIVATE') {
        return Boolean(viewerUserId && viewerUserId === p.authorId);
      }
      return true;
    });

    const hasMore = eligiblePosts.length > limit;
    const paginatedItems = hasMore ? eligiblePosts.slice(0, limit) : eligiblePosts;
    const nextCursor =
      hasMore && paginatedItems.length > 0 ? paginatedItems[paginatedItems.length - 1].id : null;

    return {
      posts: paginatedItems.map((p) => this.toPostSummary(p, viewerUserId)),
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Likes a post idempotently.
   */
  async likePost(userId: string, postId: string): Promise<PostLikeResponse> {
    const post = await this.repository.findPostById(postId);
    if (!post || post.status === 'REMOVED') {
      throw new NotFoundError('Post not found');
    }

    if (
      this.blocksRepository &&
      (await this.blocksRepository.isBlockedEither(userId, post.authorId))
    ) {
      throw new ForbiddenError('Cannot interact with this post');
    }

    await this.repository.likePost(userId, postId);
    const likeCount = await this.repository.getLikeCount(postId);

    if (this.notificationsService && post.authorId !== userId) {
      try {
        await this.notificationsService.createNotification({
          recipientId: post.authorId,
          actorId: userId,
          type: 'POST_LIKED',
          resourceType: 'POST',
          resourceId: postId,
        });
      } catch {
        // Silently proceed on notification error
      }
    }

    return {
      postId,
      isLiked: true,
      likeCount,
    };
  }

  /**
   * Unlikes a post idempotently.
   */
  async unlikePost(userId: string, postId: string): Promise<PostLikeResponse> {
    const post = await this.repository.findPostById(postId);
    if (!post || post.status === 'REMOVED') {
      throw new NotFoundError('Post not found');
    }

    await this.repository.unlikePost(userId, postId);
    const likeCount = await this.repository.getLikeCount(postId);

    return {
      postId,
      isLiked: false,
      likeCount,
    };
  }

  /**
   * Saves a post idempotently.
   */
  async savePost(userId: string, postId: string): Promise<SavedPostResponse> {
    const post = await this.repository.findPostById(postId);
    if (!post || post.status === 'REMOVED') {
      throw new NotFoundError('Post not found');
    }

    await this.repository.savePost(userId, postId);

    return {
      postId,
      isSaved: true,
    };
  }

  /**
   * Unsaves a post idempotently.
   */
  async unsavePost(userId: string, postId: string): Promise<SavedPostResponse> {
    const post = await this.repository.findPostById(postId);
    if (!post || post.status === 'REMOVED') {
      throw new NotFoundError('Post not found');
    }

    await this.repository.unsavePost(userId, postId);

    return {
      postId,
      isSaved: false,
    };
  }

  /**
   * Retrieves authenticated user's saved posts.
   */
  async getSavedPosts(
    userId: string,
    cursor?: string,
    rawLimit?: unknown,
  ): Promise<SavedPostsResponse> {
    const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 50);

    const savedRecords = await this.repository.getSavedPosts(userId, cursor, limit);

    // Filter out posts if author profile became private and viewer is not author
    const eligibleRecords = savedRecords.filter((s) => {
      if (s.post.author.profile?.profileVisibility === 'PRIVATE') {
        return s.post.authorId === userId;
      }
      return true;
    });

    const hasMore = eligibleRecords.length > limit;
    const paginatedItems = hasMore ? eligibleRecords.slice(0, limit) : eligibleRecords;
    const nextCursor =
      hasMore && paginatedItems.length > 0
        ? paginatedItems[paginatedItems.length - 1].post.id
        : null;

    return {
      posts: paginatedItems.map((s) => this.toPostSummary(s.post, userId)),
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }
}
