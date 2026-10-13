import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthController } from './auth.controller.js';

export interface AuthRoutesOptions {
  controller: AuthController;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AuthRoutesOptions,
) => {
  const { controller } = opts;

  // Registration endpoint
  fastify.post('/signup', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    handler: controller.signup,
  });

  // Login endpoint
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 15,
        timeWindow: '1 minute',
      },
    },
    handler: controller.login,
  });

  // Logout endpoint
  fastify.post('/logout', {
    handler: controller.logout,
  });

  // Current authenticated user endpoint
  fastify.get('/me', {
    handler: controller.me,
  });
};
