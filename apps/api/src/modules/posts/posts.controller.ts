import { FastifyRequest, FastifyReply } from 'fastify';
import { PostsService } from './posts.service.js';
import { UnauthorizedError } from '../../errors/app-error.js';

export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  createPost = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const post = await this.postsService.createPost(request.user.id, request.body);
    return reply.status(201).send(post);
  };

  getPost = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { postId } = request.params as { postId: string };
    const post = await this.postsService.getPostById(postId, request.user?.id);
    return reply.status(200).send(post);
  };

  deletePost = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { postId } = request.params as { postId: string };
    await this.postsService.deletePost(postId, request.user.id);
    return reply.status(200).send({ success: true, message: 'Post removed' });
  };

  getFeed = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = request.query as { cursor?: string; limit?: string };
    const feed = await this.postsService.getFeed(request.user?.id, query.cursor, query.limit);
    return reply.status(200).send(feed);
  };

  likePost = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { postId } = request.params as { postId: string };
    const result = await this.postsService.likePost(request.user.id, postId);
    return reply.status(200).send(result);
  };

  unlikePost = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { postId } = request.params as { postId: string };
    const result = await this.postsService.unlikePost(request.user.id, postId);
    return reply.status(200).send(result);
  };

  savePost = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { postId } = request.params as { postId: string };
    const result = await this.postsService.savePost(request.user.id, postId);
    return reply.status(200).send(result);
  };

  unsavePost = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { postId } = request.params as { postId: string };
    const result = await this.postsService.unsavePost(request.user.id, postId);
    return reply.status(200).send(result);
  };

  getSavedPosts = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const query = request.query as { cursor?: string; limit?: string };
    const result = await this.postsService.getSavedPosts(
      request.user.id,
      query.cursor,
      query.limit,
    );
    return reply.status(200).send(result);
  };
}
