import crypto from 'node:crypto';
import type {
  IStorageProvider,
  GenerateUploadUrlOptions,
  UploadUrlResult,
  StorageObjectMetadata,
} from './storage.interface.js';
import { NotFoundError } from '../../../errors/app-error.js';

export interface S3StorageConfig {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucket?: string;
  endpoint?: string;
  cdnUrl?: string;
}

export class S3StorageProvider implements IStorageProvider {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly region: string;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly cdnUrl?: string;

  constructor(config: S3StorageConfig = {}) {
    const accessKeyId = config.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    const bucket = config.bucket || process.env.AWS_S3_BUCKET;
    const region = config.region || process.env.AWS_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        'Configuration Error: S3StorageProvider requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET environment variables.',
      );
    }

    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
    this.bucket = bucket;
    this.endpoint =
      config.endpoint ||
      process.env.AWS_S3_ENDPOINT ||
      `https://${bucket}.s3.${region}.amazonaws.com`;
    this.cdnUrl = config.cdnUrl || process.env.MEDIA_CDN_URL;
  }

  public getBucketName(): string {
    return this.bucket;
  }

  private getSignatureKey(
    key: string,
    dateStamp: string,
    regionName: string,
    serviceName: string,
  ): Buffer {
    const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
    return crypto.createHmac('sha256', kService).update('aws4_request').digest();
  }

  async generateUploadUrl(options: GenerateUploadUrlOptions): Promise<UploadUrlResult> {
    const expiresIn = options.expiresInSeconds ?? 900;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const canonicalUri = `/${encodeURIComponent(options.storageKey)}`;

    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresIn),
      'X-Amz-SignedHeaders': 'host',
    };

    const host = new URL(this.endpoint).host;
    const canonicalHeaders = `host:${host}\n`;
    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.getSignatureKey(this.secretAccessKey, dateStamp, this.region, 's3');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const signedUrl = `${this.endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    return {
      uploadUrl: signedUrl,
      uploadMethod: 'PUT',
      uploadHeaders: {
        'Content-Type': options.mimeType,
      },
      expiresAt: new Date(now.getTime() + expiresIn * 1000),
    };
  }

  async verifyObject(storageKey: string): Promise<StorageObjectMetadata> {
    const url = `${this.endpoint}/${encodeURIComponent(storageKey)}`;

    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.status === 404) {
        throw new NotFoundError(`Storage object "${storageKey}" was not found in S3 bucket`);
      }
      if (!res.ok) {
        throw new Error(`S3 HEAD verification failed with HTTP status ${res.status}`);
      }

      const contentLength = res.headers.get('content-length');
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const eTag = res.headers.get('etag') || undefined;

      return {
        storageKey,
        sizeBytes: contentLength ? Number(contentLength) : 0,
        mimeType: contentType,
        eTag,
        lastModified: new Date(),
      };
    } catch (err: unknown) {
      if (err instanceof NotFoundError) throw err;
      throw new NotFoundError(
        `Storage object "${storageKey}" could not be verified in S3: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getDeliveryUrl(storageKey: string): Promise<string> {
    if (this.cdnUrl) {
      return `${this.cdnUrl.replace(/\/$/, '')}/${encodeURIComponent(storageKey)}`;
    }
    return `${this.endpoint}/${encodeURIComponent(storageKey)}`;
  }

  async deleteObject(storageKey: string): Promise<void> {
    const url = `${this.endpoint}/${encodeURIComponent(storageKey)}`;
    await fetch(url, { method: 'DELETE' }).catch(() => {});
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const url = `${this.endpoint}/${encodeURIComponent(storageKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new NotFoundError(`Storage object "${storageKey}" was not found in S3`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async putObject(
    storageKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageObjectMetadata> {
    const url = `${this.endpoint}/${encodeURIComponent(storageKey)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(buffer.length),
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      throw new Error(`Failed to upload object to S3: status ${res.status}`);
    }

    const hash = crypto.createHash('md5').update(buffer).digest('hex');

    return {
      storageKey,
      sizeBytes: buffer.length,
      mimeType,
      eTag: `"${hash}"`,
      lastModified: new Date(),
    };
  }
}
