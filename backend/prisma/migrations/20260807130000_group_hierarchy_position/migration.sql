-- AlterTable
ALTER TABLE "groups" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "group_hierarchies" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
