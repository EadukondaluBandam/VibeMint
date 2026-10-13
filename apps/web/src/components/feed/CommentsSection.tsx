import { useState, useEffect, type FC, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CommentSummary } from '@vibemint/types';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { Avatar, Button } from '../ui';
import { ReportModal } from '../safety/ReportModal';
import { webCommentsService } from '../../services/comments/commentsService';

export interface CommentsSectionProps {
  postId: string;
  currentUserId?: string;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
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

export const CommentsSection: FC<CommentsSectionProps> = ({
  postId,
  currentUserId,
  onCommentAdded,
  onCommentDeleted,
}) => {
  const [comments, setComments] = useState<CommentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reportingComment, setReportingComment] = useState<CommentSummary | null>(null);

  const loadComments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await webCommentsService.getPostComments(postId);
      setComments(data.comments);
      setHasMore(data.pagination.hasMore);
      setNextCursor(data.pagination.nextCursor ?? null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not load comments';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadComments();
  }, [postId]);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const data = await webCommentsService.getPostComments(postId, nextCursor);
      setComments((prev) => [...prev, ...data.comments]);
      setHasMore(data.pagination.hasMore);
      setNextCursor(data.pagination.nextCursor ?? null);
    } catch {
      // Keep existing list on failure
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || isSubmitting) return;

    if (trimmed.length > 500) {
      setSubmitError('Comment must be 500 characters or fewer');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const created = await webCommentsService.createComment(postId, { content: trimmed });
      setComments((prev) => [...prev, created]);
      setCommentText('');
      onCommentAdded?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post comment';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleDelete = async (commentId: string) => {
    if (deletingId) return;
    if (!window.confirm('Delete this comment?')) return;

    setDeletingId(commentId);
    try {
      await webCommentsService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentDeleted?.();
    } catch {
      alert('Failed to delete comment. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      style={{
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTop: `1px solid ${colors.dark.border}`,
      }}
    >
      {/* Comment Input Box */}
      <form onSubmit={handleSubmit} style={{ marginBottom: spacing.lg }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={commentText}
            onChange={(e) => {
              setCommentText(e.target.value);
              if (submitError) setSubmitError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              currentUserId ? 'Write a comment... (Ctrl+Enter to post)' : 'Sign in to comment'
            }
            disabled={!currentUserId || isSubmitting}
            maxLength={500}
            rows={2}
            aria-label="Write a comment"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: colors.dark.surfaceMuted,
              color: colors.dark.foreground,
              border: `1px solid ${submitError ? colors.dark.error : colors.dark.border}`,
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              fontSize: '0.875rem',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s ease',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.xs,
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              color: commentText.length > 480 ? '#ef4444' : colors.dark.mutedForeground,
            }}
          >
            {commentText.length}/500
          </span>

          <Button
            type="submit"
            size="sm"
            disabled={!currentUserId || !commentText.trim() || isSubmitting}
            loading={isSubmitting}
            style={{ minWidth: '70px' }}
          >
            Post
          </Button>
        </div>

        {submitError && (
          <p
            style={{
              color: colors.dark.error,
              fontSize: '0.8125rem',
              marginTop: spacing.xs,
              marginBottom: 0,
            }}
          >
            {submitError}
          </p>
        )}
      </form>

      {/* Comments List */}
      {isLoading ? (
        <div
          style={{ textAlign: 'center', padding: spacing.md, color: colors.dark.mutedForeground }}
        >
          <span style={{ fontSize: '0.875rem' }}>Loading comments...</span>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: spacing.md }}>
          <p style={{ color: colors.dark.error, fontSize: '0.875rem', marginBottom: spacing.xs }}>
            {error}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void loadComments()}>
            Retry
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: `${spacing.md} 0`,
            color: colors.dark.mutedForeground,
            fontSize: '0.875rem',
          }}
        >
          No comments yet. Be the first to share your thoughts!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {comments.map((comment) => {
            const isCommentOwner = Boolean(currentUserId && currentUserId === comment.authorId);
            const isDeleting = deletingId === comment.id;

            return (
              <div
                key={comment.id}
                style={{
                  display: 'flex',
                  gap: spacing.sm,
                  alignItems: 'flex-start',
                }}
              >
                <Link
                  to={`/profile/${comment.author.username}`}
                  style={{ textDecoration: 'none', flexShrink: 0 }}
                >
                  <Avatar
                    src={comment.author.avatarUrl || undefined}
                    fallback={comment.author.displayName || comment.author.username}
                    size="sm"
                  />
                </Link>

                <div
                  style={{
                    flex: 1,
                    backgroundColor: colors.dark.surfaceMuted,
                    borderRadius: radius.md,
                    padding: `${spacing.xs} ${spacing.sm}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                      <Link
                        to={`/profile/${comment.author.username}`}
                        style={{
                          textDecoration: 'none',
                          color: colors.dark.foreground,
                          fontWeight: fontWeights.semiBold,
                          fontSize: '0.8125rem',
                        }}
                      >
                        {comment.author.displayName}
                      </Link>
                      <span
                        style={{
                          color: colors.dark.mutedForeground,
                          fontSize: '0.75rem',
                        }}
                      >
                        @{comment.author.username} · {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>

                    {isCommentOwner ? (
                      <button
                        type="button"
                        onClick={() => void handleDelete(comment.id)}
                        disabled={isDeleting}
                        aria-label="Delete comment"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: colors.dark.error,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          padding: '0 4px',
                          opacity: isDeleting ? 0.5 : 0.8,
                          transition: 'opacity 0.15s ease',
                        }}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    ) : currentUserId ? (
                      <button
                        type="button"
                        onClick={() => setReportingComment(comment)}
                        aria-label={`Report comment by @${comment.author.username}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: colors.dark.mutedForeground,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          padding: '0 4px',
                          opacity: 0.8,
                          transition: 'opacity 0.15s ease',
                        }}
                      >
                        Report
                      </button>
                    ) : null}
                  </div>

                  <p
                    style={{
                      color: colors.dark.foreground,
                      fontSize: '0.875rem',
                      lineHeight: 1.4,
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: spacing.xs }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleLoadMore()}
                loading={isLoadingMore}
                disabled={isLoadingMore}
              >
                Load more comments
              </Button>
            </div>
          )}
        </div>
      )}

      {reportingComment && (
        <ReportModal
          isOpen={Boolean(reportingComment)}
          onClose={() => setReportingComment(null)}
          targetType="COMMENT"
          targetId={reportingComment.id}
          targetLabel={`Comment by @${reportingComment.author.username}`}
        />
      )}
    </div>
  );
};
