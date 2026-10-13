import { useState, useEffect, useCallback, type FC } from 'react';
import type { PostSummary } from '@vibemint/types';
import { colors, spacing, fontWeights } from '@vibemint/design-tokens';
import { Button, Card } from '../components/ui';
import { PostCard } from '../components/feed/PostCard';
import { CreatePostCard } from '../components/feed/CreatePostCard';
import { ReportModal } from '../components/safety/ReportModal';
import { webPostsService } from '../services/posts/postsService';
import { useAuth } from '../stores/auth/AuthContext';

type FeedTab = 'FEED' | 'SAVED';

export const AppHomePage: FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<FeedTab>('FEED');
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reportingPost, setReportingPost] = useState<PostSummary | null>(null);

  const loadData = useCallback(async (tab: FeedTab, isInitial = true) => {
    try {
      if (isInitial) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      if (tab === 'FEED') {
        const res = await webPostsService.getFeed(undefined, 20);
        setPosts(res.posts);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      } else {
        const res = await webPostsService.getSavedPosts(undefined, 20);
        setPosts(res.posts);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(activeTab, true);
  }, [activeTab, loadData]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || !nextCursor) return;

    try {
      setIsLoadingMore(true);
      if (activeTab === 'FEED') {
        const res = await webPostsService.getFeed(nextCursor, 20);
        setPosts((prev) => [...prev, ...res.posts]);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      } else {
        const res = await webPostsService.getSavedPosts(nextCursor, 20);
        setPosts((prev) => [...prev, ...res.posts]);
        setHasMore(res.pagination.hasMore);
        setNextCursor(res.pagination.nextCursor ?? null);
      }
    } catch {
      // Keep existing list on failure
    } finally {
      setIsLoadingMore(false);
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
        const res = await webPostsService.unlikePost(post.id);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, isLiked: false, likeCount: res.likeCount } : p,
          ),
        );
      } else {
        const res = await webPostsService.likePost(post.id);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, isLiked: true, likeCount: res.likeCount } : p,
          ),
        );
      }
    } catch {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, isLiked: isCurrentlyLiked, likeCount: post.likeCount } : p,
        ),
      );
    }
  };

  const handleToggleSave = async (post: PostSummary) => {
    const isCurrentlySaved = post.isSaved;

    // If currently on saved tab and unsaving, immediately filter out
    if (activeTab === 'SAVED' && isCurrentlySaved) {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } else {
      // Optimistic update
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, isSaved: !isCurrentlySaved } : p)),
      );
    }

    try {
      if (isCurrentlySaved) {
        await webPostsService.unsavePost(post.id);
      } else {
        await webPostsService.savePost(post.id);
      }
    } catch {
      // Re-fetch on error
      void loadData(activeTab, false);
    }
  };

  const handleDeletePost = async (post: PostSummary) => {
    try {
      await webPostsService.deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch {
      // Error handling
    }
  };

  const handlePostCreated = (newPost: PostSummary) => {
    if (activeTab === 'FEED') {
      setPosts((prev) => [newPost, ...prev]);
    } else {
      setActiveTab('FEED');
    }
  };

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: `${spacing.lg} 0` }}>
      {/* Create Post Section (visible on Feed tab) */}
      {activeTab === 'FEED' && <CreatePostCard onPostCreated={handlePostCreated} />}

      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Feed sections"
        style={{
          display: 'flex',
          gap: spacing.sm,
          marginBottom: spacing.xl,
          borderBottom: `1px solid ${colors.dark.border}`,
          paddingBottom: spacing.xs,
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'FEED'}
          onClick={() => setActiveTab('FEED')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'FEED' ? colors.dark.primary : 'transparent'}`,
            color: activeTab === 'FEED' ? colors.dark.primary : colors.dark.mutedForeground,
            fontSize: '1rem',
            fontWeight: fontWeights.semiBold,
            padding: `${spacing.sm} ${spacing.md}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Social Feed
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'SAVED'}
          onClick={() => setActiveTab('SAVED')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: `2px solid ${
              activeTab === 'SAVED' ? colors.dark.primary : 'transparent'
            }`,
            color: activeTab === 'SAVED' ? colors.dark.primary : colors.dark.mutedForeground,
            fontSize: '1rem',
            fontWeight: fontWeights.semiBold,
            padding: `${spacing.sm} ${spacing.md}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Saved Posts
        </button>
      </div>

      {/* Error State */}
      {errorMessage && (
        <Card
          style={{
            padding: spacing.xl,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${colors.dark.error}`,
            textAlign: 'center',
            marginBottom: spacing.xl,
          }}
        >
          <p style={{ color: colors.dark.error, margin: `0 0 ${spacing.md} 0` }}>{errorMessage}</p>
          <Button variant="outline" size="sm" onClick={() => void loadData(activeTab, true)}>
            Retry
          </Button>
        </Card>
      )}

      {/* Feed List */}
      {isLoading ? (
        <div
          style={{
            padding: `${spacing['3xl']} 0`,
            textAlign: 'center',
            color: colors.dark.mutedForeground,
          }}
        >
          Loading posts...
        </div>
      ) : posts.length === 0 ? (
        <Card
          style={{
            padding: spacing['3xl'],
            backgroundColor: colors.dark.surface,
            border: `1px solid ${colors.dark.border}`,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: spacing.md }}>
            {activeTab === 'FEED' ? '✨' : '🔖'}
          </span>
          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: fontWeights.semiBold,
              color: colors.dark.foreground,
              margin: `0 0 ${spacing.xs} 0`,
            }}
          >
            {activeTab === 'FEED' ? 'No posts yet' : 'No saved posts'}
          </h3>
          <p
            style={{
              color: colors.dark.mutedForeground,
              fontSize: '0.875rem',
              margin: 0,
            }}
          >
            {activeTab === 'FEED'
              ? 'Be the first to share your creative vibe with the community!'
              : 'Posts you save will appear here for easy access later.'}
          </p>
        </Card>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onToggleLike={handleToggleLike}
              onToggleSave={handleToggleSave}
              onDelete={handleDeletePost}
              onReport={(p) => setReportingPost(p)}
            />
          ))}

          {/* Pagination / Load More */}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: spacing.xl }}>
              <Button
                variant="outline"
                size="md"
                loading={isLoadingMore}
                disabled={isLoadingMore}
                onClick={handleLoadMore}
              >
                Load More Posts
              </Button>
            </div>
          )}
        </div>
      )}

      {reportingPost && (
        <ReportModal
          isOpen={Boolean(reportingPost)}
          onClose={() => setReportingPost(null)}
          targetType="POST"
          targetId={reportingPost.id}
          targetLabel={`Post by @${reportingPost.author.username}`}
        />
      )}
    </div>
  );
};
