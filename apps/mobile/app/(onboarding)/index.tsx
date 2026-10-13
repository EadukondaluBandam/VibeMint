import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import type { Interest } from '@vibemint/types';
import { MIN_INTERESTS_SELECTION, MAX_INTERESTS_SELECTION } from '@vibemint/validation';
import { theme } from '../../theme';
import { Button, Input } from '../../components/ui';
import { mobileProfileService } from '../../src/services/profiles/profileService';
import { mobileInterestsService } from '../../src/services/interests/interestsService';
import { mobileOnboardingService } from '../../src/services/onboarding/onboardingService';
import { useAuth } from '../../src/stores/auth/AuthContext';

type Step = 'PROFILE' | 'INTERESTS' | 'SUCCESS';

export default function OnboardingScreen() {
  const { refreshUser } = useAuth();

  const [step, setStep] = useState<Step>('PROFILE');
  const [initialLoading, setInitialLoading] = useState(true);

  // Step A: Profile state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Step B: Interests state
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [interestsSaving, setInterestsSaving] = useState(false);
  const [interestsError, setInterestsError] = useState<string | null>(null);

  // Step C: Completion state
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Load initial status
  const checkInitialStatus = useCallback(async () => {
    try {
      setInitialLoading(true);
      const status = await mobileOnboardingService.getStatus();

      if (status.isCompleted) {
        router.replace('/(tabs)/home');
        return;
      }

      if (status.nextStep === 'INTERESTS') {
        setStep('INTERESTS');
        await loadInterests();
      } else if (status.nextStep === 'COMPLETED') {
        setStep('SUCCESS');
      } else {
        setStep('PROFILE');
        // Pre-fill existing profile data if any
        const existingProfile = await mobileProfileService.getMyProfile();
        if (existingProfile) {
          setUsername(existingProfile.username || '');
          setDisplayName(existingProfile.displayName || '');
          setBio(existingProfile.bio || '');
          setAvatarUrl(existingProfile.avatarUrl || '');
        }
      }
    } catch {
      // If unauthenticated or network error, fallback to step PROFILE
      setStep('PROFILE');
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkInitialStatus();
  }, [checkInitialStatus]);

  // Load interests list
  const loadInterests = async () => {
    try {
      setInterestsLoading(true);
      setInterestsError(null);
      const [all, userSelected] = await Promise.all([
        mobileInterestsService.getActiveInterests(),
        mobileInterestsService.getMyInterests().catch(() => []),
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

  // Filtered interests
  const filteredInterests = useMemo(() => {
    if (selectedCategory === 'All') return interests;
    return interests.filter((i) => i.category === selectedCategory);
  }, [interests, selectedCategory]);

  // Toggle interest chip
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

  // Handle Profile Submit
  const handleProfileSubmit = async () => {
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
      await mobileProfileService.updateMyProfile({
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

  // Handle Interests Submit
  const handleInterestsSubmit = async () => {
    setInterestsError(null);
    if (selectedIds.length < MIN_INTERESTS_SELECTION) {
      setInterestsError(`Please select at least ${MIN_INTERESTS_SELECTION} interests to continue.`);
      return;
    }
    if (selectedIds.length > MAX_INTERESTS_SELECTION) {
      setInterestsError(`You can select at most ${MAX_INTERESTS_SELECTION} interests.`);
      return;
    }

    try {
      setInterestsSaving(true);
      await mobileInterestsService.updateMyInterests(selectedIds);

      // Now complete onboarding
      setCompleting(true);
      await mobileOnboardingService.complete();
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

  // Finish Onboarding
  const handleFinish = async () => {
    await refreshUser();
    router.replace('/(tabs)/home');
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Setting up your VibeMint journey...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f17" />
      <View style={styles.header}>
        <Text style={styles.brandTitle}>VibeMint</Text>
        <Text style={styles.brandTagline}>Connect. Create. Discover. Earn.</Text>

        {/* Step indicator */}
        <View style={styles.stepProgressContainer}>
          <View
            style={[
              styles.stepIndicator,
              step === 'PROFILE' && styles.stepActive,
              (step === 'INTERESTS' || step === 'SUCCESS') && styles.stepCompleted,
            ]}
          />
          <View
            style={[
              styles.stepIndicator,
              step === 'INTERESTS' && styles.stepActive,
              step === 'SUCCESS' && styles.stepCompleted,
            ]}
          />
          <View style={[styles.stepIndicator, step === 'SUCCESS' && styles.stepActive]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ================= STEP A: PROFILE ================= */}
        {step === 'PROFILE' && (
          <View style={styles.card}>
            <Text style={styles.stepTitle}>Create Your Profile</Text>
            <Text style={styles.stepDescription}>
              Tell the community who you are. Your username will be your unique handle.
            </Text>

            {profileError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{profileError}</Text>
              </View>
            )}

            <Input
              label="Username *"
              placeholder="e.g. alex_vibes"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Input
              label="Display Name *"
              placeholder="e.g. Alex Morgan"
              value={displayName}
              onChangeText={setDisplayName}
            />

            <Input
              label="Bio"
              placeholder="Share a short bio (optional)"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
            />

            <Input
              label="Avatar URL"
              placeholder="https://example.com/avatar.jpg (optional)"
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              autoCapitalize="none"
            />

            <Button
              variant="primary"
              size="lg"
              loading={profileSaving}
              onPress={handleProfileSubmit}
              style={styles.actionButton}
            >
              Continue to Interests
            </Button>
          </View>
        )}

        {/* ================= STEP B: INTERESTS ================= */}
        {step === 'INTERESTS' && (
          <View style={styles.card}>
            <Text style={styles.stepTitle}>Select Your Interests</Text>
            <Text style={styles.stepDescription}>
              Pick 3 to 10 interests to discover tailored vibes, creators, and communities.
            </Text>

            {/* Selection Counter Badge */}
            <View style={styles.counterRow}>
              <View
                style={[
                  styles.countBadge,
                  selectedIds.length >= MIN_INTERESTS_SELECTION
                    ? styles.countBadgeValid
                    : styles.countBadgePending,
                ]}
              >
                <Text style={styles.countBadgeText}>
                  {selectedIds.length} / {MIN_INTERESTS_SELECTION}–{MAX_INTERESTS_SELECTION}{' '}
                  selected
                </Text>
              </View>
              {selectedIds.length < MIN_INTERESTS_SELECTION && (
                <Text style={styles.minRequiredNotice}>
                  Select at least {MIN_INTERESTS_SELECTION - selectedIds.length} more
                </Text>
              )}
            </View>

            {interestsError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{interestsError}</Text>
              </View>
            )}

            {/* Category Filter Horizontal Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryPill,
                    selectedCategory === cat && styles.categoryPillActive,
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      selectedCategory === cat && styles.categoryPillTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Interests Grid / Loading / Empty */}
            {interestsLoading ? (
              <View style={styles.loadingSection}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading interests...</Text>
              </View>
            ) : filteredInterests.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>No interests found for this category.</Text>
                <Button variant="outline" size="sm" onPress={loadInterests}>
                  Retry
                </Button>
              </View>
            ) : (
              <View style={styles.chipsGrid}>
                {filteredInterests.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.interestChip, isSelected && styles.interestChipSelected]}
                      onPress={() => toggleInterest(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.interestChipText,
                          isSelected && styles.interestChipTextSelected,
                        ]}
                      >
                        {isSelected ? '✓ ' : ''}
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.buttonRow}>
              <Button
                variant="outline"
                size="lg"
                onPress={() => setStep('PROFILE')}
                style={styles.backButton}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="lg"
                disabled={
                  selectedIds.length < MIN_INTERESTS_SELECTION || interestsSaving || completing
                }
                loading={interestsSaving || completing}
                onPress={handleInterestsSubmit}
                style={styles.submitButton}
              >
                Complete Onboarding
              </Button>
            </View>
          </View>
        )}

        {/* ================= STEP C: SUCCESS ================= */}
        {step === 'SUCCESS' && (
          <View style={[styles.card, styles.successCard]}>
            <View style={styles.successIconBadge}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Welcome to VibeMint!</Text>
            <Text style={styles.successDescription}>
              Your profile is verified and your interests are registered. Connect with inspiring
              creators, discover vibrant vibes, and earn.
            </Text>

            {completionError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{completionError}</Text>
              </View>
            )}

            <Button variant="primary" size="lg" onPress={handleFinish} style={styles.finishButton}>
              Enter VibeMint
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  header: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  stepProgressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    width: 140,
  },
  stepIndicator: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
  },
  stepActive: {
    backgroundColor: '#38bdf8',
  },
  stepCompleted: {
    backgroundColor: '#10b981',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '500',
  },
  actionButton: {
    marginTop: 10,
    width: '100%',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countBadgePending: {
    backgroundColor: '#1e293b',
  },
  countBadgeValid: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  minRequiredNotice: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '500',
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryPillActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  categoryPillText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: '#0b0f17',
    fontWeight: '700',
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  interestChipSelected: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  interestChipText: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  interestChipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  backButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingSection: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#94a3b8',
    fontSize: 14,
  },
  emptySection: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  successIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successIconText: {
    fontSize: 34,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  successDescription: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 26,
    paddingHorizontal: 12,
  },
  finishButton: {
    width: '100%',
  },
});
