import { FastifyRequest } from 'fastify';
import { AuthService } from '../modules/auth/auth.service.js';
import { SafeUser } from '../modules/auth/auth.types.js';
import { SESSION_COOKIE_NAME } from '../modules/auth/auth.controller.js';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: SafeUser;
    sessionId?: string;
    authToken?: string;
  }
}

/**
 * Extracts session token from cookie or Authorization Bearer header.
 */
export function extractAuthToken(request: FastifyRequest): string | null {
  const cookieToken = request.cookies?.[SESSION_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Creates a Fastify preHandler hook for mandatory authentication.
 * 1. Extracts credentials from cookie or Bearer header.
 * 2. Validates session token and active status.
 * 3. Identifies the user.
 * 4. Rejects invalid, revoked, or expired sessions with 401 Unauthorized.
 * 5. Attaches authenticated safe user context to the request.
 */
export function requireAuth(authService: AuthService) {
  return async (request: FastifyRequest): Promise<void> => {
    const token = extractAuthToken(request);
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const session = await authService.validateSession(token);
    request.user = authService.toSafeUser(session.user);
    request.sessionId = session.id;
    request.authToken = token;
  };
}

/**
 * Creates a Fastify preHandler hook for mandatory administrator authorization.
 * 1. Enforces valid authentication first (rejects unauthenticated/expired with 401).
 * 2. Verifies account status through existing session validation rules.
 * 3. Enforces that the verified user role is ADMIN (rejects non-admin with 403).
 * 4. Attaches authenticated safe user context to the request.
 */
export function requireAdmin(authService: AuthService) {
  return async (request: FastifyRequest): Promise<void> => {
    const token = extractAuthToken(request);
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const session = await authService.validateSession(token);
    const safeUser = authService.toSafeUser(session.user);

    if (session.user.role !== 'ADMIN') {
      throw new ForbiddenError('Administrator access required');
    }

    request.user = safeUser;
    request.sessionId = session.id;
    request.authToken = token;
  };
}

/**
 * Optional authentication hook for routes that behave differently when authenticated.
 */
export function optionalAuth(authService: AuthService) {
  return async (request: FastifyRequest): Promise<void> => {
    const token = extractAuthToken(request);
    if (!token) {
      return;
    }

    try {
      const session = await authService.validateSession(token);
      request.user = authService.toSafeUser(session.user);
      request.sessionId = session.id;
      request.authToken = token;
    } catch {
      // Ignored for optional auth
    }
  };
}
