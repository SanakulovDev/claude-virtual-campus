-- AlterTable
ALTER TABLE "ProjectAgent" ADD COLUMN     "activitySource" TEXT NOT NULL DEFAULT 'real-work',
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "customName" TEXT,
ADD COLUMN     "generatedName" TEXT;
