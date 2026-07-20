-- AlterEnum
-- New enum values must be committed before they can be used (Postgres restriction);
-- kept in its own migration so the next one can safely default a column to 'QUEUED'.
ALTER TYPE "RunStatus" ADD VALUE 'QUEUED';
ALTER TYPE "RunStatus" ADD VALUE 'STARTING';
ALTER TYPE "RunStatus" ADD VALUE 'STOPPING';
ALTER TYPE "RunStatus" ADD VALUE 'TIMED_OUT';
