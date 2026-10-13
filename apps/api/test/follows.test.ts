import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';
import { InMemoryInterestsRepository } from '../src/modules/interests/index.js';
import { InMemoryPostsRepository } from '../src/modules/posts/index.js';
import { InMemoryCommentsRepository } from '../src/modules/comments/index.js';
import { InMemoryFollowsRepository } from '../src/modules/follows/index.js';

describe('VibeMint Follow & Follower API', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let interestsRepository: InMemoryInterestsRepository;
  let postsRepository: InMemoryPostsRepository;
  let commentsRepository: InMemoryCommentsRepository;
  let followsRepository: InMemoryFollowsRepository;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    authRepository = new InMemoryAuthRepository();
    profileRepository = new InMemoryProfileRepository();
    interestsRepository = new InMemoryInterestsRepository();
    postsRepository = new InMemoryPostsRepository();
    commentsRepository = new InMemoryCommentsRepository(
      postsRepository.comments,
      postsRepository.users,
      postsRepository.profiles,
    );
    followsRepository = new InMemoryFollowsRepository(
      undefined,
      postsRepository.users,
      postsRepository.profiles,
    );

    app = buildApp({
      authRepository,
      profileRepository,
      interestsRepository,
      postsRepository,
      commentsRepository,
      followsRepository,
    });
  });

  async function registerUser(email: string, username: string, isPrivate = false) {
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email,
        password: 'Password123!',
      },
    });
    const { token, user } = signupRes.json();

    const profileRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        username,
        displayName: `User ${username}`,
        bio: `Bio for ${username}`,
        profileVisibility: isPrivate ? 'PRIVATE' : 'PUBLIC',
      },
    });

    const profile = profileRes.json();

    postsRepository.users.set(user.id, user);
    postsRepository.profiles.set(user.id, {
      ...profile,
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { token, user, profile };
  }

  it('requires authentication to follow or unfollow a user', async () => {
    const alice = await registerUser('alice@vibemint.com', 'alice');
    const bob = await registerUser('bob@vibemint.com', 'bob');

    const followRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/follow`,
    });
    assert.equal(followRes.statusCode, 401);

    const unfollowRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${bob.user.id}/follow`,
    });
    assert.equal(unfollowRes.statusCode, 401);
  });

  it('rejects self-follow attempt', async () => {
    const alice = await registerUser('alice@vibemint.com', 'alice');

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${alice.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.json().message, /cannot follow yourself/i);
  });

  it('rejects following a nonexistent user', async () => {
    const alice = await registerUser('alice@vibemint.com', 'alice');

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/nonexistent-id/follow',
      headers: { authorization: `Bearer ${alice.token}` },
    });

    assert.equal(res.statusCode, 404);
  });

  it('allows following a valid public user immediately', async () => {
    const alice = await registerUser('alice@vibemint.com', 'alice');
    const bob = await registerUser('bob@vibemint.com', 'bob', false);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'FOLLOWING');
    assert.equal(body.isFollowing, true);
    assert.equal(body.isPending, false);

    // Follow status check
    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${bob.user.id}/follow-status`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.equal(statusRes.statusCode, 200);
    assert.equal(statusRes.json().status, 'FOLLOWING');
    assert.equal(statusRes.json().isFollowing, true);
  });

  it('creates pending follow request when following a private profile', async () => {
    const alice = await registerUser('alice@vibemint.com', 'alice');
    const secretAgent = await registerUser('agent@vibemint.com', 'agent', true);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${secretAgent.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'PENDING');
    assert.equal(body.isFollowing, false);
    assert.equal(body.isPending, true);

    // Follow status check
    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${secretAgent.user.id}/follow-status`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.equal(statusRes.json().status, 'PENDING');
    assert.equal(statusRes.json().isPending, true);
  });

  it('handles duplicate follow requests idempotently without error', async () => {
    const alice = await registerUser('alice@vibemint.com', 'alice');
    const bob = await registerUser('bob@vibemint.com', 'bob');

    const first = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.equal(first.statusCode, 200);

    const second = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().status, 'FOLLOWING');
  });

  it('allows unfollowing and canceling pending requests', async () => {
    const alice = await registerUser('alice@vibemint.com', 'alice');
    const bob = await registerUser('bob@vibemint.com', 'bob');

    // Follow Bob
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    // Unfollow Bob
    const unfollowRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${bob.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    assert.equal(unfollowRes.statusCode, 200);
    assert.equal(unfollowRes.json().status, 'NOT_FOLLOWING');
    assert.equal(unfollowRes.json().isFollowing, false);

    // Repeated unfollow is safe
    const repeatUnfollow = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${bob.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.equal(repeatUnfollow.statusCode, 200);
    assert.equal(repeatUnfollow.json().status, 'NOT_FOLLOWING');
  });

  it('updates follower and following counts on user profiles', async () => {
    const alice = await registerUser('alice@vibemint.com', 'alice');
    const bob = await registerUser('bob@vibemint.com', 'bob');
    const charlie = await registerUser('charlie@vibemint.com', 'charlie');

    // Initially 0 counts
    const initAliceProfile = await app.inject({
      method: 'GET',
      url: '/api/v1/profiles/me',
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.equal(initAliceProfile.json().followerCount, 0);
    assert.equal(initAliceProfile.json().followingCount, 0);

    // Alice follows Bob and Charlie
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${charlie.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    // Bob follows Charlie
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${charlie.user.id}/follow`,
      headers: { authorization: `Bearer ${bob.token}` },
    });

    // Alice's profile: following 2, followers 0
    const aliceProfile = await app.inject({
      method: 'GET',
      url: '/api/v1/profiles/me',
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.equal(aliceProfile.json().followingCount, 2);
    assert.equal(aliceProfile.json().followerCount, 0);

    // Charlie's public profile viewed by Alice: following 0, followers 2, followStatus: 'FOLLOWING'
    const charlieProfile = await app.inject({
      method: 'GET',
      url: '/api/v1/profiles/charlie',
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.equal(charlieProfile.json().followerCount, 2);
    assert.equal(charlieProfile.json().followingCount, 0);
    assert.equal(charlieProfile.json().followStatus, 'FOLLOWING');
  });

  it('supports cursor-based pagination for followers and following lists', async () => {
    const target = await registerUser('target@vibemint.com', 'target');
    const users = [];

    // Register 5 followers
    for (let i = 1; i <= 5; i++) {
      const u = await registerUser(`follower${i}@vibemint.com`, `follower${i}`);
      users.push(u);
      await app.inject({
        method: 'PUT',
        url: `/api/v1/users/${target.user.id}/follow`,
        headers: { authorization: `Bearer ${u.token}` },
      });
    }

    // Page 1: limit 2
    const page1Res = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.user.id}/followers?limit=2`,
    });
    assert.equal(page1Res.statusCode, 200);
    const page1 = page1Res.json();
    assert.equal(page1.followers.length, 2);
    assert.equal(page1.pagination.hasMore, true);
    assert.ok(page1.pagination.nextCursor);

    // Page 2: with cursor
    const page2Res = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.user.id}/followers?limit=2&cursor=${page1.pagination.nextCursor}`,
    });
    const page2 = page2Res.json();
    assert.equal(page2.followers.length, 2);
    assert.equal(page2.pagination.hasMore, true);

    // Page 3: final item
    const page3Res = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${target.user.id}/followers?limit=2&cursor=${page2.pagination.nextCursor}`,
    });
    const page3 = page3Res.json();
    assert.equal(page3.followers.length, 1);
    assert.equal(page3.pagination.hasMore, false);
    assert.equal(page3.pagination.nextCursor, null);
  });

  it('enforces privacy: private accounts restrict followers and following lists to non-followers', async () => {
    const secret = await registerUser('secret@vibemint.com', 'secret', true);
    const outsider = await registerUser('outsider@vibemint.com', 'outsider');

    // Outsider attempting to view followers
    const followersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${secret.user.id}/followers`,
      headers: { authorization: `Bearer ${outsider.token}` },
    });
    assert.equal(followersRes.statusCode, 403);

    // Outsider attempting to view following
    const followingRes = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${secret.user.id}/following`,
      headers: { authorization: `Bearer ${outsider.token}` },
    });
    assert.equal(followingRes.statusCode, 403);

    // Owner viewing own followers is allowed
    const ownerRes = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${secret.user.id}/followers`,
      headers: { authorization: `Bearer ${secret.token}` },
    });
    assert.equal(ownerRes.statusCode, 200);
  });

  it('supports private profile follow request approval and rejection workflow', async () => {
    const secret = await registerUser('secret2@vibemint.com', 'secret2', true);
    const alice = await registerUser('alice_req@vibemint.com', 'alice_req');

    // Alice requests to follow Secret
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${secret.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    // Secret lists incoming follow requests
    const requestsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/follow-requests',
      headers: { authorization: `Bearer ${secret.token}` },
    });
    assert.equal(requestsRes.statusCode, 200);
    const { requests } = requestsRes.json();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].follower.username, 'alice_req');

    // Secret accepts Alice's request
    const acceptRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/me/follow-requests/${alice.user.id}/accept`,
      headers: { authorization: `Bearer ${secret.token}` },
    });
    assert.equal(acceptRes.statusCode, 200);
    assert.equal(acceptRes.json().status, 'FOLLOWING');

    // Now Alice is an accepted follower and can view Secret's followers list!
    const aliceViewFollowers = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${secret.user.id}/followers`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.equal(aliceViewFollowers.statusCode, 200);
    assert.equal(aliceViewFollowers.json().followers.length, 1);
  });

  it('handles concurrent duplicate follow requests gracefully', async () => {
    const alice = await registerUser('alice_conc@vibemint.com', 'alice_conc');
    const bob = await registerUser('bob_conc@vibemint.com', 'bob_conc');

    const promises = [1, 2, 3].map(() =>
      app.inject({
        method: 'PUT',
        url: `/api/v1/users/${bob.user.id}/follow`,
        headers: { authorization: `Bearer ${alice.token}` },
      }),
    );

    const results = await Promise.all(promises);
    for (const res of results) {
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().status, 'FOLLOWING');
    }

    const followersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${bob.user.id}/followers`,
    });
    assert.equal(followersRes.json().followers.length, 1);
  });
});
