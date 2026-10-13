-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "blocks_no_self_block" CHECK ("blocker_id" <> "blocked_user_id")
);

-- CreateIndex
CREATE INDEX "blocks_blocker_id_blocked_user_id_idx" ON "blocks"("blocker_id", "blocked_user_id");

-- CreateIndex
CREATE INDEX "blocks_blocked_user_id_blocker_id_idx" ON "blocks"("blocked_user_id", "blocker_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_id_blocked_user_id_key" ON "blocks"("blocker_id", "blocked_user_id");

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
