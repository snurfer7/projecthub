-- CreateTable
CREATE TABLE "issue_assignees" (
    "issue_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_assignees_pkey" PRIMARY KEY ("issue_id","user_id")
);

-- Migrate existing 1:1 assignee links
INSERT INTO "issue_assignees" ("issue_id", "user_id", "created_at")
SELECT "id", "assigned_to_id", CURRENT_TIMESTAMP
FROM "issues"
WHERE "assigned_to_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "issue_assignees_user_id_idx" ON "issue_assignees"("user_id");

-- AddForeignKey
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_assigned_to_id_fkey";

-- AlterTable
ALTER TABLE "issues" DROP COLUMN IF EXISTS "assigned_to_id";
