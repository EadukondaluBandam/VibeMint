import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { InMemoryAuthRepository } from '../src/modules/auth/index.js';
import { InMemoryProfileRepository } from '../src/modules/profiles/index.js';
import { InMemoryPostsRepository } from '../src/modules/posts/index.js';
import { InMemoryCommentsRepository } from '../src/modules/comments/index.js';
import { InMemoryReportsRepository } from '../src/modules/reports/index.js';

describe('VibeMint Admin Moderation Queue & Report Review Workflow', () => {
  let authRepository: InMemoryAuthRepository;
  let profileRepository: InMemoryProfileRepository;
  let postsRepository: InMemoryPostsRepository;
  let commentsRepository: InMemoryCommentsRepository;
  let reportsRepository: InMemoryReportsRepository;
  let app: ReturnType<typeof buildApp>;

  let adminCookie: string;
  let adminId: string;
  let regularCookie: string;
  let regularUserId: string;

  beforeEach(async () => {
    authRepository = new InMemoryAuthRepository();
    profileRepository = new InMemoryProfileRepository();
    postsRepository = new InMemoryPostsRepository();
    commentsRepository = new InMemoryCommentsRepository();
    reportsRepository = new InMemoryReportsRepository(undefined, authRepository.users);

    app = buildApp({
      authRepository,
      profileRepository,
      postsRepository,
      commentsRepository,
      reportsRepository,
    });

    // 1. Create and promote Admin User
    const adminSignupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'moderator_admin@vibemint.internal',
        password: 'AdminSecret123!',
      },
    });
    assert.equal(adminSignupRes.statusCode, 201);
    adminId = adminSignupRes.json().user.id;
    await authRepository.updateUserRole(adminId, 'ADMIN');

    // Login as Admin to obtain session cookie
    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'moderator_admin@vibemint.internal',
        password: 'AdminSecret123!',
      },
    });
    assert.equal(adminLoginRes.statusCode, 200);
    adminCookie = adminLoginRes.headers['set-cookie'] as string;

    // 2. Register regular user
    const userRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'regular_reporter@example.com',
        password: 'UserSecret123!',
      },
    });
    assert.equal(userRes.statusCode, 201);
    regularCookie = userRes.headers['set-cookie'] as string;
    regularUserId = userRes.json().user.id;
  });

  describe('Authorization Gate & Access Control', () => {
    it('unauthenticated requests to moderation endpoints return 401', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports',
      });
      assert.equal(listRes.statusCode, 401);

      const statsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports/stats',
      });
      assert.equal(statsRes.statusCode, 401);

      const detailRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports/some-report-id',
      });
      assert.equal(detailRes.statusCode, 401);

      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/reports/some-report-id/status',
        payload: { status: 'UNDER_REVIEW' },
      });
      assert.equal(patchRes.statusCode, 401);
    });

    it('authenticated non-admin users return 403 Forbidden', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports',
        headers: { cookie: regularCookie },
      });
      assert.equal(listRes.statusCode, 403);
      assert.match(listRes.json().message, /Administrator access required/i);

      const detailRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports/some-report-id',
        headers: { cookie: regularCookie },
      });
      assert.equal(detailRes.statusCode, 403);

      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/reports/some-report-id/status',
        headers: { cookie: regularCookie },
        payload: { status: 'UNDER_REVIEW' },
      });
      assert.equal(patchRes.statusCode, 403);
    });

    it('authorized administrators can access moderation endpoints', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports',
        headers: { cookie: adminCookie },
      });
      assert.equal(listRes.statusCode, 200);
      const body = listRes.json();
      assert.ok(Array.isArray(body.reports));
      assert.ok(body.pagination);
    });
  });

  describe('Moderation Queue & Summary Stats', () => {
    let reportUser: any;
    let reportPost: any;
    let reportComment: any;

    beforeEach(async () => {
      // Create user report
      reportUser = await reportsRepository.createReport({
        reporterId: regularUserId,
        targetType: 'USER',
        targetId: 'reported-user-123',
        reason: 'HARASSMENT_OR_BULLYING',
        description: 'User is harassing members in comments',
      });

      // Create post report
      reportPost = await reportsRepository.createReport({
        reporterId: regularUserId,
        targetType: 'POST',
        targetId: 'reported-post-456',
        reason: 'SPAM_OR_SCAM',
        description: 'Post contains scam crypto link',
      });

      // Create comment report
      reportComment = await reportsRepository.createReport({
        reporterId: regularUserId,
        targetType: 'COMMENT',
        targetId: 'reported-comment-789',
        reason: 'HATE_OR_ABUSE',
        description: 'Offensive slur used in comment',
      });
    });

    it('returns genuine API-backed summary metric counts', async () => {
      const statsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports/stats',
        headers: { cookie: adminCookie },
      });

      assert.equal(statsRes.statusCode, 200);
      const { counts } = statsRes.json();
      assert.equal(counts.pending, 3);
      assert.equal(counts.underReview, 0);
      assert.equal(counts.resolved, 0);
      assert.equal(counts.dismissed, 0);
      assert.equal(counts.total, 3);
    });

    it('filters queue by status, targetType, and reason', async () => {
      // 1. Filter by targetType POST
      const postFilterRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports?targetType=POST',
        headers: { cookie: adminCookie },
      });
      assert.equal(postFilterRes.statusCode, 200);
      const postBody = postFilterRes.json();
      assert.equal(postBody.reports.length, 1);
      assert.equal(postBody.reports[0].id, reportPost.id);
      assert.equal(postBody.reports[0].targetType, 'POST');

      // 2. Filter by reason HATE_OR_ABUSE
      const reasonFilterRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports?reason=HATE_OR_ABUSE',
        headers: { cookie: adminCookie },
      });
      assert.equal(reasonFilterRes.statusCode, 200);
      const reasonBody = reasonFilterRes.json();
      assert.equal(reasonBody.reports.length, 1);
      assert.equal(reasonBody.reports[0].id, reportComment.id);

      // 3. Filter by status RESOLVED (initially none)
      const statusFilterRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports?status=RESOLVED',
        headers: { cookie: adminCookie },
      });
      assert.equal(statusFilterRes.statusCode, 200);
      assert.equal(statusFilterRes.json().reports.length, 0);
    });

    it('searches by report ID or target ID', async () => {
      const searchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/reports?search=${encodeURIComponent('reported-post-456')}`,
        headers: { cookie: adminCookie },
      });
      assert.equal(searchRes.statusCode, 200);
      const body = searchRes.json();
      assert.equal(body.reports.length, 1);
      assert.equal(body.reports[0].targetId, 'reported-post-456');
    });

    it('supports cursor-based pagination and stable ordering', async () => {
      const page1Res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports?limit=2',
        headers: { cookie: adminCookie },
      });
      assert.equal(page1Res.statusCode, 200);
      const page1 = page1Res.json();
      assert.equal(page1.reports.length, 2);
      assert.equal(page1.pagination.hasMore, true);
      assert.ok(page1.pagination.nextCursor);

      const page2Res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/reports?limit=2&cursor=${page1.pagination.nextCursor}`,
        headers: { cookie: adminCookie },
      });
      assert.equal(page2Res.statusCode, 200);
      const page2 = page2Res.json();
      assert.equal(page2.reports.length, 1);
      assert.equal(page2.pagination.hasMore, false);
      assert.equal(page2.pagination.nextCursor, null);
    });

    it('never leaks reporter passwords, tokens, or private auth fields in queue listing', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports',
        headers: { cookie: adminCookie },
      });
      assert.equal(listRes.statusCode, 200);
      const body = listRes.json();
      for (const item of body.reports) {
        assert.ok(item.reporter);
        assert.equal(typeof item.reporter.email, 'string');
        assert.equal((item.reporter as any).password, undefined);
        assert.equal((item.reporter as any).passwordHash, undefined);
        assert.equal((item.reporter as any).token, undefined);
      }
    });
  });

  describe('Report Details & Safe Target Inspection', () => {
    it('returns 404 for unknown report ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports/non-existent-report-id',
        headers: { cookie: adminCookie },
      });
      assert.equal(res.statusCode, 404);
      assert.match(res.json().message, /Report not found/i);
    });

    it('safely handles missing or removed targets without crashing', async () => {
      const report = await reportsRepository.createReport({
        reporterId: regularUserId,
        targetType: 'POST',
        targetId: 'deleted-post-id-999',
        reason: 'SPAM_OR_SCAM',
        description: 'Post was deleted before review',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/reports/${report.id}`,
        headers: { cookie: adminCookie },
      });

      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.report.id, report.id);
      assert.equal(body.target.type, 'POST');
      assert.equal(body.target.exists, false);
      assert.equal(body.target.isUnavailable, true);
      assert.equal(body.target.data, null);
    });

    it('preserves reporter confidentiality and does not expose secrets', async () => {
      const report = await reportsRepository.createReport({
        reporterId: regularUserId,
        targetType: 'USER',
        targetId: 'target-user-abc',
        reason: 'HARASSMENT_OR_BULLYING',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/reports/${report.id}`,
        headers: { cookie: adminCookie },
      });

      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.reporter.id, regularUserId);
      assert.equal(body.reporter.email, 'regular_reporter@example.com');
      assert.equal((body.reporter as any).password, undefined);
      assert.equal((body.reporter as any).passwordHash, undefined);
      assert.equal((body.reporter as any).sessions, undefined);
    });
  });

  describe('Status Transitions, Validation & Atomic Audit Logging', () => {
    let testReport: any;

    beforeEach(async () => {
      testReport = await reportsRepository.createReport({
        reporterId: regularUserId,
        targetType: 'POST',
        targetId: 'target-post-1',
        reason: 'SPAM_OR_SCAM',
        description: 'Suspicious commercial links',
      });
    });

    it('rejects invalid status values with 400', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'INVALID_STATUS',
        },
      });
      assert.equal(res.statusCode, 400);
    });

    it('rejects invalid transitions according to the transition policy', async () => {
      // First resolve the report with a valid note
      const resolveRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'RESOLVED',
          decisionNote: 'Content violated spam policies and was addressed.',
        },
      });
      assert.equal(resolveRes.statusCode, 200);

      // Attempt invalid transition: RESOLVED directly to DISMISSED is not allowed by policy
      const invalidRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'DISMISSED',
          decisionNote: 'Attempting invalid jump',
        },
      });
      assert.equal(invalidRes.statusCode, 400);
      assert.match(
        invalidRes.json().message,
        /Cannot transition report from RESOLVED to DISMISSED/i,
      );
    });

    it('rejects resolving or dismissing without a required decision note', async () => {
      // 1. Resolve without note
      const resolveNoNote = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'RESOLVED',
        },
      });
      assert.equal(resolveNoNote.statusCode, 400);
      assert.match(resolveNoNote.json().message, /decision note/i);

      // 2. Dismiss with note too short (< 3 chars)
      const dismissShortNote = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'DISMISSED',
          decisionNote: 'ok',
        },
      });
      assert.equal(dismissShortNote.statusCode, 400);
      assert.match(dismissShortNote.json().message, /at least 3 characters/i);
    });

    it('rejects decision note exceeding 1000 characters', async () => {
      const overlongNote = 'a'.repeat(1001);
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'RESOLVED',
          decisionNote: overlongNote,
        },
      });
      assert.equal(res.statusCode, 400);
      assert.match(res.json().message, /cannot exceed 1000 characters/i);
    });

    it('successfully transitions PENDING -> UNDER_REVIEW and records audit log', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'UNDER_REVIEW',
          decisionNote: 'Investigating flagged links',
        },
      });

      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.report.status, 'UNDER_REVIEW');
      assert.equal(body.auditLog.adminId, adminId);
      assert.equal(body.auditLog.previousStatus, 'PENDING');
      assert.equal(body.auditLog.newStatus, 'UNDER_REVIEW');
      assert.equal(body.auditLog.decisionNote, 'Investigating flagged links');

      // Verify detail view includes the recorded audit log
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/reports/${testReport.id}`,
        headers: { cookie: adminCookie },
      });
      assert.equal(detailRes.statusCode, 200);
      const detailBody = detailRes.json();
      assert.equal(detailBody.auditLogs.length, 1);
      assert.equal(detailBody.auditLogs[0].adminId, adminId);
      assert.equal(detailBody.auditLogs[0].action, 'STATUS_CHANGE_TO_UNDER_REVIEW');
    });

    it('transitions to RESOLVED atomically with resolvedAt timestamp', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'RESOLVED',
          decisionNote: 'Content verified as spam and resolved accordingly.',
        },
      });

      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.report.status, 'RESOLVED');
      assert.ok(body.report.resolvedAt);

      const savedReport = await reportsRepository.findReportById(testReport.id);
      assert.equal(savedReport?.status, 'RESOLVED');
      assert.ok(savedReport?.resolvedAt);
    });

    it('prevents concurrent updates with mismatched expectedStatus (409 Conflict)', async () => {
      // First update moves status to UNDER_REVIEW
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: { status: 'UNDER_REVIEW' },
      });

      // Second admin attempts conditional update expecting PENDING
      const conflictRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'RESOLVED',
          expectedStatus: 'PENDING',
          decisionNote: 'Resolving report thinking it was still pending',
        },
      });

      assert.equal(conflictRes.statusCode, 409);
      assert.match(conflictRes.json().message, /status has changed concurrently/i);
    });

    it('handles duplicate retries idempotently without duplicate audit records', async () => {
      // First update to UNDER_REVIEW
      const firstRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'UNDER_REVIEW',
          decisionNote: 'Beginning review',
        },
      });
      assert.equal(firstRes.statusCode, 200);

      // Repeat identical request (e.g. client double-click or network retry)
      const retryRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'UNDER_REVIEW',
          decisionNote: 'Beginning review',
        },
      });
      assert.equal(retryRes.statusCode, 200);

      // Detail should have only 1 audit log
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/reports/${testReport.id}`,
        headers: { cookie: adminCookie },
      });
      assert.equal(detailRes.statusCode, 200);
      assert.equal(detailRes.json().auditLogs.length, 1);
    });

    it('does not allow altering reporter, target, reason or description through status endpoint', async () => {
      const maliciousRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/reports/${testReport.id}/status`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'UNDER_REVIEW',
          reporterId: 'fake-reporter',
          targetId: 'tampered-target',
          reason: 'FRAUD_OR_MISLEADING',
          description: 'Hacked description',
        },
      });
      assert.equal(maliciousRes.statusCode, 200);

      const unchangedReport = await reportsRepository.findReportById(testReport.id);
      assert.equal(unchangedReport?.reporterId, regularUserId);
      assert.equal(unchangedReport?.targetId, 'target-post-1');
      assert.equal(unchangedReport?.reason, 'SPAM_OR_SCAM');
      assert.equal(unchangedReport?.description, 'Suspicious commercial links');
    });
  });
});
