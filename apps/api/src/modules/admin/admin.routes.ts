import { FastifyInstance } from 'fastify';
import { AuthService } from '../auth/auth.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { AdminController } from './admin.controller.js';
import { requireAdmin } from '../../middleware/auth.js';

export function adminRoutes(
  authService: AuthService,
  reportsService?: ReportsService | null,
  moderationService?: ModerationService | null,
) {
  const controller = new AdminController(reportsService, moderationService);

  return async (app: FastifyInstance): Promise<void> => {
    // GET /api/v1/admin/me - Protected administrator identity verification
    app.get('/me', {
      preHandler: [requireAdmin(authService)],
      handler: controller.getMe.bind(controller),
    });

    // GET /api/v1/admin/reports/stats - Report summary counts
    app.get('/reports/stats', {
      preHandler: [requireAdmin(authService)],
      handler: controller.getReportStats.bind(controller),
    });

    // GET /api/v1/admin/reports - Moderation report queue list with filters & cursor pagination
    app.get('/reports', {
      preHandler: [requireAdmin(authService)],
      handler: controller.getReportsQueue.bind(controller),
    });

    // GET /api/v1/admin/reports/:reportId - Full report details with target preview & audit logs
    app.get('/reports/:reportId', {
      preHandler: [requireAdmin(authService)],
      handler: controller.getReportDetail.bind(controller),
    });

    // PATCH /api/v1/admin/reports/:reportId/status - Validated status update with audit record
    app.patch('/reports/:reportId/status', {
      preHandler: [requireAdmin(authService)],
      handler: controller.updateReportStatus.bind(controller),
    });

    // POST /api/v1/admin/moderation/posts/:postId/remove - Remove or hide a reported post
    app.post('/moderation/posts/:postId/remove', {
      preHandler: [requireAdmin(authService)],
      handler: controller.removePost.bind(controller),
    });

    // POST /api/v1/admin/moderation/posts/:postId/restore - Restore a previously removed post
    app.post('/moderation/posts/:postId/restore', {
      preHandler: [requireAdmin(authService)],
      handler: controller.restorePost.bind(controller),
    });

    // POST /api/v1/admin/moderation/comments/:commentId/remove - Remove or hide a reported comment
    app.post('/moderation/comments/:commentId/remove', {
      preHandler: [requireAdmin(authService)],
      handler: controller.removeComment.bind(controller),
    });

    // POST /api/v1/admin/moderation/comments/:commentId/restore - Restore a previously removed comment
    app.post('/moderation/comments/:commentId/restore', {
      preHandler: [requireAdmin(authService)],
      handler: controller.restoreComment.bind(controller),
    });

    // POST /api/v1/admin/moderation/users/:userId/suspend - Suspend a user account
    app.post('/moderation/users/:userId/suspend', {
      preHandler: [requireAdmin(authService)],
      handler: controller.suspendUser.bind(controller),
    });

    // POST /api/v1/admin/moderation/users/:userId/unsuspend - Unsuspend a user account
    app.post('/moderation/users/:userId/unsuspend', {
      preHandler: [requireAdmin(authService)],
      handler: controller.unsuspendUser.bind(controller),
    });

    // GET /api/v1/admin/moderation/history/:targetType/:targetId - Moderation history
    app.get('/moderation/history/:targetType/:targetId', {
      preHandler: [requireAdmin(authService)],
      handler: controller.getTargetModerationHistory.bind(controller),
    });
  };
}
