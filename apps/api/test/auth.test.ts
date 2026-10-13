import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';

describe('VibeMint Authentication API', () => {
  let repository: InMemoryAuthRepository;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    repository = new InMemoryAuthRepository();
    app = buildApp({ authRepository: repository });
  });

  describe('POST /api/v1/auth/signup', () => {
    it('creates a new user with valid credentials and sets session cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'TestUser@example.com',
          password: 'Password123!',
        },
      });

      assert.equal(response.statusCode, 201);
      const body = response.json();

      // Check safe user fields
      assert.ok(body.user.id);
      assert.equal(body.user.email, 'testuser@example.com'); // Normalized
      assert.equal(body.user.status, 'ACTIVE');
      assert.equal(body.user.emailVerified, false);
      assert.ok(body.token);
      assert.ok(body.expiresAt);

      // Verify sensitive fields are NOT exposed
      assert.equal(body.user.passwordHash, undefined);
      assert.equal(body.user.password, undefined);

      // Verify session cookie was set
      const cookies = response.headers['set-cookie'];
      assert.ok(cookies);
      assert.match(String(cookies), /vibemint_session=/);
    });

    it('rejects registration with invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'not-an-email',
          password: 'Password123!',
        },
      });

      assert.equal(response.statusCode, 400);
      const body = response.json();
      assert.equal(body.error, 'BadRequestError');
    });

    it('rejects registration with invalid/too-short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'valid@example.com',
          password: 'short',
        },
      });

      assert.equal(response.statusCode, 400);
      const body = response.json();
      assert.equal(body.error, 'BadRequestError');
    });

    it('rejects registration with duplicate email address (case-insensitive)', async () => {
      // First signup
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'vibes@example.com',
          password: 'Password123!',
        },
      });

      // Second signup with different casing
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'VIBES@EXAMPLE.COM',
          password: 'OtherPassword456!',
        },
      });

      assert.equal(response.statusCode, 409);
      const body = response.json();
      assert.equal(body.error, 'ConflictError');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Seed a user
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'active@example.com',
          password: 'ValidPassword123!',
        },
      });
    });

    it('successfully logs in with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'Active@Example.com', // test case-insensitive lookup
          password: 'ValidPassword123!',
        },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json();

      assert.ok(body.user.id);
      assert.equal(body.user.email, 'active@example.com');
      assert.ok(body.token);
      assert.ok(body.expiresAt);
      assert.equal(body.user.passwordHash, undefined);

      const cookies = response.headers['set-cookie'];
      assert.ok(cookies);
      assert.match(String(cookies), /vibemint_session=/);
    });

    it('rejects login with invalid password without enumeration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'active@example.com',
          password: 'WrongPassword999!',
        },
      });

      assert.equal(response.statusCode, 401);
      const body = response.json();
      assert.equal(body.error, 'UnauthorizedError');
      assert.equal(body.message, 'Invalid email or password');
    });

    it('rejects login with non-existent email with uniform error message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'ValidPassword123!',
        },
      });

      assert.equal(response.statusCode, 401);
      const body = response.json();
      assert.equal(body.error, 'UnauthorizedError');
      assert.equal(body.message, 'Invalid email or password');
    });

    it('rejects login for suspended or inactive accounts', async () => {
      // Create user and mark as SUSPENDED
      const user = await repository.createUser({
        email: 'suspended@example.com',
        passwordHash: await app
          .inject({
            method: 'POST',
            url: '/api/v1/auth/signup',
            payload: { email: 'temp@example.com', password: 'Password123!' },
          })
          .then(() => 'dummy'),
      });

      // Set status to SUSPENDED in repository
      const existing = await repository.findUserByEmail('active@example.com');
      assert.ok(existing);
      await repository.updateUserStatus(existing.id, 'SUSPENDED');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'active@example.com',
          password: 'ValidPassword123!',
        },
      });

      assert.equal(response.statusCode, 403);
      const body = response.json();
      assert.equal(body.error, 'ForbiddenError');
      assert.match(body.message, /suspended/i);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns current user profile with valid session cookie', async () => {
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'me-user@example.com',
          password: 'Password123!',
        },
      });

      const setCookie = signupRes.headers['set-cookie'];
      const cookieValue = Array.isArray(setCookie) ? setCookie[0] : (setCookie as string);

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          cookie: cookieValue,
        },
      });

      assert.equal(meRes.statusCode, 200);
      const body = meRes.json();
      assert.equal(body.email, 'me-user@example.com');
      assert.equal(body.status, 'ACTIVE');
      assert.equal(body.passwordHash, undefined);
    });

    it('returns current user with Authorization Bearer header', async () => {
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'bearer-user@example.com',
          password: 'Password123!',
        },
      });

      const { token } = signupRes.json();

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      assert.equal(meRes.statusCode, 200);
      const body = meRes.json();
      assert.equal(body.email, 'bearer-user@example.com');
    });

    it('returns 401 when authentication credentials are missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      assert.equal(response.statusCode, 401);
      const body = response.json();
      assert.equal(body.error, 'UnauthorizedError');
    });

    it('returns 401 when authentication token is invalid or malformed', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer invalid.jwt.token.string',
        },
      });

      assert.equal(response.statusCode, 401);
      const body = response.json();
      assert.equal(body.error, 'UnauthorizedError');
    });
  });

  describe('POST /api/v1/auth/logout & Session Revocation', () => {
    it('logs out and revokes the session so it cannot be reused', async () => {
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'logout-user@example.com',
          password: 'Password123!',
        },
      });

      const { token } = signupRes.json();

      // Logout request
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      assert.equal(logoutRes.statusCode, 200);
      assert.equal(logoutRes.json().message, 'Successfully logged out');

      // Attempt to access /me with the revoked token
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      assert.equal(meRes.statusCode, 401);
      const meBody = meRes.json();
      assert.equal(meBody.error, 'UnauthorizedError');
      assert.match(meBody.message, /revoked/i);
    });
  });

  describe('Authentication Middleware on Protected Endpoints', () => {
    it('allows access to protected route when authenticated', async () => {
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'protected@example.com',
          password: 'Password123!',
        },
      });

      const { token } = signupRes.json();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/protected',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.message, 'Protected access granted');
      assert.equal(body.user.email, 'protected@example.com');
    });

    it('denies access to protected route when unauthenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/protected',
      });

      assert.equal(response.statusCode, 401);
      const body = response.json();
      assert.equal(body.error, 'UnauthorizedError');
    });
  });
});
