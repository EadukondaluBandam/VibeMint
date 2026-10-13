import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  IReportsRepository,
  CreateReportData,
  Report,
  ReportTargetType,
  ReportAuditLog,
  AdminReportQueueResult,
  AdminReportDetailWithRelations,
  ReportStatsResult,
  UpdateReportStatusData,
  UpdateReportStatusResult,
} from './reports.types.js';
import type { ValidatedAdminReportQueueFilters } from '@vibemint/validation';
import { ConflictError, NotFoundError } from '../../errors/app-error.js';

export class PrismaReportsRepository implements IReportsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createReport(data: CreateReportData): Promise<Report> {
    return this.prisma.report.create({
      data: {
        reporterId: data.reporterId,
        targetType: data.targetType,
        targetId: data.targetId,
        reason: data.reason,
        description: data.description ?? null,
        status: 'PENDING',
      },
    });
  }

  async findReportById(id: string): Promise<Report | null> {
    return this.prisma.report.findUnique({
      where: { id },
    });
  }

  async findActiveReport(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<Report | null> {
    return this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType,
        targetId,
        status: {
          in: ['PENDING', 'UNDER_REVIEW'],
        },
      },
    });
  }

  async getUserReports(reporterId: string, cursor?: string, limit = 20): Promise<Report[]> {
    return this.prisma.report.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    });
  }

  async getAdminReportsQueue(
    filters: ValidatedAdminReportQueueFilters,
  ): Promise<AdminReportQueueResult> {
    const where: Prisma.ReportWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.targetType) {
      where.targetType = filters.targetType;
    }
    if (filters.reason) {
      where.reason = filters.reason;
    }
    if (filters.search) {
      where.OR = [
        { id: { contains: filters.search, mode: 'insensitive' } },
        { targetId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const limit = filters.limit ?? 20;

    const [items, totalCount] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        include: {
          reporter: {
            select: {
              id: true,
              email: true,
              createdAt: true,
            },
          },
        },
        ...(filters.cursor
          ? {
              cursor: { id: filters.cursor },
              skip: 1,
            }
          : {}),
      }),
      this.prisma.report.count({ where }),
    ]);

    const hasMore = items.length > limit;
    const reports = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && reports.length > 0 ? reports[reports.length - 1].id : null;

    return {
      reports,
      hasMore,
      nextCursor,
      totalCount,
    };
  }

  async getAdminReportDetail(reportId: string): Promise<AdminReportDetailWithRelations | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
        auditLogs: {
          include: {
            admin: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return report;
  }

  async getReportStats(): Promise<ReportStatsResult> {
    const [pending, underReview, resolved, dismissed, total] = await Promise.all([
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { status: 'UNDER_REVIEW' } }),
      this.prisma.report.count({ where: { status: 'RESOLVED' } }),
      this.prisma.report.count({ where: { status: 'DISMISSED' } }),
      this.prisma.report.count(),
    ]);

    return {
      pending,
      underReview,
      resolved,
      dismissed,
      total,
    };
  }

  async updateReportStatusAtomic(data: UpdateReportStatusData): Promise<UpdateReportStatusResult> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.report.findUnique({
        where: { id: data.reportId },
      });

      if (!current) {
        throw new NotFoundError('Report not found');
      }

      if (data.expectedStatus && current.status !== data.expectedStatus) {
        throw new ConflictError(
          `Report status has changed concurrently from ${data.expectedStatus} to ${current.status}`,
        );
      }

      // Idempotency: If new status equals current status, return without creating duplicate audit log
      if (current.status === data.newStatus) {
        const latestAudit = await tx.reportAuditLog.findFirst({
          where: { reportId: data.reportId },
          orderBy: { createdAt: 'desc' },
          include: {
            admin: {
              select: { id: true, email: true },
            },
          },
        });

        const fallbackAudit: ReportAuditLog = {
          id: crypto.randomUUID(),
          reportId: current.id,
          adminId: data.adminId,
          action: `STATUS_RETAINED_${data.newStatus}`,
          previousStatus: current.status,
          newStatus: current.status,
          decisionNote: data.decisionNote ?? null,
          createdAt: new Date(),
        };

        return {
          report: current,
          auditLog: latestAudit ?? fallbackAudit,
          isNoop: true,
        };
      }

      const isResolvedOrDismissed = data.newStatus === 'RESOLVED' || data.newStatus === 'DISMISSED';
      const resolvedAt = isResolvedOrDismissed ? new Date() : null;

      const updated = await tx.report.update({
        where: { id: data.reportId },
        data: {
          status: data.newStatus,
          resolvedAt,
        },
      });

      const auditLog = await tx.reportAuditLog.create({
        data: {
          reportId: data.reportId,
          adminId: data.adminId,
          action: `STATUS_CHANGE_TO_${data.newStatus}`,
          previousStatus: current.status,
          newStatus: data.newStatus,
          decisionNote: data.decisionNote ?? null,
        },
        include: {
          admin: {
            select: { id: true, email: true },
          },
        },
      });

      return {
        report: updated,
        auditLog,
        isNoop: false,
      };
    });
  }
}

export class InMemoryReportsRepository implements IReportsRepository {
  public reports: Map<string, Report> = new Map();
  public auditLogs: Map<string, ReportAuditLog & { admin?: { id: string; email: string } | null }> =
    new Map();
  public users: Map<string, { id: string; email: string; createdAt?: Date }>;
  private sequence = 0;

  constructor(
    initialReports?: Map<string, Report>,
    users?: Map<string, { id: string; email: string; createdAt?: Date }>,
  ) {
    if (initialReports) {
      this.reports = initialReports;
    }
    this.users = users ?? new Map();
  }

  async createReport(data: CreateReportData): Promise<Report> {
    const id = crypto.randomUUID();
    const now = new Date(Date.now() + this.sequence++);
    const report: Report = {
      id,
      reporterId: data.reporterId,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
      description: data.description ?? null,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    this.reports.set(id, report);
    return { ...report };
  }

  async findReportById(id: string): Promise<Report | null> {
    const report = this.reports.get(id);
    return report ? { ...report } : null;
  }

  async findActiveReport(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<Report | null> {
    for (const report of this.reports.values()) {
      if (
        report.reporterId === reporterId &&
        report.targetType === targetType &&
        report.targetId === targetId &&
        (report.status === 'PENDING' || report.status === 'UNDER_REVIEW')
      ) {
        return { ...report };
      }
    }
    return null;
  }

  async getUserReports(reporterId: string, cursor?: string, limit = 20): Promise<Report[]> {
    const userReports = Array.from(this.reports.values())
      .filter((r) => r.reporterId === reporterId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (cursor) {
      const idx = userReports.findIndex((r) => r.id === cursor);
      if (idx >= 0) {
        startIndex = idx + 1;
      }
    }

    return userReports.slice(startIndex, startIndex + limit + 1).map((r) => ({ ...r }));
  }

  private getReporterUser(reporterId: string) {
    const user = this.users.get(reporterId);
    if (user) {
      return {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt ?? new Date('2026-01-01'),
      };
    }
    return {
      id: reporterId,
      email: `${reporterId}@example.com`,
      createdAt: new Date('2026-01-01'),
    };
  }

  private getAdminUser(adminId: string) {
    const user = this.users.get(adminId);
    if (user) {
      return {
        id: user.id,
        email: user.email,
      };
    }
    return {
      id: adminId,
      email: `${adminId}@vibemint.internal`,
    };
  }

  async getAdminReportsQueue(
    filters: ValidatedAdminReportQueueFilters,
  ): Promise<AdminReportQueueResult> {
    let items = Array.from(this.reports.values());

    if (filters.status) {
      items = items.filter((r) => r.status === filters.status);
    }
    if (filters.targetType) {
      items = items.filter((r) => r.targetType === filters.targetType);
    }
    if (filters.reason) {
      items = items.filter((r) => r.reason === filters.reason);
    }
    if (filters.search) {
      const term = filters.search.toLowerCase();
      items = items.filter(
        (r) => r.id.toLowerCase().includes(term) || r.targetId.toLowerCase().includes(term),
      );
    }

    // Stable sort: createdAt desc, then id desc
    items.sort((a, b) => {
      const diff = b.createdAt.getTime() - a.createdAt.getTime();
      if (diff !== 0) return diff;
      return b.id.localeCompare(a.id);
    });

    const totalCount = items.length;

    let startIndex = 0;
    if (filters.cursor) {
      const idx = items.findIndex((r) => r.id === filters.cursor);
      if (idx >= 0) {
        startIndex = idx + 1;
      }
    }

    const limit = filters.limit ?? 20;
    const pageItems = items.slice(startIndex, startIndex + limit);
    const hasMore = items.length > startIndex + limit;
    const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;

    const reports = pageItems.map((r) => ({
      ...r,
      reporter: this.getReporterUser(r.reporterId),
    }));

    return {
      reports,
      hasMore,
      nextCursor,
      totalCount,
    };
  }

  async getAdminReportDetail(reportId: string): Promise<AdminReportDetailWithRelations | null> {
    const report = this.reports.get(reportId);
    if (!report) return null;

    const auditLogs = Array.from(this.auditLogs.values())
      .filter((log) => log.reportId === reportId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      ...report,
      reporter: this.getReporterUser(report.reporterId),
      auditLogs: auditLogs.map((log) => ({
        ...log,
        admin: this.getAdminUser(log.adminId),
      })),
    };
  }

  async getReportStats(): Promise<ReportStatsResult> {
    let pending = 0;
    let underReview = 0;
    let resolved = 0;
    let dismissed = 0;

    for (const report of this.reports.values()) {
      switch (report.status) {
        case 'PENDING':
          pending++;
          break;
        case 'UNDER_REVIEW':
          underReview++;
          break;
        case 'RESOLVED':
          resolved++;
          break;
        case 'DISMISSED':
          dismissed++;
          break;
      }
    }

    return {
      pending,
      underReview,
      resolved,
      dismissed,
      total: this.reports.size,
    };
  }

  async updateReportStatusAtomic(data: UpdateReportStatusData): Promise<UpdateReportStatusResult> {
    const current = this.reports.get(data.reportId);
    if (!current) {
      throw new NotFoundError('Report not found');
    }

    if (data.expectedStatus && current.status !== data.expectedStatus) {
      throw new ConflictError(
        `Report status has changed concurrently from ${data.expectedStatus} to ${current.status}`,
      );
    }

    // Idempotency: Return existing without duplicate audit log
    if (current.status === data.newStatus) {
      const logs = Array.from(this.auditLogs.values())
        .filter((l) => l.reportId === data.reportId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const latestAudit = logs[0] ?? {
        id: crypto.randomUUID(),
        reportId: current.id,
        adminId: data.adminId,
        action: `STATUS_RETAINED_${data.newStatus}`,
        previousStatus: current.status,
        newStatus: current.status,
        decisionNote: data.decisionNote ?? null,
        createdAt: new Date(),
        admin: this.getAdminUser(data.adminId),
      };

      return {
        report: { ...current },
        auditLog: { ...latestAudit },
        isNoop: true,
      };
    }

    const now = new Date(Date.now() + this.sequence++);
    const isResolvedOrDismissed = data.newStatus === 'RESOLVED' || data.newStatus === 'DISMISSED';
    const resolvedAt = isResolvedOrDismissed ? now : null;

    const updated: Report = {
      ...current,
      status: data.newStatus,
      updatedAt: now,
      resolvedAt,
    };
    this.reports.set(data.reportId, updated);

    const auditLogId = crypto.randomUUID();
    const auditLog: ReportAuditLog & { admin?: { id: string; email: string } | null } = {
      id: auditLogId,
      reportId: data.reportId,
      adminId: data.adminId,
      action: `STATUS_CHANGE_TO_${data.newStatus}`,
      previousStatus: current.status,
      newStatus: data.newStatus,
      decisionNote: data.decisionNote ?? null,
      createdAt: now,
      admin: this.getAdminUser(data.adminId),
    };
    this.auditLogs.set(auditLogId, auditLog);

    return {
      report: { ...updated },
      auditLog: { ...auditLog },
      isNoop: false,
    };
  }
}
