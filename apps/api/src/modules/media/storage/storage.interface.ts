export interface GenerateUploadUrlOptions {
  storageKey: string;
  mimeType: string;
  maxSizeBytes: number;
  expiresInSeconds?: number;
}

export interface UploadUrlResult {
  uploadUrl: string;
  uploadMethod: 'PUT' | 'POST';
  uploadHeaders?: Record<string, string>;
  expiresAt: Date;
}

export interface StorageObjectMetadata {
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
  eTag?: string;
  lastModified?: Date;
}

export interface IStorageProvider {
  /**
   * Generates a signed or direct upload URL with upload constraints and expiration.
   */
  generateUploadUrl(options: GenerateUploadUrlOptions): Promise<UploadUrlResult>;

  /**
   * Verifies that the object exists in storage and returns its true metadata.
   */
  verifyObject(storageKey: string): Promise<StorageObjectMetadata>;

  /**
   * Retrieves public delivery URL or signed read URL according to visibility policy.
   */
  getDeliveryUrl(storageKey: string): Promise<string>;

  /**
   * Deletes the stored object from storage.
   */
  deleteObject(storageKey: string): Promise<void>;

  /**
   * Retrieves the object buffer for server-side verification and inspection.
   */
  getObjectBuffer(storageKey: string): Promise<Buffer>;

  /**
   * Directly uploads or persists a buffer into storage.
   */
  putObject(storageKey: string, buffer: Buffer, mimeType: string): Promise<StorageObjectMetadata>;
}
