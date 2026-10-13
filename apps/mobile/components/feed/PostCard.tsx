import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { PostSummary } from '@vibemint/types';
import { Avatar } from '../ui/Avatar';

export interface PostCardProps {
  post: PostSummary;
  currentUserId?: string;
  onToggleLike: (post: PostSummary) => Promise<void>;
  onToggleSave: (post: PostSummary) => Promise<void>;
  onDelete?: (post: PostSummary) => Promise<void>;
  onOpenComments?: (post: PostSummary) => void;
  onPressAuthor?: (username: string) => void;
  onReport?: (post: PostSummary) => void;
}

function formatRelativeTime(dateString: string): string {
  try {
    const now = Date.now();
    const date = new Date(dateString).getTime();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  onToggleLike,
  onToggleSave,
  onDelete,
  onOpenComments,
  onPressAuthor,
  onReport,
}) => {
  const [likeLoading, setLikeLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isOwner = Boolean(currentUserId && currentUserId === post.authorId);

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      await onToggleLike(post);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSave = async () => {
    if (saveLoading) return;
    setSaveLoading(true);
    try {
      await onToggleSave(post);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteLoading || !onDelete) return;
    setDeleteLoading(true);
    try {
      await onDelete(post);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* Author Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => onPressAuthor?.(post.author.username)}
          disabled={!onPressAuthor}
          style={styles.authorClickable}
          activeOpacity={0.7}
        >
          <Avatar
            src={post.author.avatarUrl || undefined}
            fallback={post.author.displayName || post.author.username}
            size="md"
          />
          <View style={styles.authorMeta}>
            <Text style={styles.displayName} numberOfLines={1}>
              {post.author.displayName}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{post.author.username} · {formatRelativeTime(post.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>

        {isOwner && onDelete && (
          <TouchableOpacity
            onPress={handleDelete}
            disabled={deleteLoading}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {deleteLoading ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Text style={styles.deleteText}>Delete</Text>
            )}
          </TouchableOpacity>
        )}

        {!isOwner && onReport && (
          <TouchableOpacity
            onPress={() => onReport(post)}
            style={styles.reportButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.reportText}>Report</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Caption */}
      {post.caption && <Text style={styles.caption}>{post.caption}</Text>}

      {/* Optional Post Image */}
      {post.imageUrl && !imageError && (
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: post.imageUrl }}
            onError={() => setImageError(true)}
            style={styles.postImage}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Action Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={handleLike}
          disabled={likeLoading}
          style={[styles.actionButton, post.isLiked && styles.actionButtonActive]}
          activeOpacity={0.7}
        >
          {likeLoading ? (
            <ActivityIndicator size="small" color={post.isLiked ? '#ef4444' : '#94a3b8'} />
          ) : (
            <Text style={[styles.actionIcon, post.isLiked && styles.likeIconActive]}>
              {post.isLiked ? '♥' : '♡'}
            </Text>
          )}
          <Text style={[styles.actionCount, post.isLiked && styles.actionCountActive]}>
            {post.likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onOpenComments?.(post)}
          style={styles.actionButton}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.commentCount ?? 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saveLoading}
          style={[styles.actionButton, post.isSaved && styles.saveButtonActive]}
          activeOpacity={0.7}
        >
          {saveLoading ? (
            <ActivityIndicator size="small" color={post.isSaved ? '#38bdf8' : '#94a3b8'} />
          ) : (
            <Text style={[styles.actionIcon, post.isSaved && styles.saveIconActive]}>
              {post.isSaved ? '★' : '☆'}
            </Text>
          )}
          <Text style={[styles.actionText, post.isSaved && styles.saveTextActive]}>
            {post.isSaved ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorMeta: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  username: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  reportButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reportText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  caption: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  imageWrapper: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  saveButtonActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  actionIcon: {
    fontSize: 18,
    color: '#94a3b8',
  },
  likeIconActive: {
    color: '#ef4444',
  },
  saveIconActive: {
    color: '#38bdf8',
  },
  actionCount: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  actionCountActive: {
    color: '#ef4444',
  },
  actionText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  saveTextActive: {
    color: '#38bdf8',
    fontWeight: '600',
  },
});
