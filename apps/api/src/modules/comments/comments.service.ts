import { validateCreateComment } from '@vibemint/validation';
import {
  ICommentsRepository,
  CommentWithAuthor,
  CommentSummary,
  CommentsResponse,
} from './comments.types.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../errors/app-error.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { IPostsRepository } from '../posts/posts.types.js';
import { IBlocksRepository } from '../blocks/blocks.types.js';

export class CommentsService {
  constructor(
    private readonly repository: ICommentsRepository,
    private readonly postsRepository: IPostsRepository,
    private readonly notificationsService?: NotificationsService | null,
    private readonly blocksRepository?: IBlocksRepository | null,
  ) {}

  toCommentSummary(comment: CommentWithAuthor): CommentSummary {
    return {
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      author: {
        id: comment.author.id,
        username: comment.author.profile?.username || 'anonymous',
        displayName: comment.author.profile?.displayName || 'VibeMint User',
        avatarUrl: comment.author.profile?.avatarUrl ?? null,
      },
      content: comment.content,
      status: comment.status,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  /**
   * Creates a new comment on a published post for the authenticated user.
   * Enforces post accessibility, profile visibility, and length validation.
   */
  async createComment(postId: string, authorId: string, input: unknown): Promise<CommentSummary> {
    const post = await this.postsRepository.findPostById(postId);
    if (!post || post.status === 'REMOVED') {
      throw new NotFoundError('Post not found');
    }

    // Profile visibility check on post author
    const isPostAuthor = authorId === post.authorId;
    if (post.author.profile?.profileVisibility === 'PRIVATE' && !isPostAuthor) {
      throw new ForbiddenError('This post is from a private account');
    }

    if (
      this.blocksRepository &&
      (await this.blocksRepository.isBlockedEither(authorId, post.authorId))
    ) {
      throw new ForbiddenError('Cannot comment on this post');
    }

    const validation = validateCreateComment(input);
    if (!validation.success || !validation.data) {
      const message = validation.errors
        ? Object.values(validation.errors).join(', ')
        : 'Invalid comment content';
      throw new BadRequestError(message);
    }

    const comment = await this.repository.createComment({
      postId,
      authorId,
      content: validation.data.content,
    });

    if (this.notificationsService && post.authorId !== authorId) {
      try {
        await this.notificationsService.createNotification({
          recipientId: post.authorId,
          actorId: authorId,
          type: 'POST_COMMENTED',
          resourceType: 'POST',
          resourceId: postId,
        });
      } catch {
        // Silently proceed on notification error
      }
    }

    return this.toCommentSummary(comment);
  }

  /**
   * Retrieves paginated comments for a post in chronological order.
   * Excludes removed comments and enforces private profile visibility.
   */
  async getPostComments(
    postId: string,
    viewerUserId?: string,
    cursor?: string,
    rawLimit?: unknown,
  ): Promise<CommentsResponse> {
    const post = await this.postsRepository.findPostById(postId);
    if (!post || post.status === 'REMOVED') {
      throw new NotFoundError('Post not found');
    }

    // Profile visibility check on post author
    const isPostAuthor = Boolean(viewerUserId && viewerUserId === post.authorId);
    if (post.author.profile?.profileVisibility === 'PRIVATE' && !isPostAuthor) {
      throw new ForbiddenError('This post is from a private account');
    }

    if (
      viewerUserId &&
      this.blocksRepository &&
      (await this.blocksRepository.isBlockedEither(viewerUserId, post.authorId))
    ) {
      throw new ForbiddenError('This post is not accessible');
    }

    const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 50);
    const comments = await this.repository.getPostComments(postId, cursor, limit);

    let blockedIds: Set<string> | null = null;
    if (viewerUserId && this.blocksRepository) {
      const { blockedUserIds, blockerUserIds } =
        await this.blocksRepository.getBlockedAndBlockerUserIds(viewerUserId);
      blockedIds = new Set([...blockedUserIds, ...blockerUserIds]);
    }

    const eligibleComments = blockedIds
      ? comments.filter((c) => !blockedIds?.has(c.authorId))
      : comments;

    const hasMore = eligibleComments.length > limit;
    const trimmed = hasMore ? eligibleComments.slice(0, limit) : eligibleComments;
    const nextCursor = hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null;

    return {
      comments: trimmed.map((c) => this.toCommentSummary(c)),
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Soft-removes a comment. Only the author of the comment is permitted to delete it.
   */
  async deleteComment(commentId: string, requesterUserId: string): Promise<void> {
    const comment = await this.repository.findCommentById(commentId);
    if (!comment || comment.status === 'REMOVED') {
      throw new NotFoundError('Comment not found');
    }

    if (comment.authorId !== requesterUserId) {
      throw new ForbiddenError('Only the comment author can remove their comment');
    }

    await this.repository.updateCommentStatus(commentId, 'REMOVED');
  }

  /**
   * Retrieves a single comment by ID.
   */
  async getCommentById(commentId: string, viewerUserId?: string): Promise<CommentSummary> {
    const comment = await this.repository.findCommentById(commentId);
    if (!comment || comment.status === 'REMOVED') {
      throw new NotFoundError('Comment not found');
    }

    const post = await this.postsRepository.findPostById(comment.postId);
    if (!post || post.status === 'REMOVED') {
      throw new NotFoundError('Post not found');
    }

    const isPostAuthor = Boolean(viewerUserId && viewerUserId === post.authorId);
    if (post.author.profile?.profileVisibility === 'PRIVATE' && !isPostAuthor) {
      throw new ForbiddenError('This post is from a private account');
    }

    return this.toCommentSummary(comment);
  }
}
