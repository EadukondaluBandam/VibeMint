import { FastifyRequest, FastifyReply } from 'fastify';
import { OnboardingService } from './onboarding.service.js';
import { UnauthorizedError } from '../../errors/app-error.js';

export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  getStatus = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const status = await this.onboardingService.getStatus(request.user.id);
    return reply.status(200).send(status);
  };

  complete = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await this.onboardingService.complete(request.user.id);
    return reply.status(200).send(result);
  };
}
