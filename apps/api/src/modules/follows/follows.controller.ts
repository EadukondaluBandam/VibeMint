import { FastifyRequest, FastifyReply } from 'fastify';
import { FollowsService } from './follows.service.js';
import { UnauthorizedError } from '../../errors/app-error.js';

export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  followUser = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { userId } = request.params as { userId: string };
    const result = await this.followsService.followUser(request.user.id, userId);
    return reply.status(200).send(result);
  };

  unfollowUser = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { userId } = request.params as { userId: string };
    const result = await this.followsService.unfollowUser(request.user.id, userId);
    return reply.status(200).send(result);
  };

  getFollowStatus = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { userId } = request.params as { userId: string };
    const result = await this.followsService.getFollowStatus(request.user?.id, userId);
    return reply.status(200).send(result);
  };

  getFollowers = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { userId } = request.params as { userId: string };
    const query = request.query as { cursor?: string; limit?: string };
    const result = await this.followsService.getFollowers(
      userId,
      request.user?.id,
      query.cursor,
      query.limit,
    );
    return reply.status(200).send(result);
  };

  getFollowing = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { userId } = request.params as { userId: string };
    const query = request.query as { cursor?: string; limit?: string };
    const result = await this.followsService.getFollowing(
      userId,
      request.user?.id,
      query.cursor,
      query.limit,
    );
    return reply.status(200).send(result);
  };

  getFollowRequests = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const query = request.query as { cursor?: string; limit?: string };
    const result = await this.followsService.getFollowRequests(
      request.user.id,
      query.cursor,
      query.limit,
    );
    return reply.status(200).send(result);
  };

  acceptFollowRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { followerId } = request.params as { followerId: string };
    const result = await this.followsService.acceptFollowRequest(request.user.id, followerId);
    return reply.status(200).send(result);
  };

  rejectFollowRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { followerId } = request.params as { followerId: string };
    await this.followsService.rejectFollowRequest(request.user.id, followerId);
    return reply.status(200).send({ success: true, message: 'Follow request rejected' });
  };
}
