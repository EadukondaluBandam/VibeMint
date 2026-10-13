import type {
  MediaUploadInitResponse,
  MediaUploadCompleteResponse,
  MediaAssetSummary,
  MediaPurpose,
  SupportedImageMimeType,
} from '@vibemint/types';
import { MAX_IMAGE_FILE_SIZE, ALLOWED_IMAGE_MIME_TYPES } from '@vibemint/validation';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000';

export interface UploadProgressCallback {
  (percentage: number): void;
}

export class WebMediaService {
  private readonly mediaUrl = `${API_BASE_URL}/api/v1/media`;

  /**
   * Validates file on client side before initiating network requests.
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file selected' };
    }

    const mime = file.type.toLowerCase().trim() as SupportedImageMimeType;
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
      return {
        valid: false,
        error: `Unsupported image format: "${file.type || 'unknown'}". Allowed formats: JPEG, PNG, WebP.`,
      };
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds the 10 MB limit (selected: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
      };
    }

    return { valid: true };
  }

  /**
   * Initiates an upload session and obtains signed/direct upload credentials.
   */
  async initUpload(file: File, purpose: MediaPurpose): Promise<MediaUploadInitResponse> {
    const res = await fetch(`${this.mediaUrl}/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        mimeType: file.type,
        fileSize: file.size,
        fileName: file.name,
        purpose,
      }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to initiate media upload');
    }

    return body as MediaUploadInitResponse;
  }

  /**
   * Uploads the binary file payload to the storage provider via XMLHttpRequest for progress monitoring.
   */
  async uploadToStorage(
    uploadUrl: string,
    uploadMethod: string,
    uploadHeaders: Record<string, string> | undefined,
    file: File,
    onProgress?: UploadProgressCallback,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(uploadMethod || 'PUT', uploadUrl, true);

      // Set custom upload headers from the provider
      if (uploadHeaders) {
        for (const [key, value] of Object.entries(uploadHeaders)) {
          xhr.setRequestHeader(key, value);
        }
      }

      if (!uploadHeaders?.['Content-Type']) {
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
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
          reject(new Error(`Storage upload failed with HTTP status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during file transport'));
      };

      xhr.onabort = () => {
        reject(new Error('Upload was cancelled'));
      };

      xhr.send(file);
    });
  }

  /**
   * Finalizes the upload session and prompts the server to verify the uploaded asset.
   */
  async completeUpload(uploadId: string): Promise<MediaUploadCompleteResponse> {
    const res = await fetch(`${this.mediaUrl}/uploads/${uploadId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Failed to verify uploaded asset');
    }

    return body as MediaUploadCompleteResponse;
  }

  /**
   * Full client upload flow: validation -> init -> upload -> complete.
   */
  async uploadImage(
    file: File,
    purpose: MediaPurpose,
    onProgress?: UploadProgressCallback,
  ): Promise<MediaAssetSummary> {
    const check = this.validateFile(file);
    if (!check.valid) {
      throw new Error(check.error);
    }

    // 1. Initialize upload session
    const init = await this.initUpload(file, purpose);

    // 2. Perform transport upload with progress tracking
    await this.uploadToStorage(
      init.uploadUrl,
      init.uploadMethod,
      init.uploadHeaders,
      file,
      onProgress,
    );

    // 3. Complete and verify asset on backend
    const complete = await this.completeUpload(init.uploadId);
    return complete.asset;
  }
}

export const webMediaService = new WebMediaService();
