-- AlterTable
ALTER TABLE "users" ADD COLUMN "suspended_at" TIMESTAMP(3),
ADD COLUMN "suspended_until" TIMESTAMP(3),
ADD COLUMN "suspension_reason" TEXT;

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('REMOVE_POST', 'RESTORE_POST', 'REMOVE_COMMENT', 'RESTORE_COMMENT', 'SUSPEND_USER', 'UNSUSPEND_USER');

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "action_type" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "report_id" TEXT,
    "suspended_until" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_actions_target_type_target_id_created_at_idx" ON "moderation_actions"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_actions_admin_id_created_at_idx" ON "moderation_actions"("admin_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_actions_report_id_idx" ON "moderation_actions"("report_id");

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
