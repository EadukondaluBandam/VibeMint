import { FastifyRequest, FastifyReply } from 'fastify';
import { InterestsService } from './interests.service.js';
import { UnauthorizedError } from '../../errors/app-error.js';

export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  getInterests = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = request.query as { category?: string };
    const list = await this.interestsService.listActiveInterests(query.category);
    return reply.status(200).send(list);
  };

  getMyInterests = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const list = await this.interestsService.getUserInterests(request.user.id);
    return reply.status(200).send(list);
  };

  updateMyInterests = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const list = await this.interestsService.replaceUserInterests(request.user.id, request.body);
    return reply.status(200).send(list);
  };
}
