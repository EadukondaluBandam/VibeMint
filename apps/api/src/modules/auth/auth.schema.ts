import {
  validateSignupInput,
  validateLoginInput,
  normalizeEmail,
  SignupInput,
  LoginInput,
} from '@vibemint/validation';
import { BadRequestError } from '../../errors/app-error.js';
import { config } from '../../config/index.js';

export function parseAndValidateSignup(body: unknown): SignupInput {
  const result = validateSignupInput(body, {
    minLength: config.passwordMinLength,
  });

  if (!result.success || !result.data) {
    const message = result.errors
      ? Object.values(result.errors).join(', ')
      : 'Invalid signup input';
    throw new BadRequestError(message);
  }

  return result.data;
}

export function parseAndValidateLogin(body: unknown): LoginInput {
  const result = validateLoginInput(body);

  if (!result.success || !result.data) {
    const message = result.errors ? Object.values(result.errors).join(', ') : 'Invalid login input';
    throw new BadRequestError(message);
  }

  return result.data;
}

export { normalizeEmail };
