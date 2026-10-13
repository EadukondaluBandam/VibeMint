import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  IStorageProvider,
  GenerateUploadUrlOptions,
  UploadUrlResult,
  StorageObjectMetadata,
} from './storage.interface.js';
import { NotFoundError } from '../../../errors/app-error.js';

export class LocalStorageProvider implements IStorageProvider {
  private readonly baseDir: string;
  private readonly baseUrl: string;

  constructor(baseDir?: string, baseUrl = 'http://localhost:4000') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Configuration Error: LocalStorageProvider cannot be used in production environments. Please configure S3-compatible cloud object storage.',
      );
    }

    this.baseDir = baseDir || path.resolve(process.cwd(), '.data', 'uploads');
    this.baseUrl = baseUrl;

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolveFilePath(storageKey: string): string {
    // Prevent directory traversal attacks
    const safeKey = storageKey.replace(/(\.\.[/\\])+/g, '');
    return path.join(this.baseDir, safeKey);
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
    const filePath = this.resolveFilePath(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError(`Storage object "${storageKey}" was not found on disk`);
    }

    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash('md5').update(content).digest('hex');

    // Basic extension-to-mime map
    const ext = path.extname(storageKey).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    return {
      storageKey,
      sizeBytes: stats.size,
      mimeType,
      eTag: `"${hash}"`,
      lastModified: stats.mtime,
    };
  }

  async getDeliveryUrl(storageKey: string): Promise<string> {
    return `${this.baseUrl}/api/v1/media/file/${storageKey}`;
  }

  async deleteObject(storageKey: string): Promise<void> {
    const filePath = this.resolveFilePath(storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const filePath = this.resolveFilePath(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError(`Storage object "${storageKey}" was not found on disk`);
    }
    return fs.readFileSync(filePath);
  }

  async putObject(
    storageKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageObjectMetadata> {
    const filePath = this.resolveFilePath(storageKey);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);
    const stats = fs.statSync(filePath);
    const hash = crypto.createHash('md5').update(buffer).digest('hex');

    return {
      storageKey,
      sizeBytes: stats.size,
      mimeType,
      eTag: `"${hash}"`,
      lastModified: stats.mtime,
    };
  }
}
