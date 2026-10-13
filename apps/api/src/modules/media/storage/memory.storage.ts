import crypto from 'node:crypto';
import type {
  IStorageProvider,
  GenerateUploadUrlOptions,
  UploadUrlResult,
  StorageObjectMetadata,
} from './storage.interface.js';
import { NotFoundError } from '../../../errors/app-error.js';

export class InMemoryStorageProvider implements IStorageProvider {
  public objects = new Map<string, { buffer: Buffer; mimeType: string; updatedAt: Date }>();
  private readonly baseUrl: string;

  constructor(baseUrl = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  async generateUploadUrl(options: GenerateUploadUrlOptions): Promise<UploadUrlResult> {
    const expiresIn = options.expiresInSeconds ?? 900;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      uploadUrl: `${this.baseUrl}/api/v1/media/upload-direct/${options.storageKey}`,
      uploadMethod: 'PUT',
      uploadHeaders: {
        'Content-Type': options.mimeType,
      },
      expiresAt,
    };
  }

  async verifyObject(storageKey: string): Promise<StorageObjectMetadata> {
    const item = this.objects.get(storageKey);
    if (!item) {
      throw new NotFoundError(`Storage object "${storageKey}" was not found in storage`);
    }

    const hash = crypto.createHash('md5').update(item.buffer).digest('hex');

    return {
      storageKey,
      sizeBytes: item.buffer.length,
      mimeType: item.mimeType,
      eTag: `"${hash}"`,
      lastModified: item.updatedAt,
    };
  }

  async getDeliveryUrl(storageKey: string): Promise<string> {
    return `${this.baseUrl}/api/v1/media/file/${storageKey}`;
  }

  async deleteObject(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
  }

  hasObject(storageKey: string): boolean {
    return this.objects.has(storageKey);
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const item = this.objects.get(storageKey);
    if (!item) {
      throw new NotFoundError(`Storage object "${storageKey}" was not found in storage`);
    }
    return item.buffer;
  }

  async putObject(
    storageKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageObjectMetadata> {
    const updatedAt = new Date();
    this.objects.set(storageKey, { buffer, mimeType, updatedAt });

    const hash = crypto.createHash('md5').update(buffer).digest('hex');

    return {
      storageKey,
      sizeBytes: buffer.length,
      mimeType,
      eTag: `"${hash}"`,
      lastModified: updatedAt,
    };
  }
}
