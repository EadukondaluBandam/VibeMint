import {
  validateCreateReport,
  validateUpdateReportStatus,
  validateAdminReportQueueFilters,
  type ValidReportStatus,
} from '@vibemint/validation';
import type {
  CreateReportResponse,
  AdminReportListResponse,
  AdminReportDetailResponse,
  AdminReportStatsResponse,
  UpdateReportStatusResponse,
  ReportedTargetDetail,
} from '@vibemint/types';
import type { IReportsRepository } from './reports.types.js';
import type { IAuthRepository } from '../auth/auth.repository.js';
import type { IProfileRepository } from '../profiles/profiles.repository.js';
import type { IPostsRepository } from '../posts/posts.types.js';
import type { ICommentsRepository } from '../comments/comments.types.js';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';

export class ReportsService {
  constructor(
    private readonly repository: IReportsRepository,
    private readonly authRepository?: IAuthRepository | null,
    private readonly postsRepository?: IPostsRepository | null,
    private readonly commentsRepository?: ICommentsRepository | null,
    private readonly profileRepository?: IProfileRepository | null,
  ) {}

  /**
   * Submits a new content report or handles duplicate submission idempotently.
   */
  async submitReport(reporterId: string, input: unknown): Promise<CreateReportResponse> {
    const validation = validateCreateReport(input);
    if (!validation.success || !validation.data) {
      const firstError = Object.values(validation.errors || {})[0] || 'Invalid report payload';
      throw new BadRequestError(firstError);
    }

    const { targetType, targetId, reason, description } = validation.data;

    // Validate that target exists and reporter is not reporting their own content
    switch (targetType) {
      case 'USER': {
        if (targetId === reporterId) {
          throw new BadRequestError('You cannot report yourself');
        }
        if (this.authRepository) {
          const user = await this.authRepository.findUserById(targetId);
          if (!user || user.status === 'DEACTIVATED') {
            throw new NotFoundError('Reported user not found');
          }
        }
        break;
      }
      case 'POST': {
        if (this.postsRepository) {
          const post = await this.postsRepository.findPostById(targetId);
          if (!post || post.status === 'REMOVED') {
            throw new NotFoundError('Reported post not found');
          }
          if (post.authorId === reporterId) {
            throw new BadRequestError('You cannot report your own post');
          }
        }
        break;
      }
      case 'COMMENT': {
        if (this.commentsRepository) {
          const comment = await this.commentsRepository.findCommentById(targetId);
          if (!comment || comment.status === 'REMOVED') {
            throw new NotFoundError('Reported comment not found');
          }
          if (comment.authorId === reporterId) {
            throw new BadRequestError('You cannot report your own comment');
          }
        }
        break;
      }
      default:
        throw new BadRequestError(`Invalid target type: ${targetType}`);
    }

    // Check for duplicate pending report to ensure idempotency on repeated client clicks
    const existing = await this.repository.findActiveReport(reporterId, targetType, targetId);
    if (existing) {
      return {
        id: existing.id,
        targetType: existing.targetType,
        targetId: existing.targetId,
        reason: existing.reason,
        status: existing.status,
        createdAt: existing.createdAt.toISOString(),
        message: 'Report has already been submitted and is under review',
        isDuplicate: true,
      };
    }

    // Persist new report
    const created = await this.repository.createReport({
      reporterId,
      targetType,
      targetId,
      reason,
      description,
    });

    return {
      id: created.id,
      targetType: created.targetType,
      targetId: created.targetId,
      reason: created.reason,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
      message: 'Report submitted successfully. Thank you for helping keep our community safe.',
      isDuplicate: false,
    };
  }

  /**
   * Retrieves the administrator reports queue with filters and cursor pagination.
   */
  async getAdminReportsQueue(query: unknown): Promise<AdminReportListResponse> {
    const validation = validateAdminReportQueueFilters(query);
    if (!validation.success || !validation.data) {
      const firstError =
        Object.values(validation.errors || {})[0] || 'Invalid queue filter parameters';
      throw new BadRequestError(firstError);
    }

    const result = await this.repository.getAdminReportsQueue(validation.data);

    const reports = await Promise.all(
      result.reports.map(async (r) => {
        let title = `${r.targetType} Target: ${r.targetId.slice(0, 8)}...`;
        let subtitle: string | undefined = `ID: ${r.targetId}`;
        let authorUsername: string | undefined;
        let isUnavailable = false;

        try {
          if (r.targetType === 'USER') {
            if (this.profileRepository) {
              const profile = await this.profileRepository.findProfileByUserId(r.targetId);
              if (profile) {
                title = `@${profile.username} (${profile.displayName})`;
                authorUsername = profile.username;
              } else {
                title = `User ${r.targetId.slice(0, 8)}...`;
              }
            } else if (this.authRepository) {
              const user = await this.authRepository.findUserById(r.targetId);
              if (user) {
                title = user.email;
              } else {
                isUnavailable = true;
                title = 'Unavailable User';
              }
            }
          } else if (r.targetType === 'POST') {
            if (this.postsRepository) {
              const post = await this.postsRepository.findPostById(r.targetId);
              if (post) {
                authorUsername =
                  post.author?.profile?.username ||
                  (post.author as unknown as { username?: string })?.username;
                title = post.caption
                  ? `"${post.caption.slice(0, 40)}..."`
                  : `Post by ${authorUsername || post.authorId.slice(0, 8)}`;
                subtitle = `Author: @${authorUsername || post.authorId.slice(0, 8)}`;
                isUnavailable = post.status === 'REMOVED';
              } else {
                isUnavailable = true;
                title = 'Unavailable / Deleted Post';
              }
            }
          } else if (r.targetType === 'COMMENT') {
            if (this.commentsRepository) {
              const comment = await this.commentsRepository.findCommentById(r.targetId);
              if (comment) {
                authorUsername =
                  comment.author?.profile?.username ||
                  (comment.author as unknown as { username?: string })?.username;
                title = `"${comment.content.slice(0, 40)}..."`;
                subtitle = `By @${authorUsername || comment.authorId.slice(0, 8)} on post ${comment.postId.slice(0, 8)}`;
                isUnavailable = comment.status === 'REMOVED';
              } else {
                isUnavailable = true;
                title = 'Unavailable / Deleted Comment';
              }
            }
          }
        } catch {
          // Failure resolving target context must never crash the queue
          isUnavailable = true;
        }

        return {
          id: r.id,
          targetType: r.targetType,
          targetId: r.targetId,
          reason: r.reason,
          description: r.description,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
          reporter: {
            id: r.reporter.id,
            email: r.reporter.email,
          },
          targetSummary: {
            title,
            subtitle,
            authorUsername,
            isUnavailable,
          },
        };
      }),
    );

    return {
      reports,
      pagination: {
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },
      totalCount: result.totalCount,
    };
  }

  /**
   * Retrieves full report details, safe target preview, reporter metadata, and audit trail.
   */
  async getAdminReportDetail(reportId: string): Promise<AdminReportDetailResponse> {
    const report = await this.repository.getAdminReportDetail(reportId);
    if (!report) {
      throw new NotFoundError('Report not found');
    }

    // Safely resolve reported target details
    let target: ReportedTargetDetail;

    switch (report.targetType) {
      case 'USER': {
        try {
          const user = this.authRepository
            ? await this.authRepository.findUserById(report.targetId)
            : null;
          const profile = this.profileRepository
            ? await this.profileRepository.findProfileByUserId(report.targetId)
            : null;

          if (!user) {
            target = {
              type: 'USER',
              exists: false,
              isUnavailable: true,
              data: null,
            };
          } else {
            target = {
              type: 'USER',
              exists: true,
              isUnavailable: user.status === 'DEACTIVATED',
              data: {
                id: user.id,
                email: user.email,
                username: profile?.username || user.email.split('@')[0],
                displayName: profile?.displayName || 'User',
                avatarUrl: profile?.avatarUrl ?? null,
                status: user.status,
                suspendedAt: user.suspendedAt ? user.suspendedAt.toISOString() : null,
                suspendedUntil: user.suspendedUntil ? user.suspendedUntil.toISOString() : null,
                suspensionReason: user.suspensionReason ?? null,
                bio: profile?.bio ?? null,
                createdAt: user.createdAt.toISOString(),
              },
            };
          }
        } catch {
          target = { type: 'USER', exists: false, isUnavailable: true, data: null };
        }
        break;
      }

      case 'POST': {
        try {
          const post = this.postsRepository
            ? await this.postsRepository.findPostById(report.targetId)
            : null;
          if (!post) {
            target = {
              type: 'POST',
              exists: false,
              isUnavailable: true,
              data: null,
            };
          } else {
            const authorUsername =
              post.author?.profile?.username ||
              (post.author as unknown as { username?: string })?.username ||
              'user';
            const authorDisplayName =
              post.author?.profile?.displayName ||
              (post.author as unknown as { displayName?: string })?.displayName ||
              'User';

            target = {
              type: 'POST',
              exists: true,
              isUnavailable: post.status === 'REMOVED',
              data: {
                id: post.id,
                authorId: post.authorId,
                authorUsername,
                authorDisplayName,
                caption: post.caption ?? null,
                imageUrl: post.imageUrl ?? null,
                isRemoved: post.status === 'REMOVED',
                createdAt: post.createdAt.toISOString(),
              },
            };
          }
        } catch {
          target = { type: 'POST', exists: false, isUnavailable: true, data: null };
        }
        break;
      }

      case 'COMMENT': {
        try {
          const comment = this.commentsRepository
            ? await this.commentsRepository.findCommentById(report.targetId)
            : null;
          if (!comment) {
            target = {
              type: 'COMMENT',
              exists: false,
              isUnavailable: true,
              data: null,
            };
          } else {
            const authorUsername =
              comment.author?.profile?.username ||
              (comment.author as unknown as { username?: string })?.username ||
              'user';
            const authorDisplayName =
              comment.author?.profile?.displayName ||
              (comment.author as unknown as { displayName?: string })?.displayName ||
              'User';

            target = {
              type: 'COMMENT',
              exists: true,
              isUnavailable: comment.status === 'REMOVED',
              data: {
                id: comment.id,
                postId: comment.postId,
                authorId: comment.authorId,
                authorUsername,
                authorDisplayName,
                content: comment.content,
                isRemoved: comment.status === 'REMOVED',
                createdAt: comment.createdAt.toISOString(),
              },
            };
          }
        } catch {
          target = { type: 'COMMENT', exists: false, isUnavailable: true, data: null };
        }
        break;
      }

      default:
        target = { type: 'USER', exists: false, isUnavailable: true, data: null };
    }

    return {
      report: {
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
        resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
      },
      reporter: {
        id: report.reporter.id,
        email: report.reporter.email,
        createdAt: report.reporter.createdAt
          ? report.reporter.createdAt.toISOString()
          : report.createdAt.toISOString(),
      },
      target,
      auditLogs: report.auditLogs.map((log) => ({
        id: log.id,
        reportId: log.reportId,
        adminId: log.adminId,
        adminEmail: log.admin?.email ?? undefined,
        action: log.action,
        previousStatus: log.previousStatus,
        newStatus: log.newStatus,
        decisionNote: log.decisionNote,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Retrieves summary counts of reports by status for the admin dashboard.
   */
  async getReportStats(): Promise<AdminReportStatsResponse> {
    const stats = await this.repository.getReportStats();
    return {
      counts: stats,
    };
  }

  /**
   * Validates status transition and atomically applies the status update with audit logging.
   */
  async updateReportStatus(
    reportId: string,
    adminId: string,
    input: unknown,
  ): Promise<UpdateReportStatusResponse> {
    // Check report existence first
    const existing = await this.repository.findReportById(reportId);
    if (!existing) {
      throw new NotFoundError('Report not found');
    }

    // Validate transition policy and decision note
    const validation = validateUpdateReportStatus(existing.status as ValidReportStatus, input);
    if (!validation.success || !validation.data) {
      const firstError = Object.values(validation.errors || {})[0] || 'Invalid status transition';
      throw new BadRequestError(firstError);
    }

    const { status: newStatus, decisionNote, expectedStatus } = validation.data;

    // Execute atomic update with concurrency check and audit log creation
    const result = await this.repository.updateReportStatusAtomic({
      reportId,
      adminId,
      newStatus,
      decisionNote,
      expectedStatus,
    });

    return {
      report: {
        id: result.report.id,
        status: result.report.status,
        resolvedAt: result.report.resolvedAt ? result.report.resolvedAt.toISOString() : null,
        updatedAt: result.report.updatedAt.toISOString(),
      },
      auditLog: {
        id: result.auditLog.id,
        reportId: result.auditLog.reportId,
        adminId: result.auditLog.adminId,
        adminEmail: result.auditLog.admin?.email ?? undefined,
        action: result.auditLog.action,
        previousStatus: result.auditLog.previousStatus,
        newStatus: result.auditLog.newStatus,
        decisionNote: result.auditLog.decisionNote,
        createdAt: result.auditLog.createdAt.toISOString(),
      },
      message: result.isNoop
        ? 'Report is already in the requested status'
        : `Report status updated to ${result.report.status} successfully`,
    };
  }
}
