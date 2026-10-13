import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import type { PublicUserProfile, FollowRelationshipStatus } from '@vibemint/types';
import { Avatar } from '../ui/Avatar';
import { mobileProfileService } from '../../src/services/profiles/profileService';
import { mobileFollowsService } from '../../src/services/follows/followsService';
import { mobileBlocksService } from '../../src/services/blocks/blocksService';
import { ReportModal } from './ReportModal';

export interface UserProfileModalProps {
  visible: boolean;
  username: string | null;
  currentUserId?: string;
  onClose: () => void;
  onRelationshipChange?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  username,
  currentUserId,
  onClose,
  onRelationshipChange,
}) => {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!username) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await mobileProfileService.getProfileByUsername(username);
      setProfile(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (visible && username) {
      void fetchProfile();
    }
  }, [visible, username, fetchProfile]);

  const isSelf =
    profile?.followStatus === 'SELF' || (currentUserId && profile?.userId === currentUserId);

  const handleFollowToggle = async () => {
    if (!profile?.userId || followLoading) return;
    setFollowLoading(true);
    try {
      if (profile.followStatus === 'FOLLOWING' || profile.followStatus === 'PENDING') {
        await mobileFollowsService.unfollowUser(profile.userId);
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
      } else {
        const res = await mobileFollowsService.followUser(profile.userId);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                followStatus: res.status as FollowRelationshipStatus,
                followerCount: (prev.followerCount ?? 0) + (res.status === 'FOLLOWING' ? 1 : 0),
              }
            : null,
        );
      }
      onRelationshipChange?.();
    } catch (err) {
      Alert.alert('Follow Error', err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlockToggle = () => {
    if (!profile?.userId || blockLoading) return;

    if (profile.isBlockedByViewer) {
      // Unblock confirmation
      Alert.alert(
        'Unblock User',
        `Unblock @${profile.username}? They will be able to view your public profile and content again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: async () => {
              setBlockLoading(true);
              try {
                await mobileBlocksService.unblockUser(profile.userId!);
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        isBlocked: false,
                        isBlockedByViewer: false,
                      }
                    : null,
                );
                onRelationshipChange?.();
                void fetchProfile();
              } catch (err) {
                Alert.alert('Error', err instanceof Error ? err.message : 'Failed to unblock user');
              } finally {
                setBlockLoading(false);
              }
            },
          },
        ],
      );
    } else {
      // Block confirmation with safety explanation
      Alert.alert(
        'Block User',
        `Are you sure you want to block @${profile.username}?\n\nThey will not be able to follow you, view your posts, leave comments, or interact with you. Any existing follows between you will be removed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block User',
            style: 'destructive',
            onPress: async () => {
              setBlockLoading(true);
              try {
                await mobileBlocksService.blockUser(profile.userId!);
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        isBlocked: true,
                        isBlockedByViewer: true,
                        followStatus: 'NOT_FOLLOWING',
                      }
                    : null,
                );
                onRelationshipChange?.();
              } catch (err) {
                Alert.alert('Error', err instanceof Error ? err.message : 'Failed to block user');
              } finally {
                setBlockLoading(false);
              }
            },
          },
        ],
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{username ? `@${username}` : 'Profile'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.statusText}>Loading profile...</Text>
          </View>
        ) : errorMessage || !profile ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>🔒</Text>
            <Text style={styles.emptyTitle}>Profile Unavailable</Text>
            <Text style={styles.emptySubtitle}>
              {errorMessage || 'This profile is not accessible or does not exist.'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {/* Blocked by viewer warning banner */}
            {profile.isBlockedByViewer && (
              <View style={styles.blockedBanner}>
                <Text style={styles.blockedBannerText}>
                  You have blocked this account. Unblock to view their full activity and interact.
                </Text>
              </View>
            )}

            {/* Profile Avatar & Names */}
            <View style={styles.profileHeader}>
              <Avatar
                src={profile.avatarUrl || undefined}
                fallback={profile.displayName || profile.username}
                size="lg"
              />
              <Text style={styles.displayName}>{profile.displayName}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
              {profile.profileVisibility && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{profile.profileVisibility}</Text>
                </View>
              )}
            </View>

            {/* Stats Row */}
            {!profile.isRestricted && (
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{profile.followerCount ?? 0}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{profile.followingCount ?? 0}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              </View>
            )}

            {/* Bio & Details */}
            {profile.bio && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Bio</Text>
                <Text style={styles.sectionValue}>{profile.bio}</Text>
              </View>
            )}

            {profile.location && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Location</Text>
                <Text style={styles.sectionValue}>{profile.location}</Text>
              </View>
            )}

            {/* Action Buttons for Other Users */}
            {!isSelf && (
              <View style={styles.actionsContainer}>
                {!profile.isBlocked && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      profile.followStatus === 'FOLLOWING'
                        ? styles.followingButton
                        : styles.followButton,
                    ]}
                    onPress={handleFollowToggle}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text
                        style={[
                          styles.actionButtonText,
                          profile.followStatus === 'FOLLOWING' && styles.followingButtonText,
                        ]}
                      >
                        {profile.followStatus === 'FOLLOWING'
                          ? 'Following'
                          : profile.followStatus === 'PENDING'
                            ? 'Requested'
                            : 'Follow'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                {/* Block / Unblock Action Button */}
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    profile.isBlockedByViewer ? styles.unblockAction : styles.blockAction,
                  ]}
                  onPress={handleBlockToggle}
                  disabled={blockLoading}
                >
                  {blockLoading ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text
                      style={[
                        styles.actionButtonText,
                        profile.isBlockedByViewer
                          ? styles.unblockActionText
                          : styles.blockActionText,
                      ]}
                    >
                      {profile.isBlockedByViewer ? 'Unblock User' : 'Block User'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Report User Action Button */}
                <TouchableOpacity
                  style={[styles.actionButton, styles.reportAction]}
                  onPress={() => setReportModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionButtonText, styles.reportActionText]}>
                    Report Account
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {profile?.userId && (
          <ReportModal
            visible={reportModalVisible}
            targetType="USER"
            targetId={profile.userId}
            targetLabel={`@${profile.username}`}
            onClose={() => setReportModalVisible(false)}
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
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
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
  content: {
    padding: 20,
    alignItems: 'center',
  },
  blockedBanner: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  blockedBannerText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  displayName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  username: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  badgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 32,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    width: '100%',
    justifyContent: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    width: '100%',
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionValue: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  followButton: {
    backgroundColor: '#4f46e5',
  },
  followingButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  followingButtonText: {
    color: '#cbd5e1',
  },
  blockAction: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  blockActionText: {
    color: '#ef4444',
  },
  unblockAction: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  unblockActionText: {
    color: '#38bdf8',
  },
  reportAction: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  reportActionText: {
    color: '#94a3b8',
  },
});
