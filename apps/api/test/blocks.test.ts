import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';
import { InMemoryInterestsRepository } from '../src/modules/interests/index.js';
import { InMemoryPostsRepository } from '../src/modules/posts/index.js';
import { InMemoryCommentsRepository } from '../src/modules/comments/index.js';
import { InMemoryFollowsRepository } from '../src/modules/follows/index.js';
import { InMemoryNotificationsRepository } from '../src/modules/notifications/index.js';
import { InMemoryBlocksRepository } from '../src/modules/blocks/index.js';

describe('VibeMint User Blocking & Safety Controls API', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let interestsRepository: InMemoryInterestsRepository;
  let postsRepository: InMemoryPostsRepository;
  let commentsRepository: InMemoryCommentsRepository;
  let followsRepository: InMemoryFollowsRepository;
  let notificationsRepository: InMemoryNotificationsRepository;
  let blocksRepository: InMemoryBlocksRepository;
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
    blocksRepository = new InMemoryBlocksRepository(
      undefined,
      followsRepository.follows,
      postsRepository.users,
      postsRepository.profiles,
    );
    notificationsRepository = new InMemoryNotificationsRepository(
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
      notificationsRepository,
      blocksRepository,
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
        location: 'Earth',
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

    notificationsRepository.users.set(user.id, user);
    notificationsRepository.profiles.set(user.id, {
      ...profile,
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    blocksRepository.users.set(user.id, user);
    blocksRepository.profiles.set(user.id, {
      ...profile,
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { token, user, profile };
  }

  it('requires authentication for block endpoints', async () => {
    const endpoints = [
      { method: 'PUT' as const, url: '/api/v1/users/user-123/block' },
      { method: 'DELETE' as const, url: '/api/v1/users/user-123/block' },
      { method: 'GET' as const, url: '/api/v1/users/me/blocked-users' },
      { method: 'GET' as const, url: '/api/v1/users/user-123/block-status' },
    ];

    for (const ep of endpoints) {
      const res = await app.inject({
        method: ep.method,
        url: ep.url,
      });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.json().error, 'UnauthorizedError');
    }
  });

  it('rejects self-blocking with a client error', async () => {
    const alice = await registerUser('alice@test.com', 'alice');

    const blockSelf = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${alice.user.id}/block`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.strictEqual(blockSelf.statusCode, 400);
    assert.strictEqual(blockSelf.json().message, 'You cannot block yourself');

    const unblockSelf = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${alice.user.id}/block`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.strictEqual(unblockSelf.statusCode, 400);
    assert.strictEqual(unblockSelf.json().message, 'You cannot unblock yourself');
  });

  it('blocks and unblocks a user idempotently', async () => {
    const alice = await registerUser('alice@test.com', 'alice');
    const bob = await registerUser('bob@test.com', 'bob');

    // Alice blocks Bob
    const blockRes1 = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/block`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.strictEqual(blockRes1.statusCode, 200);
    assert.strictEqual(blockRes1.json().isBlocked, true);

    // Repeated block call is idempotent
    const blockRes2 = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/block`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.strictEqual(blockRes2.statusCode, 200);
    assert.strictEqual(blockRes2.json().isBlocked, true);

    // Check block status from Alice perspective
    const aliceStatus = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${bob.user.id}/block-status`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.strictEqual(aliceStatus.json().isBlockedByViewer, true);
    assert.strictEqual(aliceStatus.json().hasBlockedViewer, false);
    assert.strictEqual(aliceStatus.json().isBlocked, true);

    // Check block status from Bob perspective
    const bobStatus = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${alice.user.id}/block-status`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    assert.strictEqual(bobStatus.json().isBlockedByViewer, false);
    assert.strictEqual(bobStatus.json().hasBlockedViewer, true);
    assert.strictEqual(bobStatus.json().isBlocked, true);

    // Alice unblocks Bob
    const unblockRes1 = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${bob.user.id}/block`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.strictEqual(unblockRes1.statusCode, 200);
    assert.strictEqual(unblockRes1.json().isBlocked, false);

    // Repeated unblock call is idempotent
    const unblockRes2 = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${bob.user.id}/block`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.strictEqual(unblockRes2.statusCode, 200);
    assert.strictEqual(unblockRes2.json().isBlocked, false);

    // Post-unblock status
    const postStatus = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${bob.user.id}/block-status`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.strictEqual(postStatus.json().isBlocked, false);
  });

  it('removes existing follows and pending follow requests in both directions upon blocking', async () => {
    const userA = await registerUser('a@test.com', 'usera');
    const userB = await registerUser('b@test.com', 'userb');

    // User A follows User B
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${userB.user.id}/follow`,
      headers: { authorization: `Bearer ${userA.token}` },
    });

    // User B follows User A
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${userA.user.id}/follow`,
      headers: { authorization: `Bearer ${userB.token}` },
    });

    // Confirm follows exist
    assert.strictEqual(followsRepository.follows.size, 2);

    // User A blocks User B
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${userB.user.id}/block`,
      headers: { authorization: `Bearer ${userA.token}` },
    });

    // Both follow relationships should be deleted
    assert.strictEqual(followsRepository.follows.size, 0);

    // Follow status in both directions should be NOT_FOLLOWING
    const statusAtoB = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${userB.user.id}/follow-status`,
      headers: { authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(statusAtoB.json().status, 'NOT_FOLLOWING');

    const statusBtoA = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${userA.user.id}/follow-status`,
      headers: { authorization: `Bearer ${userB.token}` },
    });
    assert.strictEqual(statusBtoA.json().status, 'NOT_FOLLOWING');
  });

  it('prevents new follows and follow request acceptances while blocked', async () => {
    const alice = await registerUser('alice@test.com', 'alice');
    const bob = await registerUser('bob@test.com', 'bob');

    // Alice blocks Bob
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/block`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    // Bob attempts to follow Alice -> 403 Forbidden
    const bobFollowAlice = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${alice.user.id}/follow`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    assert.strictEqual(bobFollowAlice.statusCode, 403);
    assert.strictEqual(bobFollowAlice.json().message, 'Cannot follow a blocked user');

    // Alice attempts to follow Bob -> 403 Forbidden
    const aliceFollowBob = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/follow`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    assert.strictEqual(aliceFollowBob.statusCode, 403);
    assert.strictEqual(aliceFollowBob.json().message, 'Cannot follow a blocked user');
  });

  it('does not automatically restore deleted follow relationships when unblocking', async () => {
    const userA = await registerUser('usera@test.com', 'usera');
    const userB = await registerUser('userb@test.com', 'userb');

    // Establish follow
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${userB.user.id}/follow`,
      headers: { authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(followsRepository.follows.size, 1);

    // Block
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${userB.user.id}/block`,
      headers: { authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(followsRepository.follows.size, 0);

    // Unblock
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${userB.user.id}/block`,
      headers: { authorization: `Bearer ${userA.token}` },
    });

    // Follow remains deleted
    assert.strictEqual(followsRepository.follows.size, 0);
    const followStatus = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${userB.user.id}/follow-status`,
      headers: { authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(followStatus.json().status, 'NOT_FOLLOWING');
  });

  it('restricts profile visibility and relationship details for blocked users', async () => {
    const alice = await registerUser('alice@test.com', 'alice_pub', false);
    const bob = await registerUser('bob@test.com', 'bob_viewer', false);

    // Alice blocks Bob
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/block`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    // Bob views Alice's profile -> restricted, no bio/location/counts
    const bobViewsAlice = await app.inject({
      method: 'GET',
      url: `/api/v1/profiles/${alice.profile.username}`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    const profileData = bobViewsAlice.json();
    assert.strictEqual(profileData.isRestricted, true);
    assert.strictEqual(profileData.isBlocked, true);
    assert.strictEqual(profileData.bio, undefined);
    assert.strictEqual(profileData.location, undefined);
    assert.strictEqual(profileData.followerCount, undefined);

    // Alice views Bob's profile -> restricted, isBlocked: true, isBlockedByViewer: true
    const aliceViewsBob = await app.inject({
      method: 'GET',
      url: `/api/v1/profiles/${bob.profile.username}`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    const bobData = aliceViewsBob.json();
    assert.strictEqual(bobData.isRestricted, true);
    assert.strictEqual(bobData.isBlocked, true);
    assert.strictEqual(bobData.isBlockedByViewer, true);
  });

  it('filters feed posts in both directions between blocked users', async () => {
    const alice = await registerUser('alice@test.com', 'alice');
    const bob = await registerUser('bob@test.com', 'bob');

    // Alice creates a post
    const postAliceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { caption: 'Alice Vibe' },
    });
    const postAlice = postAliceRes.json();

    // Bob creates a post
    const postBobRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${bob.token}` },
      payload: { caption: 'Bob Vibe' },
    });
    const postBob = postBobRes.json();

    // Before block: Alice sees Bob post, Bob sees Alice post
    const feedBeforeBob = await app.inject({
      method: 'GET',
      url: '/api/v1/feed',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    assert.strictEqual(feedBeforeBob.json().posts.length, 2);

    // Alice blocks Bob
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${bob.user.id}/block`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    // Bob's feed should exclude Alice's post
    const feedBob = await app.inject({
      method: 'GET',
      url: '/api/v1/feed',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    const bobFeedIds = feedBob.json().posts.map((p: { id: string }) => p.id);
    assert.ok(!bobFeedIds.includes(postAlice.id));
    assert.ok(bobFeedIds.includes(postBob.id));

    // Alice's feed should exclude Bob's post
    const feedAlice = await app.inject({
      method: 'GET',
      url: '/api/v1/feed',
      headers: { authorization: `Bearer ${alice.token}` },
    });
    const aliceFeedIds = feedAlice.json().posts.map((p: { id: string }) => p.id);
    assert.ok(!aliceFeedIds.includes(postBob.id));
    assert.ok(aliceFeedIds.includes(postAlice.id));
  });

  it('rejects post interactions and comments between blocked users', async () => {
    const creator = await registerUser('creator@test.com', 'creator');
    const troll = await registerUser('troll@test.com', 'troll');

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${creator.token}` },
      payload: { caption: 'Creator Post' },
    });
    const post = postRes.json();

    // Creator blocks Troll
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${troll.user.id}/block`,
      headers: { authorization: `Bearer ${creator.token}` },
    });

    // Troll tries to like Creator's post -> 403 Forbidden
    const likeRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/posts/${post.id}/like`,
      headers: { authorization: `Bearer ${troll.token}` },
    });
    assert.strictEqual(likeRes.statusCode, 403);
    assert.strictEqual(likeRes.json().message, 'Cannot interact with this post');

    // Troll tries to comment on Creator's post -> 403 Forbidden
    const commentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${troll.token}` },
      payload: { content: 'Harmful comment' },
    });
    assert.strictEqual(commentRes.statusCode, 403);
    assert.strictEqual(commentRes.json().message, 'Cannot comment on this post');
  });

  it('suppresses notifications between blocked users and isolates blocked users list with pagination', async () => {
    const userA = await registerUser('usera@test.com', 'usera');
    const userB = await registerUser('userb@test.com', 'userb');
    const userC = await registerUser('userc@test.com', 'userc');

    // User A blocks User B and User C
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${userB.user.id}/block`,
      headers: { authorization: `Bearer ${userA.token}` },
    });
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${userC.user.id}/block`,
      headers: { authorization: `Bearer ${userA.token}` },
    });

    // User A lists blocked users with limit=1
    const page1Res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/blocked-users?limit=1',
      headers: { authorization: `Bearer ${userA.token}` },
    });
    const page1 = page1Res.json();
    assert.strictEqual(page1.blockedUsers.length, 1);
    assert.strictEqual(page1.pagination.hasMore, true);
    assert.ok(page1.pagination.nextCursor);

    // Page 2
    const page2Res = await app.inject({
      method: 'GET',
      url: `/api/v1/users/me/blocked-users?limit=1&cursor=${page1.pagination.nextCursor}`,
      headers: { authorization: `Bearer ${userA.token}` },
    });
    const page2 = page2Res.json();
    assert.strictEqual(page2.blockedUsers.length, 1);
    assert.strictEqual(page2.pagination.hasMore, false);

    // Verify User B cannot see User A's blocked list
    const bobList = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/blocked-users',
      headers: { authorization: `Bearer ${userB.token}` },
    });
    assert.strictEqual(bobList.json().blockedUsers.length, 0);

    // Attempting to create notification from User B to User A directly -> suppressed
    const notif = await notificationsRepository.createNotification({
      recipientId: userA.user.id,
      actorId: userB.user.id,
      type: 'NEW_FOLLOWER',
      resourceType: 'USER',
      resourceId: userB.user.id,
    });
    assert.strictEqual(notif.recipientId, userA.user.id);

    // But NotificationsService filters it out from getNotifications
    const notifsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(notifsRes.json().notifications.length, 0);
  });
});
