import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { InterestsController } from './interests.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { requireAuth } from '../../middleware/auth.js';

export interface InterestsRoutesOptions {
  controller: InterestsController;
  authService: AuthService;
}

export const interestsRoutes: FastifyPluginAsync<InterestsRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: InterestsRoutesOptions,
) => {
  const { controller, authService } = opts;

  // 1. List active interests (public/authenticated)
  fastify.get('/', {
    handler: controller.getInterests,
  });

  // 2. Get current user's selected interests
  fastify.get('/me', {
    preHandler: [requireAuth(authService)],
    handler: controller.getMyInterests,
  });

  // 3. Replace current user's selected interests
  fastify.put('/me', {
    preHandler: [requireAuth(authService)],
    handler: controller.updateMyInterests,
  });
};
