import { FastifyRequest, FastifyReply } from 'fastify';
import { ProfilesService } from './profiles.service.js';
import { parseAndValidateProfileUpdate } from './profiles.schema.js';
import { BadRequestError, UnauthorizedError } from '../../errors/app-error.js';

export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  getMyProfile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const profile = await this.profilesService.getMyProfile(request.user.id);
    return reply.status(200).send(profile);
  };

  updateMyProfile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const data = parseAndValidateProfileUpdate(request.body);
    const profile = await this.profilesService.createOrUpdateProfile(request.user.id, data);
    return reply.status(200).send(profile);
  };

  getProfileByUsername = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { username } = request.params as { username: string };
    if (!username) {
      throw new BadRequestError('Username is required');
    }

    const viewerUserId = request.user?.id;
    const profile = await this.profilesService.getProfileByUsername(username, viewerUserId);
    return reply.status(200).send(profile);
  };

  checkUsernameAvailability = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const query = request.query as { username?: string };
    if (!query.username) {
      throw new BadRequestError('Username query parameter is required');
    }

    const currentUserId = request.user?.id;
    const result = await this.profilesService.checkUsernameAvailability(
      query.username,
      currentUserId,
    );
    return reply.status(200).send(result);
  };
}
