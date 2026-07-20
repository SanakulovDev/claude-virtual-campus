-- AlterTable
ALTER TABLE "CampusRun" ADD COLUMN     "cacheCreationTokens" INTEGER,
ADD COLUMN     "cacheReadTokens" INTEGER,
ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "costUsd" DECIMAL(10,6),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "parentRunId" TEXT,
ADD COLUMN     "permissionMode" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "skippedLines" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usageJson" JSONB,
ALTER COLUMN "status" SET DEFAULT 'QUEUED',
ALTER COLUMN "startedAt" DROP NOT NULL,
ALTER COLUMN "startedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RunEvent_runId_seq_key" ON "RunEvent"("runId", "seq");

-- CreateIndex
CREATE INDEX "CampusRun_status_createdAt_idx" ON "CampusRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CampusRun_projectId_status_idx" ON "CampusRun"("projectId", "status");

-- CreateIndex
CREATE INDEX "CampusRun_conversationId_idx" ON "CampusRun"("conversationId");

-- AddForeignKey
ALTER TABLE "CampusRun" ADD CONSTRAINT "CampusRun_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "CampusRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunEvent" ADD CONSTRAINT "RunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CampusRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
