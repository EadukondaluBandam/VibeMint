import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { NotificationsController } from './notifications.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { requireAuth } from '../../middleware/auth.js';

export interface NotificationsRoutesOptions {
  controller: NotificationsController;
  authService: AuthService;
}

export const notificationsRoutes: FastifyPluginAsync<NotificationsRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: NotificationsRoutesOptions,
) => {
  const { controller, authService } = opts;

  // 1. Unread notification count
  fastify.get('/unread-count', {
    preHandler: [requireAuth(authService)],
    handler: controller.getUnreadCount,
  });

  // 2. Mark all notifications as read (registered before :notificationId)
  fastify.patch('/read-all', {
    preHandler: [requireAuth(authService)],
    handler: controller.markAllAsRead,
  });

  // 3. Mark single notification as read
  fastify.patch('/:notificationId/read', {
    preHandler: [requireAuth(authService)],
    handler: controller.markAsRead,
  });

  // 4. Paginated notifications list
  fastify.get('/', {
    preHandler: [requireAuth(authService)],
    handler: controller.getNotifications,
  });
};
