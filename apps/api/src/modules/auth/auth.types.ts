import type { UserStatus, UserRole } from '@prisma/client';

export type { UserStatus, UserRole };

export interface SafeUser {
  id: string;
  email: string;
  status: UserStatus;
  role: UserRole;
  emailVerified: boolean;
  onboardingCompleted?: boolean;
  createdAt: Date | string;
  lastLoginAt?: Date | string | null;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

export interface AuthResponse {
  user: SafeUser;
  token: string;
  expiresAt: string;
}

export interface JwtPayload {
  sub: string; // user id
  sessionId: string;
  email: string;
  status: UserStatus;
  role: UserRole;
  iat?: number;
  exp?: number;
}
