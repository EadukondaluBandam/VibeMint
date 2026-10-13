import {
  validateProfileUpdate,
  isValidUsername,
  normalizeUsername,
  ValidatedProfileUpdateData,
} from '@vibemint/validation';
import { BadRequestError } from '../../errors/app-error.js';

export function parseAndValidateProfileUpdate(body: unknown): ValidatedProfileUpdateData {
  const result = validateProfileUpdate(body);

  if (!result.success || !result.data) {
    const message = result.errors
      ? Object.values(result.errors).join(', ')
      : 'Invalid profile data';
    throw new BadRequestError(message);
  }

  return result.data;
}

export function parseAndValidateUsername(username: unknown): string {
  if (typeof username !== 'string' || !isValidUsername(username)) {
    throw new BadRequestError(
      'Username must be 3-30 characters long and contain only letters, numbers, and underscores',
    );
  }
  return normalizeUsername(username);
}

export { normalizeUsername, isValidUsername };
