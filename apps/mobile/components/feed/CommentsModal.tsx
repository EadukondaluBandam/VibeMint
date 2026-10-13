import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { CommentSummary } from '@vibemint/types';
import { MAX_COMMENT_LENGTH } from '@vibemint/validation';
import { Avatar } from '../ui/Avatar';
import { ReportModal } from '../safety/ReportModal';
import { mobileCommentsService } from '../../src/services/comments/commentsService';

export interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
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

export const CommentsModal: React.FC<CommentsModalProps> = ({
  visible,
  onClose,
  postId,
  currentUserId,
  onCommentAdded,
  onCommentDeleted,
}) => {
  const [comments, setComments] = useState<CommentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reportingComment, setReportingComment] = useState<CommentSummary | null>(null);

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await mobileCommentsService.getPostComments(postId, undefined, 20);
      setComments(res.comments);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (visible && postId) {
      void fetchComments();
    } else {
      setComments([]);
      setInputText('');
      setSubmitError(null);
    }
  }, [visible, postId, fetchComments]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    try {
      setLoadingMore(true);
      const res = await mobileCommentsService.getPostComments(postId, nextCursor, 20);
      setComments((prev) => [...prev, ...res.comments]);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch {
      // Keep existing list on failure
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || submitting) return;

    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setSubmitError(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`);
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const created = await mobileCommentsService.createComment(postId, { content: trimmed });
      setComments((prev) => [...prev, created]);
      setInputText('');
      onCommentAdded?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingId(commentId);
            await mobileCommentsService.deleteComment(commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            onCommentDeleted?.();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete comment');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContainer}>
          {/* Sheet Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.indicator} />
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Comments</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comment List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#38bdf8" />
              <Text style={styles.statusText}>Loading comments...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity onPress={() => void fetchComments()} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No comments yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to chime in!</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isAuthor = Boolean(currentUserId && currentUserId === item.authorId);
                const isDeleting = deletingId === item.id;

                return (
                  <View style={styles.commentRow}>
                    <Avatar
                      src={item.author.avatarUrl || undefined}
                      fallback={item.author.displayName || item.author.username}
                      size="sm"
                    />
                    <View style={styles.commentBody}>
                      <View style={styles.commentHeader}>
                        <View style={styles.commentMeta}>
                          <Text style={styles.commentAuthorName} numberOfLines={1}>
                            {item.author.displayName}
                          </Text>
                          <Text style={styles.commentTimestamp}>
                            @{item.author.username} · {formatRelativeTime(item.createdAt)}
                          </Text>
                        </View>
                        {isAuthor ? (
                          <TouchableOpacity
                            onPress={() => handleDelete(item.id)}
                            disabled={isDeleting}
                            style={styles.deleteButton}
                          >
                            {isDeleting ? (
                              <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                              <Text style={styles.deleteText}>Delete</Text>
                            )}
                          </TouchableOpacity>
                        ) : currentUserId ? (
                          <TouchableOpacity
                            onPress={() => setReportingComment(item)}
                            style={styles.reportButton}
                            accessibilityLabel={`Report comment by ${item.author.displayName || item.author.username}`}
                          >
                            <Text style={styles.reportText}>Report</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <Text style={styles.commentContent}>{item.content}</Text>
                    </View>
                  </View>
                );
              }}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color="#38bdf8" />
                  </View>
                ) : null
              }
            />
          )}

          {/* Comment Input Footer */}
          <View style={styles.inputContainer}>
            {submitError && <Text style={styles.inputErrorText}>{submitError}</Text>}
            <View style={styles.inputRow}>
              <TextInput
                value={inputText}
                onChangeText={(text) => {
                  setInputText(text);
                  if (submitError) setSubmitError(null);
                }}
                placeholder="Add a comment..."
                placeholderTextColor="#64748b"
                maxLength={MAX_COMMENT_LENGTH}
                multiline
                style={styles.textInput}
                editable={!submitting}
              />
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || !inputText.trim()}
                style={[
                  styles.sendButton,
                  (!inputText.trim() || submitting) && styles.sendButtonDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#0284c7" />
                ) : (
                  <Text style={styles.sendButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.counterText}>{inputText.length}/500</Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      {reportingComment && (
        <ReportModal
          visible={Boolean(reportingComment)}
          onClose={() => setReportingComment(null)}
          targetType="COMMENT"
          targetId={reportingComment.id}
          targetLabel={`Comment by @${reportingComment.author.username}`}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '60%',
    display: 'flex',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  indicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    marginBottom: 8,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    padding: 6,
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  retryButtonText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 10,
  },
  commentBody: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  commentAuthorName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  commentTimestamp: {
    color: '#64748b',
    fontSize: 11,
  },
  deleteButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
  },
  reportButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  reportText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
  commentContent: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 18,
  },
  footerLoader: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#0f172a',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
    maxHeight: 90,
  },
  sendButton: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#0b0f17',
    fontSize: 13,
    fontWeight: '700',
  },
  counterText: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
  },
  inputErrorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 4,
  },
});
