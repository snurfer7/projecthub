-- AlterTable: estimated_hours INTEGER -> DOUBLE PRECISION (0.5 increments)
ALTER TABLE "issues" ALTER COLUMN "estimated_hours" SET DATA TYPE DOUBLE PRECISION;
