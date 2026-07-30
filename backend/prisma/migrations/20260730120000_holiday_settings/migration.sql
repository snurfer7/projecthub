-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN "holiday_weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[0, 6]::INTEGER[],
ADD COLUMN "holidays" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "workdays" JSONB NOT NULL DEFAULT '[]';
