import type { ModerationAction, ReportTargetType, ModerationActionType } from '@prisma/client';
import type {
  ModerationActionSummary,
  ModerationHistoryResponse,
  AdminRemoveContentRequest,
  AdminRestoreContentRequest,
  AdminSuspendUserRequest,
  AdminUnsuspendUserRequest,
  AdminEnforcementActionResult,
} from '@vibemint/types';

export type {
  ModerationActionSummary,
  ModerationHistoryResponse,
  AdminRemoveContentRequest,
  AdminRestoreContentRequest,
  AdminSuspendUserRequest,
  AdminUnsuspendUserRequest,
  AdminEnforcementActionResult,
};

export interface ModerationActionWithAdmin extends ModerationAction {
  admin: {
    id: string;
    email: string;
    profile?: {
      username: string;
      displayName: string;
    } | null;
  };
}

export interface CreateModerationActionData {
  adminId: string;
  targetType: ReportTargetType;
  targetId: string;
  actionType: ModerationActionType;
  reason: string;
  reportId?: string | null;
  suspendedUntil?: Date | null;
  metadata?: Record<string, unknown> | null;
}

export interface IModerationRepository {
  createAction(data: CreateModerationActionData): Promise<ModerationActionWithAdmin>;
  getActionsForTarget(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<ModerationActionWithAdmin[]>;
  getActionById(id: string): Promise<ModerationActionWithAdmin | null>;
}
