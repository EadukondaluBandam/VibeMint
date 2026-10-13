import { Interest } from '@prisma/client';
import { IInterestsRepository } from './interests.repository.js';
import { FormattedInterest } from './interests.types.js';
import { BadRequestError } from '../../errors/app-error.js';
import {
  validateInterestsSelection,
  MIN_INTERESTS_SELECTION,
  MAX_INTERESTS_SELECTION,
} from '@vibemint/validation';

export class InterestsService {
  constructor(private readonly repository: IInterestsRepository) {}

  toFormattedInterest(interest: Interest): FormattedInterest {
    return {
      id: interest.id,
      name: interest.name,
      slug: interest.slug,
      description: interest.description,
      category: interest.category,
      icon: interest.icon,
      isActive: interest.isActive,
      sortOrder: interest.sortOrder,
    };
  }

  /**
   * Retrieves active interests, optionally filtered by category.
   */
  async listActiveInterests(category?: string): Promise<FormattedInterest[]> {
    const list = await this.repository.listActiveInterests(category);
    return list.map((i) => this.toFormattedInterest(i));
  }

  /**
   * Retrieves authenticated user's selected interests.
   */
  async getUserInterests(userId: string): Promise<FormattedInterest[]> {
    const list = await this.repository.findUserInterests(userId);
    return list.map((i) => this.toFormattedInterest(i));
  }

  /**
   * Replaces authenticated user's selected interests transactionally.
   * Enforces 3-10 limits, uniqueness, and active status.
   */
  async replaceUserInterests(
    userId: string,
    rawInterestIds: unknown,
  ): Promise<FormattedInterest[]> {
    const validation = validateInterestsSelection(
      rawInterestIds,
      MIN_INTERESTS_SELECTION,
      MAX_INTERESTS_SELECTION,
    );

    if (!validation.success || !validation.data) {
      const message = validation.errors
        ? Object.values(validation.errors).join(', ')
        : 'Invalid interests selection';
      throw new BadRequestError(message);
    }

    const { interestIds } = validation.data;

    // Verify all interest IDs exist and are active
    const existing = await this.repository.findInterestsByIds(interestIds);
    const existingMap = new Map<string, Interest>(existing.map((i) => [i.id, i]));

    for (const id of interestIds) {
      const match = existingMap.get(id);
      if (!match) {
        throw new BadRequestError(`Interest with ID '${id}' not found or inactive`);
      }
      if (!match.isActive) {
        throw new BadRequestError(`Interest '${match.name}' not found or inactive`);
      }
    }

    const updated = await this.repository.replaceUserInterests(userId, interestIds);
    return updated.map((i) => this.toFormattedInterest(i));
  }
}
