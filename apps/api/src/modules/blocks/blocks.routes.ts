import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { BlocksController } from './blocks.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { requireAuth } from '../../middleware/auth.js';

export interface BlocksRoutesOptions {
  controller: BlocksController;
  authService: AuthService;
}

export const blocksRoutes: FastifyPluginAsync<BlocksRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: BlocksRoutesOptions,
) => {
  const { controller, authService } = opts;

  // 1. List blocked users for authenticated user (registered before :userId)
  fastify.get('/me/blocked-users', {
    preHandler: [requireAuth(authService)],
    handler: controller.getBlockedUsers,
  });

  // 2. Block user
  fastify.put('/:userId/block', {
    preHandler: [requireAuth(authService)],
    handler: controller.blockUser,
  });

  // 3. Unblock user
  fastify.delete('/:userId/block', {
    preHandler: [requireAuth(authService)],
    handler: controller.unblockUser,
  });

  // 4. Block status between viewer and target user
  fastify.get('/:userId/block-status', {
    preHandler: [requireAuth(authService)],
    handler: controller.getBlockStatus,
  });
};
