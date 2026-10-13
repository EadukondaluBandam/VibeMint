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
  Alert,
} from 'react-native';
import type { BlockedUserSummary } from '@vibemint/types';
import { Avatar } from '../ui/Avatar';
import { mobileBlocksService } from '../../src/services/blocks/blocksService';

export interface BlockedUsersModalProps {
  visible: boolean;
  onClose: () => void;
  onBlockChanged?: () => void;
}

export const BlockedUsersModal: React.FC<BlockedUsersModalProps> = ({
  visible,
  onClose,
  onBlockChanged,
}) => {
  const [users, setUsers] = useState<BlockedUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

  const fetchBlockedUsers = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await mobileBlocksService.getBlockedUsers(undefined, 20);
      setUsers(res.blockedUsers);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void fetchBlockedUsers();
    }
  }, [visible, fetchBlockedUsers]);

  const handleLoadMore = async () => {
    if (loading || loadingMore || !hasMore || !nextCursor) return;
    try {
      setLoadingMore(true);
      const res = await mobileBlocksService.getBlockedUsers(nextCursor, 20);
      setUsers((prev) => [...prev, ...res.blockedUsers]);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch {
      // Gracefully handle pagination error
    } finally {
      setLoadingMore(false);
    }
  };

  const handleUnblock = (user: BlockedUserSummary) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock @${user.username}? They will be able to view your public profile and content again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            try {
              setUnblockingUserId(user.id);
              await mobileBlocksService.unblockUser(user.id);
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
              onBlockChanged?.();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to unblock user');
            } finally {
              setUnblockingUserId(null);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: BlockedUserSummary }) => (
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
      </View>
      <TouchableOpacity
        style={styles.unblockButton}
        onPress={() => handleUnblock(item)}
        disabled={unblockingUserId === item.id}
        activeOpacity={0.7}
      >
        {unblockingUserId === item.id ? (
          <ActivityIndicator size="small" color="#cbd5e1" />
        ) : (
          <Text style={styles.unblockButtonText}>Unblock</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Blocked Users</Text>
            <Text style={styles.headerSubtitle}>
              Accounts you have blocked cannot interact with you
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.statusText}>Loading blocked users...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchBlockedUsers}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>No Blocked Users</Text>
            <Text style={styles.emptySubtitle}>You haven't blocked any accounts yet.</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginLeft: 12,
  },
  closeButtonText: {
    color: '#38bdf8',
    fontSize: 14,
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
    paddingVertical: 12,
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
  unblockButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 78,
    alignItems: 'center',
  },
  unblockButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
