import { useState, useEffect, useCallback, type FC } from 'react';
import { Link } from 'react-router-dom';
import type { NotificationItem } from '@vibemint/types';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { Avatar, Button, Card } from '../components/ui';
import { webNotificationsService } from '../services/notifications/notificationsService';

export const NotificationsPage: FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await webNotificationsService.getNotifications(undefined, 20);
      setNotifications(res.notifications);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || !nextCursor) return;
    try {
      setLoadingMore(true);
      const res = await webNotificationsService.getNotifications(nextCursor, 20);
      setNotifications((prev) => [...prev, ...res.notifications]);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
      );
      await webNotificationsService.markAsRead(notificationId);
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: false } : n)),
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await webNotificationsService.markAllAsRead();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark all as read');
      void fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  const formatMessage = (item: NotificationItem): { text: string; link?: string } => {
    const actorName = item.actor?.displayName || item.actor?.username || 'Someone';
    const actorLink = item.actor?.username ? `/profile/${item.actor.username}` : undefined;

    switch (item.type) {
      case 'NEW_FOLLOWER':
        return { text: `${actorName} started following you`, link: actorLink };
      case 'FOLLOW_REQUEST_RECEIVED':
        return { text: `${actorName} requested to follow you`, link: '/profile/me' };
      case 'FOLLOW_REQUEST_ACCEPTED':
        return { text: `${actorName} accepted your follow request`, link: actorLink };
      case 'POST_LIKED':
        return { text: `${actorName} liked your post`, link: '/home' };
      case 'POST_COMMENTED':
        return { text: `${actorName} commented on your post`, link: '/home' };
      default:
        return { text: `${actorName} interacted with your account`, link: '/home' };
    }
  };

  const formatTimestamp = (dateStr: string): string => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.lg,
          flexWrap: 'wrap',
          gap: spacing.md,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: fontWeights.bold,
              margin: 0,
              color: colors.dark.foreground,
            }}
          >
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span
              style={{
                backgroundColor: colors.dark.primary,
                color: colors.dark.primaryForeground,
                fontSize: '0.75rem',
                fontWeight: fontWeights.bold,
                padding: '0.125rem 0.5rem',
                borderRadius: radius.full,
              }}
            >
              {unreadCount} unread
            </span>
          )}
        </div>

        {notifications.length > 0 && unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleMarkAllAsRead()}
            loading={markingAll}
            disabled={markingAll}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* Main Container */}
      <Card
        style={{
          backgroundColor: colors.dark.surface,
          border: `1px solid ${colors.dark.border}`,
          borderRadius: radius.xl,
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div
            style={{
              padding: '3rem 1rem',
              textAlign: 'center',
              color: colors.dark.mutedForeground,
            }}
          >
            <p>Loading notifications...</p>
          </div>
        ) : errorMessage ? (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
            }}
          >
            <p style={{ color: colors.dark.error, marginBottom: '1rem' }}>{errorMessage}</p>
            <Button variant="secondary" size="sm" onClick={() => void fetchNotifications()}>
              Try Again
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div
            style={{
              padding: '4rem 1.5rem',
              textAlign: 'center',
              color: colors.dark.mutedForeground,
            }}
          >
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>
              🔔
            </span>
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: fontWeights.semiBold,
                color: colors.dark.foreground,
                margin: '0 0 0.5rem',
              }}
            >
              No notifications yet
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                maxWidth: '320px',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              When people follow you, like, or comment on your posts, you will see notifications
              here.
            </p>
          </div>
        ) : (
          <div>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {notifications.map((item) => {
                const { text, link } = formatMessage(item);
                return (
                  <li
                    key={item.id}
                    onClick={() => {
                      if (!item.isRead) {
                        void handleMarkAsRead(item.id);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: `${spacing.md} ${spacing.lg}`,
                      borderBottom: `1px solid ${colors.dark.border}`,
                      backgroundColor: item.isRead ? 'transparent' : 'rgba(56, 189, 248, 0.05)',
                      transition: 'background-color 0.15s ease',
                      gap: spacing.md,
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flex: 1 }}
                    >
                      <Avatar
                        src={item.actor?.avatarUrl || undefined}
                        alt={item.actor?.displayName || 'User'}
                        size="md"
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.9375rem', color: colors.dark.foreground }}>
                          {link ? (
                            <Link
                              to={link}
                              style={{
                                color: colors.dark.foreground,
                                textDecoration: 'none',
                                fontWeight: item.isRead
                                  ? fontWeights.regular
                                  : fontWeights.semiBold,
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.outline = `2px solid ${colors.dark.primary}`;
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.outline = 'none';
                              }}
                            >
                              {text}
                            </Link>
                          ) : (
                            <span
                              style={{
                                fontWeight: item.isRead
                                  ? fontWeights.regular
                                  : fontWeights.semiBold,
                              }}
                            >
                              {text}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: colors.dark.mutedForeground,
                            marginTop: '0.25rem',
                          }}
                        >
                          {formatTimestamp(item.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      {!item.isRead ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleMarkAsRead(item.id);
                          }}
                          title="Mark as read"
                          aria-label="Mark notification as read"
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: radius.full,
                            backgroundColor: colors.dark.primary,
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: colors.dark.mutedForeground,
                          }}
                        >
                          Read
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {hasMore && (
              <div style={{ padding: spacing.md, textAlign: 'center' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleLoadMore()}
                  loading={loadingMore}
                  disabled={loadingMore}
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
