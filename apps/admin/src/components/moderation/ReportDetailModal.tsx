import { useState, useEffect, type FC } from 'react';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import type {
  AdminReportDetailResponse,
  ReportStatus,
  ModerationActionSummary,
  TargetUserDetail,
  TargetPostDetail,
  TargetCommentDetail,
} from '@vibemint/types';
import { Badge, type BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';
import { adminModerationService } from '../../services/adminModerationService';

interface ReportDetailModalProps {
  reportId: string;
  onClose: () => void;
  onReportUpdated: () => void;
}

const statusBadgeVariant = (status: ReportStatus): BadgeVariant => {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'UNDER_REVIEW':
      return 'info';
    case 'RESOLVED':
      return 'success';
    case 'DISMISSED':
      return 'default';
    default:
      return 'default';
  }
};

const enforcementActionTitle = (action: string): string => {
  switch (action) {
    case 'REMOVE_POST':
      return 'Remove Post from Public Feed';
    case 'RESTORE_POST':
      return 'Restore Post to Published Feed';
    case 'REMOVE_COMMENT':
      return 'Remove Comment';
    case 'RESTORE_COMMENT':
      return 'Restore Comment to Published';
    case 'SUSPEND_USER':
      return 'Suspend User Account';
    case 'UNSUSPEND_USER':
      return 'Unsuspend and Restore User Account';
    default:
      return action;
  }
};

export const ReportDetailModal: FC<ReportDetailModalProps> = ({
  reportId,
  onClose,
  onReportUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminReportDetailResponse | null>(null);

  // Status transition form state
  const [targetStatus, setTargetStatus] = useState<ReportStatus | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Enforcement action state
  const [enforcementAction, setEnforcementAction] = useState<
    | 'REMOVE_POST'
    | 'RESTORE_POST'
    | 'REMOVE_COMMENT'
    | 'RESTORE_COMMENT'
    | 'SUSPEND_USER'
    | 'UNSUSPEND_USER'
    | null
  >(null);
  const [enforcementReason, setEnforcementReason] = useState('');
  const [suspensionDuration, setSuspensionDuration] = useState<number | null>(7);
  const [enforcementConfirmed, setEnforcementConfirmed] = useState(false);
  const [enforcementSubmitting, setEnforcementSubmitting] = useState(false);
  const [enforcementError, setEnforcementError] = useState<string | null>(null);
  const [enforcementSuccess, setEnforcementSuccess] = useState<string | null>(null);

  // Moderation history state
  const [moderationHistory, setModerationHistory] = useState<ModerationActionSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchModerationHistory = async (targetType: string, targetId: string) => {
    setLoadingHistory(true);
    try {
      const res = await adminModerationService.getTargetModerationHistory(targetType, targetId);
      setModerationHistory(res.actions || []);
    } catch {
      // Retain existing state on transient error
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminModerationService.getReportDetail(reportId);
        if (mounted) {
          setData(res);
          void fetchModerationHistory(res.report.targetType, res.report.targetId);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load report details');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void fetchDetail();
    return () => {
      mounted = false;
    };
  }, [reportId]);

  const handleStatusChange = async () => {
    if (!targetStatus || !data) return;

    // Client-side guard for decision note requirements
    const isFinalDecision = targetStatus === 'RESOLVED' || targetStatus === 'DISMISSED';
    const isReopen =
      (data.report.status === 'RESOLVED' || data.report.status === 'DISMISSED') &&
      (targetStatus === 'UNDER_REVIEW' || targetStatus === 'PENDING');

    if ((isFinalDecision || isReopen) && decisionNote.trim().length < 3) {
      setActionError('A decision note of at least 3 characters is required.');
      return;
    }

    if (decisionNote.trim().length > 1000) {
      setActionError('Decision note cannot exceed 1000 characters.');
      return;
    }

    if (isFinalDecision && !confirmed) {
      setActionError('Please confirm your decision before finalizing.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await adminModerationService.updateReportStatus(reportId, {
        status: targetStatus,
        decisionNote: decisionNote.trim() || undefined,
        expectedStatus: data.report.status,
      });

      setActionSuccess(res.message);
      // Reload fresh details to show updated status and new audit trail record
      const refreshed = await adminModerationService.getReportDetail(reportId);
      setData(refreshed);
      setTargetStatus(null);
      setDecisionNote('');
      setConfirmed(false);
      onReportUpdated();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update report status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnforcementAction = async () => {
    if (!enforcementAction || !data) return;

    if (enforcementReason.trim().length < 3) {
      setEnforcementError('A reason of at least 3 characters is required.');
      return;
    }

    if (enforcementReason.trim().length > 1000) {
      setEnforcementError('Reason cannot exceed 1000 characters.');
      return;
    }

    if (!enforcementConfirmed) {
      setEnforcementError('Please check the confirmation box before applying this action.');
      return;
    }

    setEnforcementSubmitting(true);
    setEnforcementError(null);
    setEnforcementSuccess(null);

    try {
      const targetId = data.report.targetId;
      const associatedReportId = data.report.id;
      let resMessage = '';

      switch (enforcementAction) {
        case 'REMOVE_POST': {
          const res = await adminModerationService.removePost(targetId, {
            reason: enforcementReason.trim(),
            reportId: associatedReportId,
          });
          resMessage = res.message;
          break;
        }
        case 'RESTORE_POST': {
          const res = await adminModerationService.restorePost(targetId, {
            reason: enforcementReason.trim(),
            reportId: associatedReportId,
          });
          resMessage = res.message;
          break;
        }
        case 'REMOVE_COMMENT': {
          const res = await adminModerationService.removeComment(targetId, {
            reason: enforcementReason.trim(),
            reportId: associatedReportId,
          });
          resMessage = res.message;
          break;
        }
        case 'RESTORE_COMMENT': {
          const res = await adminModerationService.restoreComment(targetId, {
            reason: enforcementReason.trim(),
            reportId: associatedReportId,
          });
          resMessage = res.message;
          break;
        }
        case 'SUSPEND_USER': {
          const res = await adminModerationService.suspendUser(targetId, {
            reason: enforcementReason.trim(),
            durationDays: suspensionDuration,
            reportId: associatedReportId,
          });
          resMessage = res.message;
          break;
        }
        case 'UNSUSPEND_USER': {
          const res = await adminModerationService.unsuspendUser(targetId, {
            reason: enforcementReason.trim(),
            reportId: associatedReportId,
          });
          resMessage = res.message;
          break;
        }
      }

      setEnforcementSuccess(resMessage || 'Enforcement action applied successfully.');
      // Refresh report data and target moderation history
      const refreshed = await adminModerationService.getReportDetail(reportId);
      setData(refreshed);
      await fetchModerationHistory(refreshed.report.targetType, refreshed.report.targetId);
      setEnforcementAction(null);
      setEnforcementReason('');
      setEnforcementConfirmed(false);
      onReportUpdated();
    } catch (err: unknown) {
      setEnforcementError(
        err instanceof Error ? err.message : 'Failed to apply enforcement action',
      );
    } finally {
      setEnforcementSubmitting(false);
    }
  };

  const getAvailableTransitions = (currentStatus: ReportStatus): ReportStatus[] => {
    switch (currentStatus) {
      case 'PENDING':
        return ['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];
      case 'UNDER_REVIEW':
        return ['RESOLVED', 'DISMISSED', 'PENDING'];
      case 'RESOLVED':
      case 'DISMISSED':
        return ['UNDER_REVIEW', 'PENDING'];
      default:
        return [];
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          backgroundColor: '#0b0f19',
          border: `1px solid ${colors.dark.border}`,
          borderRadius: radius.xl,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: `${spacing.lg} ${spacing.xl}`,
            borderBottom: `1px solid ${colors.dark.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0f172a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: fontWeights.bold,
                color: '#f8fafc',
                margin: 0,
              }}
            >
              Report Inspection & Enforcement
            </h2>
            {data && (
              <Badge variant={statusBadgeVariant(data.report.status)}>{data.report.status}</Badge>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={submitting || enforcementSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: spacing.xs,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: spacing.xl,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.xl,
          }}
        >
          {loading && (
            <div
              style={{
                padding: spacing['2xl'],
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.875rem',
              }}
            >
              Loading report details...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: spacing.md,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: radius.lg,
                color: '#f87171',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Report Metadata Section */}
              <div
                style={{
                  backgroundColor: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                }}
              >
                <h3
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: fontWeights.semiBold,
                    color: '#e2e8f0',
                    margin: `0 0 ${spacing.md} 0`,
                  }}
                >
                  📋 Report Overview
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: spacing.md,
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
                      Target Type
                    </span>
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: fontWeights.medium,
                        color: '#f8fafc',
                      }}
                    >
                      {data.report.targetType}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
                      Reported Reason
                    </span>
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: fontWeights.medium,
                        color: '#f8fafc',
                      }}
                    >
                      {data.report.reason}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
                      Submission Date
                    </span>
                    <span style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                      {new Date(data.report.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
                      Reporter Identity
                    </span>
                    <span style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                      {data.reporter.email}{' '}
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        ({data.reporter.id.slice(0, 8)})
                      </span>
                    </span>
                  </div>
                </div>

                {data.report.description && (
                  <div
                    style={{
                      marginTop: spacing.md,
                      paddingTop: spacing.md,
                      borderTop: '1px solid #1f2937',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      User Description
                    </span>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        color: '#e2e8f0',
                        lineHeight: 1.5,
                        fontStyle: 'italic',
                      }}
                    >
                      "{data.report.description}"
                    </p>
                  </div>
                )}
              </div>

              {/* Reported Content & Target Status Inspection */}
              <div
                style={{
                  backgroundColor: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: spacing.md,
                    flexWrap: 'wrap',
                    gap: spacing.sm,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <h3
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: fontWeights.semiBold,
                        color: '#e2e8f0',
                        margin: 0,
                      }}
                    >
                      🔍 Reported Target Investigation
                    </h3>
                    {/* Dynamic target status badge */}
                    {data.target.type === 'POST' && data.target.data && (
                      <Badge
                        variant={
                          (data.target.data as TargetPostDetail).isRemoved ? 'error' : 'success'
                        }
                      >
                        {(data.target.data as TargetPostDetail).isRemoved ? 'REMOVED' : 'PUBLISHED'}
                      </Badge>
                    )}
                    {data.target.type === 'COMMENT' && data.target.data && (
                      <Badge
                        variant={
                          (data.target.data as TargetCommentDetail).isRemoved ? 'error' : 'success'
                        }
                      >
                        {(data.target.data as TargetCommentDetail).isRemoved
                          ? 'REMOVED'
                          : 'PUBLISHED'}
                      </Badge>
                    )}
                    {data.target.type === 'USER' && data.target.data && (
                      <Badge
                        variant={
                          (data.target.data as TargetUserDetail).status === 'SUSPENDED'
                            ? 'error'
                            : (data.target.data as TargetUserDetail).status === 'ACTIVE'
                              ? 'success'
                              : 'default'
                        }
                      >
                        {(data.target.data as TargetUserDetail).status}
                      </Badge>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                    Target ID: {data.report.targetId}
                  </span>
                </div>

                {/* Target Content Rendering */}
                {data.target.isUnavailable && !data.target.data ? (
                  <div
                    style={{
                      padding: spacing.md,
                      backgroundColor: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.25)',
                      borderRadius: radius.md,
                      color: '#facc15',
                      fontSize: '0.8125rem',
                    }}
                  >
                    ⚠️ <strong>Notice:</strong> This target content or account does not exist or has
                    been physically removed from the system.
                  </div>
                ) : (
                  <div>
                    {data.target.type === 'USER' && data.target.data && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: radius.full,
                              backgroundColor: '#1e293b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.25rem',
                            }}
                          >
                            👤
                          </div>
                          <div>
                            <div style={{ fontWeight: fontWeights.semiBold, color: '#f8fafc' }}>
                              {(data.target.data as TargetUserDetail).displayName} (@
                              {(data.target.data as TargetUserDetail).username})
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {(data.target.data as TargetUserDetail).email} • Account Status:{' '}
                              {(data.target.data as TargetUserDetail).status}
                            </div>
                          </div>
                        </div>

                        {(data.target.data as TargetUserDetail).status === 'SUSPENDED' && (
                          <div
                            style={{
                              padding: spacing.sm,
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: radius.md,
                              color: '#fca5a5',
                              fontSize: '0.8125rem',
                            }}
                          >
                            🚫 <strong>Suspension Active:</strong> Suspended
                            {(data.target.data as TargetUserDetail).suspendedUntil
                              ? ` until ${new Date((data.target.data as TargetUserDetail).suspendedUntil!).toLocaleString()}`
                              : ' permanently'}
                            {(data.target.data as TargetUserDetail).suspensionReason
                              ? ` — Reason: "${(data.target.data as TargetUserDetail).suspensionReason}"`
                              : ''}
                          </div>
                        )}

                        {(data.target.data as TargetUserDetail).bio && (
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              color: '#cbd5e1',
                              marginTop: spacing.xs,
                            }}
                          >
                            <strong>Bio:</strong> {(data.target.data as TargetUserDetail).bio}
                          </div>
                        )}
                      </div>
                    )}

                    {data.target.type === 'POST' && data.target.data && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                        <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                          Author:{' '}
                          <strong>@{(data.target.data as TargetPostDetail).authorUsername}</strong>{' '}
                          ({(data.target.data as TargetPostDetail).authorDisplayName})
                        </div>

                        {(data.target.data as TargetPostDetail).isRemoved && (
                          <div
                            style={{
                              padding: spacing.sm,
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: radius.md,
                              color: '#fca5a5',
                              fontSize: '0.8125rem',
                            }}
                          >
                            🗑️ <strong>Removed Content:</strong> This post has been removed and is
                            hidden from normal user feeds and searches.
                          </div>
                        )}

                        {(data.target.data as TargetPostDetail).caption && (
                          <div
                            style={{
                              fontSize: '0.9375rem',
                              color: '#f8fafc',
                              padding: spacing.sm,
                              backgroundColor: '#1e293b',
                              borderRadius: radius.md,
                            }}
                          >
                            {(data.target.data as TargetPostDetail).caption}
                          </div>
                        )}
                        {(data.target.data as TargetPostDetail).imageUrl && (
                          <div style={{ marginTop: spacing.xs }}>
                            <img
                              src={(data.target.data as TargetPostDetail).imageUrl!}
                              alt="Reported Post"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '200px',
                                borderRadius: radius.md,
                                objectFit: 'contain',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {data.target.type === 'COMMENT' && data.target.data && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                        <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                          Author:{' '}
                          <strong>
                            @{(data.target.data as TargetCommentDetail).authorUsername}
                          </strong>{' '}
                          • Post ID: {(data.target.data as TargetCommentDetail).postId}
                        </div>

                        {(data.target.data as TargetCommentDetail).isRemoved && (
                          <div
                            style={{
                              padding: spacing.sm,
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: radius.md,
                              color: '#fca5a5',
                              fontSize: '0.8125rem',
                            }}
                          >
                            🗑️ <strong>Removed Comment:</strong> This comment has been removed and
                            is hidden from comment threads.
                          </div>
                        )}

                        <div
                          style={{
                            fontSize: '0.9375rem',
                            color: '#f8fafc',
                            padding: spacing.sm,
                            backgroundColor: '#1e293b',
                            borderRadius: radius.md,
                          }}
                        >
                          "{(data.target.data as TargetCommentDetail).content}"
                        </div>
                      </div>
                    )}

                    {/* Enforcement Action Trigger Buttons */}
                    <div
                      style={{
                        marginTop: spacing.md,
                        paddingTop: spacing.md,
                        borderTop: '1px solid #1f2937',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: spacing.sm,
                      }}
                    >
                      <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                        Eligible Enforcement Actions:
                      </span>
                      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                        {data.target.type === 'POST' && data.target.data && (
                          <>
                            {!(data.target.data as TargetPostDetail).isRemoved ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={enforcementSubmitting}
                                onClick={() => {
                                  setEnforcementAction('REMOVE_POST');
                                  setEnforcementReason('');
                                  setEnforcementConfirmed(false);
                                  setEnforcementError(null);
                                }}
                              >
                                🗑️ Remove Post
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={enforcementSubmitting}
                                onClick={() => {
                                  setEnforcementAction('RESTORE_POST');
                                  setEnforcementReason('');
                                  setEnforcementConfirmed(false);
                                  setEnforcementError(null);
                                }}
                              >
                                🔄 Restore Post
                              </Button>
                            )}
                          </>
                        )}

                        {data.target.type === 'COMMENT' && data.target.data && (
                          <>
                            {!(data.target.data as TargetCommentDetail).isRemoved ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={enforcementSubmitting}
                                onClick={() => {
                                  setEnforcementAction('REMOVE_COMMENT');
                                  setEnforcementReason('');
                                  setEnforcementConfirmed(false);
                                  setEnforcementError(null);
                                }}
                              >
                                🗑️ Remove Comment
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={enforcementSubmitting}
                                onClick={() => {
                                  setEnforcementAction('RESTORE_COMMENT');
                                  setEnforcementReason('');
                                  setEnforcementConfirmed(false);
                                  setEnforcementError(null);
                                }}
                              >
                                🔄 Restore Comment
                              </Button>
                            )}
                          </>
                        )}

                        {data.target.type === 'USER' && data.target.data && (
                          <>
                            {(data.target.data as TargetUserDetail).status !== 'SUSPENDED' ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={enforcementSubmitting}
                                onClick={() => {
                                  setEnforcementAction('SUSPEND_USER');
                                  setEnforcementReason('');
                                  setSuspensionDuration(7);
                                  setEnforcementConfirmed(false);
                                  setEnforcementError(null);
                                }}
                              >
                                🚫 Suspend Account
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={enforcementSubmitting}
                                onClick={() => {
                                  setEnforcementAction('UNSUSPEND_USER');
                                  setEnforcementReason('');
                                  setEnforcementConfirmed(false);
                                  setEnforcementError(null);
                                }}
                              >
                                ✅ Unsuspend Account
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enforcement Action Execution Form */}
              {enforcementAction && (
                <div
                  style={{
                    backgroundColor: '#161e2e',
                    border: '1px solid #3b82f6',
                    borderRadius: radius.xl,
                    padding: spacing.lg,
                  }}
                >
                  <h3
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: fontWeights.semiBold,
                      color: '#60a5fa',
                      margin: `0 0 ${spacing.sm} 0`,
                    }}
                  >
                    🛡️ Enforcement Action: {enforcementActionTitle(enforcementAction)}
                  </h3>
                  <p
                    style={{
                      margin: `0 0 ${spacing.md} 0`,
                      fontSize: '0.8125rem',
                      color: '#94a3b8',
                    }}
                  >
                    This action will immediately take effect on the live system and will be
                    permanently recorded in the moderation audit log.
                  </p>

                  {enforcementError && (
                    <div
                      style={{
                        padding: spacing.sm,
                        marginBottom: spacing.md,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: radius.md,
                        color: '#f87171',
                        fontSize: '0.8125rem',
                      }}
                    >
                      {enforcementError}
                    </div>
                  )}

                  {enforcementSuccess && (
                    <div
                      style={{
                        padding: spacing.sm,
                        marginBottom: spacing.md,
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: radius.md,
                        color: '#4ade80',
                        fontSize: '0.8125rem',
                      }}
                    >
                      ✓ {enforcementSuccess}
                    </div>
                  )}

                  {/* Suspension Duration Selector (for SUSPEND_USER) */}
                  {enforcementAction === 'SUSPEND_USER' && (
                    <div style={{ marginBottom: spacing.md }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.8125rem',
                          color: '#cbd5e1',
                          marginBottom: spacing.xs,
                        }}
                      >
                        Suspension Duration:
                      </label>
                      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                        {[
                          { label: '1 Day', days: 1 },
                          { label: '7 Days', days: 7 },
                          { label: '30 Days', days: 30 },
                          { label: 'Permanent', days: null },
                        ].map((opt) => (
                          <Button
                            key={opt.label}
                            variant={suspensionDuration === opt.days ? 'primary' : 'outline'}
                            size="sm"
                            type="button"
                            onClick={() => setSuspensionDuration(opt.days)}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Required Reason Input */}
                  <div style={{ marginBottom: spacing.md }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}
                    >
                      <label style={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>
                        Enforcement Reason <span style={{ color: '#f87171' }}>* (Required)</span>
                      </label>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color:
                            enforcementReason.length > 1000 || enforcementReason.length < 3
                              ? '#f87171'
                              : '#64748b',
                        }}
                      >
                        {enforcementReason.length} / 1000
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={enforcementReason}
                      onChange={(e) => setEnforcementReason(e.target.value)}
                      placeholder="Specify the administrative rationale, policy citation, or justification for this enforcement action..."
                      style={{
                        width: '100%',
                        backgroundColor: '#0f172a',
                        border: `1px solid ${
                          enforcementReason.length > 1000 ? '#ef4444' : '#334155'
                        }`,
                        borderRadius: radius.md,
                        color: '#f8fafc',
                        padding: spacing.sm,
                        fontSize: '0.875rem',
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Confirmation Checkbox */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.xs,
                      fontSize: '0.8125rem',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                      marginBottom: spacing.md,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={enforcementConfirmed}
                      onChange={(e) => setEnforcementConfirmed(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>
                      I confirm that this enforcement action complies with platform policy and will
                      be recorded with my administrator credentials.
                    </span>
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={enforcementSubmitting}
                      onClick={() => {
                        setEnforcementAction(null);
                        setEnforcementReason('');
                        setEnforcementConfirmed(false);
                        setEnforcementError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={enforcementSubmitting}
                      onClick={handleEnforcementAction}
                    >
                      {enforcementSubmitting ? 'Executing Enforcement...' : 'Execute Enforcement'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Status Update / Decision Workflow Section */}
              <div
                style={{
                  backgroundColor: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                }}
              >
                <h3
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: fontWeights.semiBold,
                    color: '#e2e8f0',
                    margin: `0 0 ${spacing.md} 0`,
                  }}
                >
                  ⚖️ Record Moderation Decision
                </h3>

                {actionError && (
                  <div
                    style={{
                      padding: spacing.sm,
                      marginBottom: spacing.md,
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: radius.md,
                      color: '#f87171',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {actionError}
                  </div>
                )}

                {actionSuccess && (
                  <div
                    style={{
                      padding: spacing.sm,
                      marginBottom: spacing.md,
                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: radius.md,
                      color: '#4ade80',
                      fontSize: '0.8125rem',
                    }}
                  >
                    ✓ {actionSuccess}
                  </div>
                )}

                <div style={{ marginBottom: spacing.md }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      color: '#94a3b8',
                      marginBottom: spacing.xs,
                    }}
                  >
                    Select Status Transition:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                    {getAvailableTransitions(data.report.status).map((status) => (
                      <Button
                        key={status}
                        variant={targetStatus === status ? 'primary' : 'outline'}
                        size="sm"
                        disabled={submitting}
                        onClick={() => {
                          setTargetStatus(status);
                          setActionError(null);
                        }}
                      >
                        {status === 'UNDER_REVIEW' && 'Mark Under Review'}
                        {status === 'RESOLVED' && 'Resolve Report'}
                        {status === 'DISMISSED' && 'Dismiss Report'}
                        {status === 'PENDING' && 'Return to Pending'}
                      </Button>
                    ))}
                  </div>
                </div>

                {targetStatus && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: spacing.md,
                      marginTop: spacing.md,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <label style={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>
                          Decision Note{' '}
                          {(targetStatus === 'RESOLVED' ||
                            targetStatus === 'DISMISSED' ||
                            data.report.status === 'RESOLVED' ||
                            data.report.status === 'DISMISSED') && (
                            <span style={{ color: '#f87171' }}>* (Required)</span>
                          )}
                        </label>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: decisionNote.length > 1000 ? '#f87171' : '#64748b',
                          }}
                        >
                          {decisionNote.length} / 1000
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder="Provide details regarding the findings, policy interpretation, or reason for this status change..."
                        style={{
                          width: '100%',
                          backgroundColor: '#0f172a',
                          border: `1px solid ${decisionNote.length > 1000 ? '#ef4444' : '#334155'}`,
                          borderRadius: radius.md,
                          color: '#f8fafc',
                          padding: spacing.sm,
                          fontSize: '0.875rem',
                          outline: 'none',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {(targetStatus === 'RESOLVED' || targetStatus === 'DISMISSED') && (
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          fontSize: '0.8125rem',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>
                          I confirm this moderation decision is final and will be preserved in the
                          audit log.
                        </span>
                      </label>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={submitting}
                        onClick={() => {
                          setTargetStatus(null);
                          setDecisionNote('');
                          setConfirmed(false);
                          setActionError(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={submitting}
                        onClick={handleStatusChange}
                      >
                        {submitting ? 'Applying Decision...' : `Confirm Update to ${targetStatus}`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Target Enforcement History Section */}
              <div
                style={{
                  backgroundColor: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                }}
              >
                <h3
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: fontWeights.semiBold,
                    color: '#e2e8f0',
                    margin: `0 0 ${spacing.md} 0`,
                  }}
                >
                  🛡️ Target Enforcement History ({moderationHistory.length})
                </h3>

                {loadingHistory ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                    Loading enforcement action records...
                  </p>
                ) : moderationHistory.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                    No prior enforcement actions recorded for this target.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                    {moderationHistory.map((action) => (
                      <div
                        key={action.id}
                        style={{
                          padding: spacing.sm,
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          borderRadius: radius.md,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.75rem',
                          }}
                        >
                          <span style={{ color: '#38bdf8', fontWeight: fontWeights.medium }}>
                            {action.actionType}
                          </span>
                          <span style={{ color: '#64748b' }}>
                            {new Date(action.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Administrator: {action.adminEmail || action.adminId}
                          {action.suspendedUntil && (
                            <span style={{ marginLeft: spacing.sm, color: '#f59e0b' }}>
                              Expires: {new Date(action.suspendedUntil).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {action.reason && (
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              color: '#cbd5e1',
                              marginTop: '2px',
                            }}
                          >
                            Reason: "{action.reason}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Report Audit Trail Section */}
              <div
                style={{
                  backgroundColor: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                }}
              >
                <h3
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: fontWeights.semiBold,
                    color: '#e2e8f0',
                    margin: `0 0 ${spacing.md} 0`,
                  }}
                >
                  📜 Report Audit Trail ({data.auditLogs.length})
                </h3>

                {data.auditLogs.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                    No audit records recorded yet. This report remains in initial PENDING status.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                    {data.auditLogs.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          padding: spacing.sm,
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          borderRadius: radius.md,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.75rem',
                          }}
                        >
                          <span style={{ color: '#38bdf8', fontWeight: fontWeights.medium }}>
                            {log.action} ({log.previousStatus} ➔ {log.newStatus})
                          </span>
                          <span style={{ color: '#64748b' }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Administrator: {log.adminEmail || log.adminId}
                        </div>
                        {log.decisionNote && (
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              color: '#cbd5e1',
                              fontStyle: 'italic',
                              marginTop: '2px',
                            }}
                          >
                            "{log.decisionNote}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: `${spacing.md} ${spacing.xl}`,
            borderTop: `1px solid ${colors.dark.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#0f172a',
          }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting || enforcementSubmitting}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
