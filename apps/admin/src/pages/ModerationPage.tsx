import { useState, useEffect, useCallback, type FC } from 'react';
import { radius, spacing, fontWeights } from '@vibemint/design-tokens';
import {
  type AdminReportSummary,
  type ReportStatus,
  type ReportTargetType,
  type ReportReason,
  type AdminReportStatsResponse,
  REPORT_REASONS,
} from '@vibemint/types';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { adminModerationService } from '../services/adminModerationService';
import { ReportDetailModal } from '../components/moderation/ReportDetailModal';

const getStatusBadge = (status: ReportStatus): BadgeVariant => {
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

export const ModerationPage: FC = () => {
  // Stats state
  const [stats, setStats] = useState<AdminReportStatsResponse['counts'] | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Queue state
  const [reports, setReports] = useState<AdminReportSummary[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Filters state
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<ReportTargetType | ''>('');
  const [reasonFilter, setReasonFilter] = useState<ReportReason | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected report for review modal
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await adminModerationService.getStats();
      setStats(res.counts);
    } catch (err: unknown) {
      setStatsError(err instanceof Error ? err.message : 'Failed to fetch summary metrics');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchQueue = useCallback(
    async (cursor?: string) => {
      setQueueLoading(true);
      setQueueError(null);
      try {
        const res = await adminModerationService.getReportsQueue({
          status: statusFilter || undefined,
          targetType: targetTypeFilter || undefined,
          reason: reasonFilter || undefined,
          search: searchQuery.trim() || undefined,
          cursor,
          limit: 15,
        });

        if (cursor) {
          setReports((prev) => [...prev, ...res.reports]);
        } else {
          setReports(res.reports);
        }
        setNextCursor(res.pagination.nextCursor);
        setHasMore(res.pagination.hasMore);
      } catch (err: unknown) {
        setQueueError(err instanceof Error ? err.message : 'Failed to fetch moderation queue');
      } finally {
        setQueueLoading(false);
      }
    },
    [statusFilter, targetTypeFilter, reasonFilter, searchQuery],
  );

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const handleResetFilters = () => {
    setStatusFilter('');
    setTargetTypeFilter('');
    setReasonFilter('');
    setSearchQuery('');
  };

  const handleReportUpdated = () => {
    void fetchStats();
    void fetchQueue();
  };

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xl,
      }}
    >
      {/* Page Title */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.xs,
          }}
        >
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: fontWeights.bold,
              color: '#f8fafc',
              margin: 0,
            }}
          >
            Moderation Queue & Review Workflow
          </h1>
          <Badge variant="info">Production Workflow</Badge>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.9375rem', margin: 0 }}>
          Review reported users, posts, and comments, inspect target contexts, record decisions, and
          maintain an auditable moderation history.
        </p>
      </div>

      {/* Moderation Metrics Dashboard */}
      <div>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: fontWeights.semiBold,
            color: '#e2e8f0',
            marginBottom: spacing.md,
          }}
        >
          📊 Report Status Overview
        </h2>

        {statsError && (
          <div
            style={{
              padding: spacing.md,
              marginBottom: spacing.md,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: radius.md,
              color: '#f87171',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Failed to load moderation statistics: {statsError}</span>
            <Button variant="outline" size="sm" onClick={fetchStats}>
              Retry
            </Button>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: spacing.md,
          }}
        >
          {/* Pending */}
          <Card
            style={{
              padding: spacing.lg,
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: radius.xl,
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Pending Review
            </span>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: fontWeights.bold,
                color: '#facc15',
                marginTop: '4px',
              }}
            >
              {statsLoading ? '...' : (stats?.pending ?? 0)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Requires moderator attention
            </span>
          </Card>

          {/* Under Review */}
          <Card
            style={{
              padding: spacing.lg,
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: radius.xl,
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Under Investigation
            </span>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: fontWeights.bold,
                color: '#38bdf8',
                marginTop: '4px',
              }}
            >
              {statsLoading ? '...' : (stats?.underReview ?? 0)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              In-progress investigations
            </span>
          </Card>

          {/* Resolved */}
          <Card
            style={{
              padding: spacing.lg,
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: radius.xl,
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Resolved
            </span>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: fontWeights.bold,
                color: '#4ade80',
                marginTop: '4px',
              }}
            >
              {statsLoading ? '...' : (stats?.resolved ?? 0)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Remediated or policy enforced
            </span>
          </Card>

          {/* Dismissed */}
          <Card
            style={{
              padding: spacing.lg,
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: radius.xl,
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Dismissed
            </span>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: fontWeights.bold,
                color: '#94a3b8',
                marginTop: '4px',
              }}
            >
              {statsLoading ? '...' : (stats?.dismissed ?? 0)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No violation found</span>
          </Card>

          {/* Total */}
          <Card
            style={{
              padding: spacing.lg,
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: radius.xl,
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Total Reports
            </span>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: fontWeights.bold,
                color: '#f8fafc',
                marginTop: '4px',
              }}
            >
              {statsLoading ? '...' : (stats?.total ?? 0)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>All-time submissions</span>
          </Card>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card
        style={{
          padding: spacing.lg,
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: radius.xl,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.md,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: spacing.md,
          }}
        >
          {/* Status filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginBottom: '4px',
              }}
            >
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReportStatus | '')}
              style={{
                width: '100%',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: radius.md,
                padding: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>

          {/* Target Type filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginBottom: '4px',
              }}
            >
              Target Type
            </label>
            <select
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value as ReportTargetType | '')}
              style={{
                width: '100%',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: radius.md,
                padding: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            >
              <option value="">All Targets</option>
              <option value="USER">User Account</option>
              <option value="POST">Post</option>
              <option value="COMMENT">Comment</option>
            </select>
          </div>

          {/* Reason filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginBottom: '4px',
              }}
            >
              Reason Filter
            </label>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value as ReportReason | '')}
              style={{
                width: '100%',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: radius.md,
                padding: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            >
              <option value="">All Reasons</option>
              {REPORT_REASONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search query */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginBottom: '4px',
              }}
            >
              Search Report ID or Target ID
            </label>
            <input
              type="text"
              placeholder="Enter ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: radius.md,
                padding: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            Clear Filters
          </Button>
          <Button variant="primary" size="sm" onClick={() => fetchQueue()}>
            Apply Filters
          </Button>
        </div>
      </Card>

      {/* Reports Queue Table */}
      <Card
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: radius.xl,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: `${spacing.lg} ${spacing.xl}`,
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontSize: '1.125rem',
              fontWeight: fontWeights.semiBold,
              color: '#f8fafc',
              margin: 0,
            }}
          >
            Reports Queue ({reports.length})
          </h2>
          {queueLoading && (
            <span style={{ fontSize: '0.8125rem', color: '#38bdf8' }}>Refreshing...</span>
          )}
        </div>

        {queueError && (
          <div
            style={{
              margin: spacing.lg,
              padding: spacing.md,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: radius.md,
              color: '#f87171',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Failed to load reports: {queueError}</span>
            <Button variant="outline" size="sm" onClick={() => fetchQueue()}>
              Retry
            </Button>
          </div>
        )}

        {reports.length === 0 && !queueLoading && (
          <div style={{ padding: spacing['2xl'], textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '2rem', marginBottom: spacing.xs }}>🛡️</div>
            <h3 style={{ fontSize: '1rem', color: '#f8fafc', margin: '0 0 4px 0' }}>
              No reports match the current filter
            </h3>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
              Try adjusting or resetting your filter criteria to view more reports.
            </p>
          </div>
        )}

        {reports.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid #1e293b',
                    backgroundColor: '#111827',
                    color: '#94a3b8',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: `${spacing.md} ${spacing.lg}` }}>Status</th>
                  <th style={{ padding: `${spacing.md} ${spacing.lg}` }}>Target Context</th>
                  <th style={{ padding: `${spacing.md} ${spacing.lg}` }}>Reason</th>
                  <th style={{ padding: `${spacing.md} ${spacing.lg}` }}>Reporter</th>
                  <th style={{ padding: `${spacing.md} ${spacing.lg}` }}>Submitted</th>
                  <th style={{ padding: `${spacing.md} ${spacing.lg}`, textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      backgroundColor: 'transparent',
                    }}
                  >
                    <td style={{ padding: `${spacing.md} ${spacing.lg}` }}>
                      <Badge variant={getStatusBadge(report.status)}>{report.status}</Badge>
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}` }}>
                      <div style={{ fontWeight: fontWeights.medium, color: '#f8fafc' }}>
                        {report.targetSummary?.title || `${report.targetType} Target`}
                      </div>
                      <div
                        style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}
                      >
                        {report.targetType}: {report.targetId.slice(0, 10)}...
                      </div>
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, color: '#cbd5e1' }}>
                      {report.reason}
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, color: '#94a3b8' }}>
                      {report.reporter.email}
                    </td>
                    <td
                      style={{
                        padding: `${spacing.md} ${spacing.lg}`,
                        color: '#64748b',
                        fontSize: '0.8125rem',
                      }}
                    >
                      {new Date(report.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, textAlign: 'right' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setSelectedReportId(report.id)}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && (
          <div style={{ padding: spacing.lg, textAlign: 'center', borderTop: '1px solid #1e293b' }}>
            <Button
              variant="outline"
              size="sm"
              disabled={queueLoading}
              onClick={() => {
                if (nextCursor) {
                  void fetchQueue(nextCursor);
                }
              }}
            >
              {queueLoading ? 'Loading...' : 'Load Next Page'}
            </Button>
          </div>
        )}
      </Card>

      {/* Review & Decision Modal */}
      {selectedReportId && (
        <ReportDetailModal
          reportId={selectedReportId}
          onClose={() => setSelectedReportId(null)}
          onReportUpdated={handleReportUpdated}
        />
      )}
    </div>
  );
};
