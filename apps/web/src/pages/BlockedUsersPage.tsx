import { useState, useEffect, useCallback, type FC } from 'react';
import { Link } from 'react-router-dom';
import type { BlockedUserSummary } from '@vibemint/types';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { Avatar, Button, Card } from '../components/ui';
import { webBlocksService } from '../services/blocks/blocksService';

export const BlockedUsersPage: FC = () => {
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
      const res = await webBlocksService.getBlockedUsers(undefined, 20);
      setUsers(res.blockedUsers);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    try {
      setLoadingMore(true);
      const res = await webBlocksService.getBlockedUsers(nextCursor, 20);
      setUsers((prev) => [...prev, ...res.blockedUsers]);
      setHasMore(res.pagination.hasMore);
      setNextCursor(res.pagination.nextCursor ?? null);
    } catch {
      // Gracefully handle pagination error
    } finally {
      setLoadingMore(false);
    }
  };

  const handleUnblock = async (user: BlockedUserSummary) => {
    const confirmed = window.confirm(
      `Are you sure you want to unblock @${user.username}? They will be able to view your public profile and content again.`,
    );
    if (!confirmed) return;

    try {
      setUnblockingUserId(user.id);
      await webBlocksService.unblockUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to unblock user');
    } finally {
      setUnblockingUserId(null);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      <div
        style={{ marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}
      >
        <Link
          to="/profile/me"
          style={{
            color: colors.dark.primary,
            textDecoration: 'none',
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          ← Back to Profile
        </Link>
      </div>

      <Card
        style={{
          backgroundColor: colors.dark.surface,
          border: `1px solid ${colors.dark.border}`,
          borderRadius: radius.xl,
          padding: spacing.xl,
        }}
      >
        <div style={{ marginBottom: spacing.lg }}>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: fontWeights.bold,
              margin: 0,
              color: colors.dark.foreground,
            }}
          >
            Blocked Accounts
          </h1>
          <p
            style={{
              color: colors.dark.mutedForeground,
              fontSize: '0.9375rem',
              margin: '0.25rem 0 0',
            }}
          >
            Accounts you have blocked cannot follow you, view your posts, leave comments, or
            interact with you.
          </p>
        </div>

        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: spacing['2xl'],
              color: colors.dark.mutedForeground,
            }}
          >
            Loading blocked accounts...
          </div>
        ) : errorMessage ? (
          <div style={{ textAlign: 'center', padding: spacing.xl }}>
            <p style={{ color: '#ef4444', marginBottom: spacing.md }}>{errorMessage}</p>
            <Button variant="secondary" size="sm" onClick={() => void fetchBlockedUsers()}>
              Retry
            </Button>
          </div>
        ) : users.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: spacing['2xl'],
              color: colors.dark.mutedForeground,
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: spacing.sm }}>🛡️</div>
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: fontWeights.semiBold,
                color: colors.dark.foreground,
                margin: '0 0 0.5rem',
              }}
            >
              No blocked accounts
            </h3>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>
              You haven't blocked anyone yet. When you block someone, they will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {users.map((user) => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: spacing.md,
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${colors.dark.border}`,
                  borderRadius: radius.lg,
                  gap: spacing.md,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                  <Avatar src={user.avatarUrl || undefined} alt={user.displayName} size="md" />
                  <div>
                    <div
                      style={{
                        fontWeight: fontWeights.semiBold,
                        color: colors.dark.foreground,
                        fontSize: '0.9375rem',
                      }}
                    >
                      {user.displayName}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: colors.dark.mutedForeground,
                      }}
                    >
                      @{user.username}
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  loading={unblockingUserId === user.id}
                  disabled={unblockingUserId === user.id}
                  onClick={() => void handleUnblock(user)}
                  style={{ minWidth: '90px' }}
                >
                  Unblock
                </Button>
              </div>
            ))}

            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: spacing.lg }}>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={loadingMore}
                  disabled={loadingMore}
                  onClick={() => void handleLoadMore()}
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
