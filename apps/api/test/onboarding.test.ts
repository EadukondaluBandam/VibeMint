import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';
import { InMemoryInterestsRepository, SEED_INTERESTS } from '../src/modules/interests/index.js';

describe('VibeMint Onboarding API', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let interestsRepository: InMemoryInterestsRepository;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    authRepository = new InMemoryAuthRepository();
    profileRepository = new InMemoryProfileRepository();
    interestsRepository = new InMemoryInterestsRepository();

    for (const item of SEED_INTERESTS) {
      await interestsRepository.createInterest(item);
    }

    app = buildApp({
      authRepository,
      profileRepository,
      interestsRepository,
    });
  });

  async function createAuthenticatedUser(email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email,
        password: 'Password123!',
      },
    });
    const { token, user } = res.json();
    return { token, user };
  }

  describe('Authentication & Access Control', () => {
    it('rejects unauthenticated GET /api/v1/onboarding/status with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/onboarding/status',
      });
      assert.equal(res.statusCode, 401);
      assert.equal(res.json().error, 'UnauthorizedError');
    });

    it('rejects unauthenticated POST /api/v1/onboarding/complete with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/onboarding/complete',
      });
      assert.equal(res.statusCode, 401);
      assert.equal(res.json().error, 'UnauthorizedError');
    });
  });

  describe('Onboarding Status Transitions', () => {
    it('returns PROFILE as next step for newly registered user', async () => {
      const { token } = await createAuthenticatedUser('step1@example.com');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/onboarding/status',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      const status = res.json();
      assert.equal(status.profileComplete, false);
      assert.equal(status.interestsComplete, false);
      assert.equal(status.interestsCount, 0);
      assert.equal(status.isCompleted, false);
      assert.equal(status.nextStep, 'PROFILE');
    });

    it('returns INTERESTS as next step after profile is saved', async () => {
      const { token } = await createAuthenticatedUser('step2@example.com');

      // Save profile
      await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'vibemaster',
          displayName: 'Vibe Master',
          bio: 'Building cool vibes',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/onboarding/status',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      const status = res.json();
      assert.equal(status.profileComplete, true);
      assert.equal(status.interestsComplete, false);
      assert.equal(status.interestsCount, 0);
      assert.equal(status.nextStep, 'INTERESTS');
      assert.equal(status.isCompleted, false);
    });

    it('indicates COMPLETED ready when profile exists and >= 3 interests are selected', async () => {
      const { token } = await createAuthenticatedUser('step3@example.com');

      // 1. Profile
      await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'vibemaster3',
          displayName: 'Vibe Master 3',
        },
      });

      // 2. Interests
      const allInterests = await interestsRepository.listActiveInterests();
      const selected = allInterests.slice(0, 3).map((i) => i.id);
      await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { interestIds: selected },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/onboarding/status',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      const status = res.json();
      assert.equal(status.profileComplete, true);
      assert.equal(status.interestsComplete, true);
      assert.equal(status.interestsCount, 3);
      assert.equal(status.nextStep, 'COMPLETED');
      assert.equal(status.isCompleted, false);
    });
  });

  describe('POST /api/v1/onboarding/complete Enforcement', () => {
    it('rejects completion when profile is incomplete', async () => {
      const { token } = await createAuthenticatedUser('incomplete_p@example.com');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/onboarding/complete',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /Profile setup must be completed/);
    });

    it('rejects completion when interests count is less than 3', async () => {
      const { token } = await createAuthenticatedUser('incomplete_i@example.com');

      // Create profile
      await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'half_ready',
          displayName: 'Half Ready',
        },
      });

      // Attempt completion without selecting interests
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/onboarding/complete',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /At least 3 interests must be selected/);
    });

    it('successfully completes onboarding and is idempotent on repeat calls', async () => {
      const { token } = await createAuthenticatedUser('full_onboarding@example.com');

      // Step A: Profile
      await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'finished_user',
          displayName: 'Finished User',
        },
      });

      // Step B: Interests
      const allInterests = await interestsRepository.listActiveInterests();
      const selected = allInterests.slice(0, 4).map((i) => i.id);
      await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { interestIds: selected },
      });

      // Step C: Complete
      const completeRes1 = await app.inject({
        method: 'POST',
        url: '/api/v1/onboarding/complete',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(completeRes1.statusCode, 200);
      assert.equal(completeRes1.json().isCompleted, true);

      // Verify persisted status is now completed
      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/onboarding/status',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(statusRes.statusCode, 200);
      assert.equal(statusRes.json().isCompleted, true);
      assert.equal(statusRes.json().nextStep, 'COMPLETED');

      // Idempotency check: Repeat call should succeed cleanly
      const completeRes2 = await app.inject({
        method: 'POST',
        url: '/api/v1/onboarding/complete',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(completeRes2.statusCode, 200);
      assert.equal(completeRes2.json().isCompleted, true);
    });
  });
});
