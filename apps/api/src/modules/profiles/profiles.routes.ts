import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ProfilesController } from './profiles.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';

export interface ProfilesRoutesOptions {
  controller: ProfilesController;
  authService: AuthService;
}

export const profilesRoutes: FastifyPluginAsync<ProfilesRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ProfilesRoutesOptions,
) => {
  const { controller, authService } = opts;

  // 1. Authenticated user's profile
  fastify.get('/me', {
    preHandler: [requireAuth(authService)],
    handler: controller.getMyProfile,
  });

  fastify.put('/me', {
    preHandler: [requireAuth(authService)],
    handler: controller.updateMyProfile,
  });

  // 2. Check username availability (optional auth to identify self)
  fastify.get('/username-availability', {
    preHandler: [optionalAuth(authService)],
    handler: controller.checkUsernameAvailability,
  });

  // 3. Public / visibility-checked profile lookup by username
  fastify.get('/:username', {
    preHandler: [optionalAuth(authService)],
    handler: controller.getProfileByUsername,
  });
};
