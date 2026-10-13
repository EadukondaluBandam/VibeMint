import type {
  Report,
  ReportTargetType,
  ReportReason,
  ReportStatus,
  ReportAuditLog,
} from '@prisma/client';
import type { ValidatedAdminReportQueueFilters } from '@vibemint/validation';

export type { Report, ReportTargetType, ReportReason, ReportStatus, ReportAuditLog };

export interface CreateReportData {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string | null;
}

export interface AdminReportWithReporter extends Report {
  reporter: {
    id: string;
    email: string;
    createdAt?: Date;
  };
}

export interface AdminReportDetailWithRelations extends Report {
  reporter: {
    id: string;
    email: string;
    createdAt: Date;
  };
  auditLogs: (ReportAuditLog & {
    admin?: {
      id: string;
      email: string;
    } | null;
  })[];
}

export interface AdminReportQueueResult {
  reports: AdminReportWithReporter[];
  hasMore: boolean;
  nextCursor: string | null;
  totalCount?: number;
}

export interface ReportStatsResult {
  pending: number;
  underReview: number;
  resolved: number;
  dismissed: number;
  total: number;
}

export interface UpdateReportStatusData {
  reportId: string;
  adminId: string;
  newStatus: ReportStatus;
  decisionNote?: string | null;
  expectedStatus?: ReportStatus;
}

export interface UpdateReportStatusResult {
  report: Report;
  auditLog: ReportAuditLog & { admin?: { id: string; email: string } | null };
  isNoop: boolean;
}

export interface IReportsRepository {
  createReport(data: CreateReportData): Promise<Report>;
  findReportById(id: string): Promise<Report | null>;
  findActiveReport(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<Report | null>;
  getUserReports(reporterId: string, cursor?: string, limit?: number): Promise<Report[]>;
  getAdminReportsQueue(filters: ValidatedAdminReportQueueFilters): Promise<AdminReportQueueResult>;
  getAdminReportDetail(reportId: string): Promise<AdminReportDetailWithRelations | null>;
  getReportStats(): Promise<ReportStatsResult>;
  updateReportStatusAtomic(data: UpdateReportStatusData): Promise<UpdateReportStatusResult>;
}
