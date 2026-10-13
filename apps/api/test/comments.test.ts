import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';
import { InMemoryInterestsRepository } from '../src/modules/interests/index.js';
import { InMemoryPostsRepository } from '../src/modules/posts/index.js';
import { InMemoryCommentsRepository } from '../src/modules/comments/index.js';

describe('VibeMint Comments API', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let interestsRepository: InMemoryInterestsRepository;
  let postsRepository: InMemoryPostsRepository;
  let commentsRepository: InMemoryCommentsRepository;
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

    app = buildApp({
      authRepository,
      profileRepository,
      interestsRepository,
      postsRepository,
      commentsRepository,
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
        bio: 'Living the vibe life',
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

  async function createPost(token: string, caption: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: { caption },
    });
    return res.json();
  }

  it('requires authentication to create a comment', async () => {
    const user = await registerUser('alice@vibemint.com', 'alice');
    const post = await createPost(user.token, 'Alice first post');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      payload: { content: 'Nice post!' },
    });

    assert.equal(res.statusCode, 401);
  });

  it('rejects creating comment on nonexistent or removed post', async () => {
    const user = await registerUser('alice@vibemint.com', 'alice');
    const post = await createPost(user.token, 'Post to be removed');

    // Remove the post
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/posts/${post.id}`,
      headers: { authorization: `Bearer ${user.token}` },
    });

    // Attempt comment on deleted post
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${user.token}` },
      payload: { content: 'Commenting on removed post' },
    });

    assert.equal(res.statusCode, 404);

    // Attempt comment on random uuid
    const nonExistentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts/non-existent-id/comments',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { content: 'Ghost post' },
    });

    assert.equal(nonExistentRes.statusCode, 404);
  });

  it('rejects comments and comment listing on posts from private accounts by non-authors', async () => {
    const privateUser = await registerUser('private@vibemint.com', 'privateuser', true);
    const regularUser = await registerUser('viewer@vibemint.com', 'vieweruser', false);

    const post = await createPost(privateUser.token, 'Secret private post');

    // Non-author attempting to comment
    const commentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${regularUser.token}` },
      payload: { content: 'Can I comment?' },
    });

    assert.equal(commentRes.statusCode, 403);

    // Non-author attempting to view comments
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${regularUser.token}` },
    });

    assert.equal(listRes.statusCode, 403);

    // Post author should be able to comment on their own private post
    const authorCommentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${privateUser.token}` },
      payload: { content: 'My private thought' },
    });

    assert.equal(authorCommentRes.statusCode, 201);
  });

  it('validates comment content: rejects empty, whitespace, and oversized comments', async () => {
    const user = await registerUser('alice@vibemint.com', 'alice');
    const post = await createPost(user.token, 'Validation test post');

    // Empty content
    const emptyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${user.token}` },
      payload: { content: '' },
    });
    assert.equal(emptyRes.statusCode, 400);

    // Whitespace only
    const whitespaceRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${user.token}` },
      payload: { content: '    ' },
    });
    assert.equal(whitespaceRes.statusCode, 400);

    // Oversized (> 500 chars)
    const oversizedRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${user.token}` },
      payload: { content: 'a'.repeat(501) },
    });
    assert.equal(oversizedRes.statusCode, 400);

    // Exactly 500 chars is valid
    const maxLenRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${user.token}` },
      payload: { content: 'a'.repeat(500) },
    });
    assert.equal(maxLenRes.statusCode, 201);
  });

  it('creates valid comment and exposes author summary without sensitive data', async () => {
    const user = await registerUser('alice@vibemint.com', 'alice');
    const commenter = await registerUser('bob@vibemint.com', 'bob');
    const post = await createPost(user.token, 'Public vibe post');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${commenter.token}` },
      payload: { content: '  Awesome post!   ' },
    });

    assert.equal(res.statusCode, 201);
    const comment = res.json();

    assert.equal(comment.content, 'Awesome post!');
    assert.equal(comment.postId, post.id);
    assert.equal(comment.authorId, commenter.user.id);
    assert.equal(comment.author.username, 'bob');
    assert.equal(comment.author.displayName, 'User bob');
    assert.equal(comment.status, 'PUBLISHED');
    assert.ok(comment.createdAt);

    // Sensitive fields must NOT be present
    assert.equal((comment.author as Record<string, unknown>).email, undefined);
    assert.equal((comment.author as Record<string, unknown>).passwordHash, undefined);
  });

  it('updates commentCount on post and feed responses', async () => {
    const user = await registerUser('alice@vibemint.com', 'alice');
    const commenter = await registerUser('bob@vibemint.com', 'bob');
    const post = await createPost(user.token, 'Post for comment count');

    // Initially comment count is 0
    const initialPostRes = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}`,
    });
    assert.equal(initialPostRes.json().commentCount, 0);

    // Add first comment
    await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${commenter.token}` },
      payload: { content: 'First comment' },
    });

    // Check single post
    const afterFirstRes = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}`,
    });
    assert.equal(afterFirstRes.json().commentCount, 1);

    // Check feed
    const feedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/feed',
    });
    const feedPost = feedRes.json().posts.find((p: { id: string }) => p.id === post.id);
    assert.equal(feedPost.commentCount, 1);

    // Add second comment
    await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${user.token}` },
      payload: { content: 'Thanks bob!' },
    });

    const afterSecondRes = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}`,
    });
    assert.equal(afterSecondRes.json().commentCount, 2);
  });

  it('supports cursor-based pagination and chronological ordering', async () => {
    const user = await registerUser('alice@vibemint.com', 'alice');
    const post = await createPost(user.token, 'Post with multiple comments');

    // Create 5 comments
    const commentIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/posts/${post.id}/comments`,
        headers: { authorization: `Bearer ${user.token}` },
        payload: { content: `Comment number ${i}` },
      });
      commentIds.push(res.json().id);
    }

    // Page 1: limit 2
    const page1Res = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}/comments?limit=2`,
    });
    assert.equal(page1Res.statusCode, 200);
    const page1 = page1Res.json();

    assert.equal(page1.comments.length, 2);
    assert.equal(page1.comments[0].content, 'Comment number 1');
    assert.equal(page1.comments[1].content, 'Comment number 2');
    assert.equal(page1.pagination.hasMore, true);
    assert.equal(page1.pagination.nextCursor, commentIds[1]);

    // Page 2: using cursor
    const page2Res = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}/comments?limit=2&cursor=${page1.pagination.nextCursor}`,
    });
    const page2 = page2Res.json();

    assert.equal(page2.comments.length, 2);
    assert.equal(page2.comments[0].content, 'Comment number 3');
    assert.equal(page2.comments[1].content, 'Comment number 4');
    assert.equal(page2.pagination.hasMore, true);
    assert.equal(page2.pagination.nextCursor, commentIds[3]);

    // Page 3: remaining 1 comment
    const page3Res = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}/comments?limit=2&cursor=${page2.pagination.nextCursor}`,
    });
    const page3 = page3Res.json();

    assert.equal(page3.comments.length, 1);
    assert.equal(page3.comments[0].content, 'Comment number 5');
    assert.equal(page3.pagination.hasMore, false);
    assert.equal(page3.pagination.nextCursor, null);
  });

  it('requires authentication to delete a comment', async () => {
    const user = await registerUser('alice@vibemint.com', 'alice');
    const post = await createPost(user.token, 'Post');

    const commentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${user.token}` },
      payload: { content: 'Delete me' },
    });
    const comment = commentRes.json();

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/comments/${comment.id}`,
    });
    assert.equal(deleteRes.statusCode, 401);
  });

  it('prevents non-author from deleting someone elses comment', async () => {
    const alice = await registerUser('alice@vibemint.com', 'alice');
    const bob = await registerUser('bob@vibemint.com', 'bob');
    const post = await createPost(alice.token, 'Alice post');

    // Bob creates a comment
    const commentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${bob.token}` },
      payload: { content: 'Bobs comment' },
    });
    const comment = commentRes.json();

    // Alice attempts to delete Bob's comment
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/comments/${comment.id}`,
      headers: { authorization: `Bearer ${alice.token}` },
    });

    assert.equal(deleteRes.statusCode, 403);
  });

  it('allows author to delete their comment and excludes removed comments from normal list', async () => {
    const user = await registerUser('alice@vibemint.com', 'alice');
    const post = await createPost(user.token, 'Post');

    const commentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/comments`,
      headers: { authorization: `Bearer ${user.token}` },
      payload: { content: 'Comment to remove' },
    });
    const comment = commentRes.json();

    // Author deletes
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/comments/${comment.id}`,
      headers: { authorization: `Bearer ${user.token}` },
    });

    assert.equal(deleteRes.statusCode, 200);

    // Listing comments should return empty
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}/comments`,
    });
    assert.equal(listRes.json().comments.length, 0);

    // Single comment endpoint should return 404
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/comments/${comment.id}`,
    });
    assert.equal(getRes.statusCode, 404);

    // Post commentCount should reflect removal
    const postRes = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}`,
    });
    assert.equal(postRes.json().commentCount, 0);
  });

  it('handles repeated requests and concurrent operations gracefully', async () => {
    const user = await registerUser('alice@vibemint.com', 'alice');
    const post = await createPost(user.token, 'Post for concurrency');

    // Send 3 parallel comments
    const promises = [1, 2, 3].map((num) =>
      app.inject({
        method: 'POST',
        url: `/api/v1/posts/${post.id}/comments`,
        headers: { authorization: `Bearer ${user.token}` },
        payload: { content: `Concurrent comment ${num}` },
      }),
    );

    const results = await Promise.all(promises);
    for (const res of results) {
      assert.equal(res.statusCode, 201);
    }

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}/comments`,
    });
    assert.equal(listRes.json().comments.length, 3);
  });
});
