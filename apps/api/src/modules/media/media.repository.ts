import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  IMediaRepository,
  CreateMediaAssetData,
  UpdateMediaAssetData,
  MediaAsset,
} from './media.types.js';

export class PrismaMediaRepository implements IMediaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMediaAsset(data: CreateMediaAssetData): Promise<MediaAsset> {
    return this.prisma.mediaAsset.create({
      data: {
        ownerId: data.ownerId,
        mediaType: 'IMAGE',
        purpose: data.purpose,
        storageKey: data.storageKey,
        storageProvider: data.storageProvider,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        status: 'PENDING_UPLOAD',
        expiresAt: data.expiresAt,
      },
    });
  }

  async findMediaAssetById(id: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findUnique({
      where: { id },
    });
  }

  async findMediaAssetByStorageKey(storageKey: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findUnique({
      where: { storageKey },
    });
  }

  async updateMediaAsset(id: string, data: UpdateMediaAssetData): Promise<MediaAsset> {
    return this.prisma.mediaAsset.update({
      where: { id },
      data: {
        width: data.width,
        height: data.height,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        deliveryUrl: data.deliveryUrl,
        checksum: data.checksum,
        status: data.status,
      },
    });
  }

  async deleteMediaAsset(id: string): Promise<void> {
    await this.prisma.mediaAsset.delete({
      where: { id },
    });
  }

  async getUserMediaAssets(ownerId: string, limit = 50): Promise<MediaAsset[]> {
    return this.prisma.mediaAsset.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export class InMemoryMediaRepository implements IMediaRepository {
  public assets = new Map<string, MediaAsset>();
  private sequence = 0;

  async createMediaAsset(data: CreateMediaAssetData): Promise<MediaAsset> {
    const id = crypto.randomUUID();
    const now = new Date(Date.now() + this.sequence++);

    const asset: MediaAsset = {
      id,
      ownerId: data.ownerId,
      mediaType: 'IMAGE',
      purpose: data.purpose,
      storageKey: data.storageKey,
      storageProvider: data.storageProvider,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      width: null,
      height: null,
      status: 'PENDING_UPLOAD',
      deliveryUrl: null,
      checksum: null,
      expiresAt: data.expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    this.assets.set(id, asset);
    return { ...asset };
  }

  async findMediaAssetById(id: string): Promise<MediaAsset | null> {
    const asset = this.assets.get(id);
    return asset ? { ...asset } : null;
  }

  async findMediaAssetByStorageKey(storageKey: string): Promise<MediaAsset | null> {
    for (const asset of this.assets.values()) {
      if (asset.storageKey === storageKey) {
        return { ...asset };
      }
    }
    return null;
  }

  async updateMediaAsset(id: string, data: UpdateMediaAssetData): Promise<MediaAsset> {
    const current = this.assets.get(id);
    if (!current) {
      throw new Error(`Media asset "${id}" not found`);
    }

    const now = new Date(Date.now() + this.sequence++);
    const updated: MediaAsset = {
      ...current,
      width: data.width !== undefined ? data.width : current.width,
      height: data.height !== undefined ? data.height : current.height,
      fileSize: data.fileSize !== undefined ? data.fileSize : current.fileSize,
      mimeType: data.mimeType !== undefined ? data.mimeType : current.mimeType,
      deliveryUrl: data.deliveryUrl !== undefined ? data.deliveryUrl : current.deliveryUrl,
      checksum: data.checksum !== undefined ? data.checksum : current.checksum,
      status: data.status,
      updatedAt: now,
    };

    this.assets.set(id, updated);
    return { ...updated };
  }

  async deleteMediaAsset(id: string): Promise<void> {
    this.assets.delete(id);
  }

  async getUserMediaAssets(ownerId: string, limit = 50): Promise<MediaAsset[]> {
    return Array.from(this.assets.values())
      .filter((a) => a.ownerId === ownerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }
}
