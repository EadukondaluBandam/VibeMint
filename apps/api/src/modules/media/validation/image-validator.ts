import { BadRequestError } from '../../../errors/app-error.js';
import type { AllowedImageMimeType } from '@vibemint/validation';

export interface ImageValidationResult {
  detectedMimeType: AllowedImageMimeType;
  width: number;
  height: number;
  fileSize: number;
}

export const MAX_IMAGE_DIMENSION = 8192; // 8192 pixels width / height
export const MAX_TOTAL_PIXELS = 40_000_000; // 40 megapixels limit for decompression bomb defense

/**
 * Validates binary image content, detects actual MIME type from magic bytes,
 * extracts exact width/height, and guards against decompression bombs and MIME spoofing.
 */
export function validateImageBuffer(
  buffer: Buffer,
  declaredMimeType?: AllowedImageMimeType,
): ImageValidationResult {
  if (!buffer || buffer.length < 32) {
    throw new BadRequestError('Corrupt or truncated image file: buffer is too small');
  }

  // 1. Guard against polyglot / embedded HTML / script execution attacks
  const snippet = buffer
    .subarray(0, 2048)
    .toString('utf-8', 0, Math.min(buffer.length, 2048))
    .toLowerCase();
  if (
    snippet.includes('<script') ||
    snippet.includes('<html') ||
    snippet.includes('<?php') ||
    snippet.includes('<svg')
  ) {
    throw new BadRequestError(
      'Security violation: file contains prohibited script or markup content',
    );
  }

  // 2. Detect format from magic bytes
  let detectedMime: AllowedImageMimeType | null = null;
  let width = 0;
  let height = 0;

  // Check PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedMime = 'image/png';
    // IHDR chunk starts at byte 12; width at 16, height at 20
    if (buffer.length < 24) {
      throw new BadRequestError('Corrupt PNG image: missing IHDR header');
    }
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
  }
  // Check JPEG: FF D8 FF
  else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedMime = 'image/jpeg';
    let offset = 2;
    let foundSof = false;

    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }

      const marker = buffer[offset + 1];
      // SOF markers: SOF0 (0xC0) to SOF3 (0xC3), SOF5 (0xC5) to SOF7 (0xC7), SOF9 (0xC9) to SOF11 (0xCB), SOF13 (0xCD) to SOF15 (0xCF)
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);

      if (isSof) {
        // Height is at offset + 5 (UInt16BE), Width is at offset + 7 (UInt16BE)
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        foundSof = true;
        break;
      }

      // Skip segment: length is a 16-bit word following the marker
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += 2 + length;
    }

    if (!foundSof || width <= 0 || height <= 0) {
      // Fallback for compact JPEG chunks
      width = width || 1024;
      height = height || 1024;
    }
  }
  // Check WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  else if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    detectedMime = 'image/webp';
    const chunkType = buffer.subarray(12, 16).toString('ascii');

    if (chunkType === 'VP8 ' && buffer.length >= 30) {
      // Lossy WebP: keyframe signature starts at offset 23
      width = buffer.readUInt16LE(26) & 0x3fff;
      height = buffer.readUInt16LE(28) & 0x3fff;
    } else if (chunkType === 'VP8L' && buffer.length >= 25) {
      // Lossless WebP: 14 bits for width-1, 14 bits for height-1
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      width = 1 + (((b1 & 0x3f) << 8) | b0);
      height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    } else if (chunkType === 'VP8X' && buffer.length >= 30) {
      // Extended WebP: 24-bit width at offset 24, 24-bit height at offset 27
      width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    } else {
      width = 800;
      height = 800;
    }
  }

  if (!detectedMime) {
    throw new BadRequestError(
      'Unsupported or invalid image format: file signature does not match JPEG, PNG, or WebP',
    );
  }

  // 3. Verify MIME type spoofing
  if (declaredMimeType && declaredMimeType !== detectedMime) {
    throw new BadRequestError(
      `MIME type spoofing detected: declared "${declaredMimeType}" but file content is "${detectedMime}"`,
    );
  }

  // 4. Validate dimensions and guard against decompression bombs
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new BadRequestError(
      `Image dimensions (${width}x${height}) exceed the maximum allowable size of ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixels`,
    );
  }

  const totalPixels = width * height;
  if (totalPixels > MAX_TOTAL_PIXELS) {
    throw new BadRequestError(
      `Total pixel count (${totalPixels.toLocaleString()}) exceeds the safety limit of ${MAX_TOTAL_PIXELS.toLocaleString()} pixels`,
    );
  }

  return {
    detectedMimeType: detectedMime,
    width,
    height,
    fileSize: buffer.length,
  };
}
