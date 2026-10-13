import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ReportsController } from './reports.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { requireAuth } from '../../middleware/auth.js';

export interface ReportsRoutesOptions {
  controller: ReportsController;
  authService: AuthService;
}

export const reportsRoutes: FastifyPluginAsync<ReportsRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ReportsRoutesOptions,
) => {
  const { controller, authService } = opts;

  // Submit a content report
  fastify.post('/', {
    preHandler: [requireAuth(authService)],
    handler: controller.submitReport,
  });
};
