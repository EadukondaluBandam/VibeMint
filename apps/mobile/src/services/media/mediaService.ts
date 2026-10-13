import type {
  MediaUploadInitResponse,
  MediaUploadCompleteResponse,
  MediaAssetSummary,
  MediaPurpose,
  SupportedImageMimeType,
} from '@vibemint/types';
import { MAX_IMAGE_FILE_SIZE, ALLOWED_IMAGE_MIME_TYPES } from '@vibemint/validation';
import { secureStorage } from '../auth/secureStorage';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

const API_BASE_URL = process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export interface MobileUploadProgressCallback {
  (percentage: number): void;
}

export interface PickedImageInfo {
  uri: string;
  mimeType?: string;
  fileSize?: number;
  fileName?: string;
  width?: number;
  height?: number;
}

export class MobileMediaService {
  private readonly mediaUrl = `${API_BASE_URL}/api/v1/media`;

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await secureStorage.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Validates local image constraints before starting network transmission.
   */
  validateImage(image: PickedImageInfo): { valid: boolean; error?: string } {
    const rawMime = (image.mimeType || 'image/jpeg').toLowerCase().trim() as SupportedImageMimeType;
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(rawMime)) {
      return {
        valid: false,
        error: `Unsupported image format: "${rawMime}". Allowed formats: JPEG, PNG, WebP.`,
      };
    }

    if (image.fileSize && image.fileSize > MAX_IMAGE_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds 10 MB limit (size: ${(image.fileSize / (1024 * 1024)).toFixed(2)} MB).`,
      };
    }

    return { valid: true };
  }

  /**
   * Initiates media upload session with server authorization.
   */
  async initUpload(
    mimeType: string,
    fileSize: number,
    purpose: MediaPurpose,
    fileName?: string,
  ): Promise<MediaUploadInitResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.mediaUrl}/uploads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mimeType,
        fileSize,
        fileName: fileName || 'mobile_photo.jpg',
        purpose,
      }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to initiate upload');
    }

    return body as MediaUploadInitResponse;
  }

  /**
   * Uploads local file binary to storage provider via XMLHttpRequest for progress tracking.
   */
  async uploadBinary(
    uploadUrl: string,
    uploadMethod: string,
    uploadHeaders: Record<string, string> | undefined,
    uri: string,
    mimeType: string,
    onProgress?: MobileUploadProgressCallback,
  ): Promise<void> {
    // Read binary blob from local URI
    const response = await fetch(uri);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(uploadMethod || 'PUT', uploadUrl, true);

      if (uploadHeaders) {
        for (const [key, value] of Object.entries(uploadHeaders)) {
          xhr.setRequestHeader(key, value);
        }
      }

      if (!uploadHeaders?.['Content-Type']) {
        xhr.setRequestHeader('Content-Type', mimeType || 'application/octet-stream');
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Storage transport failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network failure during image transport'));
      xhr.onabort = () => reject(new Error('Image upload cancelled'));

      xhr.send(blob);
    });
  }

  /**
   * Finalizes upload and prompts the server to verify the uploaded asset.
   */
  async completeUpload(uploadId: string): Promise<MediaUploadCompleteResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.mediaUrl}/uploads/${uploadId}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to finalize media asset');
    }

    return body as MediaUploadCompleteResponse;
  }

  /**
   * Full pipeline: client validation -> init -> binary upload -> complete.
   */
  async uploadPickedImage(
    image: PickedImageInfo,
    purpose: MediaPurpose,
    onProgress?: MobileUploadProgressCallback,
  ): Promise<MediaAssetSummary> {
    const check = this.validateImage(image);
    if (!check.valid) {
      throw new Error(check.error);
    }

    const mimeType = (image.mimeType || 'image/jpeg').toLowerCase();
    const fileSize = image.fileSize || 1024 * 100; // sensible fallback if size unavailable

    // 1. Authorize upload
    const init = await this.initUpload(mimeType, fileSize, purpose, image.fileName);

    // 2. Binary transport
    await this.uploadBinary(
      init.uploadUrl,
      init.uploadMethod,
      init.uploadHeaders,
      image.uri,
      mimeType,
      onProgress,
    );

    // 3. Complete and verify
    const complete = await this.completeUpload(init.uploadId);
    return complete.asset;
  }
}

export const mobileMediaService = new MobileMediaService();
