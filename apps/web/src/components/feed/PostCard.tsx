import { useState, type FC } from 'react';
import { Link } from 'react-router-dom';
import type { PostSummary } from '@vibemint/types';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { Card, Avatar } from '../ui';
import { CommentsSection } from './CommentsSection';

export interface PostCardProps {
  post: PostSummary;
  currentUserId?: string;
  onToggleLike: (post: PostSummary) => Promise<void>;
  onToggleSave: (post: PostSummary) => Promise<void>;
  onDelete?: (post: PostSummary) => Promise<void>;
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

export const PostCard: FC<PostCardProps> = ({
  post,
  currentUserId,
  onToggleLike,
  onToggleSave,
  onDelete,
  onReport,
}) => {
  const [likeLoading, setLikeLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);

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
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    setDeleteLoading(true);
    try {
      await onDelete(post);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Card
      style={{
        padding: spacing.xl,
        backgroundColor: colors.dark.surface,
        border: `1px solid ${colors.dark.border}`,
        borderRadius: radius.xl,
        marginBottom: spacing.lg,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <Link
            to={`/profile/${post.author.username}`}
            style={{ textDecoration: 'none', display: 'flex' }}
          >
            <Avatar
              src={post.author.avatarUrl || undefined}
              fallback={post.author.displayName || post.author.username}
              size="md"
            />
          </Link>
          <div>
            <Link
              to={`/profile/${post.author.username}`}
              style={{
                textDecoration: 'none',
                color: colors.dark.foreground,
                fontWeight: fontWeights.semiBold,
                fontSize: '0.9375rem',
                display: 'block',
              }}
            >
              {post.author.displayName}
            </Link>
            <span style={{ color: colors.dark.mutedForeground, fontSize: '0.8125rem' }}>
              @{post.author.username} · {formatRelativeTime(post.createdAt)}
            </span>
          </div>
        </div>

        {isOwner && onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading}
            aria-label="Delete post"
            style={{
              background: 'none',
              border: 'none',
              color: colors.dark.error,
              fontSize: '0.8125rem',
              fontWeight: fontWeights.medium,
              cursor: 'pointer',
              padding: `${spacing.xs} ${spacing.sm}`,
              borderRadius: radius.md,
            }}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </button>
        ) : !isOwner && onReport && currentUserId ? (
          <button
            type="button"
            onClick={() => onReport(post)}
            aria-label={`Report post by @${post.author.username}`}
            style={{
              background: 'none',
              border: 'none',
              color: colors.dark.mutedForeground,
              fontSize: '0.8125rem',
              fontWeight: fontWeights.medium,
              cursor: 'pointer',
              padding: `${spacing.xs} ${spacing.sm}`,
              borderRadius: radius.md,
            }}
          >
            Report
          </button>
        ) : null}
      </div>

      {/* Caption */}
      {post.caption && (
        <p
          style={{
            color: colors.dark.foreground,
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            margin: `0 0 ${spacing.md} 0`,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {post.caption}
        </p>
      )}

      {/* Post Image */}
      {post.imageUrl && !imageError && (
        <div
          style={{
            borderRadius: radius.lg,
            overflow: 'hidden',
            backgroundColor: colors.dark.surfaceMuted,
            marginBottom: spacing.md,
            maxHeight: '440px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <img
            src={post.imageUrl}
            alt="Post content"
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              maxHeight: '440px',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* Interaction Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.xl,
          paddingTop: spacing.sm,
          borderTop: `1px solid ${colors.dark.border}`,
        }}
      >
        {/* Like Button */}
        <button
          type="button"
          onClick={handleLike}
          disabled={likeLoading}
          aria-label={post.isLiked ? 'Unlike post' : 'Like post'}
          aria-pressed={post.isLiked}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: 'none',
            border: 'none',
            color: post.isLiked ? '#ef4444' : colors.dark.mutedForeground,
            fontSize: '0.875rem',
            fontWeight: fontWeights.medium,
            cursor: 'pointer',
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: radius.md,
            transition: 'color 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1.125rem' }}>{post.isLiked ? '♥' : '♡'}</span>
          <span>{post.likeCount}</span>
        </button>

        {/* Comment Button */}
        <button
          type="button"
          onClick={() => setShowComments((prev) => !prev)}
          aria-label={`${showComments ? 'Hide' : 'Show'} comments (${commentCount})`}
          aria-expanded={showComments}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: 'none',
            border: 'none',
            color: showComments ? colors.dark.primary : colors.dark.mutedForeground,
            fontSize: '0.875rem',
            fontWeight: fontWeights.medium,
            cursor: 'pointer',
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: radius.md,
            transition: 'color 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1rem' }}>💬</span>
          <span>{commentCount}</span>
        </button>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saveLoading}
          aria-label={post.isSaved ? 'Unsave post' : 'Save post'}
          aria-pressed={post.isSaved}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: 'none',
            border: 'none',
            color: post.isSaved ? colors.dark.primary : colors.dark.mutedForeground,
            fontSize: '0.875rem',
            fontWeight: fontWeights.medium,
            cursor: 'pointer',
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: radius.md,
            transition: 'color 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1.125rem' }}>{post.isSaved ? '★' : '☆'}</span>
          <span>{post.isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {/* Expandable Comments Section */}
      {showComments && (
        <CommentsSection
          postId={post.id}
          currentUserId={currentUserId}
          onCommentAdded={() => setCommentCount((c) => c + 1)}
          onCommentDeleted={() => setCommentCount((c) => Math.max(0, c - 1))}
        />
      )}
    </Card>
  );
};
