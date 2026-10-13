import { useState, useEffect, useCallback, type FC } from 'react';
import type { BlockedUserSummary } from '@vibemint/types';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { Avatar, Button } from '../ui';
import { webBlocksService } from '../../services/blocks/blocksService';

export interface BlockedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBlockChanged?: () => void;
}

export const BlockedUsersModal: FC<BlockedUsersModalProps> = ({
  isOpen,
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

  const fetchData = useCallback(async () => {
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
    if (isOpen) {
      void fetchData();
    } else {
      setUsers([]);
      setErrorMessage(null);
    }
  }, [isOpen, fetchData]);

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
      onBlockChanged?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to unblock user');
    } finally {
      setUnblockingUserId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocked-users-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: spacing.md,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.dark.surface,
          border: `1px solid ${colors.dark.border}`,
          borderRadius: radius.xl,
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
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
            backgroundColor: '#0f172a',
          }}
        >
          <div>
            <h2
              id="blocked-users-modal-title"
              style={{
                fontSize: '1.125rem',
                fontWeight: fontWeights.bold,
                margin: 0,
                color: colors.dark.foreground,
              }}
            >
              Blocked Users
            </h2>
            <p
              style={{
                fontSize: '0.8125rem',
                color: colors.dark.mutedForeground,
                margin: '0.125rem 0 0',
              }}
            >
              Accounts you have blocked cannot interact with you
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.dark.mutedForeground,
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: spacing.xs,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: spacing.lg,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.md,
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
              Loading blocked users...
            </div>
          ) : errorMessage ? (
            <div style={{ textAlign: 'center', padding: spacing.xl }}>
              <p style={{ color: '#ef4444', marginBottom: spacing.md }}>{errorMessage}</p>
              <Button variant="secondary" size="sm" onClick={() => void fetchData()}>
                Retry
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: spacing.xl,
                color: colors.dark.mutedForeground,
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: spacing.xs }}>🛡️</div>
              <p style={{ fontWeight: fontWeights.semiBold, color: colors.dark.foreground }}>
                No Blocked Users
              </p>
              <p style={{ fontSize: '0.875rem' }}>You haven't blocked any accounts yet.</p>
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
                    padding: spacing.sm,
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
                    style={{ minWidth: '85px' }}
                  >
                    Unblock
                  </Button>
                </div>
              ))}

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: spacing.md }}>
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
        </div>
      </div>
    </div>
  );
};
