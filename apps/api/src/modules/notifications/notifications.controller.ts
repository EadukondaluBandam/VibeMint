import { FastifyRequest, FastifyReply } from 'fastify';
import { NotificationsService } from './notifications.service.js';
import { UnauthorizedError } from '../../errors/app-error.js';

export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  getNotifications = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const query = request.query as { cursor?: string; limit?: string };
    const result = await this.notificationsService.getNotifications(
      request.user.id,
      query.cursor,
      query.limit,
    );
    return reply.status(200).send(result);
  };

  getUnreadCount = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await this.notificationsService.getUnreadCount(request.user.id);
    return reply.status(200).send(result);
  };

  markAsRead = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { notificationId } = request.params as { notificationId: string };
    const result = await this.notificationsService.markAsRead(request.user.id, notificationId);
    return reply.status(200).send(result);
  };

  markAllAsRead = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await this.notificationsService.markAllAsRead(request.user.id);
    return reply.status(200).send(result);
  };
}
