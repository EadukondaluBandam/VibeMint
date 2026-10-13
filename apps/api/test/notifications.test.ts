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

describe('VibeMint Notifications API', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let interestsRepository: InMemoryInterestsRepository;
  let postsRepository: InMemoryPostsRepository;
  let commentsRepository: InMemoryCommentsRepository;
  let followsRepository: InMemoryFollowsRepository;
  let notificationsRepository: InMemoryNotificationsRepository;
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

    notificationsRepository.users.set(user.id, user);
    notificationsRepository.profiles.set(user.id, {
      ...profile,
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { token, user, profile };
  }

  it('requires authentication for all notification endpoints', async () => {
    const endpoints = [
      { method: 'GET' as const, url: '/api/v1/notifications' },
      { method: 'GET' as const, url: '/api/v1/notifications/unread-count' },
      { method: 'PATCH' as const, url: '/api/v1/notifications/123/read' },
      { method: 'PATCH' as const, url: '/api/v1/notifications/read-all' },
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

  it('enforces notification isolation between users', async () => {
    const alice = await registerUser('alice@test.com', 'alice');
    const bob = await registerUser('bob@test.com', 'bob');

    // Bob follows Alice -> Alice receives notification
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${alice.user.id}/follow`,
      headers: { authorization: `Bearer ${bob.token}` },
    });

    // Alice fetches her notifications
    const aliceNotifsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${alice.token}` },
    });
    const aliceData = aliceNotifsRes.json();
    assert.strictEqual(aliceData.notifications.length, 1);
    const notifId = aliceData.notifications[0].id;

    // Bob fetches his notifications -> should be empty
    const bobNotifsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    assert.strictEqual(bobNotifsRes.json().notifications.length, 0);

    // Bob tries to mark Alice's notification as read -> 403 Forbidden
    const bobMarkRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${notifId}/read`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    assert.strictEqual(bobMarkRes.statusCode, 403);
    assert.strictEqual(bobMarkRes.json().error, 'ForbiddenError');
  });

  it('accurately tracks and updates unread counts', async () => {
    const userA = await registerUser('usera@test.com', 'usera');
    const userB = await registerUser('userb@test.com', 'userb');
    const userC = await registerUser('userc@test.com', 'userc');

    // Initial count is 0
    const count0 = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/unread-count',
      headers: { authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(count0.json().unreadCount, 0);

    // User B follows User A
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${userA.user.id}/follow`,
      headers: { authorization: `Bearer ${userB.token}` },
    });

    // User C follows User A
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${userA.user.id}/follow`,
      headers: { authorization: `Bearer ${userC.token}` },
    });

    // Count should be 2
    const count2 = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/unread-count',
      headers: { authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(count2.json().unreadCount, 2);

    // Get notifications and mark one as read
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${userA.token}` },
    });
    const notifs = listRes.json().notifications;
    assert.strictEqual(notifs.length, 2);

    const mark1 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${notifs[0].id}/read`,
      headers: { authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(mark1.statusCode, 200);
    assert.strictEqual(mark1.json().isRead, true);
    assert.ok(mark1.json().readAt);

    // Count should now be 1
    const count1 = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/unread-count',
      headers: { authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(count1.json().unreadCount, 1);
  });

  it('marks single notification as read and handles repeated calls idempotently', async () => {
    const author = await registerUser('author@test.com', 'author');
    const viewer = await registerUser('viewer@test.com', 'viewer');

    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${author.user.id}/follow`,
      headers: { authorization: `Bearer ${viewer.token}` },
    });

    const notifs = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${author.token}` },
    });
    const notif = notifs.json().notifications[0];

    // Mark as read first time
    const res1 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${notif.id}/read`,
      headers: { authorization: `Bearer ${author.token}` },
    });
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.json().isRead, true);
    const readAt1 = res1.json().readAt;
    assert.ok(readAt1);

    // Mark as read second time (idempotent)
    const res2 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${notif.id}/read`,
      headers: { authorization: `Bearer ${author.token}` },
    });
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.json().isRead, true);
    assert.strictEqual(res2.json().readAt, readAt1);
  });

  it('marks all notifications as read idempotently', async () => {
    const target = await registerUser('target@test.com', 'target');
    const u1 = await registerUser('u1@test.com', 'u1');
    const u2 = await registerUser('u2@test.com', 'u2');

    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${target.user.id}/follow`,
      headers: { authorization: `Bearer ${u1.token}` },
    });
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${target.user.id}/follow`,
      headers: { authorization: `Bearer ${u2.token}` },
    });

    // Mark all as read
    const markAllRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/notifications/read-all',
      headers: { authorization: `Bearer ${target.token}` },
    });
    assert.strictEqual(markAllRes.statusCode, 200);
    assert.strictEqual(markAllRes.json().success, true);
    assert.strictEqual(markAllRes.json().markedCount, 2);

    // Verify unread count is 0
    const countRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/unread-count',
      headers: { authorization: `Bearer ${target.token}` },
    });
    assert.strictEqual(countRes.json().unreadCount, 0);

    // Repeat mark all as read -> 0 marked
    const repeatRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/notifications/read-all',
      headers: { authorization: `Bearer ${target.token}` },
    });
    assert.strictEqual(repeatRes.json().markedCount, 0);
  });

  it('supports stable cursor-based pagination', async () => {
    const receiver = await registerUser('recv@test.com', 'recv');

    // Create 5 notifications directly via repository
    for (let i = 1; i <= 5; i++) {
      await notificationsRepository.createNotification({
        recipientId: receiver.user.id,
        actorId: null,
        type: 'NEW_FOLLOWER',
        resourceType: 'USER',
        resourceId: `user_${i}`,
      });
    }

    // First page with limit=2
    const page1Res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications?limit=2',
      headers: { authorization: `Bearer ${receiver.token}` },
    });
    const page1 = page1Res.json();
    assert.strictEqual(page1.notifications.length, 2);
    assert.strictEqual(page1.pagination.hasMore, true);
    assert.ok(page1.pagination.nextCursor);

    // Second page with cursor
    const page2Res = await app.inject({
      method: 'GET',
      url: `/api/v1/notifications?limit=2&cursor=${page1.pagination.nextCursor}`,
      headers: { authorization: `Bearer ${receiver.token}` },
    });
    const page2 = page2Res.json();
    assert.strictEqual(page2.notifications.length, 2);
    assert.strictEqual(page2.pagination.hasMore, true);
    assert.ok(page2.pagination.nextCursor);

    // Third page
    const page3Res = await app.inject({
      method: 'GET',
      url: `/api/v1/notifications?limit=2&cursor=${page2.pagination.nextCursor}`,
      headers: { authorization: `Bearer ${receiver.token}` },
    });
    const page3 = page3Res.json();
    assert.strictEqual(page3.notifications.length, 1);
    assert.strictEqual(page3.pagination.hasMore, false);
    assert.strictEqual(page3.pagination.nextCursor, null);
  });

  it('suppresses notifications for self-actions', async () => {
    const creator = await registerUser('creator@test.com', 'creator');

    // Create a post
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${creator.token}` },
      payload: { caption: 'Self action post' },
    });
    const post = postRes.json();

    // Like own post
    await app.inject({
      method: 'PUT',
      url: `/api/v1/posts/${post.id}/like`,
      headers: { authorization: `Bearer ${creator.token}` },
    });

    // Comment on own post
    await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${creator.token}` },
      payload: { content: 'My own comment' },
    });

    // Unread count should be 0
    const countRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/unread-count',
      headers: { authorization: `Bearer ${creator.token}` },
    });
    assert.strictEqual(countRes.json().unreadCount, 0);

    const notifsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${creator.token}` },
    });
    assert.strictEqual(notifsRes.json().notifications.length, 0);
  });

  it('triggers notifications for public follows, private follow requests, and request acceptances', async () => {
    const publicUser = await registerUser('pub@test.com', 'pub_user', false);
    const privateUser = await registerUser('priv@test.com', 'priv_user', true);
    const follower = await registerUser('flw@test.com', 'flw_user', false);

    // 1. Follow public user -> NEW_FOLLOWER
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${publicUser.user.id}/follow`,
      headers: { authorization: `Bearer ${follower.token}` },
    });

    const pubNotifs = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${publicUser.token}` },
    });
    assert.strictEqual(pubNotifs.json().notifications.length, 1);
    assert.strictEqual(pubNotifs.json().notifications[0].type, 'NEW_FOLLOWER');
    assert.strictEqual(pubNotifs.json().notifications[0].actor.username, 'flw_user');

    // 2. Follow private user -> FOLLOW_REQUEST_RECEIVED
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${privateUser.user.id}/follow`,
      headers: { authorization: `Bearer ${follower.token}` },
    });

    const privNotifs = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${privateUser.token}` },
    });
    assert.strictEqual(privNotifs.json().notifications.length, 1);
    assert.strictEqual(privNotifs.json().notifications[0].type, 'FOLLOW_REQUEST_RECEIVED');
    assert.strictEqual(privNotifs.json().notifications[0].actor.username, 'flw_user');

    // 3. Private user accepts request -> FOLLOW_REQUEST_ACCEPTED for follower
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/me/follow-requests/${follower.user.id}/accept`,
      headers: { authorization: `Bearer ${privateUser.token}` },
    });

    const followerNotifs = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${follower.token}` },
    });
    assert.strictEqual(followerNotifs.json().notifications.length, 1);
    assert.strictEqual(followerNotifs.json().notifications[0].type, 'FOLLOW_REQUEST_ACCEPTED');
    assert.strictEqual(followerNotifs.json().notifications[0].actor.username, 'priv_user');
  });

  it('triggers notifications for post likes and comments', async () => {
    const author = await registerUser('post_author@test.com', 'author_user');
    const fan = await registerUser('fan@test.com', 'fan_user');

    // Author creates a post
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${author.token}` },
      payload: { caption: 'Awesome vibe' },
    });
    const post = postRes.json();

    // Fan likes post
    await app.inject({
      method: 'PUT',
      url: `/api/v1/posts/${post.id}/like`,
      headers: { authorization: `Bearer ${fan.token}` },
    });

    // Fan comments on post
    await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${fan.token}` },
      payload: { content: 'Incredible post!' },
    });

    const authorNotifsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${author.token}` },
    });
    const notifs = authorNotifsRes.json().notifications;
    assert.strictEqual(notifs.length, 2);

    const types = notifs.map((n: { type: string }) => n.type);
    assert.ok(types.includes('POST_LIKED'));
    assert.ok(types.includes('POST_COMMENTED'));
  });

  it('prevents duplicate notifications on repeated idempotent actions', async () => {
    const author = await registerUser('dup_author@test.com', 'dup_author');
    const fan = await registerUser('dup_fan@test.com', 'dup_fan');

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${author.token}` },
      payload: { caption: 'Check this out' },
    });
    const post = postRes.json();

    // Like post twice
    await app.inject({
      method: 'PUT',
      url: `/api/v1/posts/${post.id}/like`,
      headers: { authorization: `Bearer ${fan.token}` },
    });
    await app.inject({
      method: 'PUT',
      url: `/api/v1/posts/${post.id}/like`,
      headers: { authorization: `Bearer ${fan.token}` },
    });

    // Follow author twice
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${author.user.id}/follow`,
      headers: { authorization: `Bearer ${fan.token}` },
    });
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${author.user.id}/follow`,
      headers: { authorization: `Bearer ${fan.token}` },
    });

    const notifsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${author.token}` },
    });
    const notifs = notifsRes.json().notifications;

    // Should only have 1 POST_LIKED and 1 NEW_FOLLOWER (2 total, not 4)
    assert.strictEqual(notifs.length, 2);
    const likeNotifs = notifs.filter((n: { type: string }) => n.type === 'POST_LIKED');
    const followNotifs = notifs.filter((n: { type: string }) => n.type === 'NEW_FOLLOWER');
    assert.strictEqual(likeNotifs.length, 1);
    assert.strictEqual(followNotifs.length, 1);
  });

  it('handles deleted actor gracefully without crashing', async () => {
    const user = await registerUser('lone@test.com', 'lone_user');

    // Create notification with non-existent actor
    await notificationsRepository.createNotification({
      recipientId: user.user.id,
      actorId: 'non-existent-user-id',
      type: 'NEW_FOLLOWER',
      resourceType: 'USER',
      resourceId: 'some-id',
    });

    const notifsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.strictEqual(notifsRes.statusCode, 200);
    const notifs = notifsRes.json().notifications;
    assert.strictEqual(notifs.length, 1);
    assert.strictEqual(notifs[0].actor, null);
  });
});
