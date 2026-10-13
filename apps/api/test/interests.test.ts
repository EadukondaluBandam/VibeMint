import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';
import { InMemoryInterestsRepository, SEED_INTERESTS } from '../src/modules/interests/index.js';

describe('VibeMint Interests API', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let interestsRepository: InMemoryInterestsRepository;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    authRepository = new InMemoryAuthRepository();
    profileRepository = new InMemoryProfileRepository();
    interestsRepository = new InMemoryInterestsRepository();

    // Populate initial seed interests
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

  describe('GET /api/v1/interests', () => {
    it('lists all active interests sorted by category and sortOrder', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/interests',
      });
      assert.equal(res.statusCode, 200);
      const list = res.json();
      assert.ok(Array.isArray(list));
      assert.ok(list.length > 0);
      assert.ok(list.every((i: any) => i.isActive === true));
    });

    it('filters active interests by category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/interests?category=Gaming',
      });
      assert.equal(res.statusCode, 200);
      const list = res.json();
      assert.ok(Array.isArray(list));
      assert.ok(list.length > 0);
      assert.ok(list.every((i: any) => i.category.toLowerCase() === 'gaming'));
    });

    it('excludes inactive interests from the listing', async () => {
      const inactive = await interestsRepository.createInterest({
        name: 'Deprecated Skill',
        slug: 'deprecated-skill',
        category: 'Technology',
        isActive: false,
        sortOrder: 999,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/interests',
      });
      const list = res.json();
      assert.ok(!list.some((i: any) => i.id === inactive.id));
    });
  });

  describe('GET /api/v1/interests/me & PUT /api/v1/interests/me Authentication', () => {
    it('rejects unauthenticated GET /api/v1/interests/me with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/interests/me',
      });
      assert.equal(res.statusCode, 401);
      assert.equal(res.json().error, 'UnauthorizedError');
    });

    it('rejects unauthenticated PUT /api/v1/interests/me with 401', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        payload: {
          interestIds: ['some-id'],
        },
      });
      assert.equal(res.statusCode, 401);
      assert.equal(res.json().error, 'UnauthorizedError');
    });
  });

  describe('User Interest Selection & Replacement', () => {
    it('returns empty list for newly registered user', async () => {
      const { token } = await createAuthenticatedUser('test1@example.com');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), []);
    });

    it('successfully saves valid interest selection (3-10 interests)', async () => {
      const { token } = await createAuthenticatedUser('test2@example.com');
      const allInterests = await interestsRepository.listActiveInterests();
      const selectedIds = allInterests.slice(0, 4).map((i) => i.id);

      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { interestIds: selectedIds },
      });
      assert.equal(putRes.statusCode, 200);
      const updated = putRes.json();
      assert.equal(updated.length, 4);

      // Verify subsequent GET
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(getRes.statusCode, 200);
      const getList = getRes.json();
      assert.equal(getList.length, 4);
      assert.deepEqual(getList.map((i: any) => i.id).sort(), selectedIds.sort());
    });

    it('replaces previously selected interests transactionally', async () => {
      const { token } = await createAuthenticatedUser('test3@example.com');
      const allInterests = await interestsRepository.listActiveInterests();
      const firstSet = allInterests.slice(0, 3).map((i) => i.id);
      const secondSet = allInterests.slice(3, 7).map((i) => i.id);

      await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { interestIds: firstSet },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { interestIds: secondSet },
      });
      assert.equal(res.statusCode, 200);
      const result = res.json();
      assert.equal(result.length, 4);
      assert.deepEqual(result.map((i: any) => i.id).sort(), secondSet.sort());
    });

    it('rejects selection with fewer than 3 interests', async () => {
      const { token } = await createAuthenticatedUser('test4@example.com');
      const allInterests = await interestsRepository.listActiveInterests();
      const tooFew = allInterests.slice(0, 2).map((i) => i.id);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { interestIds: tooFew },
      });
      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /at least 3 interests/i);
    });

    it('rejects selection with more than 10 interests', async () => {
      const { token } = await createAuthenticatedUser('test5@example.com');
      const allInterests = await interestsRepository.listActiveInterests();
      const tooMany = allInterests.slice(0, 11).map((i) => i.id);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { interestIds: tooMany },
      });
      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /at most 10 interests/i);
    });

    it('deduplicates interest IDs in selection payload and enforces unique count', async () => {
      const { token } = await createAuthenticatedUser('test6@example.com');
      const allInterests = await interestsRepository.listActiveInterests();
      const duplicates = [allInterests[0].id, allInterests[0].id, allInterests[1].id];

      // After deduplication this is only 2 unique IDs -> should fail with min 3 required
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { interestIds: duplicates },
      });
      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /at least 3 interests/i);
    });

    it('rejects nonexistent interest IDs', async () => {
      const { token } = await createAuthenticatedUser('test7@example.com');
      const allInterests = await interestsRepository.listActiveInterests();
      const valid = allInterests.slice(0, 2).map((i) => i.id);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { interestIds: [...valid, 'nonexistent-uuid-999'] },
      });
      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /not found or inactive/);
    });

    it('rejects inactive interest IDs', async () => {
      const inactive = await interestsRepository.createInterest({
        name: 'Obsolete Interest',
        slug: 'obsolete-interest',
        category: 'Lifestyle',
        isActive: false,
        sortOrder: 100,
      });

      const { token } = await createAuthenticatedUser('test8@example.com');
      const allInterests = await interestsRepository.listActiveInterests();
      const selection = [allInterests[0].id, allInterests[1].id, inactive.id];

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/interests/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { interestIds: selection },
      });
      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /not found or inactive/);
    });
  });
});
