-- AlterTable
ALTER TABLE "activities" ADD COLUMN "file_comment_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "activities_file_comment_id_key" ON "activities"("file_comment_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_file_comment_id_fkey" FOREIGN KEY ("file_comment_id") REFERENCES "company_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
