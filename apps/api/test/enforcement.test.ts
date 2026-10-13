import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';
import { InMemoryPostsRepository } from '../src/modules/posts/index.js';
import { InMemoryCommentsRepository } from '../src/modules/comments/index.js';
import { InMemoryReportsRepository } from '../src/modules/reports/index.js';
import { InMemoryModerationRepository } from '../src/modules/moderation/index.js';

describe('VibeMint Moderation Enforcement & Account Safety Foundation', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let postsRepository: InMemoryPostsRepository;
  let commentsRepository: InMemoryCommentsRepository;
  let reportsRepository: InMemoryReportsRepository;
  let moderationRepository: InMemoryModerationRepository;
  let app: ReturnType<typeof buildApp>;

  let adminCookie: string;
  let adminId: string;
  let regularCookie: string;
  let regularUserId: string;
  let targetUserId: string;
  let targetUserToken: string;
  let samplePostId: string;
  let sampleCommentId: string;
  let sampleReportId: string;

  beforeEach(async () => {
    authRepository = new InMemoryAuthRepository();
    profileRepository = new InMemoryProfileRepository();
    postsRepository = new InMemoryPostsRepository();
    commentsRepository = new InMemoryCommentsRepository();
    reportsRepository = new InMemoryReportsRepository(undefined, authRepository.users);
    moderationRepository = new InMemoryModerationRepository();

    app = buildApp({
      authRepository,
      profileRepository,
      postsRepository,
      commentsRepository,
      reportsRepository,
      moderationRepository,
    });

    // 1. Create and promote Administrator
    const adminSignupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'safety_admin@vibemint.internal',
        password: 'AdminPassword123!',
      },
    });
    assert.equal(adminSignupRes.statusCode, 201);
    adminId = adminSignupRes.json().user.id;
    await authRepository.updateUserRole(adminId, 'ADMIN');

    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'safety_admin@vibemint.internal',
        password: 'AdminPassword123!',
      },
    });
    adminCookie = adminLoginRes.headers['set-cookie'] as string;

    // 2. Create Regular User (Reporter)
    const regularSignupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'reporter@vibemint.io',
        password: 'ReporterPass123!',
      },
    });
    regularUserId = regularSignupRes.json().user.id;
    const regularLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'reporter@vibemint.io',
        password: 'ReporterPass123!',
      },
    });
    regularCookie = regularLoginRes.headers['set-cookie'] as string;

    // 3. Create Target User (Author of reported content)
    const targetSignupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'bad_actor@vibemint.io',
        password: 'TargetPass123!',
      },
    });
    targetUserId = targetSignupRes.json().user.id;
    const targetLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'bad_actor@vibemint.io',
        password: 'TargetPass123!',
      },
    });
    targetUserToken = targetLoginRes.json().token;

    // Complete onboarding for target user so they can post
    await profileRepository.createProfile(targetUserId, {
      username: 'badactor',
      displayName: 'Bad Actor',
    });

    // Create a post by target user
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${targetUserToken}` },
      payload: {
        caption: 'Violating content that must be moderated',
      },
    });
    assert.equal(postRes.statusCode, 201);
    samplePostId = postRes.json().id;

    // Create a comment on the post
    const commentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${samplePostId}/comments`,
      headers: { authorization: `Bearer ${targetUserToken}` },
      payload: {
        content: 'Inappropriate harassment comment',
      },
    });
    assert.equal(commentRes.statusCode, 201);
    sampleCommentId = commentRes.json().id;

    // Submit a report against the post
    const reportRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: regularCookie },
      payload: {
        targetType: 'POST',
        targetId: samplePostId,
        reason: 'HARASSMENT_OR_BULLYING',
        description: 'Blatant rule violation in feed',
      },
    });
    assert.equal(reportRes.statusCode, 201);
    sampleReportId = reportRes.json().id;
  });

  describe('Server-Side Authorization & RBAC Enforcement', () => {
    it('denies unauthenticated requests to all enforcement endpoints with 401', async () => {
      const endpoints = [
        { method: 'POST' as const, url: `/api/v1/admin/moderation/posts/${samplePostId}/remove` },
        { method: 'POST' as const, url: `/api/v1/admin/moderation/posts/${samplePostId}/restore` },
        {
          method: 'POST' as const,
          url: `/api/v1/admin/moderation/comments/${sampleCommentId}/remove`,
        },
        {
          method: 'POST' as const,
          url: `/api/v1/admin/moderation/comments/${sampleCommentId}/restore`,
        },
        { method: 'POST' as const, url: `/api/v1/admin/moderation/users/${targetUserId}/suspend` },
        {
          method: 'POST' as const,
          url: `/api/v1/admin/moderation/users/${targetUserId}/unsuspend`,
        },
        { method: 'GET' as const, url: `/api/v1/admin/moderation/history/POST/${samplePostId}` },
      ];

      for (const ep of endpoints) {
        const res = await app.inject({
          method: ep.method,
          url: ep.url,
          payload: { reason: 'Test unauthorized reason' },
        });
        assert.equal(res.statusCode, 401, `Expected 401 for ${ep.method} ${ep.url}`);
      }
    });

    it('denies non-administrator authenticated users with 403', async () => {
      const endpoints = [
        { method: 'POST' as const, url: `/api/v1/admin/moderation/posts/${samplePostId}/remove` },
        { method: 'POST' as const, url: `/api/v1/admin/moderation/posts/${samplePostId}/restore` },
        {
          method: 'POST' as const,
          url: `/api/v1/admin/moderation/comments/${sampleCommentId}/remove`,
        },
        {
          method: 'POST' as const,
          url: `/api/v1/admin/moderation/comments/${sampleCommentId}/restore`,
        },
        { method: 'POST' as const, url: `/api/v1/admin/moderation/users/${targetUserId}/suspend` },
        {
          method: 'POST' as const,
          url: `/api/v1/admin/moderation/users/${targetUserId}/unsuspend`,
        },
        { method: 'GET' as const, url: `/api/v1/admin/moderation/history/POST/${samplePostId}` },
      ];

      for (const ep of endpoints) {
        const res = await app.inject({
          method: ep.method,
          url: ep.url,
          headers: { cookie: regularCookie },
          payload: { reason: 'Attacking regular user' },
        });
        assert.equal(res.statusCode, 403, `Expected 403 for ${ep.method} ${ep.url}`);
        assert.equal(res.json().error, 'ForbiddenError');
      }
    });

    it('prevents regular users from modifying protected fields via profile update', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/me',
        headers: { cookie: regularCookie },
        payload: {
          role: 'ADMIN',
          status: 'ACTIVE',
          suspendedAt: new Date().toISOString(),
          suspendedUntil: null,
          suspensionReason: 'Self clearing',
        },
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /Cannot modify protected field/);
    });
  });

  describe('Post Moderation Enforcement & Discovery Filtering', () => {
    it('validates required reason on post removal', async () => {
      // Reason too short (< 3 characters)
      const tooShortRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/posts/${samplePostId}/remove`,
        headers: { cookie: adminCookie },
        payload: { reason: 'no' },
      });
      assert.equal(tooShortRes.statusCode, 400);
      assert.match(tooShortRes.json().message, /at least 3 characters/);

      // Missing reason
      const emptyRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/posts/${samplePostId}/remove`,
        headers: { cookie: adminCookie },
        payload: {},
      });
      assert.equal(emptyRes.statusCode, 400);
      assert.match(emptyRes.json().message, /reason is required/i);
    });

    it('successfully removes a post and filters it from public feed and discovery', async () => {
      // Verify post appears in feed before removal
      const feedBefore = await app.inject({ method: 'GET', url: '/api/v1/feed' });
      assert.equal(feedBefore.statusCode, 200);
      const postInFeed = feedBefore.json().posts.some((p: { id: string }) => p.id === samplePostId);
      assert.equal(postInFeed, true);

      // Admin removes post
      const removeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/posts/${samplePostId}/remove`,
        headers: { cookie: adminCookie },
        payload: {
          reason: 'Violates community safety guidelines on harassment',
          reportId: sampleReportId,
        },
      });

      assert.equal(removeRes.statusCode, 200);
      const body = removeRes.json();
      assert.equal(body.success, true);
      assert.equal(body.targetState.status, 'REMOVED');
      assert.equal(body.targetState.isRemoved, true);
      assert.equal(body.action.actionType, 'REMOVE_POST');
      assert.equal(body.action.reportId, sampleReportId);

      // Verify post is immediately excluded from feed
      const feedAfter = await app.inject({ method: 'GET', url: '/api/v1/feed' });
      assert.equal(feedAfter.statusCode, 200);
      const postStillInFeed = feedAfter
        .json()
        .posts.some((p: { id: string }) => p.id === samplePostId);
      assert.equal(postStillInFeed, false);

      // Verify direct post fetch returns 404
      const directFetch = await app.inject({
        method: 'GET',
        url: `/api/v1/posts/${samplePostId}`,
      });
      assert.equal(directFetch.statusCode, 404);
      assert.match(directFetch.json().message, /Post not found/);

      // Reject duplicate removal request (stale state guard)
      const duplicateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/posts/${samplePostId}/remove`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Repeated removal attempt' },
      });
      assert.equal(duplicateRes.statusCode, 400);
      assert.match(duplicateRes.json().message, /already removed/);
    });

    it('allows restoring a removed post back to public feed', async () => {
      // First remove post
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/posts/${samplePostId}/remove`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Initial take down' },
      });

      // Now restore post
      const restoreRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/posts/${samplePostId}/restore`,
        headers: { cookie: adminCookie },
        payload: {
          reason: 'Appeal granted: content compliant upon re-review',
          reportId: sampleReportId,
        },
      });

      assert.equal(restoreRes.statusCode, 200);
      const body = restoreRes.json();
      assert.equal(body.success, true);
      assert.equal(body.targetState.status, 'PUBLISHED');
      assert.equal(body.targetState.isRemoved, false);
      assert.equal(body.action.actionType, 'RESTORE_POST');

      // Post is visible again
      const directFetch = await app.inject({
        method: 'GET',
        url: `/api/v1/posts/${samplePostId}`,
      });
      assert.equal(directFetch.statusCode, 200);
      assert.equal(directFetch.json().id, samplePostId);

      // Reject restoring an already published post
      const redundantRestore = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/posts/${samplePostId}/restore`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Redundant restore' },
      });
      assert.equal(redundantRestore.statusCode, 400);
      assert.match(redundantRestore.json().message, /already published/);
    });
  });

  describe('Comment Moderation Enforcement', () => {
    it('removes comment and filters it from post comments list', async () => {
      // Verify comment appears in list
      const listBefore = await app.inject({
        method: 'GET',
        url: `/api/v1/posts/${samplePostId}/comments`,
      });
      assert.equal(listBefore.statusCode, 200);
      assert.equal(listBefore.json().comments.length, 1);

      // Remove comment
      const removeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/comments/${sampleCommentId}/remove`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Abusive language violation' },
      });
      assert.equal(removeRes.statusCode, 200);
      assert.equal(removeRes.json().action.actionType, 'REMOVE_COMMENT');

      // Comment is now filtered out of post comments
      const listAfter = await app.inject({
        method: 'GET',
        url: `/api/v1/posts/${samplePostId}/comments`,
      });
      assert.equal(listAfter.statusCode, 200);
      assert.equal(listAfter.json().comments.length, 0);

      // Restoring comment makes it visible again
      const restoreRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/comments/${sampleCommentId}/restore`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Restoring after review' },
      });
      assert.equal(restoreRes.statusCode, 200);
      assert.equal(restoreRes.json().action.actionType, 'RESTORE_COMMENT');

      const listRestored = await app.inject({
        method: 'GET',
        url: `/api/v1/posts/${samplePostId}/comments`,
      });
      assert.equal(listRestored.statusCode, 200);
      assert.equal(listRestored.json().comments.length, 1);
    });
  });

  describe('Account Suspension & Centralized Safety Enforcement', () => {
    it('prevents administrator from suspending themselves', async () => {
      const selfSuspend = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/users/${adminId}/suspend`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Attempted self-harm' },
      });
      assert.equal(selfSuspend.statusCode, 400);
      assert.match(selfSuspend.json().message, /cannot suspend their own account/);
    });

    it('prevents suspending another administrator', async () => {
      // Create a second admin
      const secondAdminRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: { email: 'admin2@vibemint.internal', password: 'Password123!' },
      });
      const secondAdminId = secondAdminRes.json().user.id;
      await authRepository.updateUserRole(secondAdminId, 'ADMIN');

      const suspendAdmin = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/users/${secondAdminId}/suspend`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Cannot target peer admin' },
      });
      assert.equal(suspendAdmin.statusCode, 400);
      assert.match(suspendAdmin.json().message, /Administrators cannot be suspended/);
    });

    it('enforces temporary suspension, revokes active sessions, and blocks authenticated routes', async () => {
      // 1. Target user can currently make authenticated requests
      const preTest = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${targetUserToken}` },
      });
      assert.equal(preTest.statusCode, 200);

      // 2. Admin suspends target user for 7 days
      const suspendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/users/${targetUserId}/suspend`,
        headers: { cookie: adminCookie },
        payload: {
          reason: 'Severe platform terms violation: repeated abusive behavior',
          durationDays: 7,
          reportId: sampleReportId,
        },
      });
      assert.equal(suspendRes.statusCode, 200);
      const suspendData = suspendRes.json();
      assert.equal(suspendData.targetState.status, 'SUSPENDED');
      assert.ok(suspendData.targetState.suspendedUntil);

      // 3. Existing active session was revoked -> immediate 401 on next request
      const sessionRevokedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles/me',
        headers: { authorization: `Bearer ${targetUserToken}` },
      });
      assert.equal(sessionRevokedRes.statusCode, 401);
      assert.match(sessionRevokedRes.json().message, /revoked/);

      // 4. Attempting login as suspended user returns 403 Forbidden
      const loginAttempt = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'bad_actor@vibemint.io',
          password: 'TargetPass123!',
        },
      });
      assert.equal(loginAttempt.statusCode, 403);
      assert.match(loginAttempt.json().message, /suspended/);
      assert.match(loginAttempt.json().message, /Severe platform terms violation/);
    });

    it('auto-recovers and restores account when temporary suspension expires', async () => {
      // Suspend user temporarily
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/users/${targetUserId}/suspend`,
        headers: { cookie: adminCookie },
        payload: {
          reason: 'Short suspension',
          durationDays: 1,
        },
      });

      // Simulate time passage by setting suspendedUntil to the past (yesterday)
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await authRepository.updateUserSuspension(targetUserId, {
        status: 'SUSPENDED',
        suspendedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        suspendedUntil: pastDate,
        suspensionReason: 'Short suspension',
      });

      // User attempts login now that temporary duration has expired
      const loginRecover = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'bad_actor@vibemint.io',
          password: 'TargetPass123!',
        },
      });

      // Auto-recovery: login succeeds and account status is restored to ACTIVE!
      assert.equal(loginRecover.statusCode, 200);
      assert.equal(loginRecover.json().user.status, 'ACTIVE');

      const restoredUser = await authRepository.findUserById(targetUserId);
      assert.equal(restoredUser?.status, 'ACTIVE');
      assert.equal(restoredUser?.suspendedAt, null);
      assert.equal(restoredUser?.suspendedUntil, null);
    });

    it('allows an administrator to unsuspend an account manually', async () => {
      // Suspend user permanently (no durationDays)
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/users/${targetUserId}/suspend`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Permanent suspension' },
      });

      // Admin unsuspends user
      const unsuspendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/users/${targetUserId}/unsuspend`,
        headers: { cookie: adminCookie },
        payload: {
          reason: 'User submitted proof of identity and resolved dispute',
          reportId: sampleReportId,
        },
      });
      assert.equal(unsuspendRes.statusCode, 200);
      const unsuspendData = unsuspendRes.json();
      assert.equal(unsuspendData.targetState.status, 'ACTIVE');
      assert.equal(unsuspendData.action.actionType, 'UNSUSPEND_USER');

      // User can now log in normally
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'bad_actor@vibemint.io',
          password: 'TargetPass123!',
        },
      });
      assert.equal(loginRes.statusCode, 200);

      // Rejects unsuspension if user is already active
      const redundantUnsuspend = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/users/${targetUserId}/unsuspend`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Redundant unsuspend' },
      });
      assert.equal(redundantUnsuspend.statusCode, 400);
      assert.match(redundantUnsuspend.json().message, /not currently suspended/);
    });
  });

  describe('Audit Trail & Target Moderation History Querying', () => {
    it('records enforcement actions in target history and returns them ordered newest first', async () => {
      // Action 1: Remove post
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/posts/${samplePostId}/remove`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Step 1: Removed post' },
      });

      // Action 2: Restore post
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/posts/${samplePostId}/restore`,
        headers: { cookie: adminCookie },
        payload: { reason: 'Step 2: Restored post' },
      });

      // Fetch moderation history for the post
      const historyRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/moderation/history/POST/${samplePostId}`,
        headers: { cookie: adminCookie },
      });

      assert.equal(historyRes.statusCode, 200);
      const history = historyRes.json();
      assert.equal(history.total, 2);
      assert.equal(history.actions.length, 2);
      // Newest action is first
      assert.equal(history.actions[0].actionType, 'RESTORE_POST');
      assert.equal(history.actions[0].reason, 'Step 2: Restored post');
      assert.equal(history.actions[1].actionType, 'REMOVE_POST');
      assert.equal(history.actions[1].reason, 'Step 1: Removed post');
      assert.ok(history.actions[0].adminEmail);
    });

    it('rejects history retrieval for unsupported target types with 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/moderation/history/INVALID_TYPE/123`,
        headers: { cookie: adminCookie },
      });
      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /Invalid target type/);
    });

    it('report detail endpoint integrates target status and audit trail accurately', async () => {
      // Remove post associated with sample report
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/moderation/posts/${samplePostId}/remove`,
        headers: { cookie: adminCookie },
        payload: {
          reason: 'Removal tied to report',
          reportId: sampleReportId,
        },
      });

      // Fetch report detail from admin endpoint
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/reports/${sampleReportId}`,
        headers: { cookie: adminCookie },
      });

      assert.equal(detailRes.statusCode, 200);
      const detail = detailRes.json();
      assert.equal(detail.target.type, 'POST');
      assert.equal(detail.target.isUnavailable, true);
      assert.equal(detail.target.data.isRemoved, true);
    });
  });
});
