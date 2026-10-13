import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { NotificationItem } from '@vibemint/types';
import { Avatar } from '../components/ui/Avatar';
import { mobileNotificationsService } from '../src/services/notifications/notificationsService';

export default function NotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      const res = await mobileNotificationsService.getNotifications(undefined, 20);
      setNotifications(res.notifications);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = () => {
    void fetchNotifications(true);
  };

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || !nextCursor) return;
    try {
      setLoadingMore(true);
      const res = await mobileNotificationsService.getNotifications(nextCursor, 20);
      setNotifications((prev) => [...prev, ...res.notifications]);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch {
      // Non-fatal pagination failure
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
      );
      await mobileNotificationsService.markAsRead(notificationId);
    } catch {
      // Rollback on error
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: false } : n)),
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await mobileNotificationsService.markAllAsRead();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to mark all as read');
      void fetchNotifications(true);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    if (!item.isRead) {
      void handleMarkAsRead(item.id);
    }

    if (item.type === 'FOLLOW_REQUEST_RECEIVED') {
      router.push('/(tabs)/me');
    } else if (item.type === 'POST_LIKED' || item.type === 'POST_COMMENTED') {
      router.push('/(tabs)/home');
    } else {
      router.push('/(tabs)/home');
    }
  };

  const formatNotificationMessage = (item: NotificationItem): string => {
    const actorName = item.actor?.displayName || item.actor?.username || 'Someone';
    switch (item.type) {
      case 'NEW_FOLLOWER':
        return `${actorName} started following you`;
      case 'FOLLOW_REQUEST_RECEIVED':
        return `${actorName} requested to follow you`;
      case 'FOLLOW_REQUEST_ACCEPTED':
        return `${actorName} accepted your follow request`;
      case 'POST_LIKED':
        return `${actorName} liked your post`;
      case 'POST_COMMENTED':
        return `${actorName} commented on your post`;
      default:
        return `${actorName} interacted with your account`;
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f17" />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>}
          </View>
        </View>

        {notifications.length > 0 && unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            disabled={markingAll}
            style={styles.markAllButton}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color="#38bdf8" />
            ) : (
              <Text style={styles.markAllButtonText}>Mark all read</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Could not load notifications</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => fetchNotifications()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            When someone follows you, likes, or comments on your posts, you will see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => void handleNotificationPress(item)}
              style={[styles.itemContainer, !item.isRead && styles.unreadItemContainer]}
            >
              <Avatar
                src={item.actor?.avatarUrl || undefined}
                fallback={item.actor?.displayName?.[0] || 'U'}
                size="md"
              />

              <View style={styles.itemTextContainer}>
                <Text style={styles.itemMessage} numberOfLines={2}>
                  {formatNotificationMessage(item)}
                </Text>
                <Text style={styles.itemTimestamp}>{formatTimestamp(item.createdAt)}</Text>
              </View>

              {!item.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#38bdf8"
              colors={['#38bdf8']}
            />
          }
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0b0f17',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#38bdf8',
    marginTop: 2,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  markAllButtonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 12,
  },
  unreadItemContainer: {
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
  },
  itemTextContainer: {
    flex: 1,
  },
  itemMessage: {
    color: '#f8fafc',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  itemTimestamp: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38bdf8',
    marginLeft: 6,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  errorTitle: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  errorMessage: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#0b0f17',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
