import { useState, useRef, type FC, type FormEvent, type ChangeEvent } from 'react';
import type { PostSummary, MediaAssetSummary } from '@vibemint/types';
import { MAX_POST_CAPTION_LENGTH, validateCreatePost } from '@vibemint/validation';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { Card, Button, Input } from '../ui';
import { webPostsService } from '../../services/posts/postsService';
import { webMediaService } from '../../services/media/mediaService';

export interface CreatePostCardProps {
  onPostCreated: (post: PostSummary) => void;
}

export const CreatePostCard: FC<CreatePostCardProps> = ({ onPostCreated }) => {
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<MediaAssetSummary | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setErrorMessage(null);

    const check = webMediaService.validateFile(file);
    if (!check.valid) {
      setUploadError(check.error || 'Invalid file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploadProgress(0);
    setIsUploading(true);

    try {
      const asset = await webMediaService.uploadImage(file, 'POST_IMAGE', (percent) => {
        setUploadProgress(percent);
      });
      setUploadedAsset(asset);
      setUploadProgress(100);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setUploadedAsset(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedAsset(null);
    setUploadProgress(0);
    setUploadError(null);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRetryUpload = async () => {
    if (!selectedFile) return;
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const asset = await webMediaService.uploadImage(selectedFile, 'POST_IMAGE', (percent) => {
        setUploadProgress(percent);
      });
      setUploadedAsset(asset);
      setUploadProgress(100);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Retry failed. Please check network.');
      setUploadedAsset(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isUploading) {
      setErrorMessage('Please wait for image upload to complete');
      return;
    }

    const validation = validateCreatePost({
      caption: caption.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      mediaAssetId: uploadedAsset?.id || undefined,
    });

    if (!validation.success || !validation.data) {
      const msg = validation.errors
        ? Object.values(validation.errors).join(', ')
        : 'Please enter a caption or attach an image';
      setErrorMessage(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const post = await webPostsService.createPost({
        caption: validation.data.caption,
        imageUrl: validation.data.imageUrl,
        mediaAssetId: validation.data.mediaAssetId,
      });

      setCaption('');
      setImageUrl('');
      setShowImageUrlInput(false);
      handleRemoveImage();
      onPostCreated(post);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      style={{
        padding: spacing.xl,
        backgroundColor: colors.dark.surface,
        border: `1px solid ${colors.dark.border}`,
        borderRadius: radius.xl,
        marginBottom: spacing.xl,
      }}
    >
      <h2
        style={{
          fontSize: '1.125rem',
          fontWeight: fontWeights.semiBold,
          color: colors.dark.foreground,
          margin: `0 0 ${spacing.md} 0`,
        }}
      >
        Create Post
      </h2>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: spacing.md,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${colors.dark.error}`,
            borderRadius: radius.md,
            color: colors.dark.error,
            fontSize: '0.875rem',
            marginBottom: spacing.md,
          }}
        >
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: spacing.sm }}>
          <textarea
            aria-label="Post caption"
            placeholder="Share your thoughts, discoveries, or creative work..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={MAX_POST_CAPTION_LENGTH}
            rows={3}
            style={{
              width: '100%',
              backgroundColor: colors.dark.surfaceMuted,
              border: `1px solid ${colors.dark.border}`,
              borderRadius: radius.lg,
              color: colors.dark.foreground,
              padding: spacing.md,
              fontSize: '0.9375rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
              {/* Image upload button */}
              <input
                ref={fileInputRef}
                id="media-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={isSubmitting || isUploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || isUploading || Boolean(uploadedAsset)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.dark.primary,
                  fontSize: '0.8125rem',
                  fontWeight: fontWeights.medium,
                  cursor: isSubmitting || isUploading ? 'not-allowed' : 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                📷 Upload Photo
              </button>

              {/* Legacy URL fallback toggle */}
              <button
                type="button"
                onClick={() => setShowImageUrlInput(!showImageUrlInput)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.dark.mutedForeground,
                  fontSize: '0.8125rem',
                  fontWeight: fontWeights.medium,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showImageUrlInput ? '− Hide Image URL' : '+ Image URL'}
              </button>
            </div>

            <span
              style={{
                fontSize: '0.75rem',
                color:
                  caption.length > MAX_POST_CAPTION_LENGTH * 0.9
                    ? colors.dark.warning
                    : colors.dark.mutedForeground,
              }}
            >
              {caption.length} / {MAX_POST_CAPTION_LENGTH}
            </span>
          </div>
        </div>

        {/* Selected file preview and upload status */}
        {previewUrl && (
          <div
            style={{
              marginTop: spacing.md,
              marginBottom: spacing.md,
              padding: spacing.md,
              backgroundColor: colors.dark.surfaceMuted,
              border: `1px solid ${colors.dark.border}`,
              borderRadius: radius.lg,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                width: 72,
                height: 72,
                objectFit: 'cover',
                borderRadius: radius.md,
                border: `1px solid ${colors.dark.border}`,
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: fontWeights.medium,
                  color: colors.dark.foreground,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedFile?.name || 'Selected image'}
              </div>

              {isUploading && (
                <div style={{ marginTop: '0.25rem' }}>
                  <div
                    style={{
                      height: 6,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: radius.full,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${uploadProgress}%`,
                        backgroundColor: colors.dark.primary,
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: colors.dark.mutedForeground,
                      marginTop: '0.25rem',
                    }}
                  >
                    Uploading... {uploadProgress}%
                  </div>
                </div>
              )}

              {uploadedAsset && !isUploading && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: colors.dark.success,
                    marginTop: '0.25rem',
                  }}
                >
                  ✓ Verified and ready
                </div>
              )}

              {uploadError && !isUploading && (
                <div style={{ marginTop: '0.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: colors.dark.error }}>{uploadError}</div>
                  <button
                    type="button"
                    onClick={handleRetryUpload}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.dark.primary,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: 0,
                      marginTop: '0.25rem',
                      textDecoration: 'underline',
                    }}
                  >
                    Retry upload
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={isSubmitting}
              aria-label="Remove image"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${colors.dark.border}`,
                color: colors.dark.mutedForeground,
                borderRadius: radius.full,
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Legacy URL fallback input */}
        {showImageUrlInput && !selectedFile && (
          <div style={{ marginBottom: spacing.md }}>
            <Input
              id="image-url-input"
              label="Image URL"
              type="url"
              placeholder="https://images.example.com/art.png"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing.md }}>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isSubmitting}
            disabled={
              isSubmitting || isUploading || (!caption.trim() && !imageUrl.trim() && !uploadedAsset)
            }
          >
            Publish Post
          </Button>
        </div>
      </form>
    </Card>
  );
};
