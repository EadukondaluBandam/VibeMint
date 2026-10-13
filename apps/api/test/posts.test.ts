import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';
import { InMemoryInterestsRepository } from '../src/modules/interests/index.js';
import { InMemoryPostsRepository } from '../src/modules/posts/index.js';

describe('VibeMint Social Feed & Posts API', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let interestsRepository: InMemoryInterestsRepository;
  let postsRepository: InMemoryPostsRepository;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    authRepository = new InMemoryAuthRepository();
    profileRepository = new InMemoryProfileRepository();
    interestsRepository = new InMemoryInterestsRepository();
    postsRepository = new InMemoryPostsRepository();

    app = buildApp({
      authRepository,
      profileRepository,
      interestsRepository,
      postsRepository,
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

    // Link into test in-memory repository for relational resolution
    postsRepository.users.set(user.id, user);
    postsRepository.profiles.set(user.id, {
      ...profile,
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { token, user, profile };
  }

  describe('Authentication & Access Control', () => {
    it('rejects unauthenticated POST /api/v1/posts with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        payload: { caption: 'Hello world' },
      });
      assert.equal(res.statusCode, 401);
      assert.equal(res.json().error, 'UnauthorizedError');
    });

    it('rejects unauthenticated DELETE /api/v1/posts/:postId with 401', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/posts/some-post-id',
      });
      assert.equal(res.statusCode, 401);
    });

    it('rejects unauthenticated PUT /api/v1/posts/:postId/like with 401', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/posts/some-post-id/like',
      });
      assert.equal(res.statusCode, 401);
    });

    it('rejects unauthenticated GET /api/v1/posts/saved with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/posts/saved',
      });
      assert.equal(res.statusCode, 401);
    });
  });

  describe('Post Creation & Validation (POST /api/v1/posts)', () => {
    it('creates a text-only post with valid caption', async () => {
      const { token, user } = await registerUser('alice@example.com', 'alice');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { caption: 'My first post on VibeMint!' },
      });

      assert.equal(res.statusCode, 201);
      const post = res.json();
      assert.ok(post.id);
      assert.equal(post.authorId, user.id);
      assert.equal(post.caption, 'My first post on VibeMint!');
      assert.equal(post.imageUrl, null);
      assert.equal(post.author.username, 'alice');
      assert.equal(post.likeCount, 0);
      assert.equal(post.isLiked, false);
      assert.equal(post.isSaved, false);
    });

    it('creates an image-only post with valid image URL', async () => {
      const { token } = await registerUser('bob@example.com', 'bob');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { imageUrl: 'https://images.unsplash.com/photo-1234' },
      });

      assert.equal(res.statusCode, 201);
      const post = res.json();
      assert.equal(post.caption, null);
      assert.equal(post.imageUrl, 'https://images.unsplash.com/photo-1234');
    });

    it('creates a post with both caption and image URL', async () => {
      const { token } = await registerUser('charlie@example.com', 'charlie');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          caption: 'Sunset vibes in Tokyo',
          imageUrl: 'https://images.unsplash.com/photo-tokyo',
        },
      });

      assert.equal(res.statusCode, 201);
      const post = res.json();
      assert.equal(post.caption, 'Sunset vibes in Tokyo');
      assert.equal(post.imageUrl, 'https://images.unsplash.com/photo-tokyo');
    });

    it('rejects post when neither caption nor image URL is provided', async () => {
      const { token } = await registerUser('empty@example.com', 'empty_user');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { caption: '', imageUrl: '' },
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /Post must contain a caption or an image URL/i);
    });

    it('rejects post with caption exceeding 1000 characters', async () => {
      const { token } = await registerUser('long@example.com', 'long_writer');
      const longCaption = 'A'.repeat(1001);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { caption: longCaption },
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /cannot exceed 1000 characters/i);
    });

    it('rejects post with malformed image URL', async () => {
      const { token } = await registerUser('urltest@example.com', 'url_tester');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { imageUrl: 'not-a-valid-url' },
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /must be a valid http or https URL/i);
    });
  });

  describe('Post Deletion & Ownership Rules (DELETE /api/v1/posts/:postId)', () => {
    it('allows author to remove their own post', async () => {
      const { token } = await registerUser('author@example.com', 'post_author');
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { caption: 'Post to be removed' },
      });
      const post = postRes.json();

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/posts/${post.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(delRes.statusCode, 200);

      // Verifying post is now removed
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/posts/${post.id}`,
      });
      assert.equal(getRes.statusCode, 404);
    });

    it('prevents non-author from deleting another user post', async () => {
      const author = await registerUser('real_author@example.com', 'real_author');
      const attacker = await registerUser('attacker@example.com', 'attacker');

      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${author.token}` },
        payload: { caption: 'Valuable content' },
      });
      const post = postRes.json();

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/posts/${post.id}`,
        headers: { authorization: `Bearer ${attacker.token}` },
      });
      assert.equal(delRes.statusCode, 403);
      assert.match(delRes.json().message, /Only the author can remove/i);
    });
  });

  describe('Social Feed (GET /api/v1/feed)', () => {
    it('returns published posts ordered newest first with pagination', async () => {
      const { token } = await registerUser('feeduser@example.com', 'feed_user');

      // Create 3 posts in sequential order
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { caption: 'First post' },
      });
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { caption: 'Second post' },
      });
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { caption: 'Third post' },
      });

      const p1 = res1.json();
      const p2 = res2.json();
      const p3 = res3.json();

      const feedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/feed?limit=2',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(feedRes.statusCode, 200);
      const feed = feedRes.json();

      assert.equal(feed.posts.length, 2);
      assert.equal(feed.posts[0].id, p3.id);
      assert.equal(feed.posts[1].id, p2.id);
      assert.equal(feed.pagination.hasMore, true);
      assert.equal(feed.pagination.nextCursor, p2.id);

      // Fetch next page with cursor
      const nextRes = await app.inject({
        method: 'GET',
        url: `/api/v1/feed?cursor=${feed.pagination.nextCursor}&limit=2`,
        headers: { authorization: `Bearer ${token}` },
      });
      const nextFeed = nextRes.json();
      assert.equal(nextFeed.posts.length, 1);
      assert.equal(nextFeed.posts[0].id, p1.id);
      assert.equal(nextFeed.pagination.hasMore, false);
    });

    it('excludes removed posts from the feed', async () => {
      const { token } = await registerUser('remover@example.com', 'remover');

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { caption: 'Post to delete' },
      });
      const post = createRes.json();

      // Delete post
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/posts/${post.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      // Feed lookup
      const feedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/feed',
      });
      const feed = feedRes.json();
      assert.ok(!feed.posts.some((p: any) => p.id === post.id));
    });

    it('excludes posts from private profiles when viewed by non-authors', async () => {
      const privateAuthor = await registerUser('private@example.com', 'private_author', true);
      const publicViewer = await registerUser('viewer@example.com', 'public_viewer', false);

      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${privateAuthor.token}` },
        payload: { caption: 'Private thoughts' },
      });
      const post = postRes.json();

      // Non-author viewer feed
      const viewerFeedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/feed',
        headers: { authorization: `Bearer ${publicViewer.token}` },
      });
      const viewerFeed = viewerFeedRes.json();
      assert.ok(!viewerFeed.posts.some((p: any) => p.id === post.id));

      // Direct lookup by non-author should be forbidden
      const directGetRes = await app.inject({
        method: 'GET',
        url: `/api/v1/posts/${post.id}`,
        headers: { authorization: `Bearer ${publicViewer.token}` },
      });
      assert.equal(directGetRes.statusCode, 403);

      // Private author themself can see their own post in feed
      const authorFeedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/feed',
        headers: { authorization: `Bearer ${privateAuthor.token}` },
      });
      const authorFeed = authorFeedRes.json();
      assert.ok(authorFeed.posts.some((p: any) => p.id === post.id));
    });
  });

  describe('Likes (PUT/DELETE /api/v1/posts/:postId/like)', () => {
    it('likes a post and updates like count', async () => {
      const author = await registerUser('postauthor@example.com', 'post_owner');
      const liker = await registerUser('liker@example.com', 'liker_user');

      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${author.token}` },
        payload: { caption: 'Awesome track release' },
      });
      const post = postRes.json();

      // Like
      const likeRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/posts/${post.id}/like`,
        headers: { authorization: `Bearer ${liker.token}` },
      });
      assert.equal(likeRes.statusCode, 200);
      assert.deepEqual(likeRes.json(), {
        postId: post.id,
        isLiked: true,
        likeCount: 1,
      });

      // Repeat like should be idempotent without duplicate rows
      const repeatLikeRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/posts/${post.id}/like`,
        headers: { authorization: `Bearer ${liker.token}` },
      });
      assert.equal(repeatLikeRes.statusCode, 200);
      assert.equal(repeatLikeRes.json().likeCount, 1);

      // Unlike
      const unlikeRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/posts/${post.id}/like`,
        headers: { authorization: `Bearer ${liker.token}` },
      });
      assert.equal(unlikeRes.statusCode, 200);
      assert.deepEqual(unlikeRes.json(), {
        postId: post.id,
        isLiked: false,
        likeCount: 0,
      });
    });
  });

  describe('Saved Posts (PUT/DELETE /api/v1/posts/:postId/save & GET /api/v1/posts/saved)', () => {
    it('saves, unsaves, and isolates saved posts per user', async () => {
      const author = await registerUser('save_author@example.com', 'save_author');
      const userA = await registerUser('usera@example.com', 'user_a');
      const userB = await registerUser('userb@example.com', 'user_b');

      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${author.token}` },
        payload: { caption: 'Bookmarking this!' },
      });
      const post = postRes.json();

      // User A saves post
      const saveRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/posts/${post.id}/save`,
        headers: { authorization: `Bearer ${userA.token}` },
      });
      assert.equal(saveRes.statusCode, 200);
      assert.deepEqual(saveRes.json(), { postId: post.id, isSaved: true });

      // User A retrieves saved posts
      const userASavedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/posts/saved',
        headers: { authorization: `Bearer ${userA.token}` },
      });
      assert.equal(userASavedRes.statusCode, 200);
      const userASaved = userASavedRes.json();
      assert.equal(userASaved.posts.length, 1);
      assert.equal(userASaved.posts[0].id, post.id);
      assert.equal(userASaved.posts[0].isSaved, true);

      // User B saved list must be empty (isolated)
      const userBSavedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/posts/saved',
        headers: { authorization: `Bearer ${userB.token}` },
      });
      assert.equal(userBSavedRes.json().posts.length, 0);

      // User A unsaves post
      const unsaveRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/posts/${post.id}/save`,
        headers: { authorization: `Bearer ${userA.token}` },
      });
      assert.equal(unsaveRes.statusCode, 200);
      assert.deepEqual(unsaveRes.json(), { postId: post.id, isSaved: false });

      // User A saved list is now empty
      const userAAfterUnsave = await app.inject({
        method: 'GET',
        url: '/api/v1/posts/saved',
        headers: { authorization: `Bearer ${userA.token}` },
      });
      assert.equal(userAAfterUnsave.json().posts.length, 0);
    });
  });
});
