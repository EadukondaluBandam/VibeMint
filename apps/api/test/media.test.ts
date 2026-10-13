import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';
import { InMemoryPostsRepository } from '../src/modules/posts/index.js';
import { InMemoryMediaRepository } from '../src/modules/media/index.js';
import { InMemoryStorageProvider } from '../src/modules/media/storage/memory.storage.js';
import { S3StorageProvider } from '../src/modules/media/storage/s3.storage.js';

const VALID_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const VALID_1X1_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x80, 0xff, 0xd9,
]);

describe('VibeMint Media Upload & Asset Management Foundation', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let postsRepository: InMemoryPostsRepository;
  let mediaRepository: InMemoryMediaRepository;
  let storageProvider: InMemoryStorageProvider;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    authRepository = new InMemoryAuthRepository();
    profileRepository = new InMemoryProfileRepository();
    postsRepository = new InMemoryPostsRepository();
    mediaRepository = new InMemoryMediaRepository();
    storageProvider = new InMemoryStorageProvider();

    app = buildApp({
      authRepository,
      profileRepository,
      postsRepository,
      mediaRepository,
      storageProvider,
    });
  });

  async function registerUser(email: string, username: string) {
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email, password: 'Password123!' },
    });
    const { token, user } = signupRes.json();

    const profileRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        username,
        displayName: `User ${username}`,
        bio: 'VibeMint Creator',
        profileVisibility: 'PUBLIC',
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

  describe('Authentication & Access Control', () => {
    it('rejects unauthenticated upload initiation with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: 1024,
          purpose: 'POST_IMAGE',
        },
      });
      assert.equal(res.statusCode, 401);
    });

    it('rejects unauthenticated upload completion with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads/some-upload-id/complete',
        payload: {},
      });
      assert.equal(res.statusCode, 401);
    });

    it('rejects unauthenticated GET /api/v1/media/:mediaId with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/media/some-media-id',
      });
      assert.equal(res.statusCode, 401);
    });

    it('rejects unauthenticated DELETE /api/v1/media/:mediaId with 401', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/media/some-media-id',
      });
      assert.equal(res.statusCode, 401);
    });
  });

  describe('Upload Initiation & Payload Validation', () => {
    it('initiates upload session successfully with valid PNG request', async () => {
      const { token } = await registerUser('alice@vibemint.com', 'alice');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          originalFilename: 'photo.png',
          purpose: 'POST_IMAGE',
        },
      });

      assert.equal(res.statusCode, 201);
      const data = res.json();
      assert.ok(data.uploadId);
      assert.ok(data.uploadUrl);
      assert.ok(data.storageKey);
      assert.equal(data.mimeType, 'image/png');
      assert.equal(data.status, 'PENDING_UPLOAD');
      assert.ok(data.expiresAt);
    });

    it('rejects unsupported MIME types such as SVG, HTML, and executables', async () => {
      const { token } = await registerUser('bob@vibemint.com', 'bob');

      const unsupportedTypes = [
        'image/svg+xml',
        'text/html',
        'application/javascript',
        'image/gif',
      ];
      for (const mimeType of unsupportedTypes) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/media/uploads',
          headers: { authorization: `Bearer ${token}` },
          payload: {
            mimeType,
            fileSizeBytes: 1024,
            purpose: 'POST_IMAGE',
          },
        });
        assert.equal(res.statusCode, 400, `Expected 400 for MIME type: ${mimeType}`);
      }
    });

    it('rejects oversized files exceeding 10 MB limit', async () => {
      const { token } = await registerUser('charlie@vibemint.com', 'charlie');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/jpeg',
          fileSizeBytes: 10 * 1024 * 1024 + 1, // 10MB + 1 byte
          purpose: 'POST_IMAGE',
        },
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /exceeds the 10 MB maximum limit/i);
    });

    it('rejects invalid or missing upload purpose', async () => {
      const { token } = await registerUser('david@vibemint.com', 'david');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: 500,
          purpose: 'INVALID_PURPOSE',
        },
      });

      assert.equal(res.statusCode, 400);
    });
  });

  describe('Upload Verification & Completion', () => {
    it('verifies stored object, extracts dimensions, and transitions to READY', async () => {
      const { token } = await registerUser('elena@vibemint.com', 'elena');

      // 1. Initiate upload
      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          originalFilename: 'avatar.png',
          purpose: 'AVATAR',
        },
      });
      assert.equal(initRes.statusCode, 201);
      const { uploadId, storageKey } = initRes.json();

      // 2. Put file in storage
      await storageProvider.putObject(storageKey, VALID_1X1_PNG, 'image/png');

      // 3. Complete upload
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      assert.equal(completeRes.statusCode, 200);
      const { asset } = completeRes.json();
      assert.equal(asset.id, uploadId);
      assert.equal(asset.status, 'READY');
      assert.equal(asset.mimeType, 'image/png');
      assert.equal(asset.width, 1);
      assert.equal(asset.height, 1);
      assert.ok(asset.deliveryUrl);
    });

    it('rejects completion when file is missing from storage', async () => {
      const { token } = await registerUser('frank@vibemint.com', 'frank');

      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/jpeg',
          fileSizeBytes: VALID_1X1_JPEG.length,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId } = initRes.json();

      // Don't store anything in storageProvider

      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      assert.equal(completeRes.statusCode, 404);
      assert.match(completeRes.json().message, /not found in storage/i);
    });

    it('rejects spoofed file with wrong magic bytes (HTML disguised as PNG)', async () => {
      const { token } = await registerUser('grace@vibemint.com', 'grace');

      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: 64,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId, storageKey } = initRes.json();

      // Store fake HTML content
      const fakeHtml = Buffer.from('<html><script>alert(1)</script></html>', 'utf-8');
      await storageProvider.putObject(storageKey, fakeHtml, 'image/png');

      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      assert.equal(completeRes.statusCode, 400);
      assert.match(
        completeRes.json().message,
        /prohibited script or markup|invalid image signature/i,
      );

      // Verify asset status transitioned to FAILED
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/media/${uploadId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(getRes.statusCode, 200);
      assert.equal(getRes.json().asset.status, 'FAILED');
    });

    it('handles repeated completion idempotently when already READY', async () => {
      const { token } = await registerUser('heidi@vibemint.com', 'heidi');

      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/jpeg',
          fileSizeBytes: VALID_1X1_JPEG.length,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId, storageKey } = initRes.json();
      await storageProvider.putObject(storageKey, VALID_1X1_JPEG, 'image/jpeg');

      // First complete
      const firstRes = await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      assert.equal(firstRes.statusCode, 200);
      assert.equal(firstRes.json().asset.status, 'READY');

      // Second complete should return existing READY asset without failing
      const secondRes = await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      assert.equal(secondRes.statusCode, 200);
      assert.equal(secondRes.json().asset.status, 'READY');
    });

    it('rejects completion of expired upload session', async () => {
      const { token } = await registerUser('ivan@vibemint.com', 'ivan');

      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId, storageKey } = initRes.json();
      await storageProvider.putObject(storageKey, VALID_1X1_PNG, 'image/png');

      // Force expiresAt to the past
      const record = mediaRepository.assets.get(uploadId);
      if (record) {
        record.expiresAt = new Date(Date.now() - 60000); // 1 minute ago
      }

      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      assert.equal(completeRes.statusCode, 400);
      assert.match(completeRes.json().message, /upload authorization has expired/i);
    });
  });

  describe('Asset Ownership & User Isolation', () => {
    it('prevents user B from completing user A upload', async () => {
      const userA = await registerUser('usera@vibemint.com', 'usera');
      const userB = await registerUser('userb@vibemint.com', 'userb');

      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${userA.token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId } = initRes.json();

      // User B tries to complete user A's upload
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${userB.token}` },
        payload: {},
      });

      assert.equal(res.statusCode, 403);
    });

    it('prevents user B from retrieving user A pending or private asset', async () => {
      const userA = await registerUser('usera2@vibemint.com', 'usera2');
      const userB = await registerUser('userb2@vibemint.com', 'userb2');

      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${userA.token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId } = initRes.json();

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/media/${uploadId}`,
        headers: { authorization: `Bearer ${userB.token}` },
      });

      assert.equal(getRes.statusCode, 403);
    });

    it('prevents user B from deleting user A asset', async () => {
      const userA = await registerUser('usera3@vibemint.com', 'usera3');
      const userB = await registerUser('userb3@vibemint.com', 'userb3');

      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${userA.token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId } = initRes.json();

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/media/${uploadId}`,
        headers: { authorization: `Bearer ${userB.token}` },
      });

      assert.equal(deleteRes.statusCode, 403);
    });

    it('allows owner to delete their asset and cleans up storage', async () => {
      const { token } = await registerUser('deleter@vibemint.com', 'deleter');

      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId, storageKey } = initRes.json();
      await storageProvider.putObject(storageKey, VALID_1X1_PNG, 'image/png');

      await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      assert.ok(storageProvider.hasObject(storageKey));

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/media/${uploadId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(deleteRes.statusCode, 200);
      assert.equal(storageProvider.hasObject(storageKey), false);

      const assetRecord = mediaRepository.assets.get(uploadId);
      assert.equal(assetRecord?.status, 'DELETED');
    });
  });

  describe('Post Creation Integration', () => {
    it('creates post successfully with verified media asset attachment', async () => {
      const { token, user } = await registerUser('postauthor@vibemint.com', 'postauthor');

      // 1. Initiate and complete upload
      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId, storageKey } = initRes.json();
      await storageProvider.putObject(storageKey, VALID_1X1_PNG, 'image/png');

      await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      // 2. Create post with mediaAssetId
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          caption: 'Beautiful sunset with new media pipeline!',
          mediaAssetId: uploadId,
        },
      });

      assert.equal(postRes.statusCode, 201);
      const post = postRes.json();
      assert.equal(post.author.id, user.id);
      assert.equal(post.mediaAssetId, uploadId);
      assert.ok(post.imageUrl);
      assert.match(post.imageUrl, new RegExp(storageKey));
    });

    it('rejects attaching unverified (PENDING_UPLOAD) asset to a post', async () => {
      const { token } = await registerUser('pendinguser@vibemint.com', 'pendinguser');

      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId } = initRes.json();

      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          caption: 'Testing unverified asset',
          mediaAssetId: uploadId,
        },
      });

      assert.equal(postRes.statusCode, 400);
      assert.match(postRes.json().message, /It must be "READY"/i);
    });

    it('rejects attaching another user verified asset to a post', async () => {
      const userA = await registerUser('authora@vibemint.com', 'authora');
      const userB = await registerUser('authorb@vibemint.com', 'authorb');

      // User A creates ready asset
      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${userA.token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          purpose: 'POST_IMAGE',
        },
      });
      const { uploadId, storageKey } = initRes.json();
      await storageProvider.putObject(storageKey, VALID_1X1_PNG, 'image/png');
      await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${userA.token}` },
        payload: {},
      });

      // User B tries to use User A's mediaAssetId
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${userB.token}` },
        payload: {
          caption: 'Trying to steal media asset',
          mediaAssetId: uploadId,
        },
      });

      assert.equal(postRes.statusCode, 403);
      assert.match(postRes.json().message, /You can only attach media assets that you own/i);
    });

    it('preserves legacy image URL post creation without mediaAssetId', async () => {
      const { token } = await registerUser('legacyuser@vibemint.com', 'legacyuser');

      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          caption: 'Legacy image URL post',
          imageUrl: 'https://images.unsplash.com/photo-legacy.jpg',
        },
      });

      assert.equal(postRes.statusCode, 201);
      const post = postRes.json();
      assert.equal(post.imageUrl, 'https://images.unsplash.com/photo-legacy.jpg');
    });
  });

  describe('User Profile Avatar Integration', () => {
    it('updates profile avatar with verified media asset attachment', async () => {
      const { token } = await registerUser('avataruser@vibemint.com', 'avataruser');

      // 1. Upload avatar
      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          mimeType: 'image/jpeg',
          fileSizeBytes: VALID_1X1_JPEG.length,
          purpose: 'AVATAR',
        },
      });
      const { uploadId, storageKey } = initRes.json();
      await storageProvider.putObject(storageKey, VALID_1X1_JPEG, 'image/jpeg');
      await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      // 2. Update profile with mediaAssetId
      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          username: 'avataruser',
          mediaAssetId: uploadId,
        },
      });

      assert.equal(updateRes.statusCode, 200);
      const updated = updateRes.json();
      assert.ok(updated.avatarUrl);
      assert.match(updated.avatarUrl, new RegExp(storageKey));
    });

    it('rejects updating avatar with another user asset', async () => {
      const userA = await registerUser('avatar_a@vibemint.com', 'avatar_a');
      const userB = await registerUser('avatar_b@vibemint.com', 'avatar_b');

      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/uploads',
        headers: { authorization: `Bearer ${userA.token}` },
        payload: {
          mimeType: 'image/png',
          fileSizeBytes: VALID_1X1_PNG.length,
          purpose: 'AVATAR',
        },
      });
      const { uploadId, storageKey } = initRes.json();
      await storageProvider.putObject(storageKey, VALID_1X1_PNG, 'image/png');
      await app.inject({
        method: 'POST',
        url: `/api/v1/media/uploads/${uploadId}/complete`,
        headers: { authorization: `Bearer ${userA.token}` },
        payload: {},
      });

      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${userB.token}` },
        payload: {
          username: 'avatar_b',
          mediaAssetId: uploadId,
        },
      });

      assert.equal(updateRes.statusCode, 403);
    });
  });

  describe('Storage Provider Interface & Configuration Behavior', () => {
    it('throws explicit configuration error when S3 credentials are missing', () => {
      assert.throws(
        () => new S3StorageProvider({ accessKeyId: '', secretAccessKey: '', bucket: '' }),
        /Configuration Error: S3StorageProvider requires/i,
      );
    });

    it('InMemoryStorageProvider accurately handles put, verify, get, and delete operations', async () => {
      const provider = new InMemoryStorageProvider();
      const testBuffer = Buffer.from('test content');

      const meta = await provider.putObject('test/sample.txt', testBuffer, 'text/plain');
      assert.equal(meta.sizeBytes, testBuffer.length);
      assert.equal(meta.mimeType, 'text/plain');

      const verified = await provider.verifyObject('test/sample.txt');
      assert.equal(verified.sizeBytes, testBuffer.length);

      const buf = await provider.getObjectBuffer('test/sample.txt');
      assert.deepEqual(buf, testBuffer);

      await provider.deleteObject('test/sample.txt');
      assert.equal(provider.hasObject('test/sample.txt'), false);
    });
  });
});
