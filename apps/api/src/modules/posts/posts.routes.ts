import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PostsController } from './posts.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';

export interface PostsRoutesOptions {
  controller: PostsController;
  authService: AuthService;
}

export const postsRoutes: FastifyPluginAsync<PostsRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PostsRoutesOptions,
) => {
  const { controller, authService } = opts;

  // 1. Create post
  fastify.post('/', {
    preHandler: [requireAuth(authService)],
    handler: controller.createPost,
  });

  // 2. Saved posts (Must be registered before /:postId)
  fastify.get('/saved', {
    preHandler: [requireAuth(authService)],
    handler: controller.getSavedPosts,
  });

  // 3. Retrieve single post
  fastify.get('/:postId', {
    preHandler: [optionalAuth(authService)],
    handler: controller.getPost,
  });

  // 4. Delete post (author only)
  fastify.delete('/:postId', {
    preHandler: [requireAuth(authService)],
    handler: controller.deletePost,
  });

  // 5. Like / Unlike post
  fastify.put('/:postId/like', {
    preHandler: [requireAuth(authService)],
    handler: controller.likePost,
  });

  fastify.delete('/:postId/like', {
    preHandler: [requireAuth(authService)],
    handler: controller.unlikePost,
  });

  // 6. Save / Unsave post
  fastify.put('/:postId/save', {
    preHandler: [requireAuth(authService)],
    handler: controller.savePost,
  });

  fastify.delete('/:postId/save', {
    preHandler: [requireAuth(authService)],
    handler: controller.unsavePost,
  });
};

export const feedRoutes: FastifyPluginAsync<PostsRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PostsRoutesOptions,
) => {
  const { controller, authService } = opts;

  // Feed endpoint
  fastify.get('/', {
    preHandler: [optionalAuth(authService)],
    handler: controller.getFeed,
  });
};
