import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CommentsController } from './comments.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';

export interface CommentsRoutesOptions {
  controller: CommentsController;
  authService: AuthService;
}

export const commentsRoutes: FastifyPluginAsync<CommentsRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: CommentsRoutesOptions,
) => {
  const { controller, authService } = opts;

  // Post comments
  fastify.post('/posts/:postId/comments', {
    preHandler: [requireAuth(authService)],
    handler: controller.createComment,
  });

  fastify.get('/posts/:postId/comments', {
    preHandler: [optionalAuth(authService)],
    handler: controller.getPostComments,
  });

  // Comment management
  fastify.delete('/comments/:commentId', {
    preHandler: [requireAuth(authService)],
    handler: controller.deleteComment,
  });

  fastify.get('/comments/:commentId', {
    preHandler: [optionalAuth(authService)],
    handler: controller.getComment,
  });
};
