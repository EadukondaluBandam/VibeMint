import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { OnboardingController } from './onboarding.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { requireAuth } from '../../middleware/auth.js';

export interface OnboardingRoutesOptions {
  controller: OnboardingController;
  authService: AuthService;
}

export const onboardingRoutes: FastifyPluginAsync<OnboardingRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: OnboardingRoutesOptions,
) => {
  const { controller, authService } = opts;

  // 1. Get onboarding status
  fastify.get('/status', {
    preHandler: [requireAuth(authService)],
    handler: controller.getStatus,
  });

  // 2. Complete onboarding
  fastify.post('/complete', {
    preHandler: [requireAuth(authService)],
    handler: controller.complete,
  });
};
