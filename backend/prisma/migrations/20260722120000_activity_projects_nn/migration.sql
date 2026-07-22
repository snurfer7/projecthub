-- CreateTable
CREATE TABLE "activity_projects" (
    "activity_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_projects_pkey" PRIMARY KEY ("activity_id","project_id")
);

-- Migrate existing 1:N links
INSERT INTO "activity_projects" ("activity_id", "project_id", "created_at")
SELECT "id", "project_id", CURRENT_TIMESTAMP
FROM "activities"
WHERE "project_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "activity_projects_project_id_idx" ON "activity_projects"("project_id");

-- AddForeignKey
ALTER TABLE "activity_projects" ADD CONSTRAINT "activity_projects_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_projects" ADD CONSTRAINT "activity_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "activities_project_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "activities_project_id_idx";

-- AlterTable
ALTER TABLE "activities" DROP COLUMN IF EXISTS "project_id";
