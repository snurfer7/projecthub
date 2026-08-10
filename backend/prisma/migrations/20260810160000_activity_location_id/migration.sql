-- AlterTable
ALTER TABLE "activities" ADD COLUMN "location_id" INTEGER;

-- CreateIndex
CREATE INDEX "activities_location_id_idx" ON "activities"("location_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
