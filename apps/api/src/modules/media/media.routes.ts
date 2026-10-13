import { FastifyInstance } from 'fastify';
import { AuthService } from '../auth/auth.service.js';
import { MediaController } from './media.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export interface MediaRoutesOptions {
  controller: MediaController;
  authService: AuthService;
}

export async function mediaRoutes(
  app: FastifyInstance,
  options: MediaRoutesOptions,
): Promise<void> {
  const { controller, authService } = options;

  // Add buffer content parser for direct binary uploads
  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'],
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  // POST /api/v1/media/uploads - Initiate upload session
  app.post('/uploads', {
    preHandler: [requireAuth(authService)],
    handler: controller.initUpload.bind(controller),
  });

  // POST /api/v1/media/uploads/:uploadId/complete - Verify and finalize upload
  app.post('/uploads/:uploadId/complete', {
    preHandler: [requireAuth(authService)],
    handler: controller.completeUpload.bind(controller),
  });

  // GET /api/v1/media/:mediaId - Retrieve authorized asset metadata
  app.get('/:mediaId', {
    preHandler: [requireAuth(authService)],
    handler: controller.getMediaAsset.bind(controller),
  });

  // DELETE /api/v1/media/:mediaId - Delete asset owned by requesting user
  app.delete('/:mediaId', {
    preHandler: [requireAuth(authService)],
    handler: controller.deleteMediaAsset.bind(controller),
  });

  // Local development / testing transport routes
  app.put('/upload-direct/*', {
    handler: controller.handleDirectUpload.bind(controller),
  });

  app.get('/file/*', {
    handler: controller.serveLocalFile.bind(controller),
  });
}
