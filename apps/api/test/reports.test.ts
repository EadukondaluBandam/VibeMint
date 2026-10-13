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
import { InMemoryReportsRepository } from '../src/modules/reports/index.js';

describe('VibeMint Content Reporting API', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let interestsRepository: InMemoryInterestsRepository;
  let postsRepository: InMemoryPostsRepository;
  let commentsRepository: InMemoryCommentsRepository;
  let followsRepository: InMemoryFollowsRepository;
  let notificationsRepository: InMemoryNotificationsRepository;
  let blocksRepository: InMemoryBlocksRepository;
  let reportsRepository: InMemoryReportsRepository;
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
    reportsRepository = new InMemoryReportsRepository();

    app = buildApp({
      authRepository,
      profileRepository,
      interestsRepository,
      postsRepository,
      commentsRepository,
      followsRepository,
      notificationsRepository,
      blocksRepository,
      reportsRepository,
    });
  });

  const registerUser = async (email: string, username: string, isPrivate = false) => {
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email, password: 'password123' },
    });
    const { token, user } = signupRes.json();

    postsRepository.users.set(user.id, {
      ...user,
      passwordHash: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    await app.inject({
      method: 'PUT',
      url: '/api/v1/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        username,
        displayName: `User ${username}`,
        profileVisibility: isPrivate ? 'PRIVATE' : 'PUBLIC',
      },
    });

    const prof = await profileRepository.findProfileByUserId(user.id);
    if (prof) {
      postsRepository.profiles.set(user.id, prof);
    }

    return { token, user };
  };

  it('rejects unauthenticated report submissions with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: {
        targetType: 'USER',
        targetId: 'some-user-id',
        reason: 'SPAM_OR_SCAM',
      },
    });

    assert.equal(res.statusCode, 401);
  });

  it('validates input payloads and returns consistent 400 errors for invalid targetType, reason, or overlong description', async () => {
    const { token } = await registerUser('reporter@example.com', 'reporter_1');

    // Missing targetType
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetId: 'some-id',
        reason: 'SPAM_OR_SCAM',
      },
    });
    assert.equal(res1.statusCode, 400);

    // Invalid targetType
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'INVALID_TYPE',
        targetId: 'some-id',
        reason: 'SPAM_OR_SCAM',
      },
    });
    assert.equal(res2.statusCode, 400);

    // Invalid reason
    const res3 = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'USER',
        targetId: 'some-id',
        reason: 'NOT_A_REAL_REASON',
      },
    });
    assert.equal(res3.statusCode, 400);

    // Missing targetId
    const res4 = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'USER',
        targetId: '',
        reason: 'SPAM_OR_SCAM',
      },
    });
    assert.equal(res4.statusCode, 400);

    // Overlong description (> 1000 characters)
    const res5 = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'USER',
        targetId: 'some-id',
        reason: 'SPAM_OR_SCAM',
        description: 'a'.repeat(1001),
      },
    });
    assert.equal(res5.statusCode, 400);
  });

  it('rejects reporting nonexistent targets with 404', async () => {
    const { token } = await registerUser('reporter@example.com', 'reporter_1');

    // Nonexistent user
    const userRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'USER',
        targetId: '00000000-0000-0000-0000-000000000000',
        reason: 'HARASSMENT_OR_BULLYING',
      },
    });
    assert.equal(userRes.statusCode, 404);

    // Nonexistent post
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'POST',
        targetId: '00000000-0000-0000-0000-000000000000',
        reason: 'SPAM_OR_SCAM',
      },
    });
    assert.equal(postRes.statusCode, 404);

    // Nonexistent comment
    const commentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'COMMENT',
        targetId: '00000000-0000-0000-0000-000000000000',
        reason: 'HATE_OR_ABUSE',
      },
    });
    assert.equal(commentRes.statusCode, 404);
  });

  it("rejects reporting one's own content with 400", async () => {
    const { token, user } = await registerUser('author@example.com', 'author_user');

    // Self report user profile
    const selfUserRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'USER',
        targetId: user.id,
        reason: 'IMPERSONATION',
      },
    });
    assert.equal(selfUserRes.statusCode, 400);
    assert.match(selfUserRes.json().message, /cannot report yourself/i);

    // Create a post
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: { caption: 'Author post' },
    });
    const post = postRes.json();

    // Self report post
    const selfPostRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'POST',
        targetId: post.id,
        reason: 'SPAM_OR_SCAM',
      },
    });
    assert.equal(selfPostRes.statusCode, 400);
    assert.match(selfPostRes.json().message, /cannot report your own post/i);

    // Create a comment
    const commentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'Author comment' },
    });
    const comment = commentRes.json();

    // Self report comment
    const selfCommentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'COMMENT',
        targetId: comment.id,
        reason: 'HATE_OR_ABUSE',
      },
    });
    assert.equal(selfCommentRes.statusCode, 400);
    assert.match(selfCommentRes.json().message, /cannot report your own comment/i);
  });

  it('allows reporting an inappropriate user profile with valid reason and creates PENDING report', async () => {
    const { token: reporterToken } = await registerUser('reporter@example.com', 'reporter_user');
    const { user: badUser } = await registerUser('bad@example.com', 'bad_user');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        targetType: 'USER',
        targetId: badUser.id,
        reason: 'IMPERSONATION',
        description: 'Impersonating another person with unauthorized pictures.',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.ok(body.id);
    assert.equal(body.targetType, 'USER');
    assert.equal(body.targetId, badUser.id);
    assert.equal(body.reason, 'IMPERSONATION');
    assert.equal(body.status, 'PENDING');
    assert.equal(body.isDuplicate, false);
  });

  it('allows reporting an inappropriate post with valid reason and optional description', async () => {
    const { token: reporterToken } = await registerUser('reporter@example.com', 'reporter_user');
    const { token: authorToken } = await registerUser('author@example.com', 'author_user');

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${authorToken}` },
      payload: { caption: 'Spam promotional link' },
    });
    const post = postRes.json();

    const reportRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        targetType: 'POST',
        targetId: post.id,
        reason: 'SPAM_OR_SCAM',
        description: 'Cryptocurrency scam link.',
      },
    });

    assert.equal(reportRes.statusCode, 201);
    const body = reportRes.json();
    assert.equal(body.targetType, 'POST');
    assert.equal(body.targetId, post.id);
    assert.equal(body.reason, 'SPAM_OR_SCAM');
    assert.equal(body.status, 'PENDING');
  });

  it('allows reporting an inappropriate comment with valid reason', async () => {
    const { token: reporterToken } = await registerUser('reporter@example.com', 'reporter_user');
    const { token: authorToken } = await registerUser('author@example.com', 'author_user');

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${authorToken}` },
      payload: { caption: 'Public post' },
    });
    const post = postRes.json();

    const commentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${authorToken}` },
      payload: { content: 'Threatening offensive comment' },
    });
    const comment = commentRes.json();

    const reportRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        targetType: 'COMMENT',
        targetId: comment.id,
        reason: 'VIOLENCE_OR_THREAT',
        description: 'Contains direct physical threats.',
      },
    });

    assert.equal(reportRes.statusCode, 201);
    const body = reportRes.json();
    assert.equal(body.targetType, 'COMMENT');
    assert.equal(body.targetId, comment.id);
    assert.equal(body.reason, 'VIOLENCE_OR_THREAT');
    assert.equal(body.status, 'PENDING');
  });

  it('handles duplicate submissions from repeated clicks idempotently without duplicating reports', async () => {
    const { token: reporterToken } = await registerUser('reporter@example.com', 'reporter_user');
    const { user: badUser } = await registerUser('bad@example.com', 'bad_user');

    // First submission
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        targetType: 'USER',
        targetId: badUser.id,
        reason: 'HARASSMENT_OR_BULLYING',
      },
    });
    assert.equal(res1.statusCode, 201);
    const firstBody = res1.json();
    assert.equal(firstBody.isDuplicate, false);

    // Duplicate submission by same reporter for same target
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        targetType: 'USER',
        targetId: badUser.id,
        reason: 'HARASSMENT_OR_BULLYING',
      },
    });
    assert.equal(res2.statusCode, 200);
    const secondBody = res2.json();
    assert.equal(secondBody.id, firstBody.id);
    assert.equal(secondBody.isDuplicate, true);
    assert.match(secondBody.message, /already been submitted/i);

    // Verify only 1 record exists in repository
    assert.equal(reportsRepository.reports.size, 1);
  });

  it('allows reporting users and content even when a block relationship exists (safety workflow)', async () => {
    const { token: userA, user: a } = await registerUser('user_a@example.com', 'user_a');
    const { token: userB, user: b } = await registerUser('user_b@example.com', 'user_b');

    // User A blocks User B
    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${b.id}/block`,
      headers: { authorization: `Bearer ${userA}` },
    });

    // User A can still report User B for harassment that led to the block
    const reportRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${userA}` },
      payload: {
        targetType: 'USER',
        targetId: b.id,
        reason: 'HARASSMENT_OR_BULLYING',
        description: 'Persistent harassment before blocking.',
      },
    });

    assert.equal(reportRes.statusCode, 201);
    assert.equal(reportRes.json().targetId, b.id);
  });

  it('rejects reporting removed posts or removed comments with 404', async () => {
    const { token: reporterToken } = await registerUser('reporter@example.com', 'reporter_user');
    const { token: authorToken } = await registerUser('author@example.com', 'author_user');

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${authorToken}` },
      payload: { caption: 'Post to be removed' },
    });
    const post = postRes.json();

    // Author removes post
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/posts/${post.id}`,
      headers: { authorization: `Bearer ${authorToken}` },
    });

    // Reporting removed post returns 404
    const reportPostRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: {
        targetType: 'POST',
        targetId: post.id,
        reason: 'SPAM_OR_SCAM',
      },
    });
    assert.equal(reportPostRes.statusCode, 404);
  });
});
