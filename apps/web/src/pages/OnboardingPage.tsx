import { useState, useEffect, useMemo, type FC, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Interest, OnboardingStatus } from '@vibemint/types';
import { MIN_INTERESTS_SELECTION, MAX_INTERESTS_SELECTION } from '@vibemint/validation';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { Card, Button, Input, Badge } from '../components/ui';
import { webProfileService } from '../services/profiles/profileService';
import { webInterestsService } from '../services/interests/interestsService';
import { webOnboardingService } from '../services/onboarding/onboardingService';
import { useAuth } from '../stores/auth/AuthContext';

type OnboardingStep = 'PROFILE' | 'INTERESTS' | 'SUCCESS';

export const OnboardingPage: FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState<OnboardingStep>('PROFILE');
  const [initialLoading, setInitialLoading] = useState(true);

  // Step 1: Profile state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Step 2: Interests state
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [interestsSaving, setInterestsSaving] = useState(false);
  const [interestsError, setInterestsError] = useState<string | null>(null);

  // Step 3: Completion state
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Load server-side onboarding status on mount
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        setInitialLoading(true);
        const status: OnboardingStatus = await webOnboardingService.getStatus();

        if (!isMounted) return;

        if (status.isCompleted) {
          navigate('/home', { replace: true });
          return;
        }

        if (status.nextStep === 'INTERESTS') {
          setStep('INTERESTS');
          await loadInterests();
        } else if (status.nextStep === 'COMPLETED') {
          setStep('SUCCESS');
        } else {
          setStep('PROFILE');
          // Pre-fill existing profile fields if any
          const existing = await webProfileService.getMyProfile();
          if (isMounted && existing) {
            setUsername(existing.username || '');
            setDisplayName(existing.displayName || '');
            setBio(existing.bio || '');
            setAvatarUrl(existing.avatarUrl || '');
          }
        }
      } catch {
        // Fallback to profile step
        if (isMounted) setStep('PROFILE');
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }

    void init();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const loadInterests = async () => {
    try {
      setInterestsLoading(true);
      setInterestsError(null);
      const [all, userSelected] = await Promise.all([
        webInterestsService.getActiveInterests(),
        webInterestsService.getMyInterests().catch(() => []),
      ]);
      setInterests(all);
      if (userSelected.length > 0) {
        setSelectedIds(userSelected.map((i) => i.id));
      }
    } catch (err) {
      setInterestsError(
        err instanceof Error ? err.message : 'Unable to load interests. Please try again.',
      );
    } finally {
      setInterestsLoading(false);
    }
  };

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    interests.forEach((i) => set.add(i.category));
    return ['All', ...Array.from(set).sort()];
  }, [interests]);

  // Filtered interests by category and search
  const filteredInterests = useMemo(() => {
    return interests.filter((item) => {
      const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [interests, selectedCategory, searchQuery]);

  // Toggle selection
  const toggleInterest = (id: string) => {
    setInterestsError(null);
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= MAX_INTERESTS_SELECTION) {
        setInterestsError(`You can select at most ${MAX_INTERESTS_SELECTION} interests.`);
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Submit Step 1: Profile
  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
      setProfileError('Username must be between 3 and 30 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setProfileError('Username can only contain letters, numbers, and underscores');
      return;
    }
    if (!cleanDisplayName) {
      setProfileError('Display name is required');
      return;
    }

    try {
      setProfileSaving(true);
      await webProfileService.updateMyProfile({
        username: cleanUsername,
        displayName: cleanDisplayName,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });

      setStep('INTERESTS');
      await loadInterests();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // Submit Step 2: Interests
  const handleInterestsSubmit = async () => {
    setInterestsError(null);

    if (selectedIds.length < MIN_INTERESTS_SELECTION) {
      setInterestsError(`Please select at least ${MIN_INTERESTS_SELECTION} interests to proceed.`);
      return;
    }
    if (selectedIds.length > MAX_INTERESTS_SELECTION) {
      setInterestsError(`You can select at most ${MAX_INTERESTS_SELECTION} interests.`);
      return;
    }

    try {
      setInterestsSaving(true);
      await webInterestsService.updateMyInterests(selectedIds);

      setCompleting(true);
      await webOnboardingService.complete();
      await refreshUser();
      setStep('SUCCESS');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save interests';
      setInterestsError(msg);
      setCompletionError(msg);
    } finally {
      setInterestsSaving(false);
      setCompleting(false);
    }
  };

  // Complete & Navigate
  const handleFinish = async () => {
    await refreshUser();
    navigate('/home', { replace: true });
  };

  if (initialLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
          color: colors.dark.mutedForeground,
          fontSize: '1rem',
        }}
      >
        <span>Preparing your onboarding experience...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: `${spacing['2xl']} ${spacing.md}`,
      }}
    >
      {/* Header & Step Tracker */}
      <div style={{ textAlign: 'center', marginBottom: spacing['2xl'] }}>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: fontWeights.bold,
            color: colors.dark.foreground,
            margin: '0 0 0.5rem 0',
          }}
        >
          Welcome to <span style={{ color: colors.dark.primary }}>VibeMint</span>
        </h1>
        <p
          style={{
            color: colors.dark.mutedForeground,
            fontSize: '1rem',
            margin: '0 0 1.5rem 0',
          }}
        >
          Connect. Create. Discover. Earn.
        </p>

        {/* Step Progress Pills */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: spacing.md,
            maxWidth: '360px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '4px',
              borderRadius: radius.full,
              backgroundColor: step === 'PROFILE' ? colors.dark.primary : colors.dark.success,
              transition: 'background-color 0.2s ease',
            }}
          />
          <div
            style={{
              flex: 1,
              height: '4px',
              borderRadius: radius.full,
              backgroundColor:
                step === 'INTERESTS'
                  ? colors.dark.primary
                  : step === 'SUCCESS'
                    ? colors.dark.success
                    : colors.dark.border,
              transition: 'background-color 0.2s ease',
            }}
          />
          <div
            style={{
              flex: 1,
              height: '4px',
              borderRadius: radius.full,
              backgroundColor: step === 'SUCCESS' ? colors.dark.success : colors.dark.border,
              transition: 'background-color 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* ================= STEP 1: PROFILE SETUP ================= */}
      {step === 'PROFILE' && (
        <Card
          style={{
            padding: spacing['2xl'],
            backgroundColor: colors.dark.surface,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: radius.xl,
          }}
        >
          <div style={{ marginBottom: spacing.xl }}>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: fontWeights.semiBold,
                color: colors.dark.foreground,
                margin: '0 0 0.25rem 0',
              }}
            >
              Step 1: Set Up Your Profile
            </h2>
            <p style={{ color: colors.dark.mutedForeground, fontSize: '0.875rem', margin: 0 }}>
              Choose your public handle and display identity on VibeMint.
            </p>
          </div>

          {profileError && (
            <div
              role="alert"
              style={{
                padding: spacing.md,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${colors.dark.error}`,
                borderRadius: radius.md,
                color: colors.dark.error,
                fontSize: '0.875rem',
                marginBottom: spacing.lg,
              }}
            >
              {profileError}
            </div>
          )}

          <form onSubmit={handleProfileSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
              <Input
                label="Username *"
                id="username-input"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. nova_creator"
                helperText="3–30 characters, letters, numbers, and underscores."
                required
                autoFocus
              />

              <Input
                label="Display Name *"
                id="display-name-input"
                name="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Nova Vance"
                required
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label
                  htmlFor="bio-input"
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: fontWeights.medium,
                    color: colors.dark.foreground,
                  }}
                >
                  Bio
                </label>
                <textarea
                  id="bio-input"
                  name="bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell the VibeMint community about your passions and style (optional)"
                  style={{
                    backgroundColor: colors.dark.surfaceMuted,
                    border: `1px solid ${colors.dark.border}`,
                    borderRadius: radius.md,
                    color: colors.dark.foreground,
                    padding: spacing.md,
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>

              <Input
                label="Avatar URL"
                id="avatar-input"
                name="avatarUrl"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg (optional)"
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing.md }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={profileSaving}
                  disabled={profileSaving}
                >
                  Continue to Interests →
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* ================= STEP 2: INTERESTS SELECTION ================= */}
      {step === 'INTERESTS' && (
        <Card
          style={{
            padding: spacing['2xl'],
            backgroundColor: colors.dark.surface,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: radius.xl,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: fontWeights.semiBold,
                  color: colors.dark.foreground,
                  margin: '0 0 0.25rem 0',
                }}
              >
                Step 2: Choose Your Interests
              </h2>
              <p style={{ color: colors.dark.mutedForeground, fontSize: '0.875rem', margin: 0 }}>
                Select 3 to 10 interests to calibrate your discovery and connect with the right
                creators.
              </p>
            </div>

            {/* Live Count Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <Badge
                variant={selectedIds.length >= MIN_INTERESTS_SELECTION ? 'success' : 'warning'}
                style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
              >
                Selected: {selectedIds.length} / {MIN_INTERESTS_SELECTION}–{MAX_INTERESTS_SELECTION}
              </Badge>
            </div>
          </div>

          {interestsError && (
            <div
              role="alert"
              style={{
                padding: spacing.md,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${colors.dark.error}`,
                borderRadius: radius.md,
                color: colors.dark.error,
                fontSize: '0.875rem',
                marginBottom: spacing.lg,
              }}
            >
              {interestsError}
            </div>
          )}

          {/* Search & Filter Bar */}
          <div
            style={{
              display: 'flex',
              gap: spacing.md,
              marginBottom: spacing.lg,
              flexWrap: 'wrap',
            }}
          >
            <input
              type="text"
              placeholder="Search interests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search interests"
              style={{
                flex: '1 1 200px',
                padding: `${spacing.sm} ${spacing.md}`,
                backgroundColor: colors.dark.surfaceMuted,
                border: `1px solid ${colors.dark.border}`,
                borderRadius: radius.md,
                color: colors.dark.foreground,
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Category Tabs */}
          <div
            role="tablist"
            aria-label="Interest Categories"
            style={{
              display: 'flex',
              gap: spacing.xs,
              overflowX: 'auto',
              paddingBottom: spacing.sm,
              marginBottom: spacing.xl,
              scrollbarWidth: 'thin',
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat}
                role="tab"
                aria-selected={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: `0.375rem 0.875rem`,
                  borderRadius: radius.full,
                  fontSize: '0.8125rem',
                  fontWeight: fontWeights.medium,
                  cursor: 'pointer',
                  border: `1px solid ${
                    selectedCategory === cat ? colors.dark.primary : colors.dark.border
                  }`,
                  backgroundColor:
                    selectedCategory === cat ? colors.dark.primary : colors.dark.surfaceMuted,
                  color:
                    selectedCategory === cat
                      ? colors.dark.primaryForeground
                      : colors.dark.mutedForeground,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Interests Chips Grid */}
          {interestsLoading ? (
            <div
              style={{
                padding: `${spacing['3xl']} 0`,
                textAlign: 'center',
                color: colors.dark.mutedForeground,
              }}
            >
              Loading curated interests...
            </div>
          ) : filteredInterests.length === 0 ? (
            <div
              style={{
                padding: `${spacing['2xl']} 0`,
                textAlign: 'center',
                color: colors.dark.mutedForeground,
              }}
            >
              <p style={{ margin: '0 0 1rem 0' }}>No matching interests found.</p>
              <Button variant="outline" size="sm" onClick={loadInterests}>
                Reload Interests
              </Button>
            </div>
          ) : (
            <div
              role="group"
              aria-label="Available interests"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: spacing.md,
                marginBottom: spacing['2xl'],
              }}
            >
              {filteredInterests.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleInterest(item.id)}
                    aria-pressed={isSelected}
                    title={item.description || item.name}
                    style={{
                      padding: `${spacing.md} ${spacing.md}`,
                      borderRadius: radius.lg,
                      border: `1px solid ${isSelected ? colors.dark.primary : colors.dark.border}`,
                      backgroundColor: isSelected
                        ? 'rgba(56, 189, 248, 0.12)'
                        : colors.dark.surfaceMuted,
                      color: isSelected ? colors.dark.primary : colors.dark.foreground,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '0.25rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: fontWeights.semiBold,
                        }}
                      >
                        {item.name}
                      </span>
                      {isSelected && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: fontWeights.bold,
                            color: colors.dark.primary,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: colors.dark.mutedForeground,
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Navigation Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: `1px solid ${colors.dark.border}`,
              paddingTop: spacing.lg,
            }}
          >
            <Button type="button" variant="outline" size="md" onClick={() => setStep('PROFILE')}>
              ← Back to Profile
            </Button>

            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={interestsSaving || completing}
              disabled={
                selectedIds.length < MIN_INTERESTS_SELECTION ||
                selectedIds.length > MAX_INTERESTS_SELECTION ||
                interestsSaving ||
                completing
              }
              onClick={handleInterestsSubmit}
            >
              Complete Onboarding ({selectedIds.length}/{MIN_INTERESTS_SELECTION})
            </Button>
          </div>
        </Card>
      )}

      {/* ================= STEP 3: COMPLETION / SUCCESS ================= */}
      {step === 'SUCCESS' && (
        <Card
          style={{
            padding: spacing['3xl'],
            backgroundColor: colors.dark.surface,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: radius.xl,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: radius.full,
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              border: `2px solid ${colors.dark.success}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              color: colors.dark.success,
              margin: '0 auto 1.5rem auto',
            }}
          >
            ✓
          </div>

          <h2
            style={{
              fontSize: '1.75rem',
              fontWeight: fontWeights.bold,
              color: colors.dark.foreground,
              margin: '0 0 0.5rem 0',
            }}
          >
            You’re Ready to Vibe!
          </h2>

          <p
            style={{
              color: colors.dark.mutedForeground,
              fontSize: '1rem',
              maxWidth: '480px',
              margin: '0 auto 2rem auto',
              lineHeight: 1.6,
            }}
          >
            Your profile is established and your interests are registered. Connect with inspiring
            creators, discover tailored vibes, and share your creative journey.
          </p>

          {completionError && (
            <div
              role="alert"
              style={{
                padding: spacing.md,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${colors.dark.error}`,
                borderRadius: radius.md,
                color: colors.dark.error,
                fontSize: '0.875rem',
                marginBottom: spacing.lg,
                maxWidth: '400px',
                margin: '0 auto 1.5rem auto',
              }}
            >
              {completionError}
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleFinish}
            style={{ minWidth: '220px' }}
          >
            Enter VibeMint →
          </Button>
        </Card>
      )}
    </div>
  );
};
