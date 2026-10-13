import { useState, useEffect, type FC } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { PublicUserProfile, FollowRelationshipStatus } from '@vibemint/types';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { webProfileService } from '../services/profiles/profileService';
import { webFollowsService } from '../services/follows/followsService';
import { webBlocksService } from '../services/blocks/blocksService';
import { useAuth } from '../stores/auth/AuthContext';
import { Card, Avatar, Badge, Button } from '../components/ui';
import { FollowListModal, FollowListType } from '../components/feed/FollowListModal';
import { ReportModal } from '../components/safety/ReportModal';

export const PublicProfilePage: FC = () => {
  const { username } = useParams<{ username: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [unblockLoading, setUnblockLoading] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Follow list modal state
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followModalType, setFollowModalType] = useState<FollowListType>('followers');

  const fetchProfile = (isMounted = true) => {
    if (!username) return;
    setIsLoading(true);
    setErrorMessage(null);

    webProfileService
      .getProfileByUsername(username)
      .then((data) => {
        if (!isMounted) return;
        setProfile(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    fetchProfile(isMounted);
    return () => {
      isMounted = false;
    };
  }, [username]);

  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!profile || followLoading) return;

    setFollowLoading(true);
    try {
      if (profile.followStatus === 'FOLLOWING' || profile.followStatus === 'PENDING') {
        // Unfollow or cancel request
        if (profile.userId) {
          await webFollowsService.unfollowUser(profile.userId);
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  followStatus: 'NOT_FOLLOWING',
                  followerCount: Math.max(
                    0,
                    (prev.followerCount ?? 0) - (prev.followStatus === 'FOLLOWING' ? 1 : 0),
                  ),
                }
              : null,
          );
        }
      } else {
        // Follow or request
        if (profile.userId) {
          const res = await webFollowsService.followUser(profile.userId);
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  followStatus: res.status as FollowRelationshipStatus,
                  followerCount: (prev.followerCount ?? 0) + (res.status === 'FOLLOWING' ? 1 : 0),
                  // If newly accepted follower on private profile, refresh profile details
                  isRestricted: res.status === 'FOLLOWING' ? false : prev.isRestricted,
                }
              : null,
          );
          if (res.status === 'FOLLOWING' && profile.profileVisibility === 'PRIVATE') {
            fetchProfile();
          }
        }
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Follow operation failed');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlockConfirm = async () => {
    if (!profile?.userId || blockLoading) return;
    setBlockLoading(true);
    try {
      await webBlocksService.blockUser(profile.userId);
      setBlockModalOpen(false);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isBlocked: true,
              isBlockedByViewer: true,
              followStatus: 'NOT_FOLLOWING',
              isRestricted: true,
              followerCount: Math.max(
                0,
                (prev.followerCount ?? 0) - (prev.followStatus === 'FOLLOWING' ? 1 : 0),
              ),
            }
          : null,
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to block user');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!profile?.userId || unblockLoading) return;
    setUnblockLoading(true);
    try {
      await webBlocksService.unblockUser(profile.userId);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isBlocked: false,
              isBlockedByViewer: false,
            }
          : null,
      );
      fetchProfile();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to unblock user');
    } finally {
      setUnblockLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{ textAlign: 'center', padding: '3rem 1rem', color: colors.dark.mutedForeground }}
      >
        <p>Loading profile...</p>
      </div>
    );
  }

  if (errorMessage || !profile) {
    return (
      <div style={{ maxWidth: '480px', margin: '2rem auto', textAlign: 'center' }}>
        <Card title="Profile Not Found">
          <p style={{ color: colors.dark.mutedForeground, marginBottom: '1.5rem' }}>
            We couldn't find a user profile for <strong>@{username}</strong>.
          </p>
          <Link to="/home">
            <Button variant="secondary">Back to Home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isSelf = profile.followStatus === 'SELF' || (user && profile.userId === user.id);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      <Card
        style={{
          backgroundColor: colors.dark.surface,
          border: `1px solid ${colors.dark.border}`,
          borderRadius: radius.xl,
          padding: spacing.xl,
        }}
      >
        {/* Blocked by viewer warning banner */}
        {profile.isBlockedByViewer && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: `1px solid #ef4444`,
              borderRadius: radius.md,
              padding: `${spacing.sm} ${spacing.md}`,
              marginBottom: spacing.md,
              color: '#f87171',
              fontSize: '0.875rem',
            }}
          >
            You have blocked @{profile.username}. Unblock to view their full activity and interact.
          </div>
        )}

        {/* Top Header Row with Avatar, Names, and Actions */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <Avatar src={profile.avatarUrl || undefined} alt={profile.displayName} size="lg" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <h1
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: fontWeights.bold,
                    margin: 0,
                    color: colors.dark.foreground,
                  }}
                >
                  {profile.displayName}
                </h1>
                <Badge variant={profile.profileVisibility === 'PUBLIC' ? 'success' : 'default'}>
                  {profile.profileVisibility}
                </Badge>
              </div>
              <p
                style={{
                  color: colors.dark.primary,
                  margin: '0.25rem 0 0',
                  fontSize: '0.9375rem',
                  fontWeight: fontWeights.medium,
                }}
              >
                @{profile.username}
              </p>
            </div>
          </div>

          {/* Action Buttons for other users */}
          {!isSelf && (
            <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
              {profile.isBlockedByViewer ? (
                <>
                  <Button
                    variant="outline"
                    size="md"
                    loading={unblockLoading}
                    disabled={unblockLoading}
                    onClick={() => void handleUnblock()}
                    style={{ minWidth: '100px' }}
                  >
                    Unblock
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      if (!isAuthenticated) {
                        navigate('/login');
                        return;
                      }
                      setReportModalOpen(true);
                    }}
                    style={{ color: colors.dark.mutedForeground }}
                  >
                    Report
                  </Button>
                </>
              ) : (
                <>
                  {!profile.isBlocked && (
                    <Button
                      variant={
                        profile.followStatus === 'FOLLOWING'
                          ? 'outline'
                          : profile.followStatus === 'PENDING'
                            ? 'secondary'
                            : 'primary'
                      }
                      size="md"
                      loading={followLoading}
                      disabled={followLoading}
                      onClick={() => void handleFollowToggle()}
                      style={{ minWidth: '100px' }}
                    >
                      {profile.followStatus === 'FOLLOWING'
                        ? 'Following'
                        : profile.followStatus === 'PENDING'
                          ? 'Requested'
                          : 'Follow'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      if (!isAuthenticated) {
                        navigate('/login');
                        return;
                      }
                      setBlockModalOpen(true);
                    }}
                    style={{ color: '#ef4444' }}
                  >
                    Block
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      if (!isAuthenticated) {
                        navigate('/login');
                        return;
                      }
                      setReportModalOpen(true);
                    }}
                    style={{ color: colors.dark.mutedForeground }}
                  >
                    Report
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stats Row (Followers & Following) */}
        {!profile.isRestricted && (
          <div
            style={{
              display: 'flex',
              gap: spacing.xl,
              padding: `${spacing.sm} 0`,
              marginBottom: spacing.lg,
              borderTop: `1px solid ${colors.dark.border}`,
              borderBottom: `1px solid ${colors.dark.border}`,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setFollowModalType('followers');
                setFollowModalOpen(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: colors.dark.foreground,
                fontSize: '0.9375rem',
                padding: `${spacing.xs} 0`,
              }}
            >
              <strong style={{ fontWeight: fontWeights.bold }}>{profile.followerCount ?? 0}</strong>
              <span style={{ color: colors.dark.mutedForeground }}>Followers</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFollowModalType('following');
                setFollowModalOpen(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: colors.dark.foreground,
                fontSize: '0.9375rem',
                padding: `${spacing.xs} 0`,
              }}
            >
              <strong style={{ fontWeight: fontWeights.bold }}>
                {profile.followingCount ?? 0}
              </strong>
              <span style={{ color: colors.dark.mutedForeground }}>Following</span>
            </button>
          </div>
        )}

        {profile.isBlocked && !profile.isBlockedByViewer ? (
          <div
            style={{
              padding: spacing.xl,
              backgroundColor: colors.dark.surfaceMuted,
              borderRadius: radius.lg,
              textAlign: 'center',
              color: colors.dark.mutedForeground,
              margin: `${spacing.md} 0`,
            }}
          >
            <div style={{ fontSize: '1.75rem', marginBottom: spacing.xs }}>🔒</div>
            <h3
              style={{
                color: colors.dark.foreground,
                margin: `0 0 ${spacing.xs}`,
                fontSize: '1.125rem',
              }}
            >
              Profile Unavailable
            </h3>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>This account is not accessible.</p>
          </div>
        ) : profile.isRestricted ? (
          <div
            style={{
              padding: spacing.xl,
              backgroundColor: colors.dark.surfaceMuted,
              borderRadius: radius.lg,
              textAlign: 'center',
              color: colors.dark.mutedForeground,
              margin: `${spacing.md} 0`,
            }}
          >
            <div style={{ fontSize: '1.75rem', marginBottom: spacing.xs }}>🔒</div>
            <h3
              style={{
                color: colors.dark.foreground,
                margin: `0 0 ${spacing.xs}`,
                fontSize: '1.125rem',
              }}
            >
              This Profile is Private
            </h3>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>
              Follow this account to see their full profile and updates.
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: spacing.md }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: colors.dark.mutedForeground,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: fontWeights.semiBold,
                }}
              >
                Bio
              </span>
              <p
                style={{
                  color: colors.dark.foreground,
                  margin: `${spacing.xs} 0 0`,
                  fontSize: '0.9375rem',
                }}
              >
                {profile.bio || 'No bio provided.'}
              </p>
            </div>

            {profile.location && (
              <div style={{ marginBottom: spacing.md }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: colors.dark.mutedForeground,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: fontWeights.semiBold,
                  }}
                >
                  Location
                </span>
                <p
                  style={{
                    color: colors.dark.foreground,
                    margin: `${spacing.xs} 0 0`,
                    fontSize: '0.9375rem',
                  }}
                >
                  {profile.location}
                </p>
              </div>
            )}

            {profile.createdAt && (
              <div
                style={{
                  borderTop: `1px solid ${colors.dark.border}`,
                  paddingTop: spacing.sm,
                  marginTop: spacing.md,
                }}
              >
                <span style={{ fontSize: '0.75rem', color: colors.dark.mutedForeground }}>
                  Member since {new Date(profile.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Follow List Modal */}
      {profile.userId && (
        <FollowListModal
          isOpen={followModalOpen}
          onClose={() => setFollowModalOpen(false)}
          userId={profile.userId}
          type={followModalType}
          onFollowCountChange={() => fetchProfile()}
        />
      )}

      {/* Accessible Block Confirmation Dialog */}
      {blockModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="block-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: spacing.md,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !blockLoading) setBlockModalOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: colors.dark.surface,
              border: `1px solid ${colors.dark.border}`,
              borderRadius: radius.xl,
              padding: spacing.xl,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h3
              id="block-dialog-title"
              style={{
                fontSize: '1.25rem',
                fontWeight: fontWeights.bold,
                margin: '0 0 0.5rem',
                color: colors.dark.foreground,
              }}
            >
              Block @{profile.username}?
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: colors.dark.mutedForeground,
                lineHeight: 1.5,
                margin: '0 0 1.5rem',
              }}
            >
              They will not be able to follow you, view your posts, leave comments, or interact with
              you. Any existing follows between you will be removed.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
              <Button
                variant="secondary"
                size="md"
                disabled={blockLoading}
                onClick={() => setBlockModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="md"
                loading={blockLoading}
                disabled={blockLoading}
                onClick={() => void handleBlockConfirm()}
              >
                Block User
              </Button>
            </div>
          </div>
        </div>
      )}

      {profile?.userId && (
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="USER"
          targetId={profile.userId}
          targetLabel={`@${profile.username}`}
        />
      )}
    </div>
  );
};
