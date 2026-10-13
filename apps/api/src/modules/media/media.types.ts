import type { MediaAsset, MediaStatus, MediaPurpose } from '@prisma/client';

export type { MediaAsset, MediaStatus, MediaPurpose };

export interface CreateMediaAssetData {
  ownerId: string;
  purpose: MediaPurpose;
  storageKey: string;
  storageProvider: string;
  mimeType: string;
  fileSize: number;
  expiresAt: Date;
}

export interface UpdateMediaAssetData {
  width?: number | null;
  height?: number | null;
  fileSize?: number;
  mimeType?: string;
  deliveryUrl?: string | null;
  checksum?: string | null;
  status: MediaStatus;
}

export interface IMediaRepository {
  createMediaAsset(data: CreateMediaAssetData): Promise<MediaAsset>;
  findMediaAssetById(id: string): Promise<MediaAsset | null>;
  findMediaAssetByStorageKey(storageKey: string): Promise<MediaAsset | null>;
  updateMediaAsset(id: string, data: UpdateMediaAssetData): Promise<MediaAsset>;
  deleteMediaAsset(id: string): Promise<void>;
  getUserMediaAssets(ownerId: string, limit?: number): Promise<MediaAsset[]>;
}
