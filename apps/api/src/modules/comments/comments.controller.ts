import { FastifyRequest, FastifyReply } from 'fastify';
import { CommentsService } from './comments.service.js';
import { UnauthorizedError } from '../../errors/app-error.js';

export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  createComment = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { postId } = request.params as { postId: string };
    const comment = await this.commentsService.createComment(postId, request.user.id, request.body);
    return reply.status(201).send(comment);
  };

  getPostComments = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { postId } = request.params as { postId: string };
    const query = request.query as { cursor?: string; limit?: string };
    const result = await this.commentsService.getPostComments(
      postId,
      request.user?.id,
      query.cursor,
      query.limit,
    );
    return reply.status(200).send(result);
  };

  deleteComment = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { commentId } = request.params as { commentId: string };
    await this.commentsService.deleteComment(commentId, request.user.id);
    return reply.status(200).send({ success: true, message: 'Comment removed' });
  };

  getComment = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { commentId } = request.params as { commentId: string };
    const comment = await this.commentsService.getCommentById(commentId, request.user?.id);
    return reply.status(200).send(comment);
  };
}
