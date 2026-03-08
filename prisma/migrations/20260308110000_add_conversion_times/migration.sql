-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "conversionTimes" DOUBLE PRECISION[] NOT NULL DEFAULT '{}';
