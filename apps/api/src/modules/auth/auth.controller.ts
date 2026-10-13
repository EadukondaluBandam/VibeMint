import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { parseAndValidateSignup, parseAndValidateLogin } from './auth.schema.js';
import { UnauthorizedError } from '../../errors/app-error.js';
import { config } from '../../config/index.js';

export const SESSION_COOKIE_NAME = 'vibemint_session';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Helper to extract session token from cookie or Authorization Bearer header.
   */
  extractToken(request: FastifyRequest): string | null {
    // 1. Check cookies (preferred for web clients)
    const cookieToken = request.cookies[SESSION_COOKIE_NAME];
    if (cookieToken) {
      return cookieToken;
    }

    // 2. Check Authorization Bearer header (used by mobile & API clients)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }

    return null;
  }

  private setSessionCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: config.sessionTtlHours * 3600,
    });
  }

  private clearSessionCookie(reply: FastifyReply): void {
    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
    });
  }

  signup = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const input = parseAndValidateSignup(request.body);
    const result = await this.authService.signup(input);

    this.setSessionCookie(reply, result.token);

    return reply.status(201).send(result);
  };

  login = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const input = parseAndValidateLogin(request.body);
    const result = await this.authService.login(input);

    this.setSessionCookie(reply, result.token);

    return reply.status(200).send(result);
  };

  logout = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = this.extractToken(request);
    if (token) {
      await this.authService.logout(token);
    }

    this.clearSessionCookie(reply);

    return reply.status(200).send({
      message: 'Successfully logged out',
    });
  };

  me = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await this.authService.getMe(token);

    return reply.status(200).send(user);
  };
}
