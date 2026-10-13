import { FastifyRequest, FastifyReply } from 'fastify';
import { ReportsService } from '../reports/reports.service.js';
import { ModerationService } from '../moderation/moderation.service.js';

export class AdminController {
  constructor(
    private readonly reportsService?: ReportsService | null,
    private readonly moderationService?: ModerationService | null,
  ) {}

  /**
   * Returns the authenticated administrator's verified identity.
   */
  async getMe(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    return reply.status(200).send({
      user: request.user,
    });
  }

  /**
   * Retrieves the paginated administrator reports moderation queue.
   */
  async getReportsQueue(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.reportsService) {
      return reply.status(500).send({ message: 'Reports service unavailable' });
    }
    const result = await this.reportsService.getAdminReportsQueue(request.query);
    return reply.status(200).send(result);
  }

  /**
   * Retrieves summary metric counts for reports dashboard.
   */
  async getReportStats(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.reportsService) {
      return reply.status(500).send({ message: 'Reports service unavailable' });
    }
    const result = await this.reportsService.getReportStats();
    return reply.status(200).send(result);
  }

  /**
   * Retrieves full report detail, reported target inspection, and audit trail.
   */
  async getReportDetail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.reportsService) {
      return reply.status(500).send({ message: 'Reports service unavailable' });
    }
    const { reportId } = request.params as { reportId: string };
    const result = await this.reportsService.getAdminReportDetail(reportId);
    return reply.status(200).send(result);
  }

  /**
   * Updates report status with decision note and records an audit log entry.
   */
  async updateReportStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.reportsService) {
      return reply.status(500).send({ message: 'Reports service unavailable' });
    }
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const { reportId } = request.params as { reportId: string };
    const adminId = request.user.id;
    const result = await this.reportsService.updateReportStatus(reportId, adminId, request.body);
    return reply.status(200).send(result);
  }

  /**
   * Removes or hides a reported post.
   */
  async removePost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.moderationService) {
      return reply.status(500).send({ message: 'Moderation service unavailable' });
    }
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const { postId } = request.params as { postId: string };
    const result = await this.moderationService.removePost(request.user.id, postId, request.body);
    return reply.status(200).send(result);
  }

  /**
   * Restores a previously removed post.
   */
  async restorePost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.moderationService) {
      return reply.status(500).send({ message: 'Moderation service unavailable' });
    }
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const { postId } = request.params as { postId: string };
    const result = await this.moderationService.restorePost(request.user.id, postId, request.body);
    return reply.status(200).send(result);
  }

  /**
   * Removes or hides a reported comment.
   */
  async removeComment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.moderationService) {
      return reply.status(500).send({ message: 'Moderation service unavailable' });
    }
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const { commentId } = request.params as { commentId: string };
    const result = await this.moderationService.removeComment(
      request.user.id,
      commentId,
      request.body,
    );
    return reply.status(200).send(result);
  }

  /**
   * Restores a previously removed comment.
   */
  async restoreComment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.moderationService) {
      return reply.status(500).send({ message: 'Moderation service unavailable' });
    }
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const { commentId } = request.params as { commentId: string };
    const result = await this.moderationService.restoreComment(
      request.user.id,
      commentId,
      request.body,
    );
    return reply.status(200).send(result);
  }

  /**
   * Suspends a user account (temporary or permanent).
   */
  async suspendUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.moderationService) {
      return reply.status(500).send({ message: 'Moderation service unavailable' });
    }
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const { userId } = request.params as { userId: string };
    const result = await this.moderationService.suspendUser(request.user.id, userId, request.body);
    return reply.status(200).send(result);
  }

  /**
   * Unsuspends or restores an account.
   */
  async unsuspendUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.moderationService) {
      return reply.status(500).send({ message: 'Moderation service unavailable' });
    }
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const { userId } = request.params as { userId: string };
    const result = await this.moderationService.unsuspendUser(
      request.user.id,
      userId,
      request.body,
    );
    return reply.status(200).send(result);
  }

  /**
   * Retrieves moderation enforcement action history for a target.
   */
  async getTargetModerationHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!this.moderationService) {
      return reply.status(500).send({ message: 'Moderation service unavailable' });
    }
    const { targetType, targetId } = request.params as { targetType: string; targetId: string };
    const result = await this.moderationService.getTargetModerationHistory(targetType, targetId);
    return reply.status(200).send(result);
  }
}
