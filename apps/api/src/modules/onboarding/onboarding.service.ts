import { OnboardingStatus, OnboardingCompleteResponse } from '@vibemint/types';
import { MIN_INTERESTS_SELECTION } from '@vibemint/validation';
import { IAuthRepository } from '../auth/auth.repository.js';
import { IProfileRepository } from '../profiles/profiles.repository.js';
import { IInterestsRepository } from '../interests/interests.repository.js';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';

export class OnboardingService {
  constructor(
    private readonly authRepository: IAuthRepository,
    private readonly profileRepository: IProfileRepository,
    private readonly interestsRepository: IInterestsRepository,
  ) {}

  /**
   * Evaluates the authenticated user's current onboarding status
   * entirely derived from persisted server-side data.
   */
  async getStatus(userId: string): Promise<OnboardingStatus> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const profile = await this.profileRepository.findProfileByUserId(userId);
    const userInterests = await this.interestsRepository.findUserInterests(userId);

    const profileComplete = Boolean(
      profile && profile.username && profile.displayName && profile.username.trim().length > 0,
    );
    const interestsCount = userInterests.length;
    const interestsComplete = interestsCount >= MIN_INTERESTS_SELECTION;
    const isCompleted = Boolean(user.onboardingCompleted && profileComplete && interestsComplete);

    let nextStep: 'PROFILE' | 'INTERESTS' | 'COMPLETED';
    if (!profileComplete) {
      nextStep = 'PROFILE';
    } else if (!interestsComplete) {
      nextStep = 'INTERESTS';
    } else {
      nextStep = 'COMPLETED';
    }

    return {
      profileComplete,
      interestsComplete,
      interestsCount,
      minInterestsRequired: MIN_INTERESTS_SELECTION,
      isCompleted,
      nextStep,
    };
  }

  /**
   * Validates that all onboarding prerequisites are met before marking onboarding complete.
   * Idempotent: If already complete and requirements are met, returns success without error.
   */
  async complete(userId: string): Promise<OnboardingCompleteResponse> {
    const status = await this.getStatus(userId);

    if (!status.profileComplete) {
      throw new BadRequestError('Profile setup must be completed before completing onboarding');
    }

    if (!status.interestsComplete) {
      throw new BadRequestError(
        `At least ${MIN_INTERESTS_SELECTION} interests must be selected (currently selected: ${status.interestsCount})`,
      );
    }

    if (!status.isCompleted) {
      await this.authRepository.setOnboardingCompleted(userId, true);
    }

    const updatedStatus: OnboardingStatus = {
      profileComplete: true,
      interestsComplete: true,
      interestsCount: status.interestsCount,
      minInterestsRequired: MIN_INTERESTS_SELECTION,
      isCompleted: true,
      nextStep: 'COMPLETED',
    };

    return {
      isCompleted: true,
      message: 'Onboarding completed successfully',
      status: updatedStatus,
    };
  }
}
