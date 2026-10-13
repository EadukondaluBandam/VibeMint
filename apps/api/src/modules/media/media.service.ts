import crypto from 'node:crypto';
import {
  validateMediaUploadInit,
  validateMediaUploadComplete,
  MAX_IMAGE_FILE_SIZE,
  type AllowedImageMimeType,
} from '@vibemint/validation';
import type {
  MediaUploadInitResponse,
  MediaUploadCompleteResponse,
  MediaAssetSummary,
  SupportedImageMimeType,
} from '@vibemint/types';
import type { IMediaRepository, MediaAsset, MediaPurpose } from './media.types.js';
import type { IStorageProvider } from './storage/storage.interface.js';
import { validateImageBuffer } from './validation/image-validator.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../errors/app-error.js';

export class MediaService {
  constructor(
    private readonly repository: IMediaRepository,
    private readonly storageProvider: IStorageProvider,
    private readonly providerName = 'local',
  ) {}

  toMediaAssetSummary(asset: MediaAsset): MediaAssetSummary {
    return {
      id: asset.id,
      ownerId: asset.ownerId,
      mediaType: asset.mediaType,
      purpose: asset.purpose,
      storageKey: asset.storageKey,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
      status: asset.status,
      deliveryUrl: asset.deliveryUrl,
      checksum: asset.checksum,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }

  /**
   * Initiates a media upload request, validates declared parameters,
   * generates a short-lived presigned/direct upload authorization and records pending asset.
   */
  async initiateUpload(userId: string, input: unknown): Promise<MediaUploadInitResponse> {
    const validation = validateMediaUploadInit(input);
    if (!validation.success || !validation.data) {
      const firstError = Object.values(validation.errors || {})[0] || 'Invalid upload parameters';
      throw new BadRequestError(firstError);
    }

    const { mimeType, fileSize, purpose } = validation.data;

    // Generate safe, collision-resistant server-side object key
    const assetId = crypto.randomUUID();
    const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
    const storageKey = `uploads/${userId}/${assetId}${ext}`;

    const expiresInSeconds = 900; // 15 minutes
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Generate presigned upload URL or direct handler endpoint
    const uploadResult = await this.storageProvider.generateUploadUrl({
      storageKey,
      mimeType,
      maxSizeBytes: MAX_IMAGE_FILE_SIZE,
      expiresInSeconds,
    });

    // Record pending asset in database
    const asset = await this.repository.createMediaAsset({
      ownerId: userId,
      purpose,
      storageKey,
      storageProvider: this.providerName,
      mimeType,
      fileSize,
      expiresAt,
    });

    return {
      uploadId: asset.id,
      assetId: asset.id,
      uploadUrl: uploadResult.uploadUrl,
      uploadMethod: uploadResult.uploadMethod,
      uploadHeaders: uploadResult.uploadHeaders,
      storageKey: asset.storageKey,
      expiresAt: expiresAt.toISOString(),
      maxSizeBytes: MAX_IMAGE_FILE_SIZE,
      mimeType: asset.mimeType as SupportedImageMimeType,
      status: asset.status,
    };
  }

  /**
   * Verifies stored object content, extracts true dimensions, detects MIME spoofing,
   * and idempotently marks the asset READY.
   */
  async completeUpload(
    userId: string,
    uploadId: string,
    input?: unknown,
  ): Promise<MediaUploadCompleteResponse> {
    const validation = validateMediaUploadComplete(input);
    if (!validation.success) {
      const firstError = Object.values(validation.errors || {})[0] || 'Invalid complete payload';
      throw new BadRequestError(firstError);
    }

    const asset = await this.repository.findMediaAssetById(uploadId);
    if (!asset) {
      throw new NotFoundError('Media upload session not found');
    }

    // Ownership check: Users cannot finalize someone else's upload
    if (asset.ownerId !== userId) {
      throw new ForbiddenError('You do not own this media asset');
    }

    // Idempotency: If already verified and ready, return existing asset without re-processing
    if (asset.status === 'READY') {
      return {
        asset: this.toMediaAssetSummary(asset),
        message: 'Media asset is already verified and ready',
      };
    }

    // Expiration check for upload authorization
    if (asset.expiresAt && asset.expiresAt < new Date()) {
      await this.repository.updateMediaAsset(asset.id, { status: 'FAILED' });
      throw new BadRequestError('Upload authorization has expired. Please initiate a new upload.');
    }

    // 1. Verify object existence and metadata with storage provider
    const metadata = await this.storageProvider.verifyObject(asset.storageKey);
    if (!metadata || metadata.sizeBytes <= 0) {
      throw new BadRequestError('No uploaded file found in storage for this upload session');
    }

    if (metadata.sizeBytes > MAX_IMAGE_FILE_SIZE) {
      await this.repository.updateMediaAsset(asset.id, { status: 'FAILED' });
      throw new BadRequestError(
        `Uploaded file size exceeds the maximum limit of ${MAX_IMAGE_FILE_SIZE / (1024 * 1024)} MB`,
      );
    }

    // 2. Fetch object buffer from storage for server-side image verification
    const buffer = await this.storageProvider.getObjectBuffer(asset.storageKey);

    // 3. Verify magic bytes, extract true dimensions, prevent decompression bombs and MIME spoofing
    let imageInfo;
    try {
      imageInfo = validateImageBuffer(buffer, asset.mimeType as AllowedImageMimeType);
    } catch (err) {
      await this.repository.updateMediaAsset(asset.id, { status: 'FAILED' });
      throw err;
    }

    // 4. Compute delivery URL & content checksum
    const deliveryUrl = await this.storageProvider.getDeliveryUrl(asset.storageKey);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // 5. Update asset in database to READY
    const updated = await this.repository.updateMediaAsset(asset.id, {
      width: imageInfo.width,
      height: imageInfo.height,
      fileSize: buffer.length,
      mimeType: imageInfo.detectedMimeType,
      deliveryUrl,
      checksum,
      status: 'READY',
    });

    return {
      asset: this.toMediaAssetSummary(updated),
      message: 'Image upload verified and asset is ready for use',
    };
  }

  /**
   * Retrieves asset metadata by ID with ownership and visibility checks.
   */
  async getMediaAsset(userId: string, assetId: string): Promise<MediaAssetSummary> {
    const asset = await this.repository.findMediaAssetById(assetId);
    if (!asset || asset.status === 'DELETED') {
      throw new NotFoundError('Media asset not found');
    }

    // Private pending/failed assets can only be viewed by the owner
    if (asset.status !== 'READY' && asset.ownerId !== userId) {
      throw new ForbiddenError('Access to this media asset is forbidden');
    }

    return this.toMediaAssetSummary(asset);
  }

  /**
   * Deletes a media asset owned by the requesting user.
   */
  async deleteMediaAsset(userId: string, assetId: string): Promise<void> {
    const asset = await this.repository.findMediaAssetById(assetId);
    if (!asset || asset.status === 'DELETED') {
      throw new NotFoundError('Media asset not found');
    }

    if (asset.ownerId !== userId) {
      throw new ForbiddenError('Only the asset owner can delete this media asset');
    }

    // Clean up physical object from storage provider
    try {
      await this.storageProvider.deleteObject(asset.storageKey);
    } catch {
      // Proceed even if physical deletion encounters transient error
    }

    // Mark as DELETED to preserve auditability and prevent dangling references
    await this.repository.updateMediaAsset(asset.id, { status: 'DELETED' });
  }

  /**
   * Validates that an asset exists, belongs to the specified user,
   * matches the expected purpose, and is in READY status.
   */
  async verifyAssetForUse(
    userId: string,
    assetId: string,
    expectedPurpose: MediaPurpose,
  ): Promise<MediaAsset> {
    const asset = await this.repository.findMediaAssetById(assetId);
    if (!asset || asset.status === 'DELETED') {
      throw new NotFoundError(`Attached media asset "${assetId}" not found`);
    }

    if (asset.ownerId !== userId) {
      throw new ForbiddenError('You can only attach media assets that you own');
    }

    if (asset.status !== 'READY') {
      throw new BadRequestError(
        `Media asset cannot be attached because it is in status "${asset.status}". It must be "READY".`,
      );
    }

    if (asset.purpose !== expectedPurpose) {
      throw new BadRequestError(
        `Media asset has purpose "${asset.purpose}", but "${expectedPurpose}" is required.`,
      );
    }

    return asset;
  }
}
