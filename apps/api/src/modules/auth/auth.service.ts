import * as argon2 from '@node-rs/argon2';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import { config } from '../../config/index.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../errors/app-error.js';
import { normalizeEmail } from './auth.schema.js';
import { IAuthRepository, SessionWithUser } from './auth.repository.js';
import { AuthResponse, JwtPayload, SafeUser } from './auth.types.js';

export class AuthService {
  constructor(private readonly repository: IAuthRepository) {}

  /**
   * Hashes a password securely using Argon2id.
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  /**
   * Verifies a candidate password against an Argon2id hash.
   */
  async verifyPassword(hash: string, candidate: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, candidate);
    } catch {
      return false;
    }
  }

  /**
   * Transforms internal User model into safe client-facing DTO.
   * Strips passwordHash and internal secrets.
   */
  toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted ?? false,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Creates an authenticated session token for the user.
   */
  private async createSessionForUser(user: User): Promise<{ token: string; expiresAt: Date }> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000);

    const payload: JwtPayload = {
      sub: user.id,
      sessionId,
      email: user.email,
      status: user.status,
      role: user.role,
    };

    const token = jwt.sign(payload, config.authSecret, {
      expiresIn: `${config.sessionTtlHours}h`,
    });

    await this.repository.createSession({
      userId: user.id,
      token,
      expiresAt,
    });

    return { token, expiresAt };
  }

  /**
   * Registers a new user account.
   */
  async signup(input: { email: string; password: string }): Promise<AuthResponse> {
    const normalizedEmail = normalizeEmail(input.email);

    const existingUser = await this.repository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictError('An account with this email address already exists');
    }

    const passwordHash = await this.hashPassword(input.password);
    const user = await this.repository.createUser({
      email: normalizedEmail,
      passwordHash,
      status: 'ACTIVE',
    });

    const { token, expiresAt } = await this.createSessionForUser(user);

    return {
      user: this.toSafeUser(user),
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Authenticates user with email and password.
   */
  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const normalizedEmail = normalizeEmail(input.email);

    let user = await this.repository.findUserByEmail(normalizedEmail);
    if (!user) {
      // Intentionally uniform error to prevent email enumeration
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await this.verifyPassword(user.passwordHash, input.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify account status
    if (user.status !== 'ACTIVE') {
      if (user.status === 'SUSPENDED') {
        // Check if temporary suspension has expired
        if (user.suspendedUntil && new Date() >= new Date(user.suspendedUntil)) {
          // Temporary suspension has expired; auto-restore account
          const restoredUser = await this.repository.updateUserSuspension(user.id, {
            status: 'ACTIVE',
            suspendedAt: null,
            suspendedUntil: null,
            suspensionReason: null,
          });
          user = restoredUser;
        } else {
          const reasonMsg = user.suspensionReason ? `: ${user.suspensionReason}` : '';
          const untilMsg = user.suspendedUntil
            ? ` until ${new Date(user.suspendedUntil).toISOString()}`
            : '';
          throw new ForbiddenError(
            `Your account has been suspended${untilMsg}${reasonMsg}. Please contact support.`,
          );
        }
      }
      if (user.status !== 'ACTIVE') {
        if (user.status === 'BANNED') {
          throw new ForbiddenError('Your account has been permanently banned.');
        }
        if (user.status === 'DEACTIVATED') {
          throw new ForbiddenError('Your account is currently deactivated.');
        }
        throw new ForbiddenError('Account is not active.');
      }
    }

    // Update lastLoginAt
    const updatedUser = await this.repository.updateUserLastLogin(user.id, new Date());
    const { token, expiresAt } = await this.createSessionForUser(updatedUser);

    return {
      user: this.toSafeUser(updatedUser),
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Validates a session token and retrieves the authenticated user context.
   */
  async validateSession(token: string): Promise<SessionWithUser> {
    if (!token) {
      throw new UnauthorizedError('Missing authentication token');
    }

    // Validate JWT signature and payload
    try {
      jwt.verify(token, config.authSecret);
    } catch {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    // Server-side session verification in database
    const session = await this.repository.findSessionByToken(token);
    if (!session) {
      throw new UnauthorizedError('Session not found or expired');
    }

    if (session.revokedAt) {
      throw new UnauthorizedError('Session has been revoked');
    }

    if (new Date() > new Date(session.expiresAt)) {
      throw new UnauthorizedError('Session has expired');
    }

    if (session.user.status !== 'ACTIVE') {
      if (session.user.status === 'SUSPENDED') {
        // Check if temporary suspension has expired
        if (session.user.suspendedUntil && new Date() >= new Date(session.user.suspendedUntil)) {
          const restoredUser = await this.repository.updateUserSuspension(session.user.id, {
            status: 'ACTIVE',
            suspendedAt: null,
            suspendedUntil: null,
            suspensionReason: null,
          });
          session.user = restoredUser;
        } else {
          const reasonMsg = session.user.suspensionReason
            ? `: ${session.user.suspensionReason}`
            : '';
          const untilMsg = session.user.suspendedUntil
            ? ` until ${new Date(session.user.suspendedUntil).toISOString()}`
            : '';
          throw new ForbiddenError(
            `Account is not active: Account is suspended${untilMsg}${reasonMsg}`,
          );
        }
      }
      if (session.user.status !== 'ACTIVE') {
        throw new ForbiddenError('Account is not active');
      }
    }

    return session;
  }

  /**
   * Revokes an existing session.
   */
  async logout(token: string): Promise<void> {
    if (!token) return;
    await this.repository.revokeSession(token);
  }

  /**
   * Retrieves current user data for an authenticated session.
   */
  async getMe(token: string): Promise<SafeUser> {
    const session = await this.validateSession(token);
    return this.toSafeUser(session.user);
  }
}
