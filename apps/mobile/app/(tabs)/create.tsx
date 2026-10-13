import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  SafeAreaView,
  ScrollView,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { MAX_POST_CAPTION_LENGTH, validateCreatePost } from '@vibemint/validation';
import { Button } from '../../components/ui/Button';
import { mobilePostsService } from '../../src/services/posts/postsService';

export default function CreateScreen() {
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);

    const validation = validateCreatePost({
      caption: caption.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
    });

    if (!validation.success || !validation.data) {
      const msg = validation.errors
        ? Object.values(validation.errors).join(', ')
        : 'Please provide a caption or image URL';
      setErrorMessage(msg);
      return;
    }

    setSubmitting(true);
    try {
      await mobilePostsService.createPost({
        caption: validation.data.caption,
        imageUrl: validation.data.imageUrl,
      });
      setCaption('');
      setImageUrl('');
      router.replace('/(tabs)/home');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f17" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Post</Text>
        <Text style={styles.headerSubtitle}>Share your vibe with the community</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Caption */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Caption</Text>
          <TextInput
            placeholder="Write a thought, insight, or announcement..."
            placeholderTextColor="#64748b"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={MAX_POST_CAPTION_LENGTH}
            style={styles.captionInput}
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

        {/* Image URL */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Image URL (optional)</Text>
          <TextInput
            placeholder="https://images.example.com/artwork.png"
            placeholderTextColor="#64748b"
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.urlInput}
          />
        </View>

        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || (!caption.trim() && !imageUrl.trim())}
          style={styles.submitButton}
        >
          Publish Post
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  content: {
    padding: 20,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 8,
    fontWeight: '600',
  },
  captionInput: {
    minHeight: 140,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    color: '#ffffff',
    padding: 14,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  charCount: {
    alignSelf: 'flex-end',
    color: '#64748b',
    fontSize: 12,
    marginTop: 6,
  },
  charCountWarning: {
    color: '#fbbf24',
  },
  urlInput: {
    height: 48,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    color: '#ffffff',
    paddingHorizontal: 14,
    fontSize: 15,
  },
  submitButton: {
    marginTop: 10,
    width: '100%',
  },
});
