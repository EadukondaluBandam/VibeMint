import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';

describe('VibeMint User Profile API', () => {
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
    it('rejects unauthenticated GET /api/v1/profiles/me with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles/me',
      });
      assert.equal(res.statusCode, 401);
      assert.equal(res.json().error, 'UnauthorizedError');
    });

    it('rejects unauthenticated PUT /api/v1/profiles/me with 401', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        payload: {
          username: 'unauth_user',
          displayName: 'Unauthenticated',
        },
      });
      assert.equal(res.statusCode, 401);
      assert.equal(res.json().error, 'UnauthorizedError');
    });
  });

  describe('Profile Creation & Retrieval (PUT/GET /api/v1/profiles/me)', () => {
    it('creates a new profile for authenticated user', async () => {
      const { token, user } = await createAuthenticatedUser('creator@example.com');

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          username: 'vibemaster',
          displayName: 'Vibe Master',
          bio: 'Building digital culture.',
          avatarUrl: 'https://images.example.com/avatar.jpg',
          location: 'Tokyo, Japan',
          profileVisibility: 'PUBLIC',
        },
      });

      assert.equal(res.statusCode, 200);
      const profile = res.json();

      assert.ok(profile.id);
      assert.equal(profile.userId, user.id);
      assert.equal(profile.username, 'vibemaster');
      assert.equal(profile.displayName, 'Vibe Master');
      assert.equal(profile.bio, 'Building digital culture.');
      assert.equal(profile.avatarUrl, 'https://images.example.com/avatar.jpg');
      assert.equal(profile.location, 'Tokyo, Japan');
      assert.equal(profile.profileVisibility, 'PUBLIC');
    });

    it('retrieves the existing profile of authenticated user via GET /api/v1/profiles/me', async () => {
      const { token } = await createAuthenticatedUser('me_tester@example.com');

      // Create profile
      await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'me_tester',
          displayName: 'Me Tester',
          bio: 'Testing profile retrieval',
        },
      });

      // Retrieve profile
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(res.statusCode, 200);
      const profile = res.json();
      assert.equal(profile.username, 'me_tester');
      assert.equal(profile.displayName, 'Me Tester');
      assert.equal(profile.bio, 'Testing profile retrieval');
    });

    it('updates allowed fields on existing profile', async () => {
      const { token } = await createAuthenticatedUser('updater@example.com');

      // Create initial profile
      await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'original_user',
          displayName: 'Original Name',
          bio: 'Original bio',
        },
      });

      // Update fields
      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          displayName: 'Updated Name',
          bio: 'Brand new bio updated!',
          location: 'Berlin, Germany',
        },
      });

      assert.equal(updateRes.statusCode, 200);
      const updated = updateRes.json();
      assert.equal(updated.username, 'original_user');
      assert.equal(updated.displayName, 'Updated Name');
      assert.equal(updated.bio, 'Brand new bio updated!');
      assert.equal(updated.location, 'Berlin, Germany');
    });
  });

  describe('Validation & Security Rules', () => {
    it('rejects invalid usernames (too short, invalid characters)', async () => {
      const { token } = await createAuthenticatedUser('invalid_user@example.com');

      // Too short (< 3 chars)
      const resShort = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'ab',
          displayName: 'Short Name',
        },
      });
      assert.equal(resShort.statusCode, 400);

      // Invalid characters
      const resChars = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'user with spaces!',
          displayName: 'Space Name',
        },
      });
      assert.equal(resChars.statusCode, 400);
    });

    it('rejects duplicate usernames including case-only differences', async () => {
      const user1 = await createAuthenticatedUser('user1@example.com');
      const user2 = await createAuthenticatedUser('user2@example.com');

      // User 1 creates profile
      const res1 = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${user1.token}` },
        payload: {
          username: 'CoolCreator',
          displayName: 'Creator One',
        },
      });
      assert.equal(res1.statusCode, 200);

      // User 2 attempts to claim 'coolcreator' (different case)
      const res2 = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${user2.token}` },
        payload: {
          username: 'COOLCREATOR',
          displayName: 'Creator Two',
        },
      });
      assert.equal(res2.statusCode, 409);
      assert.equal(res2.json().error, 'ConflictError');
    });

    it('rejects protected User fields in profile update request', async () => {
      const { token } = await createAuthenticatedUser('hacker@example.com');

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'hacker_user',
          displayName: 'Hacker',
          email: 'stolen@example.com',
          passwordHash: 'injected_hash',
          status: 'BANNED',
        },
      });

      assert.equal(res.statusCode, 400);
      assert.equal(res.json().error, 'BadRequestError');
      assert.match(res.json().message, /protected field/i);
    });
  });

  describe('Username Availability Endpoint', () => {
    it('reports availability correctly for available and taken usernames', async () => {
      const { token } = await createAuthenticatedUser('taken@example.com');

      await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'taken_user',
          displayName: 'Taken User',
        },
      });

      // Check taken username
      const resTaken = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles/username-availability?username=taken_user',
      });
      assert.equal(resTaken.statusCode, 200);
      assert.equal(resTaken.json().available, false);

      // Check available username
      const resAvail = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles/username-availability?username=brand_new_name',
      });
      assert.equal(resAvail.statusCode, 200);
      assert.equal(resAvail.json().available, true);

      // Check invalid username format
      const resInvalid = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles/username-availability?username=bad!',
      });
      assert.equal(resInvalid.statusCode, 200);
      assert.equal(resInvalid.json().available, false);
      assert.ok(resInvalid.json().reason);
    });
  });

  describe('Public Profiles & Visibility Rules', () => {
    it('returns full public profile for PUBLIC visibility to any visitor', async () => {
      const { token } = await createAuthenticatedUser('public_star@example.com');

      await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'public_star',
          displayName: 'Public Star',
          bio: 'Open to the world!',
          avatarUrl: 'https://images.example.com/star.png',
          location: 'New York, USA',
          profileVisibility: 'PUBLIC',
        },
      });

      // Anonymous visitor
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles/public_star',
      });

      assert.equal(res.statusCode, 200);
      const profile = res.json();
      assert.equal(profile.username, 'public_star');
      assert.equal(profile.displayName, 'Public Star');
      assert.equal(profile.bio, 'Open to the world!');
      assert.equal(profile.location, 'New York, USA');
      assert.equal(profile.isRestricted, false);
    });

    it('restricts private fields when non-owner views PRIVATE profile', async () => {
      const owner = await createAuthenticatedUser('private_owner@example.com');
      const viewer = await createAuthenticatedUser('curious_viewer@example.com');

      await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${owner.token}` },
        payload: {
          username: 'secret_agent',
          displayName: 'Secret Agent',
          bio: 'Classified operations bio',
          location: 'Undisclosed Area',
          profileVisibility: 'PRIVATE',
        },
      });

      // Non-owner viewer request
      const resViewer = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles/secret_agent',
        headers: { authorization: `Bearer ${viewer.token}` },
      });

      assert.equal(resViewer.statusCode, 200);
      const restricted = resViewer.json();
      assert.equal(restricted.username, 'secret_agent');
      assert.equal(restricted.displayName, 'Secret Agent');
      assert.equal(restricted.profileVisibility, 'PRIVATE');
      assert.equal(restricted.isRestricted, true);
      // Private fields must be hidden!
      assert.equal(restricted.bio, undefined);
      assert.equal(restricted.location, undefined);

      // Owner viewer request gets full details
      const resOwner = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles/secret_agent',
        headers: { authorization: `Bearer ${owner.token}` },
      });

      assert.equal(resOwner.statusCode, 200);
      const fullOwnerView = resOwner.json();
      assert.equal(fullOwnerView.bio, 'Classified operations bio');
      assert.equal(fullOwnerView.location, 'Undisclosed Area');
      assert.equal(fullOwnerView.isRestricted, false);
    });
  });
});
