import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import type { UserProfile, ProfileVisibility } from '@vibemint/types';
import { mobileProfileService } from '../../src/services/profiles/profileService';
import { Avatar, Button, Card, Input } from '../../components/ui';
import { FollowListModal, FollowListType } from '../../components/feed/FollowListModal';
import { BlockedUsersModal } from '../../components/safety/BlockedUsersModal';
import { theme } from '../../theme';

export default function MeScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Follow list modal state
  const [followModalVisible, setFollowModalVisible] = useState(false);
  const [followModalType, setFollowModalType] = useState<FollowListType>('followers');

  // Blocked users modal state
  const [blockedModalVisible, setBlockedModalVisible] = useState(false);

  // Edit fields
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<ProfileVisibility>('PUBLIC');

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await mobileProfileService.getMyProfile();
      setProfile(data);
      if (data) {
        setUsername(data.username);
        setDisplayName(data.displayName);
        setBio(data.bio || '');
        setAvatarUrl(data.avatarUrl || '');
        setLocation(data.location || '');
        setVisibility(data.profileVisibility);
      } else {
        setIsEditing(true); // Open creation mode if no profile yet
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username is required');
      return;
    }
    if (!displayName.trim()) {
      Alert.alert('Validation Error', 'Display name is required');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updated = await mobileProfileService.updateMyProfile({
        username: username.trim(),
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        location: location.trim() || null,
        profileVisibility: visibility,
      });

      setProfile(updated);
      setIsEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setErrorMessage(msg);
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (errorMessage && !profile && !isEditing) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorSub}>{errorMessage}</Text>
        <Button variant="primary" onPress={() => void fetchProfile()}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>My Profile</Text>
        {profile && !isEditing && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {errorMessage && (
        <View style={styles.bannerError}>
          <Text style={styles.bannerErrorText}>{errorMessage}</Text>
        </View>
      )}

      {!isEditing && profile ? (
        <Card style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <Avatar src={profile.avatarUrl || undefined} fallback={profile.displayName} size="lg" />
            <View style={styles.nameBlock}>
              <Text style={styles.displayName}>{profile.displayName}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
              <View
                style={[
                  styles.visibilityBadge,
                  profile.profileVisibility === 'PUBLIC' ? styles.badgePublic : styles.badgePrivate,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    profile.profileVisibility === 'PUBLIC'
                      ? styles.badgeTextPublic
                      : styles.badgeTextPrivate,
                  ]}
                >
                  {profile.profileVisibility}
                </Text>
              </View>
            </View>
          </View>

          {/* Follow Stats */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              onPress={() => {
                setFollowModalType('followers');
                setFollowModalVisible(true);
              }}
              style={styles.statBox}
              activeOpacity={0.7}
            >
              <Text style={styles.statCount}>{profile.followerCount ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setFollowModalType('following');
                setFollowModalVisible(true);
              }}
              style={styles.statBox}
              activeOpacity={0.7}
            >
              <Text style={styles.statCount}>{profile.followingCount ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>

            {profile.profileVisibility === 'PRIVATE' && (
              <TouchableOpacity
                onPress={() => {
                  setFollowModalType('requests');
                  setFollowModalVisible(true);
                }}
                style={styles.statBox}
                activeOpacity={0.7}
              >
                <Text style={styles.statIcon}>📩</Text>
                <Text style={styles.statLabel}>Requests</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Bio</Text>
            <Text style={styles.sectionValue}>{profile.bio || 'No bio provided yet.'}</Text>
          </View>

          {profile.location && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Location</Text>
              <Text style={styles.sectionValue}>{profile.location}</Text>
            </View>
          )}

          <View style={styles.footerRow}>
            <Text style={styles.joinedText}>
              Member since {new Date(profile.createdAt).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.safetySection}>
            <TouchableOpacity
              style={styles.safetyButton}
              onPress={() => setBlockedModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.safetyButtonLeft}>
                <Text style={styles.safetyIcon}>🛡️</Text>
                <View>
                  <Text style={styles.safetyTitle}>Blocked Users</Text>
                  <Text style={styles.safetySubtitle}>
                    Manage blocked accounts and safety controls
                  </Text>
                </View>
              </View>
              <Text style={styles.safetyArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : (
        <Card style={styles.profileCard}>
          <Text style={styles.cardHeaderTitle}>{profile ? 'Edit Profile' : 'Set Up Profile'}</Text>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Username</Text>
            <Input
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. vibe_master"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <Input
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Vibe Master"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <Input
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself..."
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Avatar URL</Text>
            <Input
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              placeholder="https://example.com/avatar.jpg"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Location</Text>
            <Input value={location} onChangeText={setLocation} placeholder="e.g. Los Angeles, CA" />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Visibility</Text>
            <View style={styles.visibilityToggleRow}>
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility === 'PUBLIC' && styles.visibilityOptionActive,
                ]}
                onPress={() => setVisibility('PUBLIC')}
              >
                <Text
                  style={[
                    styles.visibilityOptionText,
                    visibility === 'PUBLIC' && styles.visibilityOptionTextActive,
                  ]}
                >
                  PUBLIC
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility === 'PRIVATE' && styles.visibilityOptionActive,
                ]}
                onPress={() => setVisibility('PRIVATE')}
              >
                <Text
                  style={[
                    styles.visibilityOptionText,
                    visibility === 'PRIVATE' && styles.visibilityOptionTextActive,
                  ]}
                >
                  PRIVATE
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actionRow}>
            {profile && (
              <Button
                variant="secondary"
                onPress={() => {
                  setIsEditing(false);
                  setErrorMessage(null);
                }}
                disabled={isSaving}
                style={styles.actionButton}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              onPress={() => void handleSave()}
              disabled={isSaving}
              style={styles.actionButton}
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </Button>
          </View>
        </Card>
      )}

      {profile && (
        <FollowListModal
          visible={followModalVisible}
          onClose={() => setFollowModalVisible(false)}
          userId={profile.userId}
          type={followModalType}
          onFollowCountChange={() => void fetchProfile()}
        />
      )}

      <BlockedUsersModal
        visible={blockedModalVisible}
        onClose={() => setBlockedModalVisible(false)}
        onBlockChanged={() => void fetchProfile()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0b0f17',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorSub: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  editButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  bannerError: {
    backgroundColor: '#451a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  bannerErrorText: {
    color: '#f87171',
    fontSize: 14,
  },
  profileCard: {
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  nameBlock: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  username: {
    fontSize: 15,
    color: '#818cf8',
    marginTop: 2,
    marginBottom: 6,
  },
  visibilityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgePublic: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  badgePrivate: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextPublic: {
    color: '#34d399',
  },
  badgeTextPrivate: {
    color: '#94a3b8',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 15,
    color: '#e2e8f0',
    lineHeight: 22,
  },
  footerRow: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 12,
    marginTop: 8,
  },
  joinedText: {
    fontSize: 12,
    color: '#64748b',
  },
  formGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 6,
    fontWeight: '500',
  },
  visibilityToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  visibilityOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  visibilityOptionActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  visibilityOptionText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 13,
  },
  visibilityOptionTextActive: {
    color: '#818cf8',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    minWidth: 100,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCount: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  statIcon: {
    fontSize: 16,
  },
  safetySection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 12,
  },
  safetyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  safetyButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  safetyIcon: {
    fontSize: 20,
  },
  safetyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  safetySubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  safetyArrow: {
    color: '#64748b',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
});
