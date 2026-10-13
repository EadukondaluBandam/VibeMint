import { useState, useEffect, type FC, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { UserProfile, ProfileVisibility } from '@vibemint/types';
import { webProfileService } from '../services/profiles/profileService';
import { webMediaService } from '../services/media/mediaService';
import { Card, Avatar, Button, Input, Badge } from '../components/ui';
import { FollowListModal, type FollowListType } from '../components/feed/FollowListModal';
import { BlockedUsersModal } from '../components/safety/BlockedUsersModal';

export const MyProfilePage: FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Follow modal state
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followModalType, setFollowModalType] = useState<FollowListType>('followers');

  // Blocked modal state
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);

  // Edit form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarAssetId, setAvatarAssetId] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<ProfileVisibility>('PUBLIC');

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    const check = webMediaService.validateFile(file);
    if (!check.valid) {
      setAvatarError(check.error || 'Invalid image');
      return;
    }

    setAvatarUploading(true);
    setAvatarProgress(0);

    try {
      const asset = await webMediaService.uploadImage(file, 'AVATAR', (pct) => {
        setAvatarProgress(pct);
      });
      setAvatarAssetId(asset.id);
      if (asset.deliveryUrl) {
        setAvatarUrl(asset.deliveryUrl);
      }
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Avatar upload failed');
    } finally {
      setAvatarUploading(false);
    }
  };

  const loadProfile = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await webProfileService.getMyProfile();
      setProfile(data);
      if (data) {
        setUsername(data.username);
        setDisplayName(data.displayName);
        setBio(data.bio || '');
        setAvatarUrl(data.avatarUrl || '');
        setLocation(data.location || '');
        setVisibility(data.profileVisibility);
      } else {
        // Automatically open creation mode if profile does not exist yet
        setIsEditing(true);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const updated = await webProfileService.updateMyProfile({
        username: username.trim(),
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        location: location.trim() || null,
        profileVisibility: visibility,
        mediaAssetId: avatarAssetId || undefined,
      });

      setProfile(updated);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
          My Profile
        </h1>
        {profile && !isEditing && (
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
      </div>

      {successMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            backgroundColor: '#064e3b',
            color: '#34d399',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            backgroundColor: '#451a1a',
            color: '#f87171',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      {!isEditing && profile ? (
        <Card>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <Avatar src={profile.avatarUrl || undefined} alt={profile.displayName} size="lg" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  {profile.displayName}
                </h2>
                <Badge variant={profile.profileVisibility === 'PUBLIC' ? 'success' : 'default'}>
                  {profile.profileVisibility}
                </Badge>
              </div>
              <p style={{ color: '#818cf8', margin: '0.25rem 0 0', fontSize: '0.9375rem' }}>
                @{profile.username}
              </p>
            </div>
          </div>

          {/* Stats Row (Followers & Following + Follow Requests) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              padding: '0.75rem 0',
              marginBottom: '1.25rem',
              borderTop: '1px solid #1e293b',
              borderBottom: '1px solid #1e293b',
              flexWrap: 'wrap',
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
                color: '#ffffff',
                fontSize: '0.9375rem',
                padding: '0.25rem 0',
              }}
            >
              <strong style={{ fontWeight: 700 }}>{profile.followerCount ?? 0}</strong>
              <span style={{ color: '#94a3b8' }}>Followers</span>
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
                color: '#ffffff',
                fontSize: '0.9375rem',
                padding: '0.25rem 0',
              }}
            >
              <strong style={{ fontWeight: 700 }}>{profile.followingCount ?? 0}</strong>
              <span style={{ color: '#94a3b8' }}>Following</span>
            </button>

            {profile.profileVisibility === 'PRIVATE' && (
              <button
                type="button"
                onClick={() => {
                  setFollowModalType('requests');
                  setFollowModalOpen(true);
                }}
                style={{
                  background: 'none',
                  border: '1px solid #4f46e5',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  color: '#818cf8',
                  fontSize: '0.8125rem',
                  padding: '0.25rem 0.75rem',
                  marginLeft: 'auto',
                }}
              >
                <span>Follow Requests</span>
              </button>
            )}
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Bio
            </span>
            <p style={{ color: '#cbd5e1', margin: '0.25rem 0 0', fontSize: '0.9375rem' }}>
              {profile.bio || 'No bio provided.'}
            </p>
          </div>

          {profile.location && (
            <div style={{ marginBottom: '1.25rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Location
              </span>
              <p style={{ color: '#cbd5e1', margin: '0.25rem 0 0', fontSize: '0.9375rem' }}>
                {profile.location}
              </p>
            </div>
          )}

          <div
            style={{
              borderTop: '1px solid #1e293b',
              paddingTop: '1rem',
              marginTop: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Member since {new Date(profile.createdAt).toLocaleDateString()}
            </span>
            <Link
              to={`/profile/${profile.username}`}
              style={{ color: '#818cf8', textDecoration: 'none', fontSize: '0.875rem' }}
            >
              View Public Profile →
            </Link>
          </div>
        </Card>
      ) : (
        <Card title={profile ? 'Edit Profile' : 'Create Profile'}>
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="edit-username"
                style={{
                  display: 'block',
                  marginBottom: '0.25rem',
                  fontSize: '0.875rem',
                  color: '#cbd5e1',
                }}
              >
                Username (3-30 chars, letters, numbers, underscores)
              </label>
              <Input
                id="edit-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. vibe_master"
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="edit-display-name"
                style={{
                  display: 'block',
                  marginBottom: '0.25rem',
                  fontSize: '0.875rem',
                  color: '#cbd5e1',
                }}
              >
                Display Name
              </label>
              <Input
                id="edit-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Vibe Master"
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="edit-bio"
                style={{
                  display: 'block',
                  marginBottom: '0.25rem',
                  fontSize: '0.875rem',
                  color: '#cbd5e1',
                }}
              >
                Bio
              </label>
              <textarea
                id="edit-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.9375rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="edit-avatar-url"
                style={{
                  display: 'block',
                  marginBottom: '0.25rem',
                  fontSize: '0.875rem',
                  color: '#cbd5e1',
                }}
              >
                Avatar
              </label>

              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <label
                  style={{
                    display: 'inline-block',
                    padding: '0.5rem 0.875rem',
                    backgroundColor: '#334155',
                    color: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    cursor: avatarUploading ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {avatarUploading ? `Uploading (${avatarProgress}%)` : '📁 Upload New Avatar'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarFileChange}
                    disabled={avatarUploading}
                    style={{ display: 'none' }}
                  />
                </label>
                {avatarAssetId && (
                  <span style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ Avatar ready</span>
                )}
              </div>

              {avatarError && (
                <div style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  {avatarError}
                </div>
              )}

              <Input
                id="edit-avatar-url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Or paste an image URL: https://example.com/avatar.jpg"
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="edit-location"
                style={{
                  display: 'block',
                  marginBottom: '0.25rem',
                  fontSize: '0.875rem',
                  color: '#cbd5e1',
                }}
              >
                Location (optional)
              </label>
              <Input
                id="edit-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Tokyo, Japan"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="edit-visibility"
                style={{
                  display: 'block',
                  marginBottom: '0.25rem',
                  fontSize: '0.875rem',
                  color: '#cbd5e1',
                }}
              >
                Profile Visibility
              </label>
              <select
                id="edit-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as ProfileVisibility)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.9375rem',
                  boxSizing: 'border-box',
                }}
              >
                <option value="PUBLIC">PUBLIC — visible to anyone</option>
                <option value="PRIVATE">PRIVATE — only visible to you</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              {profile && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setErrorMessage(null);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {profile && (
        <div style={{ marginTop: '1.25rem' }}>
          <Card
            style={{
              backgroundColor: '#111827',
              border: '1px solid #1f2937',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#ffffff' }}>
                Safety & Blocking
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>
                Manage accounts you have blocked from interacting with you
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <Button variant="outline" size="sm" onClick={() => setBlockedModalOpen(true)}>
                Blocked Accounts
              </Button>
              <Link
                to="/settings/blocked-users"
                style={{
                  color: '#818cf8',
                  textDecoration: 'none',
                  fontSize: '0.8125rem',
                }}
              >
                Full Page →
              </Link>
            </div>
          </Card>
        </div>
      )}

      {profile && (
        <FollowListModal
          isOpen={followModalOpen}
          onClose={() => setFollowModalOpen(false)}
          type={followModalType}
          userId={profile.userId}
          onFollowCountChange={() => void loadProfile()}
        />
      )}

      <BlockedUsersModal
        isOpen={blockedModalOpen}
        onClose={() => setBlockedModalOpen(false)}
        onBlockChanged={() => void loadProfile()}
      />
    </div>
  );
};
