-- AlterTable
ALTER TABLE "companies" ADD COLUMN "is_sales" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN "is_purchase" BOOLEAN NOT NULL DEFAULT false;
