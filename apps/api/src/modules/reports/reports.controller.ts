import { FastifyRequest, FastifyReply } from 'fastify';
import { ReportsService } from './reports.service.js';
import { UnauthorizedError } from '../../errors/app-error.js';

export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  submitReport = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await this.reportsService.submitReport(request.user.id, request.body);
    // Return 201 for new reports, 200 for idempotent duplicate responses
    const statusCode = result.isDuplicate ? 200 : 201;
    return reply.status(statusCode).send(result);
  };
}
