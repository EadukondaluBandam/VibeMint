import { useState, useEffect, useCallback, type FC } from 'react';
import { Link } from 'react-router-dom';
import type { FollowUserSummary, FollowRequestItem } from '@vibemint/types';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { Avatar, Button, Card } from '../ui';
import { webFollowsService } from '../../services/follows/followsService';

export type FollowListType = 'followers' | 'following' | 'requests';

export interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: FollowListType;
  onFollowCountChange?: () => void;
}

export const FollowListModal: FC<FollowListModalProps> = ({
  isOpen,
  onClose,
  userId,
  type,
  onFollowCountChange,
}) => {
  const [users, setUsers] = useState<FollowUserSummary[]>([]);
  const [requests, setRequests] = useState<FollowRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const title =
    type === 'followers' ? 'Followers' : type === 'following' ? 'Following' : 'Follow Requests';

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setErrorMessage(null);

      if (type === 'followers') {
        const res = await webFollowsService.getFollowers(userId, undefined, 20);
        setUsers(res.followers);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      } else if (type === 'following') {
        const res = await webFollowsService.getFollowing(userId, undefined, 20);
        setUsers(res.following);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      } else {
        const res = await webFollowsService.getFollowRequests(undefined, 20);
        setRequests(res.requests);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load list');
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    if (isOpen && userId) {
      void fetchData();
    } else {
      setUsers([]);
      setRequests([]);
      setErrorMessage(null);
    }
  }, [isOpen, userId, fetchData]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    try {
      setLoadingMore(true);
      if (type === 'followers') {
        const res = await webFollowsService.getFollowers(userId, nextCursor, 20);
        setUsers((prev) => [...prev, ...res.followers]);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      } else if (type === 'following') {
        const res = await webFollowsService.getFollowing(userId, nextCursor, 20);
        setUsers((prev) => [...prev, ...res.following]);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      } else {
        const res = await webFollowsService.getFollowRequests(nextCursor, 20);
        setRequests((prev) => [...prev, ...res.requests]);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      }
    } catch {
      // Keep existing
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAcceptRequest = async (followerId: string) => {
    try {
      setActionLoadingId(followerId);
      await webFollowsService.acceptFollowRequest(followerId);
      setRequests((prev) => prev.filter((r) => r.followerId !== followerId));
      onFollowCountChange?.();
    } catch {
      // Handle error
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectRequest = async (followerId: string) => {
    try {
      setActionLoadingId(followerId);
      await webFollowsService.rejectFollowRequest(followerId);
      setRequests((prev) => prev.filter((r) => r.followerId !== followerId));
    } catch {
      // Handle error
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: spacing.md,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-modal-title"
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Card
          style={{
            backgroundColor: colors.dark.surface,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: radius.xl,
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '80vh',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${spacing.md} ${spacing.lg}`,
              borderBottom: `1px solid ${colors.dark.border}`,
            }}
          >
            <h2
              id="follow-modal-title"
              style={{
                fontSize: '1.125rem',
                fontWeight: fontWeights.bold,
                margin: 0,
                color: colors.dark.foreground,
              }}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                background: 'none',
                border: 'none',
                color: colors.dark.mutedForeground,
                fontSize: '1.25rem',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: radius.sm,
              }}
            >
              ✕
            </button>
          </div>

          {/* List Content */}
          <div
            style={{
              padding: spacing.md,
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {loading ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: spacing.xl,
                  color: colors.dark.mutedForeground,
                }}
              >
                Loading {title.toLowerCase()}...
              </div>
            ) : errorMessage ? (
              <div style={{ textAlign: 'center', padding: spacing.lg }}>
                <p style={{ color: colors.dark.error, marginBottom: spacing.md }}>{errorMessage}</p>
                <Button variant="ghost" size="sm" onClick={() => void fetchData()}>
                  Retry
                </Button>
              </div>
            ) : type === 'requests' ? (
              requests.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: spacing.xl,
                    color: colors.dark.mutedForeground,
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: spacing.xs }}>✨</div>
                  <p style={{ margin: 0, fontWeight: fontWeights.medium }}>No pending requests</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                  {requests.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: `${spacing.xs} 0`,
                        borderBottom: `1px solid ${colors.dark.border}`,
                      }}
                    >
                      <Link
                        to={`/profile/${item.follower.username}`}
                        onClick={onClose}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm,
                          textDecoration: 'none',
                          flex: 1,
                        }}
                      >
                        <Avatar
                          src={item.follower.avatarUrl || undefined}
                          fallback={item.follower.displayName || item.follower.username}
                          size="md"
                        />
                        <div>
                          <div
                            style={{
                              color: colors.dark.foreground,
                              fontWeight: fontWeights.semiBold,
                              fontSize: '0.875rem',
                            }}
                          >
                            {item.follower.displayName}
                          </div>
                          <div
                            style={{
                              color: colors.dark.mutedForeground,
                              fontSize: '0.75rem',
                            }}
                          >
                            @{item.follower.username}
                          </div>
                        </div>
                      </Link>

                      <div style={{ display: 'flex', gap: spacing.xs }}>
                        <Button
                          size="sm"
                          disabled={actionLoadingId === item.followerId}
                          onClick={() => void handleAcceptRequest(item.followerId)}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actionLoadingId === item.followerId}
                          onClick={() => void handleRejectRequest(item.followerId)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : users.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: spacing.xl,
                  color: colors.dark.mutedForeground,
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: spacing.xs }}>👥</div>
                <p style={{ margin: 0, fontWeight: fontWeights.medium }}>
                  No {title.toLowerCase()} yet
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                {users.map((user) => (
                  <Link
                    key={user.id}
                    to={`/profile/${user.username}`}
                    onClick={onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      textDecoration: 'none',
                      padding: `${spacing.xs} 0`,
                      borderBottom: `1px solid ${colors.dark.border}`,
                    }}
                  >
                    <Avatar
                      src={user.avatarUrl || undefined}
                      fallback={user.displayName || user.username}
                      size="md"
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: colors.dark.foreground,
                          fontWeight: fontWeights.semiBold,
                          fontSize: '0.875rem',
                        }}
                      >
                        {user.displayName}
                      </div>
                      <div
                        style={{
                          color: colors.dark.mutedForeground,
                          fontSize: '0.75rem',
                        }}
                      >
                        @{user.username}
                      </div>
                      {user.bio && (
                        <div
                          style={{
                            color: colors.dark.foreground,
                            fontSize: '0.8125rem',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '300px',
                          }}
                        >
                          {user.bio}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}

                {hasMore && (
                  <div style={{ textAlign: 'center', paddingTop: spacing.sm }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleLoadMore()}
                      loading={loadingMore}
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
