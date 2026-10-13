import { FastifyRequest, FastifyReply } from 'fastify';
import { BlocksService } from './blocks.service.js';
import { UnauthorizedError } from '../../errors/app-error.js';

export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  blockUser = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { userId } = request.params as { userId: string };
    const result = await this.blocksService.blockUser(request.user.id, userId);
    return reply.status(200).send(result);
  };

  unblockUser = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { userId } = request.params as { userId: string };
    const result = await this.blocksService.unblockUser(request.user.id, userId);
    return reply.status(200).send(result);
  };

  getBlockedUsers = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const query = request.query as { cursor?: string; limit?: string };
    const result = await this.blocksService.getBlockedUsers(
      request.user.id,
      query.cursor,
      query.limit,
    );
    return reply.status(200).send(result);
  };

  getBlockStatus = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { userId } = request.params as { userId: string };
    const result = await this.blocksService.getBlockStatus(request.user.id, userId);
    return reply.status(200).send(result);
  };
}
