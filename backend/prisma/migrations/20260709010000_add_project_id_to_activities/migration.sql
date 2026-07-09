-- AlterTable
ALTER TABLE "activities" ADD COLUMN "project_id" INTEGER;

-- CreateIndex
CREATE INDEX "activities_project_id_idx" ON "activities"("project_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
