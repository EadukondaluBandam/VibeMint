import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { FollowsController } from './follows.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';

export interface FollowsRoutesOptions {
  controller: FollowsController;
  authService: AuthService;
}

export const followsRoutes: FastifyPluginAsync<FollowsRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: FollowsRoutesOptions,
) => {
  const { controller, authService } = opts;

  // 1. Follow Requests for current user (registered before :userId parameters)
  fastify.get('/me/follow-requests', {
    preHandler: [requireAuth(authService)],
    handler: controller.getFollowRequests,
  });

  fastify.put('/me/follow-requests/:followerId/accept', {
    preHandler: [requireAuth(authService)],
    handler: controller.acceptFollowRequest,
  });

  fastify.delete('/me/follow-requests/:followerId', {
    preHandler: [requireAuth(authService)],
    handler: controller.rejectFollowRequest,
  });

  // 2. Follow / Unfollow user
  fastify.put('/:userId/follow', {
    preHandler: [requireAuth(authService)],
    handler: controller.followUser,
  });

  fastify.delete('/:userId/follow', {
    preHandler: [requireAuth(authService)],
    handler: controller.unfollowUser,
  });

  // 3. Follow status for viewer
  fastify.get('/:userId/follow-status', {
    preHandler: [optionalAuth(authService)],
    handler: controller.getFollowStatus,
  });

  // 4. Followers and Following lists
  fastify.get('/:userId/followers', {
    preHandler: [optionalAuth(authService)],
    handler: controller.getFollowers,
  });

  fastify.get('/:userId/following', {
    preHandler: [optionalAuth(authService)],
    handler: controller.getFollowing,
  });
};
