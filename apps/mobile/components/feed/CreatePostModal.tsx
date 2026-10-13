import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MAX_POST_CAPTION_LENGTH, validateCreatePost } from '@vibemint/validation';
import type { PostSummary, MediaAssetSummary } from '@vibemint/types';
import { Button } from '../ui/Button';
import { mobilePostsService } from '../../src/services/posts/postsService';
import { mobileMediaService, type PickedImageInfo } from '../../src/services/media/mediaService';

export interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: (post: PostSummary) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  visible,
  onClose,
  onPostCreated,
}) => {
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Image picker & upload state
  const [pickedImage, setPickedImage] = useState<PickedImageInfo | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<MediaAssetSummary | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resetForm = () => {
    setCaption('');
    setImageUrl('');
    setPickedImage(null);
    setUploadedAsset(null);
    setUploadProgress(0);
    setIsUploading(false);
    setUploadError(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const pickImage = async () => {
    setUploadError(null);
    setErrorMessage(null);

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        setErrorMessage('Permission to access photo library is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const imageInfo: PickedImageInfo = {
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        fileSize: asset.fileSize,
        fileName: asset.fileName || 'photo.jpg',
        width: asset.width,
        height: asset.height,
      };

      const check = mobileMediaService.validateImage(imageInfo);
      if (!check.valid) {
        setUploadError(check.error || 'Invalid file');
        return;
      }

      setPickedImage(imageInfo);
      setUploadedAsset(null);
      setIsUploading(true);
      setUploadProgress(0);

      try {
        const verifiedAsset = await mobileMediaService.uploadPickedImage(
          imageInfo,
          'POST_IMAGE',
          (pct) => setUploadProgress(pct),
        );
        setUploadedAsset(verifiedAsset);
        setUploadProgress(100);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed. Tap to retry.');
        setUploadedAsset(null);
      } finally {
        setIsUploading(false);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not pick image');
    }
  };

  const handleRetryUpload = async () => {
    if (!pickedImage) return;
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const verifiedAsset = await mobileMediaService.uploadPickedImage(
        pickedImage,
        'POST_IMAGE',
        (pct) => setUploadProgress(pct),
      );
      setUploadedAsset(verifiedAsset);
      setUploadProgress(100);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload retry failed');
      setUploadedAsset(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPickedImage(null);
    setUploadedAsset(null);
    setUploadProgress(0);
    setIsUploading(false);
    setUploadError(null);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (isUploading) {
      setErrorMessage('Please wait for the image upload to complete');
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
        : 'Please provide a caption or attach an image';
      setErrorMessage(msg);
      return;
    }

    setSubmitting(true);
    try {
      const created = await mobilePostsService.createPost({
        caption: validation.data.caption,
        imageUrl: validation.data.imageUrl,
        mediaAssetId: validation.data.mediaAssetId,
      });
      resetForm();
      onPostCreated(created);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Post</Text>
            <TouchableOpacity onPress={handleClose} disabled={submitting || isUploading}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Caption Input */}
            <View style={styles.inputGroup}>
              <TextInput
                placeholder="What's your vibe today? Share your thoughts, creative works, or discovery..."
                placeholderTextColor="#64748b"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={MAX_POST_CAPTION_LENGTH}
                style={styles.captionInput}
                autoFocus
              />
              <Text
                style={[
                  styles.charCount,
                  caption.length > MAX_POST_CAPTION_LENGTH * 0.9 && styles.charCountWarning,
                ]}
              >
                {caption.length} / {MAX_POST_CAPTION_LENGTH}
              </Text>
            </View>

            {/* Photo Picker Button */}
            {!pickedImage && (
              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={styles.pickButton}
                  onPress={pickImage}
                  disabled={submitting || isUploading}
                >
                  <Text style={styles.pickButtonText}>📷 Attach Photo from Library</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Selected Image Preview & Upload Status */}
            {pickedImage && (
              <View style={styles.previewContainer}>
                <Image source={{ uri: pickedImage.uri }} style={styles.previewImage} />
                <View style={styles.previewInfo}>
                  <Text style={styles.previewTitle} numberOfLines={1}>
                    {pickedImage.fileName || 'Selected Photo'}
                  </Text>

                  {isUploading && (
                    <View style={styles.uploadProgressRow}>
                      <ActivityIndicator size="small" color="#6366f1" style={{ marginRight: 6 }} />
                      <Text style={styles.uploadProgressText}>Uploading... {uploadProgress}%</Text>
                    </View>
                  )}

                  {uploadedAsset && !isUploading && (
                    <Text style={styles.uploadSuccessText}>✓ Verified and ready</Text>
                  )}

                  {uploadError && !isUploading && (
                    <View>
                      <Text style={styles.uploadErrorText}>{uploadError}</Text>
                      <TouchableOpacity onPress={handleRetryUpload} style={styles.retryButton}>
                        <Text style={styles.retryButtonText}>Tap to Retry</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleRemoveImage}
                  disabled={submitting}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Legacy Image URL Input (fallback) */}
            {!pickedImage && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Or Image URL (optional)</Text>
                <TextInput
                  placeholder="https://example.com/image.jpg"
                  placeholderTextColor="#64748b"
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.urlInput}
                />
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                variant="outline"
                size="md"
                onPress={handleClose}
                disabled={submitting}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onPress={handleSubmit}
                loading={submitting}
                disabled={
                  submitting ||
                  isUploading ||
                  (!caption.trim() && !imageUrl.trim() && !uploadedAsset)
                }
                style={styles.submitButton}
              >
                Publish
              </Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeText: {
    fontSize: 20,
    color: '#94a3b8',
    padding: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 6,
    fontWeight: '500',
  },
  captionInput: {
    minHeight: 110,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  charCount: {
    alignSelf: 'flex-end',
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  charCountWarning: {
    color: '#fbbf24',
  },
  pickButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#4338ca',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pickButtonText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    marginBottom: 16,
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  previewInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  previewTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  uploadProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  uploadProgressText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  uploadSuccessText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '500',
  },
  uploadErrorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 2,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  retryButtonText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  urlInput: {
    height: 44,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});
