import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import type { FollowUserSummary, FollowRequestItem } from '@vibemint/types';
import { Avatar } from '../ui/Avatar';
import { mobileFollowsService } from '../../src/services/follows/followsService';

export type FollowListType = 'followers' | 'following' | 'requests';

export interface FollowListModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  type: FollowListType;
  onFollowCountChange?: () => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  visible,
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
        const res = await mobileFollowsService.getFollowers(userId, undefined, 20);
        setUsers(res.followers);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      } else if (type === 'following') {
        const res = await mobileFollowsService.getFollowing(userId, undefined, 20);
        setUsers(res.following);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      } else {
        const res = await mobileFollowsService.getFollowRequests(undefined, 20);
        setRequests(res.requests);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load list');
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    if (visible && userId) {
      void fetchData();
    } else {
      setUsers([]);
      setRequests([]);
      setErrorMessage(null);
    }
  }, [visible, userId, fetchData]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    try {
      setLoadingMore(true);
      if (type === 'followers') {
        const res = await mobileFollowsService.getFollowers(userId, nextCursor, 20);
        setUsers((prev) => [...prev, ...res.followers]);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      } else if (type === 'following') {
        const res = await mobileFollowsService.getFollowing(userId, nextCursor, 20);
        setUsers((prev) => [...prev, ...res.following]);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      } else {
        const res = await mobileFollowsService.getFollowRequests(nextCursor, 20);
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
      await mobileFollowsService.acceptFollowRequest(followerId);
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
      await mobileFollowsService.rejectFollowRequest(followerId);
      setRequests((prev) => prev.filter((r) => r.followerId !== followerId));
    } catch {
      // Handle error
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.indicator} />
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#38bdf8" />
              <Text style={styles.statusText}>Loading {title.toLowerCase()}...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity onPress={() => void fetchData()} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : type === 'requests' ? (
            requests.length === 0 ? (
              <View style={styles.centerContainer}>
                <Text style={styles.emptyIcon}>✨</Text>
                <Text style={styles.emptyTitle}>No pending requests</Text>
                <Text style={styles.emptySubtitle}>You are all caught up!</Text>
              </View>
            ) : (
              <FlatList
                data={requests}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const isLoadingAction = actionLoadingId === item.followerId;
                  return (
                    <View style={styles.userRow}>
                      <Avatar
                        src={item.follower.avatarUrl || undefined}
                        fallback={item.follower.displayName || item.follower.username}
                        size="md"
                      />
                      <View style={styles.userMeta}>
                        <Text style={styles.displayName} numberOfLines={1}>
                          {item.follower.displayName}
                        </Text>
                        <Text style={styles.username} numberOfLines={1}>
                          @{item.follower.username}
                        </Text>
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          onPress={() => void handleAcceptRequest(item.followerId)}
                          disabled={isLoadingAction}
                          style={styles.acceptButton}
                        >
                          <Text style={styles.acceptButtonText}>Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => void handleRejectRequest(item.followerId)}
                          disabled={isLoadingAction}
                          style={styles.rejectButton}
                        >
                          <Text style={styles.rejectButtonText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
              />
            )
          ) : users.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No {title.toLowerCase()} yet</Text>
              <Text style={styles.emptySubtitle}>
                {type === 'followers'
                  ? 'People who follow this account will appear here.'
                  : 'Accounts followed will appear here.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={styles.userRow}>
                  <Avatar
                    src={item.avatarUrl || undefined}
                    fallback={item.displayName || item.username}
                    size="md"
                  />
                  <View style={styles.userMeta}>
                    <Text style={styles.displayName} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <Text style={styles.username} numberOfLines={1}>
                      @{item.username}
                    </Text>
                    {item.bio ? (
                      <Text style={styles.bioText} numberOfLines={1}>
                        {item.bio}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
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
        </View>
      </SafeAreaView>
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
    height: '75%',
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
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 12,
  },
  userMeta: {
    flex: 1,
  },
  displayName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  username: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 1,
  },
  bioText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: '#0b0f17',
    fontSize: 12,
    fontWeight: '700',
  },
  rejectButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rejectButtonText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
