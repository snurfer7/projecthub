-- CreateIndex
CREATE INDEX "issues_project_id_idx" ON "issues"("project_id");

-- CreateIndex
CREATE INDEX "time_entries_project_id_spent_on_idx" ON "time_entries"("project_id", "spent_on");

-- CreateIndex
CREATE INDEX "time_entries_issue_id_idx" ON "time_entries"("issue_id");

-- CreateIndex
CREATE INDEX "time_entries_user_id_idx" ON "time_entries"("user_id");
