import {
  validateAdminRemoveContent,
  validateAdminRestoreContent,
  validateAdminSuspendUser,
  validateAdminUnsuspendUser,
} from '@vibemint/validation';
import type { ReportTargetType } from '@prisma/client';
import type {
  IModerationRepository,
  ModerationActionWithAdmin,
  ModerationActionSummary,
  ModerationHistoryResponse,
  AdminEnforcementActionResult,
} from './moderation.types.js';
import type { IAuthRepository } from '../auth/auth.repository.js';
import type { IPostsRepository } from '../posts/posts.types.js';
import type { ICommentsRepository } from '../comments/comments.types.js';
import type { IReportsRepository } from '../reports/reports.types.js';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';

export class ModerationService {
  constructor(
    private readonly repository: IModerationRepository,
    private readonly authRepository: IAuthRepository,
    private readonly postsRepository: IPostsRepository,
    private readonly commentsRepository: ICommentsRepository,
    private readonly reportsRepository?: IReportsRepository | null,
  ) {}

  toActionSummary(action: ModerationActionWithAdmin): ModerationActionSummary {
    return {
      id: action.id,
      adminId: action.adminId,
      adminEmail: action.admin?.email,
      adminUsername: action.admin?.profile?.username || 'admin',
      targetType: action.targetType,
      targetId: action.targetId,
      actionType: action.actionType,
      reason: action.reason,
      reportId: action.reportId ?? null,
      suspendedUntil: action.suspendedUntil ? action.suspendedUntil.toISOString() : null,
      metadata: (action.metadata as Record<string, unknown>) ?? null,
      createdAt: action.createdAt.toISOString(),
    };
  }

  private async verifyReportExists(reportId?: string | null): Promise<void> {
    if (!reportId || !this.reportsRepository) return;
    const report = await this.reportsRepository.findReportById(reportId);
    if (!report) {
      throw new NotFoundError('Associated report not found');
    }
  }

  /**
   * Removes or hides a post from normal discovery, feeds, and timelines.
   */
  async removePost(
    adminId: string,
    postId: string,
    input: unknown,
  ): Promise<AdminEnforcementActionResult> {
    const validation = validateAdminRemoveContent(input);
    if (!validation.success || !validation.data) {
      const firstError = Object.values(validation.errors || {})[0] || 'Invalid removal payload';
      throw new BadRequestError(firstError);
    }

    await this.verifyReportExists(validation.data.reportId);

    const post = await this.postsRepository.findPostById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    if (post.status === 'REMOVED') {
      throw new BadRequestError('Post is already removed');
    }

    await this.postsRepository.updatePostStatus(postId, 'REMOVED');

    const action = await this.repository.createAction({
      adminId,
      targetType: 'POST',
      targetId: postId,
      actionType: 'REMOVE_POST',
      reason: validation.data.reason,
      reportId: validation.data.reportId ?? null,
    });

    return {
      success: true,
      message: 'Post removed successfully',
      action: this.toActionSummary(action),
      targetState: {
        id: postId,
        status: 'REMOVED',
        isRemoved: true,
      },
    };
  }

  /**
   * Restores a previously removed post back to published status.
   */
  async restorePost(
    adminId: string,
    postId: string,
    input: unknown,
  ): Promise<AdminEnforcementActionResult> {
    const validation = validateAdminRestoreContent(input);
    if (!validation.success || !validation.data) {
      const firstError = Object.values(validation.errors || {})[0] || 'Invalid restoration payload';
      throw new BadRequestError(firstError);
    }

    await this.verifyReportExists(validation.data.reportId);

    const post = await this.postsRepository.findPostById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    if (post.status === 'PUBLISHED') {
      throw new BadRequestError('Post is already published');
    }

    await this.postsRepository.updatePostStatus(postId, 'PUBLISHED');

    const action = await this.repository.createAction({
      adminId,
      targetType: 'POST',
      targetId: postId,
      actionType: 'RESTORE_POST',
      reason: validation.data.reason,
      reportId: validation.data.reportId ?? null,
    });

    return {
      success: true,
      message: 'Post restored successfully',
      action: this.toActionSummary(action),
      targetState: {
        id: postId,
        status: 'PUBLISHED',
        isRemoved: false,
      },
    };
  }

  /**
   * Removes or hides a comment from comment lists and replies.
   */
  async removeComment(
    adminId: string,
    commentId: string,
    input: unknown,
  ): Promise<AdminEnforcementActionResult> {
    const validation = validateAdminRemoveContent(input);
    if (!validation.success || !validation.data) {
      const firstError = Object.values(validation.errors || {})[0] || 'Invalid removal payload';
      throw new BadRequestError(firstError);
    }

    await this.verifyReportExists(validation.data.reportId);

    const comment = await this.commentsRepository.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.status === 'REMOVED') {
      throw new BadRequestError('Comment is already removed');
    }

    await this.commentsRepository.updateCommentStatus(commentId, 'REMOVED');

    const action = await this.repository.createAction({
      adminId,
      targetType: 'COMMENT',
      targetId: commentId,
      actionType: 'REMOVE_COMMENT',
      reason: validation.data.reason,
      reportId: validation.data.reportId ?? null,
    });

    return {
      success: true,
      message: 'Comment removed successfully',
      action: this.toActionSummary(action),
      targetState: {
        id: commentId,
        status: 'REMOVED',
        isRemoved: true,
      },
    };
  }

  /**
   * Restores a previously removed comment back to published status.
   */
  async restoreComment(
    adminId: string,
    commentId: string,
    input: unknown,
  ): Promise<AdminEnforcementActionResult> {
    const validation = validateAdminRestoreContent(input);
    if (!validation.success || !validation.data) {
      const firstError = Object.values(validation.errors || {})[0] || 'Invalid restoration payload';
      throw new BadRequestError(firstError);
    }

    await this.verifyReportExists(validation.data.reportId);

    const comment = await this.commentsRepository.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.status === 'PUBLISHED') {
      throw new BadRequestError('Comment is already published');
    }

    await this.commentsRepository.updateCommentStatus(commentId, 'PUBLISHED');

    const action = await this.repository.createAction({
      adminId,
      targetType: 'COMMENT',
      targetId: commentId,
      actionType: 'RESTORE_COMMENT',
      reason: validation.data.reason,
      reportId: validation.data.reportId ?? null,
    });

    return {
      success: true,
      message: 'Comment restored successfully',
      action: this.toActionSummary(action),
      targetState: {
        id: commentId,
        status: 'PUBLISHED',
        isRemoved: false,
      },
    };
  }

  /**
   * Suspends a user account (temporary or permanent) and revokes all active sessions.
   */
  async suspendUser(
    adminId: string,
    userId: string,
    input: unknown,
  ): Promise<AdminEnforcementActionResult> {
    const validation = validateAdminSuspendUser(input);
    if (!validation.success || !validation.data) {
      const firstError = Object.values(validation.errors || {})[0] || 'Invalid suspension payload';
      throw new BadRequestError(firstError);
    }

    await this.verifyReportExists(validation.data.reportId);

    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (userId === adminId) {
      throw new BadRequestError('Administrators cannot suspend their own account');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestError('Administrators cannot be suspended');
    }

    let suspendedUntil: Date | null = null;
    if (validation.data.durationDays && validation.data.durationDays > 0) {
      suspendedUntil = new Date(Date.now() + validation.data.durationDays * 24 * 60 * 60 * 1000);
    }

    // Update account suspension state
    await this.authRepository.updateUserSuspension(userId, {
      status: 'SUSPENDED',
      suspendedAt: new Date(),
      suspendedUntil,
      suspensionReason: validation.data.reason,
    });

    // Revoke all active sessions immediately
    await this.authRepository.revokeAllUserSessions(userId);

    const action = await this.repository.createAction({
      adminId,
      targetType: 'USER',
      targetId: userId,
      actionType: 'SUSPEND_USER',
      reason: validation.data.reason,
      reportId: validation.data.reportId ?? null,
      suspendedUntil,
    });

    return {
      success: true,
      message: suspendedUntil
        ? `User suspended until ${suspendedUntil.toISOString()}`
        : 'User suspended permanently',
      action: this.toActionSummary(action),
      targetState: {
        id: userId,
        status: 'SUSPENDED',
        suspendedUntil: suspendedUntil ? suspendedUntil.toISOString() : null,
      },
    };
  }

  /**
   * Unsuspends or restores an account when an authorized administrator decides to do so.
   */
  async unsuspendUser(
    adminId: string,
    userId: string,
    input: unknown,
  ): Promise<AdminEnforcementActionResult> {
    const validation = validateAdminUnsuspendUser(input);
    if (!validation.success || !validation.data) {
      const firstError =
        Object.values(validation.errors || {})[0] || 'Invalid unsuspension payload';
      throw new BadRequestError(firstError);
    }

    await this.verifyReportExists(validation.data.reportId);

    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.status !== 'SUSPENDED') {
      throw new BadRequestError('User is not currently suspended');
    }

    await this.authRepository.updateUserSuspension(userId, {
      status: 'ACTIVE',
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
    });

    const action = await this.repository.createAction({
      adminId,
      targetType: 'USER',
      targetId: userId,
      actionType: 'UNSUSPEND_USER',
      reason: validation.data.reason,
      reportId: validation.data.reportId ?? null,
    });

    return {
      success: true,
      message: 'User unsuspended successfully',
      action: this.toActionSummary(action),
      targetState: {
        id: userId,
        status: 'ACTIVE',
        suspendedUntil: null,
      },
    };
  }

  /**
   * Retrieves full moderation history for a target.
   */
  async getTargetModerationHistory(
    targetType: string,
    targetId: string,
  ): Promise<ModerationHistoryResponse> {
    const upperType = targetType.toUpperCase() as ReportTargetType;
    if (upperType !== 'USER' && upperType !== 'POST' && upperType !== 'COMMENT') {
      throw new BadRequestError(`Invalid target type: ${targetType}`);
    }

    const actions = await this.repository.getActionsForTarget(upperType, targetId);
    return {
      targetType: upperType,
      targetId,
      actions: actions.map((a) => this.toActionSummary(a)),
      total: actions.length,
    };
  }
}
