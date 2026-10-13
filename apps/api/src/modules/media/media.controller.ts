import { FastifyRequest, FastifyReply } from 'fastify';
import { MediaService } from './media.service.js';
import type { IStorageProvider } from './storage/storage.interface.js';

export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly storageProvider: IStorageProvider,
  ) {}

  /**
   * Initiates a new media upload session.
   */
  async initUpload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const result = await this.mediaService.initiateUpload(request.user.id, request.body);
    return reply.status(201).send(result);
  }

  /**
   * Finalizes an upload and verifies the stored content.
   */
  async completeUpload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const { uploadId } = request.params as { uploadId: string };
    const result = await this.mediaService.completeUpload(request.user.id, uploadId, request.body);
    return reply.status(200).send(result);
  }

  /**
   * Retrieves asset metadata by ID.
   */
  async getMediaAsset(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const { mediaId } = request.params as { mediaId: string };
    const asset = await this.mediaService.getMediaAsset(request.user.id, mediaId);
    return reply.status(200).send({ asset });
  }

  /**
   * Deletes an asset owned by the requesting user.
   */
  async deleteMediaAsset(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const { mediaId } = request.params as { mediaId: string };
    await this.mediaService.deleteMediaAsset(request.user.id, mediaId);
    return reply.status(200).send({ message: 'Media asset deleted successfully' });
  }

  /**
   * Direct upload endpoint used for local development / testing transport.
   */
  async handleDirectUpload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const rawPath = (request.params as Record<string, string>)['*'] || '';
    const storageKey = rawPath.replace(/^\/+/, '');
    const contentType = request.headers['content-type'] || 'application/octet-stream';

    // Body could be buffer or raw binary
    const buffer = Buffer.isBuffer(request.body)
      ? request.body
      : typeof request.body === 'string'
        ? Buffer.from(request.body, 'binary')
        : Buffer.from((request as unknown as { rawBody?: Buffer }).rawBody || []);

    const metadata = await this.storageProvider.putObject(storageKey, buffer, contentType);
    return reply.status(200).send(metadata);
  }

  /**
   * Serves file for local development / testing delivery URLs.
   */
  async serveLocalFile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const rawPath = (request.params as Record<string, string>)['*'] || '';
    const storageKey = rawPath.replace(/^\/+/, '');
    const buffer = await this.storageProvider.getObjectBuffer(storageKey);
    const metadata = await this.storageProvider.verifyObject(storageKey);

    return reply
      .header('Content-Type', metadata.mimeType)
      .header('Content-Length', buffer.length)
      .header('Cache-Control', 'public, max-age=86400')
      .status(200)
      .send(buffer);
  }
}
