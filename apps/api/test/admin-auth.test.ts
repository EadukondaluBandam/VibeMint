import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';
import { provisionAdmin } from '../src/scripts/provision-admin.js';

describe('VibeMint Admin Authentication & RBAC API', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    authRepository = new InMemoryAuthRepository();
    profileRepository = new InMemoryProfileRepository();
    app = buildApp({
      authRepository,
      profileRepository,
    });
  });

  describe('Registration & Role Immutability', () => {
    it('ordinary registration always creates a user with USER role', async () => {
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'regular_user@example.com',
          password: 'Password123!',
        },
      });

      assert.equal(signupRes.statusCode, 201);
      const body = signupRes.json();
      assert.equal(body.user.role, 'USER');

      // Verify repository persistence
      const savedUser = await authRepository.findUserById(body.user.id);
      assert.ok(savedUser);
      assert.equal(savedUser.role, 'USER');
    });

    it('ignores client attempts to inject role: "ADMIN" or isAdmin: true during signup', async () => {
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'malicious_actor@example.com',
          password: 'Password123!',
          role: 'ADMIN',
          isAdmin: true,
        },
      });

      assert.equal(signupRes.statusCode, 201);
      const body = signupRes.json();
      assert.equal(body.user.role, 'USER');

      const savedUser = await authRepository.findUserById(body.user.id);
      assert.ok(savedUser);
      assert.equal(savedUser.role, 'USER');
    });

    it('rejects attempts to inject role or isAdmin during profile update', async () => {
      // Create user
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'profile_updater@example.com',
          password: 'Password123!',
        },
      });
      const token = signupRes.json().token;

      // Attempt profile update with protected fields
      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          displayName: 'Hacker',
          role: 'ADMIN',
        },
      });

      assert.equal(updateRes.statusCode, 400);
      assert.match(updateRes.json().message, /Cannot modify protected field: role/);

      // Verify user remains USER
      const user = await authRepository.findUserById(signupRes.json().user.id);
      assert.equal(user?.role, 'USER');
    });
  });

  describe('Administrator Endpoint Authorization (GET /api/v1/admin/me)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/me',
      });

      assert.equal(res.statusCode, 401);
      assert.equal(res.json().error, 'UnauthorizedError');
    });

    it('rejects authenticated ordinary USER with 403 Forbidden', async () => {
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'standard_member@example.com',
          password: 'Password123!',
        },
      });
      const token = signupRes.json().token;

      const adminRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/me',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(adminRes.statusCode, 403);
      assert.equal(adminRes.json().error, 'ForbiddenError');
      assert.match(adminRes.json().message, /Administrator access required/);
    });

    it('allows verified administrator with ADMIN role and returns safe admin identity', async () => {
      // 1. Create user
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'real_admin@example.com',
          password: 'Password123!',
        },
      });
      const userId = signupRes.json().user.id;

      // 2. Legitimate server-side promotion via repository
      await authRepository.updateUserRole(userId, 'ADMIN');

      // 3. Log in again to get fresh session with ADMIN role
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'real_admin@example.com',
          password: 'Password123!',
        },
      });
      assert.equal(loginRes.statusCode, 200);
      assert.equal(loginRes.json().user.role, 'ADMIN');
      const adminToken = loginRes.json().token;

      // 4. Access protected admin endpoint
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/me',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      assert.equal(meRes.statusCode, 200);
      const body = meRes.json();
      assert.ok(body.user);
      assert.equal(body.user.id, userId);
      assert.equal(body.user.email, 'real_admin@example.com');
      assert.equal(body.user.role, 'ADMIN');
      assert.equal(body.user.status, 'ACTIVE');

      // Ensure sensitive credentials are stripped
      assert.equal(body.user.passwordHash, undefined);
      assert.equal(body.user.password, undefined);
    });

    it('rejects revoked sessions with 401', async () => {
      // Create user and promote to ADMIN
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'revoked_admin@example.com',
          password: 'Password123!',
        },
      });
      const userId = signupRes.json().user.id;
      await authRepository.updateUserRole(userId, 'ADMIN');

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'revoked_admin@example.com',
          password: 'Password123!',
        },
      });
      const token = loginRes.json().token;

      // Revoke session (logout)
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: { authorization: `Bearer ${token}` },
      });

      // Try accessing admin endpoint
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/me',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(meRes.statusCode, 401);
      assert.equal(meRes.json().error, 'UnauthorizedError');
    });

    it('rejects suspended or banned administrators with 403', async () => {
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'suspended_admin@example.com',
          password: 'Password123!',
        },
      });
      const userId = signupRes.json().user.id;
      await authRepository.updateUserRole(userId, 'ADMIN');

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'suspended_admin@example.com',
          password: 'Password123!',
        },
      });
      const token = loginRes.json().token;

      // Suspend admin account
      await authRepository.updateUserStatus(userId, 'SUSPENDED');

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/me',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(meRes.statusCode, 403);
      assert.equal(meRes.json().error, 'ForbiddenError');
      assert.match(meRes.json().message, /Account is not active/);
    });

    it('supports cookie-based session authentication for Admin portal', async () => {
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'cookie_admin@example.com',
          password: 'Password123!',
        },
      });
      const userId = signupRes.json().user.id;
      await authRepository.updateUserRole(userId, 'ADMIN');

      // Login to get session cookie
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'cookie_admin@example.com',
          password: 'Password123!',
        },
      });

      const cookies = loginRes.headers['set-cookie'];
      assert.ok(cookies);

      // Access admin endpoint with Cookie header
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/me',
        headers: {
          cookie: String(cookies),
        },
      });

      assert.equal(meRes.statusCode, 200);
      assert.equal(meRes.json().user.role, 'ADMIN');
    });
  });

  describe('Secure Provisioning Script Validation', () => {
    it('rejects provisioning without email', async () => {
      await assert.rejects(
        async () => {
          await provisionAdmin({ email: '' });
        },
        {
          message: /Administrator email is required/,
        },
      );
    });

    it('rejects provisioning with invalid email format', async () => {
      await assert.rejects(
        async () => {
          await provisionAdmin({ email: 'not-an-email', password: 'Password123!' });
        },
        {
          message: /is not a valid email address/,
        },
      );
    });
  });
});
