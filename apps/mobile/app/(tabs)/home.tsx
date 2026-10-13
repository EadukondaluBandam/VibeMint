import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { PostSummary } from '@vibemint/types';
import { PostCard } from '../../components/feed/PostCard';
import { CreatePostModal } from '../../components/feed/CreatePostModal';
import { CommentsModal } from '../../components/feed/CommentsModal';
import { UserProfileModal } from '../../components/safety/UserProfileModal';
import { ReportModal } from '../../components/safety/ReportModal';
import { mobilePostsService } from '../../src/services/posts/postsService';
import { mobileNotificationsService } from '../../src/services/notifications/notificationsService';
import { useAuth } from '../../src/stores/auth/AuthContext';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState<PostSummary | null>(null);
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [reportingPost, setReportingPost] = useState<PostSummary | null>(null);

  const fetchFeed = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      const res = await mobilePostsService.getFeed(undefined, 20);
      setPosts(res.posts);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);

      try {
        const notifRes = await mobileNotificationsService.getUnreadCount();
        setUnreadNotifications(notifRes.unreadCount);
      } catch {
        // Silently proceed
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  const handleRefresh = () => {
    void fetchFeed(true);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    try {
      setLoadingMore(true);
      const res = await mobilePostsService.getFeed(nextCursor, 20);
      setPosts((prev) => [...prev, ...res.posts]);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch {
      // Keep existing list on pagination failure
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleLike = async (post: PostSummary) => {
    const isCurrentlyLiked = post.isLiked;
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              isLiked: !isCurrentlyLiked,
              likeCount: isCurrentlyLiked ? Math.max(0, p.likeCount - 1) : p.likeCount + 1,
            }
          : p,
      ),
    );

    try {
      if (isCurrentlyLiked) {
        const res = await mobilePostsService.unlikePost(post.id);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, isLiked: false, likeCount: res.likeCount } : p,
          ),
        );
      } else {
        const res = await mobilePostsService.likePost(post.id);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, isLiked: true, likeCount: res.likeCount } : p,
          ),
        );
      }
    } catch {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, isLiked: isCurrentlyLiked, likeCount: post.likeCount } : p,
        ),
      );
    }
  };

  const handleToggleSave = async (post: PostSummary) => {
    const isCurrentlySaved = post.isSaved;
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, isSaved: !isCurrentlySaved } : p)),
    );

    try {
      if (isCurrentlySaved) {
        await mobilePostsService.unsavePost(post.id);
      } else {
        await mobilePostsService.savePost(post.id);
      }
    } catch {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, isSaved: isCurrentlySaved } : p)),
      );
    }
  };

  const handleDeletePost = async (post: PostSummary) => {
    try {
      await mobilePostsService.deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch {
      // Handle error
    }
  };

  const handlePostCreated = (newPost: PostSummary) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleCommentAdded = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentCount: (p.commentCount ?? 0) + 1 } : p)),
    );
  };

  const handleCommentDeleted = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentCount: Math.max(0, (p.commentCount ?? 0) - 1) } : p,
      ),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f17" />

      {/* App Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>VibeMint</Text>
          <Text style={styles.headerSubtitle}>Discover Feed</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={styles.notificationButton}
            accessibilityLabel="Notifications"
          >
            <Text style={styles.notificationIcon}>🔔</Text>
            {unreadNotifications > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCreateModalVisible(true)}
            style={styles.createButton}
            activeOpacity={0.8}
          >
            <Text style={styles.createButtonText}>+ Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Feed Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading fresh vibes...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Oops! Unable to load feed</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => fetchFeed()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptySubtitle}>
            Be the very first creator to share a vibe with the community!
          </Text>
          <TouchableOpacity
            onPress={() => setCreateModalVisible(true)}
            style={styles.firstPostButton}
          >
            <Text style={styles.firstPostButtonText}>Create First Post</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserId={user?.id}
              onToggleLike={handleToggleLike}
              onToggleSave={handleToggleSave}
              onDelete={handleDeletePost}
              onOpenComments={(post) => setActiveCommentPost(post)}
              onPressAuthor={(authorUsername) => setSelectedUsername(authorUsername)}
              onReport={(post) => setReportingPost(post)}
            />
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

      {/* Create Post Modal */}
      <CreatePostModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Comments Modal */}
      {activeCommentPost && (
        <CommentsModal
          visible={Boolean(activeCommentPost)}
          onClose={() => setActiveCommentPost(null)}
          postId={activeCommentPost.id}
          currentUserId={user?.id}
          onCommentAdded={() => handleCommentAdded(activeCommentPost.id)}
          onCommentDeleted={() => handleCommentDeleted(activeCommentPost.id)}
        />
      )}

      {/* User Profile & Safety Modal */}
      <UserProfileModal
        visible={Boolean(selectedUsername)}
        username={selectedUsername}
        currentUserId={user?.id}
        onClose={() => setSelectedUsername(null)}
        onRelationshipChange={() => void fetchFeed()}
      />

      {/* Post Reporting Modal */}
      {reportingPost && (
        <ReportModal
          visible={Boolean(reportingPost)}
          targetType="POST"
          targetId={reportingPost.id}
          targetLabel={`Post by @${reportingPost.author.username}`}
          onClose={() => setReportingPost(null)}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0b0f17',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  createButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationIcon: {
    fontSize: 18,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 14,
    color: '#f87171',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 24,
    lineHeight: 20,
  },
  firstPostButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  firstPostButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
