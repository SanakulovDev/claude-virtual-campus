-- Make runtime identity explicit so Claude Code and Codex sessions can coexist safely.
ALTER TABLE "ClaudeSession" ADD COLUMN "runtime" TEXT NOT NULL DEFAULT 'claude';
ALTER TABLE "ProjectAgent" ADD COLUMN "runtime" TEXT NOT NULL DEFAULT 'claude';
ALTER TABLE "ProjectAgent" ADD COLUMN "currentTool" TEXT;
ALTER TABLE "ProjectAgent" ADD COLUMN "currentFile" TEXT;
ALTER TABLE "ProjectAgent" ADD COLUMN "currentCommandSummary" TEXT;
ALTER TABLE "ProjectAgent" ADD COLUMN "commandCategory" TEXT;
ALTER TABLE "ClaudeEvent" ADD COLUMN "runtime" TEXT NOT NULL DEFAULT 'claude';
ALTER TABLE "ApprovalRequest" ADD COLUMN "runtime" TEXT NOT NULL DEFAULT 'claude';
ALTER TABLE "ToolExecution" ADD COLUMN "externalToolUseId" TEXT;

DROP INDEX "ClaudeSession_externalSessionId_key";
CREATE UNIQUE INDEX "ClaudeSession_runtime_externalSessionId_key"
  ON "ClaudeSession"("runtime", "externalSessionId");
CREATE INDEX "ToolExecution_sessionId_externalToolUseId_idx"
  ON "ToolExecution"("sessionId", "externalToolUseId");
