-- AlterTable
ALTER TABLE "users" ADD COLUMN "auth_method" TEXT NOT NULL DEFAULT 'password';
ALTER TABLE "users" ADD COLUMN "microsoft_oid" TEXT;
ALTER TABLE "users" ADD COLUMN "microsoft_tenant_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_microsoft_oid_key" ON "users"("microsoft_oid");
